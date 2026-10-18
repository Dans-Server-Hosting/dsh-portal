// A tiny in-memory stand-in for dsh-api and for UserAuth's login redirect.
// It exists so the portal can be developed and smoke-tested without a
// cluster; nothing here is ever deployed. Zero dependencies on purpose.
//
//   node mock/server.mjs            # listens on MOCK_PORT (default 4000)
//
// Implements the dsh-api contract the portal codes against:
//   GET    /api/v1/limits
//   GET    /api/v1/default-plugins
//   GET    /api/v1/servers
//   POST   /api/v1/servers                 202 provisioning (+ one-time admin_password) | 409 taken
//                                          | 409 { detail, server } another create still provisioning
//                                          | 403 at cap | 422 invalid
//                                          provisioning → waking → awake by itself over MOCK_PROVISION_MS
//   GET    /api/v1/servers/{name}
//   POST   /api/v1/servers/{name}/wake     202 (asleep/failed/stopped → waking; otherwise a no-op)
//   DELETE /api/v1/servers/{name}          204 | 409 players online (unless ?force=true)
//   GET    /api/v1/catalog                 the Dan's Plugins catalog (public) | 503 selection switched off
//   GET    /api/v1/servers/{name}/plugins  { server, state, players_online, pending, plugins } | 503 switched off
//   PUT    /api/v1/servers/{name}/plugins/{slug}     adds it and what it requires → { added, ...view }
//                                          | 404 not in the catalog | 409 the server is being created
//   DELETE /api/v1/servers/{name}/plugins/{slug}     → { removed, unused_dependencies, ...view }
//                                          | 404 not installed | 409 { detail, required_by }
//   POST   /api/v1/servers/{name}/plugins/apply      { confirm_players } → 202 { applies: next_start | restarting }
//                                          | 409 { detail, players_online } unless confirmed | 409 busy
//          A server "starts" with its selection on create, on wake and on a restarting apply; until
//          then the view says pending and the new plugins' status is "pending".
//   GET    /api/v1/me                      { username, is_admin }  (admin when the username is "admin")
//   POST   /api/v1/feedback                201 | 422 message missing/too long | 429 more than 10 an hour
//   GET    /api/v1/feedback?status=new|read|all   admin only (403), newest first
//   PATCH  /api/v1/feedback/{id}           { status: "read" | "new" }  admin only (403) | 404
// plus a fake UserAuth (the same REST shape as the real one, in memory):
//   POST   /userauth/register              201 | 400 rules | 409 taken
//   POST   /userauth/login                 200 { token, tokenType, expiresAt, refreshToken } | 401
//   GET    /userauth/session/validate      200 | 401
//   POST   /userauth/logout                204, revokes the bearer
//   POST   /userauth/password              { currentPassword, newPassword } → 204 and every other session
//          (USERAUTH_CHANGE_PASSWORD_PATH)  of the account is revoked | 401 wrong current | 400 policy / same
// and test-only controls:
//   POST   /mock/servers/{name}/state      { state, players_online } (simulate a player joining; stops the
//                                          automatic provisioning/wake progression for that server)
//   POST   /mock/servers/{name}/advance    one step now: provisioning → waking → awake
//   POST   /mock/servers/{name}/cluster-error  { detail } makes wake and delete on that server answer
//                                          502 { detail } (what dsh-api's ClusterError handler sends) until
//                                          { detail: null } or a reset
//   POST   /mock/plugins                   { enabled } switches plugin selection on (the default) or off,
//                                          as DSH_PLUGIN_SELECTION does; it starts off when
//                                          MOCK_PLUGIN_SELECTION=false
//   POST   /mock/reset                     also restores plugin selection to MOCK_PLUGIN_SELECTION
//   POST   /mock/feedback/reset            clear feedback and the rate-limit counters only
import http from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4000);
const WAKE_MS = Number(process.env.MOCK_WAKE_MS || 3000);
// A fresh server spends half of this provisioning and half waking before it is awake.
const PROVISION_MS = Number(process.env.MOCK_PROVISION_MS || 6000);
const CHANGE_PASSWORD_PATH = process.env.USERAUTH_CHANGE_PASSWORD_PATH?.trim() || "/password";
const NAME_RE = /^[a-z][a-z0-9-]{1,30}$/;
const ADMIN_USERNAME = "admin";
const FEEDBACK_MAX_LENGTH = 4000;
const FEEDBACK_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;

