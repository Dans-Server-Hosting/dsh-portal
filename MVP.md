# dsh-portal — MVP

**Sign in, press "Create server", get an address to give your friends, see when it's awake.**

## Shape

- Next.js (App Router) + MUI, the same stack as preponderous.org and danielstephenson.dev, so the existing dev-loop and deploy patterns apply.
- Talks only to `dsh-api`. Holds no cluster credentials and no database.
- Sign-in via UserAuth: the portal redirects to UserAuth's login, receives the JWT, stores it in an httpOnly cookie, and forwards it to `dsh-api` as a Bearer token.
- Served at the apex of `dansserverhosting.com` through Traefik.

## Pages

| Route | Shows |
|---|---|
| `/` | what the free tier is (limits from `GET /api/v1/limits`), how sleeping works, "Sign in" |
| `/servers` | the signed-in user's servers: name, address to copy, state pill (asleep / waking / awake), "Open dashboard", "Wake", "Delete" |
| `/servers/new` | name, MOTD, your Minecraft username (becomes operator) → create |
| `/servers/[name]` | one server: address, state, last woken, dashboard link, delete with confirmation |

## Done when

1. A stranger with a UserAuth account can go from `/` to a joinable server address in under two minutes with no human involved.
2. The state pill changes from asleep to awake within a minute of a player joining, without a page reload.
3. Delete asks for the server name to be typed and says a backup is taken first.
4. Works at phone width.
5. Playwright smoke test covers create → see → delete against a mocked `dsh-api`.

## Not in the MVP

- Editing server settings (difficulty, plugins) — the OMCSI dashboard already does that; the portal links to it.
- Admin views, billing, a paid tier.
- Public server listing / discovery.

## Depends on

- `dsh-api` MVP.
- UserAuth with a registration flow open to the public.
