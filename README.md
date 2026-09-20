# dsh-portal

Web portal for **Dan's Server Hosting**: sign in, create a server, see whether
it is awake, and tell the team what is wrong. See [MVP.md](MVP.md) for the
scope.

Status: **MVP implemented, deploy manifests written, not yet deployed** —
every page, sign-in and registration against UserAuth's REST API, and the
delete/wake actions are built and smoke-tested against an in-memory mock of
`dsh-api` and UserAuth. The last step of the MVP (a stranger going from `/`
to a joinable address) can be measured once `dsh-api` and UserAuth are
running in the cluster.

## What it is

- Next.js (App Router) + MUI, TypeScript. Same stack as preponderous.org.
- Dark by default, with a sun/moon toggle at the right of the header. The
  choice is kept in the browser (`localStorage`, key `mui-mode`) and applied
  by an inline script before the first paint, so there is no flash of the
  other mode on the next visit. Both palettes live in `src/theme.ts`; the
  default mode is one constant in `src/lib/color-mode.ts`.
- Talks only to `dsh-api`. Holds no cluster credentials and no database.
- UserAuth is a plain REST API with no hosted pages, so the portal has its
  own sign-in and registration forms. Their server actions call UserAuth's
  `POST /login` and `POST /register`; the returned JWT is kept in an
  `httpOnly`, `Secure`, `SameSite=Lax` cookie (lifetime from `expiresAt`) and
  is only ever read by server-side code, which forwards it to `dsh-api` as a
  Bearer token. The browser never sees the token; it talks to the portal's
  own `/api/servers*` route handlers. Sign-out revokes the token with
  `POST /logout` before clearing the cookie.
