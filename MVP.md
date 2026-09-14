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

1. [ ] A stranger with a UserAuth account can go from `/` to a joinable server address in under two minutes with no human involved. *(The portal side is built; this needs a deployed `dsh-api` and public UserAuth registration to be measured.)*
2. [x] The state pill changes from asleep to awake within a minute of a player joining, without a page reload. *(Polled every 10 s while the tab is visible; the transition is covered by the smoke test.)*
3. [x] Delete asks for the server name to be typed and says a backup is taken first.
4. [x] Works at phone width. *(400 px screenshots are taken on every test run and checked for horizontal overflow.)*
5. [x] Playwright smoke test covers create → see → delete against a mocked `dsh-api`.

## Not in the MVP

- Editing server settings (difficulty, plugins) — the OMCSI dashboard already does that; the portal links to it.
- Admin views, billing, a paid tier.
- Public server listing / discovery.

## Depends on

- `dsh-api` MVP.
- UserAuth with a registration flow open to the public.
