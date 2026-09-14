# dsh-portal

Web portal for **Dan's Server Hosting**: sign in, create a server, see whether
it is awake. See [MVP.md](MVP.md) for the scope.

Status: **MVP implemented, not yet deployed** — every page, the UserAuth
sign-in flow and the delete/wake actions are built and smoke-tested against
an in-memory mock of `dsh-api`. The last step of the MVP (a stranger going
from `/` to a joinable address) needs a deployed `dsh-api` and a public
UserAuth registration flow, neither of which this repo provides.

## What it is

- Next.js (App Router) + MUI, TypeScript. Same stack as preponderous.org.
- Talks only to `dsh-api`. Holds no cluster credentials and no database.
- Sign-in is a redirect to UserAuth. The returned JWT is kept in an
  `httpOnly`, `Secure`, `SameSite=Lax` cookie and is only ever read by
  server-side code, which forwards it to `dsh-api` as a Bearer token. The
  browser never sees the token; it talks to the portal's own `/api/servers*`
  route handlers.
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
| `/auth/login` | redirects to `${USERAUTH_URL}/login?redirect=<portal>/auth/callback` |
| `/auth/callback?token=` | stores the JWT in the session cookie and redirects to `/servers` |
| `/auth/signout` (POST) | clears the cookie |

## Configuration

All variables are read on the server only; nothing is exposed as
`NEXT_PUBLIC_`. See [.env.example](.env.example).

| Variable | Meaning |
|---|---|
| `DSH_API_URL` | Base URL of `dsh-api`, e.g. `https://api.example.com` |
| `USERAUTH_URL` | Base URL of UserAuth; the portal redirects to `${USERAUTH_URL}/login?redirect=…` |
| `PORTAL_URL` | The portal's own public origin, used to build the sign-in callback (defaults to the request origin) |
| `DSH_SECURE_COOKIE` | `0` allows the session cookie over plain http for local development; defaults to on in production |

## Running locally

```sh
npm ci
cp .env.example .env.local     # points at the mock below
npm run mock                   # terminal 1: mock dsh-api + UserAuth on :4000
npm run dev                    # terminal 2: portal on :3000
```

The mock (`mock/server.mjs`, zero dependencies, in-memory) implements the
`dsh-api` contract the portal codes against plus a fake UserAuth that signs
anyone in as `mock-user`. It also has two test-only controls:
`POST /mock/reset` and `POST /mock/servers/{name}/state` with
`{ "state": "awake", "players_online": 1 }` to simulate a player joining.

Sign-in with the mock is instant: pressing **Sign in** bounces through the
fake UserAuth and lands on `/servers`.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm test            # Playwright: create → see → delete, desktop + 400px phone
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
