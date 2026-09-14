// A tiny in-memory stand-in for dsh-api and for UserAuth's login redirect.
// It exists so the portal can be developed and smoke-tested without a
// cluster; nothing here is ever deployed. Zero dependencies on purpose.
//
//   node mock/server.mjs            # listens on MOCK_PORT (default 4000)
//
// Implements the dsh-api contract the portal codes against:
//   GET    /api/v1/limits
//   GET    /api/v1/servers
//   POST   /api/v1/servers                 201 | 409 taken | 403 at cap | 422 invalid
//   GET    /api/v1/servers/{name}
//   POST   /api/v1/servers/{name}/wake     202
//   DELETE /api/v1/servers/{name}          204 | 409 players online (unless ?force=true)
//   GET    /api/v1/me                      { username, is_admin }  (admin when the username is "admin")
//   POST   /api/v1/feedback                201 | 422 message missing/too long | 429 more than 10 an hour
//   GET    /api/v1/feedback?status=new|read|all   admin only (403), newest first
//   PATCH  /api/v1/feedback/{id}           { status: "read" | "new" }  admin only (403) | 404
// plus a fake UserAuth (the same REST shape as the real one, in memory):
//   POST   /userauth/register              201 | 400 rules | 409 taken
//   POST   /userauth/login                 200 { token, tokenType, expiresAt, refreshToken } | 401
//   GET    /userauth/session/validate      200 | 401
//   POST   /userauth/logout                204, revokes the bearer
// and test-only controls:
//   POST   /mock/servers/{name}/state      { state, players_online } (simulate a player joining)
//   POST   /mock/reset
//   POST   /mock/feedback/reset            clear feedback and the rate-limit counters only
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4000);
const WAKE_MS = Number(process.env.MOCK_WAKE_MS || 3000);
const NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;
const ADMIN_USERNAME = "admin";
const FEEDBACK_MAX_LENGTH = 4000;
const FEEDBACK_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

const LIMITS = {
  heap: "3G",
  memory_limit: "3.5Gi",
  world_quota: "5Gi",
  idle_minutes: 20,
  max_awake: 12,
  max_registered: 40,
  archive_after_days: 60,
  backup_retention_days: 14,
  minecraft_version: "26.2",
  max_servers_per_tenant: 1,
};

/** @type {Map<string, Map<string, object>>} tenant -> name -> server */
const tenants = new Map();
const wakeTimers = new Map();
/** @type {Map<string, {id: number, username: string, password: string, email: string|null, createdAt: string}>} lowercased username -> user */
const users = new Map();
/** @type {Map<string, {username: string, issuedAt: string, expiresAt: string}>} token -> session */
const sessions = new Map();
const TOKEN_TTL_MS = 60 * 60 * 1000;
/** @type {Array<{id: number, username: string, message: string, page: string|null, created_at: string, status: "new"|"read"}>} newest last */
let feedback = [];
let nextFeedbackId = 1;
/** @type {Map<string, number[]>} username -> submission times (ms) within the last hour */
const feedbackTimes = new Map();

function isAdmin(username) {
  return username.toLowerCase() === ADMIN_USERNAME;
}

function resetFeedback() {
  feedback = [];
  nextFeedbackId = 1;
  feedbackTimes.clear();
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function issueToken(username) {
  const now = Date.now();
  const header = b64url({ alg: "none", typ: "JWT" });
  const payload = b64url({
    sub: username,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TOKEN_TTL_MS) / 1000),
    iss: "mock-userauth",
  });
  const token = `${header}.${payload}.${Math.random().toString(36).slice(2)}`;
  sessions.set(token, { username, issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + TOKEN_TTL_MS).toISOString() });
  return token;
}

function bearerOf(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  return m ? m[1] : null;
}

/** The username behind a live, unrevoked token, or null. */
function sessionOf(req) {
  const token = bearerOf(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return { token, ...session };
}

function tenantOf(req) {
  return sessionOf(req)?.username ?? null;
}

function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 72) return "password must be 8-72 characters";
  if (!/[a-z]/.test(password)) return "password must contain a lowercase letter";
  if (!/[A-Z]/.test(password)) return "password must contain an uppercase letter";
  if (!/[0-9]/.test(password)) return "password must contain a digit";
  if (!/[^A-Za-z0-9]/.test(password)) return "password must contain a special character";
  return null;
}

function serversFor(tenant) {
  if (!tenants.has(tenant)) tenants.set(tenant, new Map());
  return tenants.get(tenant);
}

function findServer(name) {
  for (const servers of tenants.values()) {
    if (servers.has(name)) return servers.get(name);
  }
  return null;
}