const LIMITS = {
  servers_per_tenant: 1,
  heap_gb: 3.0,
  memory_limit_gib: 3.5,
  world_quota_gib: 5.0,
  idle_minutes: 20,
  max_awake_servers: 12,
  max_registered_servers: 40,
  archive_after_days: 60,
  backup_retention_days: 14,
  minecraft_version: "26.2",
};

// What dsh-api derives from DSH_DEFAULT_PLUGINS, in install order.
const DEFAULT_PLUGINS = [
  {
    name: "Dan's Plugin Manager",
    version: "0.7.0-SNAPSHOT-8-8-2026",
    description: "Installs and updates plugins from Dan's Plugins in-game with /dpm.",
    download_url:
      "https://github.com/Dans-Plugins/Dans-Plugin-Manager/releases/download/v0.7.0-SNAPSHOT-8-8-2026/DansPluginManager-0.7.0-SNAPSHOT-8-8-2026.jar",
    project_url: "https://github.com/Dans-Plugins/Dans-Plugin-Manager",
  },
  {
    name: "ViaVersion",
    version: "5.12.0",
    description: "Lets players on newer Minecraft versions join your server.",
    download_url: "https://github.com/ViaVersion/ViaVersion/releases/download/5.12.0/ViaVersion-5.12.0.jar",
    project_url: "https://github.com/ViaVersion/ViaVersion",
  },
  {
    name: "ViaBackwards",
    version: "5.12.0",
    description: "Lets players on older Minecraft versions join your server.",
    download_url: "https://github.com/ViaVersion/ViaBackwards/releases/download/5.12.0/ViaBackwards-5.12.0.jar",
    project_url: "https://github.com/ViaVersion/ViaBackwards",
  },
];

// What dsh-api's GET /api/v1/catalog returns (a few of the real entries),
// sorted by title. Fiefs requires Medieval Factions, as on dansplugins.com.
const DPC = "https://dansplugins.com";
const CATALOG = [
  {
    slug: "currencies",
    title: "Currencies",
    description: "Lets factions mint their own currencies.",
    tags: ["economy"],
    requires: ["medieval-factions"],
    version: "v2.1.0",
    icon_url: null,
    project_url: `${DPC}/resources/currencies`,
  },
  {
    slug: "dans-plugin-manager",
    title: "Dan's Plugin Manager",
    description: "Installs and updates plugins from Dan's Plugins in-game with /dpm.",
    tags: ["utility"],
    requires: [],
    version: "v0.6.0",
    icon_url: null,
    project_url: `${DPC}/resources/dans-plugin-manager`,
  },
  {
    slug: "fiefs",
    title: "Fiefs",
    description: "Lets faction members claim land of their own inside their faction's territory.",
    tags: ["factions", "land"],
    requires: ["medieval-factions"],
    version: "v0.13.1",
    icon_url: null,
    project_url: `${DPC}/resources/fiefs`,
  },
  {
    slug: "medieval-factions",
    title: "Medieval Factions",
    description: "Factions with land claims, diplomacy, gates and duels.",
    tags: ["factions"],
    requires: [],
    version: "v7.0.0",
    icon_url: null,
    project_url: `${DPC}/resources/medieval-factions`,
  },
  {
    slug: "viabackwards",
    title: "ViaBackwards",
    description: "Lets players on older Minecraft versions join your server.",
    tags: ["compatibility"],
    requires: ["viaversion"],
    version: "5.12.0",
    icon_url: null,
    project_url: "https://github.com/ViaVersion/ViaBackwards",
  },
  {
    slug: "viaversion",
    title: "ViaVersion",
    description: "Lets players on newer Minecraft versions join your server.",
    tags: ["compatibility"],
    requires: [],
    version: "5.12.0",
    icon_url: null,
    project_url: "https://github.com/ViaVersion/ViaVersion",
  },
];
const catalogEntry = (slug) => CATALOG.find((p) => p.slug === slug);
// A new server's selection: the default plugins, pinned to the default jars.
const DEFAULT_SELECTION = [
  { slug: "dans-plugin-manager", title: "Dan's Plugin Manager", version: "0.7.0-SNAPSHOT-8-8-2026", requires: [] },
  { slug: "viaversion", title: "ViaVersion", version: "5.12.0", requires: [] },
  { slug: "viabackwards", title: "ViaBackwards", version: "5.12.0", requires: ["viaversion"] },
];
let pluginSelection = process.env.MOCK_PLUGIN_SELECTION !== "false";

