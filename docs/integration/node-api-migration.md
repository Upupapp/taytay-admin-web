# Moving the staff console onto the Node API

Started 2026-11-05. Decision: `DL-164`. Evidence: [`node-api-gap-map.md`](./node-api-gap-map.md)
(port by port) and [`node-api-transport-design.md`](./node-api-transport-design.md) (transport,
sign-in, checks, risks). Backend: `taytay-backend`, Node 20 / Express / PostgreSQL, Firebase for
sign-in only, hosted on Linode.

## Where things stand

| | |
|---|---|
| Console ports the Node API serves fully | 0 of 20 |
| Served in part (mostly different concepts with the same name) | 7 |
| No endpoint at all | 13 — cases, requests, beneficiaries, visits, releases, referrals, families, saved views, dashboard, work, reports, search, events |
| Node staff endpoints with no console screen | ~40 — verification review, office inbox, users and roles, offices, services, hotlines, home banners and links, digital IDs, audit, app configuration |

## Plan

| # | Step | Repo | State |
|---|---|---|---|
| 1 | CORS for browser clients, exact origins | backend | done `135ec41` |
| 2 | `permissions` on `GET /me` from a table of the route guards; `POST /auth/sign-out` | backend | done `189b911` |
| 3 | Transport: cursor paging, Node error codes, vendored `openapi.json`, `local-api` on port 3000; `GET me`, sign-out and the inbox served, the other eighteen ports bound to adapters that make no request | console | done (`DL-165`) |
| 4 | Sign-in: Firebase Auth REST, tokens in memory; dev sign-in through the backend's mock verifier | console | done (`DL-166`): password sign-in, TOTP second factor and on-demand refresh built to Google's published REST reference; `local-api` signs in through the development verifier. **Not live anywhere yet**: no Firebase web API key has been supplied for staging or production, so both say sign-in is not configured; the TOTP flow has not been exercised against a project with Identity Platform TOTP enabled |
| 5 | Unserved ports bound to adapters that say so; navigation withholds them; one page names them | console | done (`DL-165`, `DL-167`): the http set declares its eighteen unserved ports (`UNSERVED_PORTS`), the menu withholds every entry whose screen reads one, each such route leads to `/unavailable`, which names every withheld module and every port it lacks, and `check:unserved` holds the bindings, the declaration, the routes and the menu to one another |
| 6 | Platform screens: verification review first, then office inbox, users and roles, directory, home, digital IDs, Balita, audit, app config | console | to do |
| 7 | Re-point the contract checks at the Node spec, new baselines stated | console | done with step 3, in one commit, each old and new count stated (`DL-165`) |

## For the owner to decide

These are not engineering choices, and nothing below has been built.

1. **Casework on the Node API, or not.** The console's thirteen unserved modules are the MSWDO's
   casework: intake, assessment, approval, payout, referral, visits. Either the Node API grows
   them, or the console retires those screens. Until then they stay in the code, run on sample data
   in local development, and are hidden — with a page that says so — against the real API.
   If they are built, the console's domain already states the rules the server would need to
   enforce: the assistance lifecycle and its transitions, case events appended in the same act as
   the change (`DL-54`), money as integer centavos, releases that warn on self-release (`DL-91`),
   referrals that cannot be sent without a recorded lawful basis (`DL-140`).
2. **Staff roles finer than `staff` and `admin`.** The console's separation of duties — nobody both
   approves a request and releases its money — cannot be enforced by two roles. Client checks are
   never the boundary (CLAUDE.md §2.4), so this needs a server-side table. Only relevant if (1) is yes.
3. **An auditor who can read the trail without holding every admin write.** `GET /admin/audit` is
   admin-only today.
4. **Two-factor sign-in for staff.** Firebase TOTP needs the Identity Platform upgrade on the
   project. Until then staff sign in with a password only.
5. **How the first admin is created.** There is no provisioning step; today it needs a `role`
   custom claim set before first sign-in, or a database edit.
6. **One Firebase project for residents and staff.** Signing out revokes every session of that
   account, including the same person's resident app, if they use one account for both.

## Smaller backend items found on the way

- `app.set('trust proxy', 1)` behind nginx, or the 120-a-minute limiter is shared by every client.
- Expose `Retry-After` through CORS (the console reads `details.retry_after` meanwhile).
- `X-Client-Channel` is sent by both clients and read by nobody.
- Media uploads are capped at 5 MB on the API and 10 MB in the console.

## Things only a person can supply

- The Firebase **web** app settings (API key, auth domain, project id, app id) for staging and
  production. They are public identifiers, not secrets; restrict the key by HTTP referrer to the
  console's origins in Google Cloud.
- The console's and the API's real hostnames, for `CORS_ALLOWED_ORIGINS` and the CSP.
- A staff or admin account to test with.