function publicView(server) {
  // admin_password is only ever returned once, on creation; operator_username is write-only.
  const rest = { ...server };
  delete rest.admin_password;
  delete rest.operator_username;
  return rest;
}

function send(res, status, body, headers = {}) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    ...headers,
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

function scheduleWake(server) {
  clearTimeout(wakeTimers.get(server.name));
  wakeTimers.set(
    server.name,
    setTimeout(() => {
      if (server.state === "waking") {
        server.state = "awake";
        server.players_online = 0;
      }
    }, WAKE_MS),
  );
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;
  const method = req.method || "GET";

  if (method === "OPTIONS") return send(res, 204);

  // ---- fake UserAuth ----
  if (pathname === "/userauth/register" && method === "POST") {
    const body = await readJson(req);
    if (!body) return send(res, 400, { message: "body must be JSON" });
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (username.length < 3 || username.length > 50) return send(res, 400, { message: "username must be 3-50 characters" });
    const problem = passwordProblem(body.password);
    if (problem) return send(res, 400, { message: problem });
    const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
    if (email && !/^[^@\s]+@[^@\s]+$/.test(email)) return send(res, 400, { message: "email is not valid" });
    if (users.has(username.toLowerCase())) return send(res, 409, { message: "username is already taken" });
    if (email && [...users.values()].some((u) => u.email?.toLowerCase() === email.toLowerCase())) {
      return send(res, 409, { message: "email is already taken" });
    }
    const user = { id: users.size + 1, username, password: body.password, email, createdAt: new Date().toISOString() };
    users.set(username.toLowerCase(), user);
    return send(res, 201, { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt });
  }
  if (pathname === "/userauth/login" && method === "POST") {
    const body = await readJson(req);
    if (!body || typeof body.username !== "string" || typeof body.password !== "string" || !body.username || !body.password) {
      return send(res, 400, { message: "username and password are required" });
    }
    const user = users.get(body.username.trim().toLowerCase());
    if (!user || user.password !== body.password) return send(res, 401, { message: "invalid username or password" });
    const token = issueToken(user.username);
    const session = sessions.get(token);
    return send(res, 200, { token, tokenType: "Bearer", expiresAt: session.expiresAt, refreshToken: `refresh-${Math.random().toString(36).slice(2)}` });
  }
  if (pathname === "/userauth/session/validate" && method === "GET") {
    const session = sessionOf(req);
    if (!session) return send(res, 401, { message: "invalid or expired token" });
    return send(res, 200, { valid: true, username: session.username, roles: ["USER"], issuedAt: session.issuedAt, expiresAt: session.expiresAt });
  }
  if (pathname === "/userauth/logout" && method === "POST") {
    const token = bearerOf(req);
    if (!token || !sessions.has(token)) return send(res, 401, { message: "invalid or expired token" });
    sessions.delete(token);
    return send(res, 204);
  }

  // ---- test-only controls ----
  if (method === "POST" && pathname === "/mock/reset") {
    tenants.clear();
    users.clear();
    sessions.clear();
    for (const t of wakeTimers.values()) clearTimeout(t);
    wakeTimers.clear();
    resetFeedback();
    return send(res, 204);
  }
  if (method === "POST" && pathname === "/mock/feedback/reset") {
    resetFeedback();
    return send(res, 204);
  }
  let m = /^\/mock\/servers\/([^/]+)\/state$/.exec(pathname);
  if (m && method === "POST") {
    const server = findServer(m[1]);
    if (!server) return send(res, 404, { message: "no such server" });
    const body = await readJson(req);
    if (body?.state) server.state = body.state;
    if (body?.players_online !== undefined) server.players_online = body.players_online;
    if (body?.state === "awake" && !server.last_woken) server.last_woken = new Date().toISOString();
    return send(res, 200, publicView(server));
  }

  // ---- dsh-api ----
  if (pathname === "/api/v1/limits" && method === "GET") return send(res, 200, LIMITS);

  if (!pathname.startsWith("/api/v1/servers") && !pathname.startsWith("/api/v1/feedback") && pathname !== "/api/v1/me") {
    return send(res, 404, { message: "not found" });
  }

  const tenant = tenantOf(req);
  if (!tenant) return send(res, 401, { message: "a valid bearer token is required" });

  if (pathname === "/api/v1/me" && method === "GET") return send(res, 200, { username: tenant, is_admin: isAdmin(tenant) });

  // ---- feedback ----
  if (pathname === "/api/v1/feedback" && method === "POST") {
    const body = await readJson(req);
    if (!body) return send(res, 400, { message: "body must be JSON" });
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > FEEDBACK_MAX_LENGTH) {
      return send(res, 422, { message: `message must be 1-${FEEDBACK_MAX_LENGTH} characters` });
    }
    const page = typeof body.page === "string" && body.page ? body.page.slice(0, 200) : null;
    const now = Date.now();
    const recent = (feedbackTimes.get(tenant) ?? []).filter((t) => now - t < HOUR_MS);
    if (recent.length >= FEEDBACK_PER_HOUR) {
      return send(res, 429, { message: `at most ${FEEDBACK_PER_HOUR} pieces of feedback an hour` }, { "retry-after": "3600" });
    }
    recent.push(now);
    feedbackTimes.set(tenant, recent);
    const item = { id: nextFeedbackId++, username: tenant, message, page, created_at: new Date(now).toISOString(), status: "new" };
    feedback.push(item);
    return send(res, 201, item);
  }
  if (pathname === "/api/v1/feedback" && method === "GET") {
    if (!isAdmin(tenant)) return send(res, 403, { message: "admin only" });
    const status = url.searchParams.get("status") ?? "new";
    if (!["new", "read", "all"].includes(status)) return send(res, 422, { message: "status must be new, read or all" });
    const items = feedback.filter((f) => status === "all" || f.status === status);
    return send(res, 200, [...items].reverse());
  }
  m = /^\/api\/v1\/feedback\/(\d+)$/.exec(pathname);
  if (m && method === "PATCH") {
    if (!isAdmin(tenant)) return send(res, 403, { message: "admin only" });
    const item = feedback.find((f) => f.id === Number(m[1]));
    if (!item) return send(res, 404, { message: `no feedback with id ${m[1]}` });
    const body = await readJson(req);
    if (!body || (body.status !== "read" && body.status !== "new")) return send(res, 422, { message: "status must be read or new" });
    item.status = body.status;
    return send(res, 200, item);
  }
  if (pathname.startsWith("/api/v1/feedback")) return send(res, 404, { message: "not found" });

  const servers = serversFor(tenant);

  if (pathname === "/api/v1/servers" && method === "GET") {
    return send(res, 200, [...servers.values()].map(publicView));
  }

  if (pathname === "/api/v1/servers" && method === "POST") {
    const body = await readJson(req);
    if (!body) return send(res, 400, { message: "body must be JSON" });
    const name = String(body.name ?? "");
    if (!NAME_RE.test(name) || name.includes("omcsi")) {
      return send(res, 422, {
        message: "name must be 2-31 characters: lowercase letters, digits and hyphens, starting with a letter, and must not contain 'omcsi'",
      });
    }
    if (findServer(name)) return send(res, 409, { message: `the name '${name}' is already taken` });
    if (servers.size >= LIMITS.max_servers_per_tenant) {
      return send(res, 403, { message: `the free tier allows ${LIMITS.max_servers_per_tenant} server per account` });
    }
    const server = {
      name,
      hostname: `${name}.example.com`,
      dashboard_url: `https://${name}.example.com/dashboard`,
      state: "asleep",
      last_woken: null,
      players_online: null,
      motd: body.motd ? String(body.motd) : "A Minecraft Server",
      operator_username: body.operator_username ? String(body.operator_username) : null,
      admin_password: `mock-${Math.random().toString(36).slice(2, 10)}`,
    };
    servers.set(name, server);
    return send(res, 201, { ...publicView(server), admin_password: server.admin_password });
  }

  m = /^\/api\/v1\/servers\/([^/]+)(\/wake)?$/.exec(pathname);
  if (!m) return send(res, 404, { message: "not found" });
  const server = servers.get(m[1]);
  if (!server) return send(res, 404, { message: `no server named '${m[1]}'` });

  if (m[2] === "/wake" && method === "POST") {
    if (server.state === "asleep" || server.state === "failed") {
      server.state = "waking";
      server.last_woken = new Date().toISOString();
      scheduleWake(server);
    }
    return send(res, 202, publicView(server));
  }
  if (!m[2] && method === "GET") return send(res, 200, publicView(server));
  if (!m[2] && method === "DELETE") {
    const force = url.searchParams.get("force") === "true";
    if ((server.players_online ?? 0) > 0 && !force) {
      return send(res, 409, { message: `${server.players_online} player(s) are online; pass force=true to delete anyway` });
    }
    clearTimeout(wakeTimers.get(server.name));
    servers.delete(server.name);
    return send(res, 204);
  }
  return send(res, 405, { message: "method not allowed" });
}

http
  .createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(err);
      send(res, 500, { message: "mock failure" });
    });
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`mock dsh-api + userauth listening on http://127.0.0.1:${PORT}`);
  });