- Creating a server is asynchronous: `POST /api/v1/servers` answers **202**
  with the server in state `provisioning` (and the one-time dashboard
  password), and the created view shows the address straight away with a
  live status line that asks for the server every 5 seconds ("Setting up…
  usually about a minute" → "Starting…" → "Online — ready to join"). While
  the request itself is in flight the button is disabled and a progress bar
  says so. A second create during that window is answered by the API with a
  409 naming the pending server; the portal says "A server is already being
  created for your account" and links to it, instead of the cap message.
- State pills (`provisioning`, `asleep`, `waking`, `awake`, `stopped`,
  `failed`) refresh every 10 seconds (while the tab is visible) without a
  page reload. `stopped` is a game that exited while its pod stayed up (Stop
  in the dashboard, or a crash); Wake is enabled for it, as for `asleep` and
  `failed`.
- Deleting a server requires typing its name back and says up front that a
  backup is taken first.
- Every signed-in page has a **Feedback** link in the header. It opens a
  textarea (4000 characters) and sends the message, plus the path the user
  came from, to `POST /api/v1/feedback` through the portal's own route
  handler. The API's 422 and 429 (ten a user an hour) are shown plainly.
- **Account** (`/account`, linked from the header) changes the password:
  current, new and confirm, with the same live rule checklist as
  registration plus "different from your current password". The portal's
  own `POST /api/account/password` route handler forwards
  `{ currentPassword, newPassword }` to UserAuth's change-password endpoint
  with the session's Bearer token. UserAuth's 204 is shown as success with a
  note that every other session was signed out (this one stays); its 401
  (wrong current password) and 400 (policy, or the same password again) are
  shown plainly. The endpoint's path defaults to `POST /password` and is
  read from `USERAUTH_CHANGE_PASSWORD_PATH`, so `/password/change` (or
  wherever it settles) is a config change, not a rebuild.
- `GET /api/v1/me` is fetched server-side, once per request, whenever there
  is a session. When it says `is_admin`, the header gains **Admin · Feedback**
  and `/admin/feedback` lists what users sent (username, relative time, page,
  message) with a New / Read / All filter and a Mark read / Mark new toggle
  per item (`PATCH /api/v1/feedback/{id}` through the proxy). Anyone else
  gets the ordinary "not found" page there; the API enforces the same rule
  with a 403, which the proxy passes through.

| Route | Shows |
|---|---|
| `/` | the free tier (limits fetched live from `GET /api/v1/limits`), what comes installed (`GET /api/v1/default-plugins`: name, version, description, link to the project), how sleeping works, Sign in |
| `/servers` | the signed-in user's servers: name, address to copy, state pill, Open dashboard, Wake, Delete |
| `/servers/new` | name, MOTD, Minecraft username (becomes operator); a line naming the plugins it comes with → create (202); address + one-time password with a live status until online; 403/409/422 shown in plain language, "already being created" links to the pending server |
| `/account` | who is signed in, and a change-password form (current, new, confirm, live rules) → UserAuth via `POST /api/account/password` |
| `/servers/[name]` | one server: address, state, last woken, dashboard link, the plugins installed by default, delete with typed confirmation |
| `/feedback` | a textarea with a counter → `POST /api/v1/feedback` with `page` = where the user came from; thanks on success |
| `/admin/feedback` | admins only: feedback newest first, New / Read / All filter, Mark read / Mark new; "not found" for everyone else |
| `/auth/login` | username + password → UserAuth `POST /login`; a 401 is shown plainly |
| `/auth/register` | username, password (rules hinted as you type), optional email → `POST /register`, then signed in |
| `/auth/signout` (POST) | revokes the token at UserAuth and clears the cookie |

## Configuration

All variables are read on the server only; nothing is exposed as
`NEXT_PUBLIC_`. See [.env.example](.env.example).

| Variable | Meaning |
|---|---|
| `DSH_API_URL` | Base URL of `dsh-api`, e.g. `https://api.example.com` |
| `USERAUTH_URL` | Base URL of UserAuth's REST API (`POST /login`, `/register`, `/logout`, the change-password endpoint) |
| `USERAUTH_CHANGE_PASSWORD_PATH` | Path of UserAuth's change-password endpoint under `USERAUTH_URL`; defaults to `/password` |
| `PORTAL_URL` | The portal's own public origin, used for redirects after sign-out (defaults to the request origin) |
| `DSH_SECURE_COOKIE` | `0` allows the session cookie over plain http for local development; defaults to on in production |

## Running locally

```sh
npm ci
cp .env.example .env.local     # points at the mock below
npm run mock                   # terminal 1: mock dsh-api + UserAuth on :4000
npm run dev                    # terminal 2: portal on :3000
```

The mock (`mock/server.mjs`, zero dependencies, in-memory) implements the
`dsh-api` contract the portal codes against (servers, `/api/v1/me`, and the
feedback endpoints with their 403 / 422 / 429 behaviours) plus UserAuth's
`/register`, `/login`, `/session/validate`, `/logout` and the change-password
endpoint (at `USERAUTH_CHANGE_PASSWORD_PATH`, default `/password`) with the
same status codes and password rules, under `/userauth`. A create answers 202
in state `provisioning` and moves to `waking` and then `awake` by itself over
`MOCK_PROVISION_MS` (default 6 s); a second create in that window is the 409.
It also has test-only controls: `POST /mock/reset`,
`POST /mock/feedback/reset`, `POST /mock/servers/{name}/state` with
`{ "state": "awake", "players_online": 1 }` to simulate a player joining (or
`"stopped"`, or anything else; it also stops the automatic progression for
that server), `POST /mock/servers/{name}/advance` to move a server one
step along provisioning → waking → awake right away, and
`POST /mock/servers/{name}/cluster-error` with `{ "detail": "..." }` to make
wake and delete on that server answer `502 { "detail" }` the way `dsh-api`
does when a cluster operation fails (`{ "detail": null }` clears it).

Nothing is seeded: create an account on `/auth/register` (any username of
3-50 characters and a password with a lower- and uppercase letter, a digit
and a symbol) and it exists until the mock restarts. The mock treats the
username `admin` as an administrator; every other account is a normal user.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test            # Playwright: register → sign in → create (202 → provisioning → online, 409 while pending, provisioning/stopped pills) → see → delete, a 502 from the API, feedback → admin, change password, desktop + 400px phone
```

`npm test` starts the mock (with `MOCK_PROVISION_MS` set high, so the tests
drive provisioning with the `advance` control) and the standalone production
server itself (`npm run build` must have run first). It saves a full-page screenshot of
every page at both viewports under `test-results/screenshots/` and asserts
that no page scrolls horizontally; CI uploads those screenshots as an
artifact. The pinned `@playwright/test` version must match the installed
Chromium build (`npx playwright install chromium` fetches the right one).

Do not run `next build` while `next dev` is running: they share `.next/`.

## Container

```sh
docker build -t dsh-portal .
docker run --rm -p 3000:3000 \
  -e DSH_API_URL=https://api.example.com \
  -e USERAUTH_URL=https://auth.example.com \
  -e PORTAL_URL=https://portal.example.com \
  dsh-portal
```

Multi-stage build on `node:22-alpine`; the runtime image holds only the
standalone Next.js output and runs as a non-root user on port 3000.

## Deploying to the cluster

`deploy/` holds Kubernetes manifests (namespace `dsh-portal`, ConfigMap,
Deployment, Service, Ingress for `dansserverhosting.com` with a
cert-manager certificate). Images are built on the node itself, so the
Deployment uses `dsh-portal:local` with `imagePullPolicy: Never`:

```sh
docker build -t dsh-portal:local .
kubectl kustomize deploy/          # render and eyeball
kubectl apply -k deploy/
```

The ConfigMap points at `dsh-api` (Service `dsh-api.dsh-api`, port 80) and
UserAuth (Service `userauth.userauth`, port 9998) by their in-cluster names;
adjust there if either moves.
