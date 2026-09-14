# dsh-portal — MVP

**Sign in, press "Create server", get an address to give your friends, see when it's awake.**

## Shape

- Next.js (App Router) + MUI, the same stack as preponderous.org and danielstephenson.dev, so the existing dev-loop and deploy patterns apply.
- Talks only to `dsh-api`. Holds no cluster credentials and no database.
- Sign-in via UserAuth: UserAuth is a REST API with no hosted pages, so the portal has its own sign-in and registration forms, calls UserAuth's `/login` and `/register`, stores the JWT in an httpOnly cookie, and forwards it to `dsh-api` as a Bearer token.
- Served at the apex of `dansserverhosting.com` through Traefik.

## Pages

| Route | Shows |
|---|---|
| `/` | what the free tier is (limits from `GET /api/v1/limits`), how sleeping works, "Sign in" / "Create account" |
| `/servers` | the signed-in user's servers: name, address to copy, state pill (provisioning / asleep / waking / awake / stopped / failed), "Open dashboard", "Wake", "Delete" |
| `/servers/new` | name, MOTD, your Minecraft username (becomes operator) → create; the API answers 202 straight away and the page shows the address with a live status until the server is online; a second create while one is pending says so and links to it |
| `/account` | who is signed in; change password (current, new, confirm, the same live rules as registration) through UserAuth |
| `/servers/[name]` | one server: address, state, last woken, dashboard link, delete with confirmation |
| `/auth/login`, `/auth/register` | the portal's own forms over UserAuth's REST API |
| `/feedback` | a Feedback link on every signed-in page opens a textarea; the message and the page it was about go to `POST /api/v1/feedback` |
| `/admin/feedback` | when `GET /api/v1/me` says `is_admin`: what users sent, newest first, New / Read / All, Mark read / Mark new; "not found" for anyone else |

## Done when

1. [ ] A stranger with a UserAuth account can go from `/` to a joinable server address in under two minutes with no human involved. *(The portal side, including registration, is built and `deploy/` holds the manifests; this is measured once `dsh-api` and UserAuth are running in the cluster.)*
2. [x] The state pill changes from asleep to awake within a minute of a player joining, without a page reload. *(Polled every 10 s while the tab is visible; the transition is covered by the smoke test.)*
3. [x] Delete asks for the server name to be typed and says a backup is taken first.
4. [x] Works at phone width. *(400 px screenshots are taken on every test run and checked for horizontal overflow.)*
5. [x] Playwright smoke test covers create → see → delete against a mocked `dsh-api`.
6. [x] A signed-in user can send feedback from any page and an admin can read it in the portal and mark it read. *(Covered by the smoke test at both viewports.)*
7. [x] Creating a server cannot be submitted twice during the provisioning window, and the page shows progress until the server is online. *(The button is disabled while the request is in flight; the API's 202 is followed by a status line polled every 5 s; its 409 for a pending create is shown with a link rather than the cap message. Covered at both viewports.)*
8. [x] A signed-in user can change their password from the portal. *(`/account`, over UserAuth's change-password endpoint; wrong current password, weak new password and success with sign-in afterwards are covered at both viewports.)*

## Not in the MVP

- Editing server settings (difficulty, plugins) — the OMCSI dashboard already does that; the portal links to it.
- Admin views beyond the feedback inbox, billing, a paid tier.
- Public server listing / discovery.

## Depends on

- `dsh-api` MVP, with the asynchronous create (202 + `provisioning`, 409 for a concurrent create).
- UserAuth reachable in-cluster with registration open to the public, and its change-password endpoint (`POST /password` unless `USERAUTH_CHANGE_PASSWORD_PATH` says otherwise).
