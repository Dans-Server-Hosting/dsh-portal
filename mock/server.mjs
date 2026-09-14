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
// plus a fake UserAuth and test-only controls:
//   GET    /userauth/login?redirect=<url>  302 -> <url>?token=<fake jwt>
//   POST   /mock/servers/{name}/state      { state, players_online } (simulate a player joining)
//   POST   /mock/reset
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4000);
const WAKE_MS = Number(process.env.MOCK_WAKE_MS || 3000);
const NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;

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

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");

function issueToken(username) {
  const header = b64url({ alg: "none", typ: "JWT" });
  const payload = b64url({
    sub: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: "mock-userauth",
  });
  return `${header}.${payload}.mock-signature`;
}

function tenantOf(req) {
  const auth = req.headers.authorization || "";
  const m = /^Bearer (.+)$/.exec(auth);
  if (!m) return null;
  const parts = m[1].split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    if (!payload.sub) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return String(payload.sub);
  } catch {
    return null;
  }
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
  if (pathname === "/userauth/login") {
    const redirect = url.searchParams.get("redirect");
    if (!redirect) return send(res, 400, { message: "redirect is required" });
    const user = url.searchParams.get("user") || "mock-user";
    const target = new URL(redirect);
    target.searchParams.set("token", issueToken(user));
    res.writeHead(302, { location: target.toString() });
    return res.end();
  }

  // ---- test-only controls ----
  if (method === "POST" && pathname === "/mock/reset") {
    tenants.clear();
    for (const t of wakeTimers.values()) clearTimeout(t);
    wakeTimers.clear();
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

  if (!pathname.startsWith("/api/v1/servers")) return send(res, 404, { message: "not found" });

  const tenant = tenantOf(req);
  if (!tenant) return send(res, 401, { message: "a valid bearer token is required" });
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
