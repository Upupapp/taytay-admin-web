# Moving the staff console onto the Node API

Started 2026-11-05. Decision: `DL-164`. Evidence: [`node-api-gap-map.md`](./node-api-gap-map.md)
(port by port) and [`node-api-transport-design.md`](./node-api-transport-design.md) (transport,
sign-in, checks, risks). Backend: `taytay-backend`, Node 20 / Express / PostgreSQL, Firebase for
sign-in only, hosted on Linode.

## Where things stand

| | |
|---|---|
| Console ports the Node API serves fully | 0 of 20 casework ports; 4 platform ports added (`DL-167` verification review; `DL-168` office inbox, office directory, app accounts) |
| Served in part (mostly different concepts with the same name) | 7 |
| No endpoint at all | 13 — cases, requests, beneficiaries, visits, releases, referrals, families, saved views, dashboard, work, reports, search, events |
| Node staff endpoints with no console screen | ~28 — offices, services, hotlines, home banners and links, digital IDs, audit, app configuration |

## Plan

| # | Step | Repo | State |
|---|---|---|---|
| 1 | CORS for browser clients, exact origins | backend | done `135ec41` |
| 2 | `permissions` on `GET /me` from a table of the route guards; `POST /auth/sign-out` | backend | done `189b911` |
| 3 | Transport: cursor paging, Node error codes, vendored `openapi.json`, `local-api` on port 3000; `GET me`, sign-out and the inbox served, the other eighteen ports bound to adapters that make no request | console | done (`DL-165`) |
| 4 | Sign-in: Firebase Auth REST, tokens in memory; dev sign-in through the backend's mock verifier | console | done (`DL-166`): password sign-in, TOTP second factor and on-demand refresh built to Google's published REST reference; `local-api` signs in through the development verifier. **Not live anywhere yet**: no Firebase web API key has been supplied for staging or production, so both say sign-in is not configured; the TOTP flow has not been exercised against a project with Identity Platform TOTP enabled |
| 5 | Unserved ports bound to adapters that say so; navigation withholds them; one page names them | console | done (`DL-165`, `DL-167`): the http set declares its eighteen unserved ports (`UNSERVED_PORTS`), the menu withholds every entry whose screen reads one, each such route leads to `/unavailable`, which names every withheld module and every port it lacks, and `check:unserved` holds the bindings, the declaration, the routes and the menu to one another |
| 6a | Platform screen: residents' ID verification review | console | done (`DL-167`, [`docs/verification`](../verification/README.md)): queue by status, cursor-paged; review in a drawer; images only after a warning, read as bytes with the bearer in a header and revoked on leave; approve and reject through `StatusTransition` with what the API does shown before the button and the rejection's reader named; `verification.review` added unchanged from `StaffCapability`, held by the administrator alone. **Not run against a live API.** Open: whether the review should show the account's name and birth date (owner decision 7; the spec has no `GET admin/users/{id}`) |
| 6b | Platform screen: the office inbox | console | done (`DL-168`, [`docs/inbox`](../inbox/README.md)): conversations newest activity first, cursor-paged, no preview of what a resident wrote in the list; one conversation by address, oldest first; replies in words; mark read (one mark for the whole office, said so); close behind a confirmation listing what the server does and asking no reason (it keeps none); attachments only after a warning, as bytes, revoked on leave; an empty first page asked about (`GET me`) so a staff account with no office is told so rather than shown an empty inbox; `office-inbox.manage` added unchanged. **Not run against a live API.** Not done: sending an image with a reply |
| 6c | Platform screen: users and roles | console | done (`DL-168`, [`docs/accounts`](../accounts/README.md)): every app account, a page at a time, showing name, email, role and office only; role and office changed in a drawer, what the server does shown before each button (digital ID revoked on any role but verified, `verified` skipping the ID review, console access, the next-request timing), no reason asked (the server keeps none), one's own role not offered; offices picked from the directory read in full; `user.view`, `user.change-role`, `user.assign-office` added unchanged, held by the administrator alone. **Not run against a live API.** No search: the API has none |
| 6d | Platform screens: directory, home, digital IDs, Balita, audit, app config | console | to do |
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
7. **ID review shows no account name or birth date** (the request carries neither); should the
   reviewer see the account's name and birth date to compare against the ID? More personal data on
   screen — an office decision. It would need the API too: the spec has no `GET admin/users/{id}`,
   and `GET admin/users` omits birth dates.
8. **The office inbox names no resident.** A conversation carries the resident's account id and
   nothing else, so staff answer somebody they know only by what they wrote. Showing a name is more
   personal data on the screen and needs the API to send it — the office's decision first.
9. **Closing a conversation tells the resident nothing**, and keeps no reason. Whether the resident
   should be told, and whether a reason should be kept (the API would have to store it), is the
   office's decision; the console asks for no reason it cannot keep.

## Smaller backend items found on the way

- `app.set('trust proxy', 1)` behind nginx, or the 120-a-minute limiter is shared by every client.
- Expose `Retry-After` through CORS (the console reads `details.retry_after` meanwhile).
- `X-Client-Channel` is sent by both clients and read by nobody.
- Media uploads are capped at 5 MB on the API and 10 MB in the console.
- A thread's `unread_count` counts every message not sent by the reader, so a colleague's reply is
  "unread" to everybody else at the office until somebody marks the conversation read — while the
  read mark itself is one per office (`office_last_read_at`). Counting only the resident's messages
  would make the office's count mean "the resident is waiting".
- `GET threads` answers a staff account with no office with an empty page rather than a refusal; the
  console asks `GET me` before believing it (`DL-168`). A `403` would say it directly.

## Things only a person can supply

- The Firebase **web** app settings (API key, auth domain, project id, app id) for staging and
  production. They are public identifiers, not secrets; restrict the key by HTTP referrer to the
  console's origins in Google Cloud.
- The console's and the API's real hostnames, for `CORS_ALLOWED_ORIGINS` and the CSP.
- A staff or admin account to test with.