/** @type {Map<string, Map<string, object>>} tenant -> name -> server */
const tenants = new Map();
const wakeTimers = new Map();
/** @type {Map<string, string>} name -> the 502 detail wake and delete answer with (test-only) */
const clusterErrors = new Map();
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
  delete rest.plugins;
  delete rest.started_with;
  return rest;
}

const selectionKey = (server) =>
  [...server.plugins.values()]
    .map((p) => `${p.slug}@${p.version}`)
    .sort()
    .join(",");

/** The wrapper's boot script reconciling plugins/ against the selection. */
function startWithSelection(server) {
  server.started_with = new Set([...server.plugins.values()].map((p) => `${p.slug}@${p.version}`));
}

function pluginsView(server) {
  const pending = selectionKey(server) !== [...server.started_with].sort().join(",");
  const rows = [...server.plugins.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  return {
    server: server.name,
    state: server.state,
    players_online: server.players_online,
    pending,
    plugins: rows.map((p) => ({
      slug: p.slug,
      title: p.title,
      version: p.version,
      added_by: p.added_by,
      requires: p.requires,
      required_by: rows.filter((o) => o.requires.includes(p.slug)).map((o) => o.slug).sort(),
      status: server.started_with.has(`${p.slug}@${p.version}`) ? "installed" : "pending",
    })),
  };
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

function stopProgression(server) {
  clearTimeout(wakeTimers.get(server.name));
  wakeTimers.delete(server.name);
}

/** provisioning → waking → awake, one step; anything else is left alone. */
function advance(server) {
  if (server.state === "provisioning") {
    startWithSelection(server);
    server.state = "waking";
    server.last_woken = new Date().toISOString();
  } else if (server.state === "waking") {
    server.state = "awake";
    server.players_online = 0;
  }
}

function scheduleWake(server) {
  stopProgression(server);
  wakeTimers.set(
    server.name,
    setTimeout(() => {
      if (server.state === "waking") advance(server);
    }, WAKE_MS),
  );
}

function scheduleProvisioning(server) {
  stopProgression(server);
  wakeTimers.set(
    server.name,
    setTimeout(() => {
      if (server.state !== "provisioning") return;
      advance(server);
      wakeTimers.set(
        server.name,
        setTimeout(() => {
          if (server.state === "waking") advance(server);
        }, PROVISION_MS / 2),
      );
    }, PROVISION_MS / 2),
  );
}

function revokeOtherSessions(username, keepToken) {
  for (const [token, session] of sessions) {
    if (token !== keepToken && session.username.toLowerCase() === username.toLowerCase()) sessions.delete(token);
  }
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
  if (pathname === `/userauth${CHANGE_PASSWORD_PATH}` && method === "POST") {
    const session = sessionOf(req);
    if (!session) return send(res, 401, { message: "invalid or expired token" });
    const body = await readJson(req);
    if (!body || typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
      return send(res, 400, { message: "currentPassword and newPassword are required" });
    }
    const user = users.get(session.username.toLowerCase());
    if (!user || user.password !== body.currentPassword) return send(res, 401, { message: "current password is incorrect" });
    const problem = passwordProblem(body.newPassword);
    if (problem) return send(res, 400, { message: problem });
    if (body.newPassword === body.currentPassword) return send(res, 400, { message: "new password must be different from the current password" });
    user.password = body.newPassword;
    revokeOtherSessions(user.username, session.token);
    return send(res, 204);
  }

  // ---- test-only controls ----
  if (method === "POST" && pathname === "/mock/reset") {
    tenants.clear();
    users.clear();
    sessions.clear();
    for (const t of wakeTimers.values()) clearTimeout(t);
    wakeTimers.clear();
    clusterErrors.clear();
    resetFeedback();
    pluginSelection = process.env.MOCK_PLUGIN_SELECTION !== "false";
    return send(res, 204);
  }
  if (method === "POST" && pathname === "/mock/plugins") {
    const body = await readJson(req);
    pluginSelection = body?.enabled !== false;
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
    stopProgression(server);
    if (body?.state) server.state = body.state;
    if (body?.players_online !== undefined) server.players_online = body.players_online;
    if (body?.state === "awake" && !server.last_woken) server.last_woken = new Date().toISOString();
    return send(res, 200, publicView(server));
  }
  m = /^\/mock\/servers\/([^/]+)\/advance$/.exec(pathname);
  if (m && method === "POST") {
    const server = findServer(m[1]);
    if (!server) return send(res, 404, { message: "no such server" });
    stopProgression(server);
    advance(server);
    return send(res, 200, publicView(server));
  }
  m = /^\/mock\/servers\/([^/]+)\/cluster-error$/.exec(pathname);
  if (m && method === "POST") {
    const server = findServer(m[1]);
    if (!server) return send(res, 404, { message: "no such server" });
    const body = await readJson(req);
    if (body && typeof body.detail === "string") clusterErrors.set(server.name, body.detail);
    else clusterErrors.delete(server.name);
    return send(res, 204);
  }

  // ---- dsh-api ----
  if (pathname === "/api/v1/limits" && method === "GET") return send(res, 200, LIMITS);
  if (pathname === "/api/v1/default-plugins" && method === "GET") return send(res, 200, DEFAULT_PLUGINS);
  if (pathname === "/api/v1/catalog" && method === "GET") {
    if (!pluginSelection) return send(res, 503, { detail: "choosing plugins is not switched on for this service yet" });
    return send(res, 200, CATALOG);
  }

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
    // The slot is reserved before provisioning starts, so a second create in
    // that window is told about the first rather than about the cap.
    const pending = [...servers.values()].find((s) => s.state === "provisioning");
    if (pending) return send(res, 409, { detail: "a server is already being created for this account", server: pending.name });
    if (servers.size >= LIMITS.servers_per_tenant) {
      return send(res, 403, { message: `the free tier allows ${LIMITS.servers_per_tenant} server per account` });
    }
    const server = {
      name,
      hostname: `${name}.example.com`,
      dashboard_url: `https://${name}.example.com/dashboard`,
      state: "provisioning",
      last_woken: null,
      players_online: null,
      motd: body.motd ? String(body.motd) : "A Minecraft Server",
      operator_username: body.operator_username ? String(body.operator_username) : null,
      admin_password: `mock-${Math.random().toString(36).slice(2, 10)}`,
      plugins: new Map(DEFAULT_SELECTION.map((p) => [p.slug, { ...p, added_by: "default" }])),
      started_with: new Set(),
    };
    startWithSelection(server);
    servers.set(name, server);
    scheduleProvisioning(server);
    return send(res, 202, { ...publicView(server), admin_password: server.admin_password });
  }

  m = /^\/api\/v1\/servers\/([^/]+)\/plugins(?:\/([^/]+))?$/.exec(pathname);
  if (m) return handlePlugins(req, res, servers.get(m[1]), m[2] ? decodeURIComponent(m[2]) : null);

  m = /^\/api\/v1\/servers\/([^/]+)(\/wake)?$/.exec(pathname);
  if (!m) return send(res, 404, { message: "not found" });
  const server = servers.get(m[1]);
  if (!server) return send(res, 404, { message: `no server named '${m[1]}'` });

  // dsh-api answers a failed cluster operation with 502 and a detail that is
  // written to be shown to the user; this is that answer, for wake and delete.
  if (clusterErrors.has(server.name) && ((m[2] === "/wake" && method === "POST") || (!m[2] && method === "DELETE"))) {
    return send(res, 502, { detail: clusterErrors.get(server.name) });
  }

  if (m[2] === "/wake" && method === "POST") {
    if (server.state === "asleep" || server.state === "failed" || server.state === "stopped") {
      startWithSelection(server);
      server.state = "waking";
      server.players_online = null;
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
    stopProgression(server);
    servers.delete(server.name);
    return send(res, 204);
  }
  return send(res, 405, { message: "method not allowed" });
}

async function handlePlugins(req, res, server, slug) {
  const method = req.method || "GET";
  if (!pluginSelection) return send(res, 503, { detail: "choosing plugins is not switched on for this service yet" });
  if (!server) return send(res, 404, { detail: "no such server" });
  if (!slug && method === "GET") return send(res, 200, pluginsView(server));
  if (method !== "GET" && server.state === "provisioning") {
    return send(res, 409, { detail: "the server is being created; try again once it is up" });
  }

  if (slug === "apply" && method === "POST") {
    const body = (await readJson(req)) ?? {};
    if (server.state === "asleep") return send(res, 202, { applies: "next_start" });
    if (server.state !== "awake" && server.state !== "stopped") {
      return send(res, 409, { detail: `the server is ${server.state}; try again once it is up` });
    }
    const online = server.state === "awake" ? (server.players_online ?? 0) : 0;
    if (online > 0 && body.confirm_players !== true) {
      return send(res, 409, { detail: `${online} player(s) online; confirm to restart anyway`, players_online: online });
    }
    // The wrapper pod is deleted; it comes back up with the new selection.
    startWithSelection(server);
    server.state = "waking";
    server.players_online = null;
    scheduleWake(server);
    return send(res, 202, { applies: "restarting" });
  }

  if (slug && method === "PUT") {
    if (!catalogEntry(slug)) return send(res, 404, { detail: `no plugin '${slug}' in the catalog` });
    const added = [];
    const queue = [[slug, "tenant"]];
    while (queue.length > 0) {
      const [current, addedBy] = queue.shift();
      if (server.plugins.has(current)) continue;
      const entry = catalogEntry(current);
      server.plugins.set(current, { slug: current, title: entry.title, version: entry.version, requires: entry.requires, added_by: addedBy });
      added.push(current);
      queue.push(...entry.requires.map((dep) => [dep, "dependency"]));
    }
    return send(res, 200, { added, ...pluginsView(server) });
  }

  if (slug && method === "DELETE") {
    if (!server.plugins.has(slug)) return send(res, 404, { detail: `'${slug}' is not installed on this server` });
    const dependents = [...server.plugins.values()].filter((p) => p.requires.includes(slug)).map((p) => p.slug).sort();
    if (dependents.length > 0) {
      return send(res, 409, { detail: `${slug} is needed by ${dependents.join(", ")}`, required_by: dependents });
    }
    server.plugins.delete(slug);
    const remaining = [...server.plugins.values()];
    const unused = remaining
      .filter((p) => p.added_by === "dependency" && !remaining.some((o) => o.requires.includes(p.slug)))
      .map((p) => p.slug)
      .sort();
    return send(res, 200, { removed: slug, unused_dependencies: unused, ...pluginsView(server) });
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
