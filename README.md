# dsh-portal

Web portal for **Dan's Server Hosting**: sign in, create a server, see whether
it is awake. See [MVP.md](MVP.md) for the scope.

Status: **MVP implemented, deploy manifests written, not yet deployed** —
every page, sign-in and registration against UserAuth's REST API, and the
delete/wake actions are built and smoke-tested against an in-memory mock of
`dsh-api` and UserAuth. The last step of the MVP (a stranger going from `/`
to a joinable address) can be measured once `dsh-api` and UserAuth are
running in the cluster.

## What it is

- Next.js (App Router) + MUI, TypeScript. Same stack as preponderous.org.
- Talks only to `dsh-api`. Holds no cluster credentials and no database.
- UserAuth is a plain REST API with no hosted pages, so the portal has its
  own sign-in and registration forms. Their server actions call UserAuth's
  `POST /login` and `POST /register`; the returned JWT is kept in an
  `httpOnly`, `Secure`, `SameSite=Lax` cookie (lifetime from `expiresAt`) and
  is only ever read by server-side code, which forwards it to `dsh-api` as a
  Bearer token. The browser never sees the token; it talks to the portal's
  own `/api/servers*` route handlers. Sign-out revokes the token with
  `POST /logout` before clearing the cookie.
- State pills refresh every 10 seconds (while the tab is visible) without a
  page reload.
- Deleting a server requires typing its name back and says up front that a
  backup is taken first.

| Route | Shows |
|---|---|
| `/` | the free tier (limits fetched live from `GET /api/v1/limits`), how sleeping works, Sign in |
| `/servers` | the signed-in user's servers: name, address to copy, state pill, Open dashboard, Wake, Delete |
| `/servers/new` | name, MOTD, Minecraft username (becomes operator) → create; 403/409/422 shown in plain language |
| `/servers/[name]` | one server: address, state, last woken, dashboard link, delete with typed confirmation |
| `/auth/login` | username + password → UserAuth `POST /login`; a 401 is shown plainly |
| `/auth/register` | username, password (rules hinted as you type), optional email → `POST /register`, then signed in |
| `/auth/signout` (POST) | revokes the token at UserAuth and clears the cookie |

## Configuration

All variables are read on the server only; nothing is exposed as
`NEXT_PUBLIC_`. See [.env.example](.env.example).

| Variable | Meaning |
|---|---|
| `DSH_API_URL` | Base URL of `dsh-api`, e.g. `https://api.example.com` |
| `USERAUTH_URL` | Base URL of UserAuth's REST API (`POST /login`, `/register`, `/logout`) |
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
`dsh-api` contract the portal codes against plus UserAuth's `/register`,
`/login`, `/session/validate` and `/logout` with the same status codes and
password rules, under `/userauth`. It also has two test-only controls:
`POST /mock/reset` and `POST /mock/servers/{name}/state` with
`{ "state": "awake", "players_online": 1 }` to simulate a player joining.

Nothing is seeded: create an account on `/auth/register` (any username of
3-50 characters and a password with a lower- and uppercase letter, a digit
and a symbol) and it exists until the mock restarts.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test            # Playwright: register → sign in → create → see → delete, desktop + 400px phone
```

`npm test` starts the mock and the standalone production server itself
(`npm run build` must have run first). It saves a full-page screenshot of
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
