# Moving the staff console onto the Node API

Started 2026-11-05. Decision: `DL-164`. Evidence: [`node-api-gap-map.md`](./node-api-gap-map.md)
(port by port) and [`node-api-transport-design.md`](./node-api-transport-design.md) (transport,
sign-in, checks, risks). Backend: `taytay-backend`, Node 20 / Express / PostgreSQL, Firebase for
sign-in only, hosted on Linode.

## Where things stand

| | |
|---|---|
| Console ports the Node API serves fully | 10 of 20 casework ports — referrals, drafted with nothing disclosed, the lawful basis and each shared field their own acts, sent only under a recorded basis (refused under the row lock, `DL-140`) and summarised by the server, and field visits, each observation saying whose claim it is and nothing recording where anybody was (`DL-181`), releases and payout sessions, in integer centavos, with the request moving through its own lifecycle as a payout is scheduled and handed over (`DL-180`), the resident registry (`DL-174`), saved views, households and families (`DL-175`), cases, opened, given to a social worker and appended to, with tasks, notes and the requests they name (`DL-179`), assistance requests from intake to endorsement, with assignment to a social worker, the assessment, documents and document requests (`DL-177`, `DL-178`), the programme catalogue with its editor, now the whole form (`DL-176`, `DL-177`, `DL-178`; utilization said to be not connected until releases are served); the resident profile is read with its household, and says the assistance history is not connected yet; 12 platform ports added (`DL-167` verification review; `DL-168` office inbox, office directory, app accounts; `DL-170` directory offices, Tulong pages, hotlines, the home screen, the app's settings; `DL-171` digital IDs, Balita, the audit trail) |
| Served in part (mostly different concepts with the same name) | 4 — staff, notification, governance, newsfeed (assistance requests left this row with `DL-178`; scheduling and releasing are recorded with the payout since `DL-180`); the resident (`DL-174`), household (`DL-175`) and program (`DL-176`) ports left this row for the one above |
| No endpoint at all | 6 — beneficiaries, dashboard, work, reports, search, events |
| Node staff endpoints with no console screen | 0 — every `office/referrals`, `office/service-providers` and `office/visits` route is reached from the referral list and record, the provider directory, the visit list and record, or the new visit-scheduling page (`DL-181`); every `office/releases` and `office/release-batches` route from the release screens (`DL-180`) |

## Plan

| # | Step | Repo | State |
|---|---|---|---|
| 1 | CORS for browser clients, exact origins | backend | done `135ec41` |
| 2 | `permissions` on `GET /me` from a table of the route guards; `POST /auth/sign-out` | backend | done `189b911` |
| 3 | Transport: cursor paging, Node error codes, vendored `openapi.json`, `local-api` on port 3000; `GET me`, sign-out and the inbox served, the other eighteen ports bound to adapters that make no request | console | done (`DL-165`) |
| 4 | Sign-in: Firebase Auth REST, tokens in memory; dev sign-in through the backend's mock verifier | console | done (`DL-166`): password sign-in, TOTP second factor and on-demand refresh built to Google's published REST reference; `local-api` signs in through the development verifier. **Staging has a key** (`DL-169`); production has none and says sign-in is not configured; the TOTP flow has not been exercised against a project with Identity Platform TOTP enabled |
| 5 | Unserved ports bound to adapters that say so; navigation withholds them; one page names them | console | done (`DL-165`, `DL-167`): the http set declares its eighteen unserved ports (`UNSERVED_PORTS`), the menu withholds every entry whose screen reads one, each such route leads to `/unavailable`, which names every withheld module and every port it lacks, and `check:unserved` holds the bindings, the declaration, the routes and the menu to one another |
| 6a | Platform screen: residents' ID verification review | console | done (`DL-167`, [`docs/verification`](../verification/README.md)): queue by status, cursor-paged; review in a drawer; images only after a warning, read as bytes with the bearer in a header and revoked on leave; approve and reject through `StatusTransition` with what the API does shown before the button and the rejection's reader named; `verification.review` added unchanged from `StaffCapability`, held by the administrator alone. **Not run against a live API.** Open: whether the review should show the account's name and birth date (owner decision 7; the spec has no `GET admin/users/{id}`) |
| 6b | Platform screen: the office inbox | console | done (`DL-168`, [`docs/inbox`](../inbox/README.md)): conversations newest activity first, cursor-paged, no preview of what a resident wrote in the list; one conversation by address, oldest first; replies in words; mark read (one mark for the whole office, said so); close behind a confirmation listing what the server does and asking no reason (it keeps none); attachments only after a warning, as bytes, revoked on leave; an empty first page asked about (`GET me`) so a staff account with no office is told so rather than shown an empty inbox; `office-inbox.manage` added unchanged. **Not run against a live API.** Not done: sending an image with a reply |
| 6c | Platform screen: users and roles | console | done (`DL-168`, [`docs/accounts`](../accounts/README.md)): every app account, a page at a time, showing name, email, role and office only; role and office changed in a drawer, what the server does shown before each button (digital ID revoked on any role but verified, `verified` skipping the ID review, console access, the next-request timing), no reason asked (the server keeps none), one's own role not offered; offices picked from the directory read in full; `user.view`, `user.change-role`, `user.assign-office` added unchanged, held by the administrator alone. **Not run against a live API.** No search: the API has none |
| 6d | Platform screen: the app directory — offices, Tulong pages, hotlines | console | done (`DL-170`, [`docs/directory`](../directory/README.md)): offices and Tulong pages a page at a time, hotlines whole with the cap said; added and changed in a drawer, each form listing what the API does before its button; deletes only through a confirmation listing the effects, a refusal shown in the server's words; images chosen through one shared field that refuses past 5 MB or by the file's first bytes before sending, sent as `multipart/form-data` through the new `ApiClient.postForm`/`patchForm` (the contract checks learned form bodies and now read a `toWire…` mapper's keys); a Tulong page never modelled as a programme; `office.manage`, `service.manage`, `hotline.manage` added unchanged. **Not run against a live API.** Not possible on the published contract: changing an office's details after creation, clearing a short name, removing a banner, changing a page's address, category, eligibility, places or office, listing a hidden page (opened by its address instead) |
| 6e | Platform screen: the app's home screen — banners and quick links | console | done (`DL-170`, [`docs/home-screen`](../home-screen/README.md)): every banner and link, in the app's order; added and changed in a drawer with what the API does before each button — an image stored before its banner and kept if the banner is refused, an old image never removed, every link shown; deletes only through a confirmation, hiding offered instead for a banner; a banner's image read as bytes and shown from object URLs; the screen says the app has **no description of a banner's image** because the API keeps none, rather than collecting one it would drop; a preview of `GET home` read again after every save; `home.manage` added unchanged. **Not run against a live API** |
| 6f | Platform screen: the app's settings | console | done (`DL-170`, [`docs/app-settings`](../app-settings/README.md)): contact line, support email, terms and privacy versions, the oldest app version, feature flags; only what changed is sent, `null` to clear; **every change reviewed** in a confirmation listing what it does, and a newer oldest version or a new terms or privacy version **acknowledged** before the button enables — it can stop residents using the app until they update or accept again; the privacy notice the API serves shown by version and date, with a warning when residents would be asked to accept another; flags said not secret; `app-config.manage` added unchanged. **Not run against a live API** |
| 6g | Platform screen: digital IDs | console | done (`DL-171`, [`docs/digital-ids`](../digital-ids/README.md)): a resident's QR code checked from a pasted or typed payload — no camera — showing only what the API answers, the photo only after a warning, the code emptied as it is sent and nothing kept or logged; an account's current card read through the app accounts' verified residents, and issued, suspended, revoked or replaced behind a confirmation that says first what each does to the card in the app; `digital-id.verify` (every role, a read) and `digital-id.manage` added unchanged. **Not run against a live API** |
| 6h | Platform screen: Balita | console | done (`DL-171`, [`docs/balita`](../balita/README.md)): the residents' published list, pinned first, a page at a time; an article written and changed in a drawer as a form with its cover; what publishing, saving a draft, taking an article off and pinning do shown **above each button** — publishing cannot be recalled from anybody who read it, and sends no notification; drafts kept in the page's memory with their IDs, and one opened by its ID, because the API lists none; no cover description, said; `news.write` added unchanged, not the newsfeed's keys. **Not run against a live API** |
| 6i | Platform screen: the app's audit trail | console | done (`DL-171`, [`docs/platform-audit`](../platform-audit/README.md)): `GET admin/audit` newest first, fifty at a time with "more available"; each row's six fields and nothing beside them — the action in words for all thirty-three codes and the code as given, the account and record by id, no lookup; the page says the API keeps no earlier or later value and no reason; separate from the unserved governance trail; `audit.view` as the server spells it. **Not run against a live API**. **Step 6 is complete**: every staff route the Node API serves has a screen |
| 7 | Re-point the contract checks at the Node spec, new baselines stated | console | done with step 3, in one commit, each old and new count stated (`DL-165`) |
| 8 | Casework phase 1a: office roles on staff accounts, casework keys and scope on `/me`; an office role narrows the platform keys and the routes check the key | backend + console | done (`DL-173`, `DL-174`): `taytay-backend` `7996668`, `a4fa8d9`, `ee83617`. The auditor and the barangay link hold no Balita or inbox key; the head and the auditor read the audit trail |
| 9 | Casework phase 1b: the office's resident registry | backend + console | done (`DL-174`): `taytay-backend` `6544381` — `/api/v1/office/residents`, redacted and scoped on the server, sectors and retirements as append-only histories with reasons; `HttpResidentRepository` in the console, `resident` out of `UNSERVED_PORTS`. **The Residents menu entry stays withheld** — its list also reads `saved-view`, its record `family` and `field-visit`. **Not run against a live API.** For the owner: the social worker's `assigned-cases` scope is refused until cases exist; saved views, or a list without its bar, to bring the list back |
| 10 | Casework phase 1c: saved views, the office household register, families; only a module's primary port gates its menu entry | backend + console | done (`DL-175`): `taytay-backend` `013d74c`, `154a052`, `0c19dd2` — `/api/v1/office/saved-views`, `/office/households` (the vulnerability snapshot computed and disclosed on the server), `/office/families` with relationships and transfers as appended acts; `saved-view`, `household`, `family` out of `UNSERVED_PORTS` (fourteen remain). A secondary panel whose port is unserved now says so in place, and `check:unserved` holds it; **Residents, Households and Families are in the menu** against the API. **Not run against a live API** |
| 11 | Casework phase 1d: the programme catalogue | backend + console | done (`DL-176`): `taytay-backend` `f887038` — `/api/v1/office/programs`, programmes as records with their responsibility refused by route and database when it would misdescribe the office, guidance that never gates, documents required/optional/conditional, every version kept; `program` out of `UNSERVED_PORTS` (thirteen remain), the list read a cursor page at a time; utilization said to be not connected, never a zero. **Programmes is in the menu** against the API. **Not run against a live API.** No form in the console creates a programme |
| 12 | Casework phase 2a: the programme editor; assistance requests — intake, filing, the lifecycle | backend + console | done (`DL-177`): `taytay-backend` `54c68f0` — a programme's change keeps its reason, requirement templates are written with a reason and retired one way; `cf42d64` — `/api/v1/office/assistance-requests`: drafts with no control number, filing that issues one and refuses an incomplete intake record by the console's own codes, moves only along the console's transitions as appended rows with who, when and why (the lifecycle compared with this console's domain by a test), the duplicate check that decides nothing and names what it could not read, notes in two tiers, scope and redaction as the registry's. Console `ddf9b13` (new-programme form, template editor) and `91ab104`: `assistance-request` out of `UNSERVED_PORTS` (twelve remain), **Requests and intake are in the menu** against the API; the assessment and documents say in place that they are not connected yet; scheduling and releasing are refused by the API until payouts are served. **Not run against a live API** |
| 13 | Casework phase 2b: assignment for assessment and the caseload, the assessment, documents and their versions, opening a file, document requests; the programme edit as the whole form; request notes | backend + console | done (`DL-178`): `taytay-backend` `240803d` — a filed request assigned to a social worker with a reason, appended, and `assigned-cases` served for the requests assigned to it (drafts, filing, the duplicate check, assigning and the registry still refused to it); the console's two assessment forms as fixed reference data, opened only in assessment, answered as a patch, completed with the recommendation a person chose and moving the request nowhere; a filed checklist moved only by appended acts; document versions appended and superseded with a reason, files by their bytes through `MediaStore`, numbers held whole and answered masked; a file opened through a single-use grant with the server's warning, the bytes for a handle in a body; document requests asked, answered and withdrawn. Console `f3ac8d3`: the request record works end to end and its "not connected yet" placeholders are gone; the notes box; the list narrows by assignee; the programme edit is the New programme form with a reason. **Phase 2 is complete.** |
| 14 | Casework phase 3: cases | backend + console | done (`DL-179`): `taytay-backend` `aef52f8` — `/api/v1/office/cases`: a case opened about one person, naming the filed requests it covers one link at a time (one case per request, the subject or their household); every write a reason and an event appended in the same transaction, the status, assignee and task state moved only by that event and a case, note, task or link refused at commit without one; `closed` terminal, a recurrence a new case naming the closed one, closing refused while a task is open; the next action an open task; protected notes withheld in the data layer; a protected subject's words withheld from a reader without `request.view-sensitive`; queues counted on the municipality's calendar; `office_case.*` audit rows. **`assigned-cases` reads only the cases assigned to it** (superseding `DL-57`'s pool) and is not widened to the registry. Console `fc30e89`: `case` out of `UNSERVED_PORTS` (eleven remain), **Cases is in the menu** against the API, with an open-a-case page, assignment to a named social worker (superseding `DL-59`'s pair), naming a request, task acts, and withheld words said in place. The work queue stays unserved (phase 6). **Not run against a live API** |
| 15 | Casework phase 4: releases and payout sessions | backend + console | done (`DL-180`): `taytay-backend` `da22eec` — `/api/v1/office/releases` and `/office/release-batches`: a release prepared for an approved request in integer centavos or as goods with no amount, every act an event appended in the same transaction and the only thing that moves it, the request scheduled and released through its own history as the payout is, sessions with no status counted from their members, the payout list composed by the server, self-release recorded and never refused, every money write carrying `idempotency_key` in its body; `release` out of `UNSERVED_PORTS` (ten remain) |
| 16 | Casework phase 5: referrals and field visits | backend + console | done (`DL-181`): `taytay-backend` `6436b70` — `/api/v1/office/referrals`, `/office/service-providers` (read-only, empty until somebody keeps it) and `/office/visits`: a referral drafted with nothing disclosed, the basis and each field beyond the minimum their own acts and only while a draft, `send` with no body refused without a basis by the route and again by the database under the row lock, the sheet composed by the server from what the reader could read, overdue derived; a visit's observations each with their kind and a third party named, appended only, closed once, and no column for where anybody was (tested against `information_schema`); a caseload reads only its own cases' and requests' records, and a protected client's words are withheld in the data layer; `referral` and `field-visit` out of `UNSERVED_PORTS` (eight remain) |

**Next: casework phase 6** — the dashboard, work queues, reports, search and events.

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
- Media uploads are capped at 5 MB on the API and 10 MB in the console's casework document policy
  (`DOCUMENT_UPLOAD_POLICY`, unserved). The app's images use `APP_IMAGE_POLICY`, which matches the API.
- A thread's `unread_count` counts every message not sent by the reader, so a colleague's reply is
  "unread" to everybody else at the office until somebody marks the conversation read — while the
  read mark itself is one per office (`office_last_read_at`). Counting only the resident's messages
  would make the office's count mean "the resident is waiting".
- `GET threads` answers a staff account with no office with an empty page rather than a refusal; the
  console asks `GET me` before believing it (`DL-168`). A `403` would say it directly.
- **`OfficePatch` and `ServicePatch` under-declare** (`DL-170`). The handlers accept every create
  field on a change (`offices/schemas.ts`, `services/schemas.ts`); the spec declares four for an
  office and leaves a page's `slug`, `category`, `eligibility`, `locations` and `office_id` out.
  The console sends only what the spec declares, so an office's description, head, hours, phone,
  email, address and position, and those five page fields, cannot be changed after creation.
  Declaring them in the spec fixes it without a code change on either side.
- **No admin list of Tulong pages.** `GET services` leaves out `hidden_from_list` pages unless
  `featured=true`; a hidden, unfeatured page is reachable only by its slug (`DL-170`). An admin list,
  or a `hidden` filter, would let the console show every page.
- **An office cannot lose its banner or its short name.** The banner is set only when a file is sent,
  and a multipart change cannot carry `null`. `latitude`/`longitude` sent empty coerce to `0`
  (`z.coerce.number`), so the console never sends them empty.
- **An office's delete refusal does not say what names it** (`409` "still has staff or other
  records"), and a deleted office's banner image is never removed from storage.
- **Hotline lists stop at 100 with no word of more** (`HOTLINE_LIST_CAP`), for the app and the admin
  list alike; the console says so when it receives a hundred.
- **A banner's image has no description** (`DL-170`, `DL-125`): `home_banners` keeps a title, an image,
  a link, an order and whether it is shown. The app has nothing to give a resident who cannot see
  the image. An `alt_text` column on banners, required to show one, would close it; the console
  would then ask for it beside the image.
- **Stored images are never removed.** Replacing or removing a banner's image, deleting a banner, or
  an upload left unused because the banner was then refused all leave the bytes in storage. Banners
  name an image uploaded separately (`POST media`), so a refused banner leaves one behind by design.
- The spec's banner `PATCH` body is `BannerWrite` (`title` required) while the handler takes a
  partial body, and `LinkWrite` requires nothing while the handler requires `label` and `href` on a
  create. The console sends what both accept; the spec and the handlers should agree.
- **The privacy notice's text cannot be changed through the API** (`DL-170`): it is the placeholder
  from `0018_account_gaps.sql` until somebody edits the database, and `privacy_version` is a separate
  setting, so residents can be asked to accept a version whose text the API does not serve. A route to
  publish the notice, setting both together, would close it.
- **`app.config_updated` names no setting** and keeps no values, so the trail cannot say who raised
  the oldest app version or changed the terms version. Recording the changed keys would be enough.
- **`minimum_app_version` longer than 20 characters** passes the API's pattern and fails the
  column's check (1 to 20 characters, `0010_screen_coverage.sql`), which the error handler does not
  map; the console refuses it first.
- **Nothing on the server enforces the versions.** No route refuses an old app or compares a
  resident's accepted version with these; the app is trusted to. Whether that is enough is the
  office's call.
- **No reason is kept for an act on a digital ID** (`DL-171`). Suspend, revoke and reissue take no
  body, and the audit entry says only who; an office asked later why a resident's card stopped
  working has nothing to read.
- **A suspended digital ID cannot be made active again.** `setStatus` moves only to `suspended` or
  `revoked`; a suspension made by mistake can only be undone by a replacement with a new number.
- **No list of digital IDs**, nor of revoked ones: a card is reachable only through its account
  (`GET admin/users/{id}/digital-id`), so an administrator looking for one card must find the
  resident first. A `GET admin/digital-ids` by status or number would close it.
- **No route lists a resident's media**, so `photo_media_id` on an issue cannot be chosen from the
  console; the API's default — the latest approved verification selfie — is the only photo offered.
- **No list of Balita drafts for staff** (`DL-171`). `GET news` is the residents' list, published
  only; a draft is reachable only by its id, so one not opened in the console's page is lost to it
  though stored. A `status=draft` filter for `news.write` holders would close it.
- **No description of a Balita cover** (`DL-171`, `DL-125`), as for banners: the app has nothing to
  give a resident who cannot see it. An `alt_text` on `news`, required with a cover, would close it.
- **A Balita category or cover cannot be removed** once set: `NewsPatch` takes neither as `null`, and
  a form cannot say `null`.
- **The audit trail has no filter** (`DL-171`) — by actor, action, record or date — so an
  administrator looking for one act reads from the newest down. It also keeps no values and no
  reasons, so it can say a role changed but not from what, or a card was suspended but not why.
- A multipart request with an unexpected file field (`LIMIT_UNEXPECTED_FILE`) is not mapped by the
  error handler and answers `500`.

## Things only a person can supply

- ~~Staging Firebase web settings~~ — done 2026-11-05 (`DL-169`): project `taytay-lgu-ids-staging`
  under michaela@lguids.com.ph, key in `environment.staging.ts`, restricted to the Identity Toolkit
  and Token Service APIs. Still owed: the **HTTP-referrer restriction** once the staging console has
  an origin, and the **production** project and key.
- The backend's Firebase **service-account key** for the staging VM (a secret: created by a person
  in the Firebase console, placed only on the server).
- Identity Platform (billing) if staff two-factor is wanted; TOTP is off until then.
- The console's and the API's real hostnames, for `CORS_ALLOWED_ORIGINS` and the CSP.
- A staff or admin account to test with.

## Decided 2026-11-06: casework is built on the Node API

Michaela Cailing, who directs this work, decided owner question 1: **keep the casework** and build
it into `taytay-backend`, rather than retire the screens. Built in phases, each usable on its own,
each replacing the matching `Unserved*` adapters with real ones and keeping every console doctrine
check green (the server enforces what the console only displays):

1. **Foundation** — the office's resident registry (not app accounts), households and families,
   programmes with guidelines and responsibility (`DL-65`, `DL-66`), and **granular staff roles**
   (intake officer, social worker, MSWDO head, release officer, barangay link, auditor) published
   as permissions on `/me`, with separation of duties enforced server-side.
2. **Assistance requests** — intake → assessment → approval, requirements and documents
   (append-only versions, `DL-77`), advisory evidence that decides nothing (`DL-60`).
3. **Cases** — tasks, notes (protected tier, `DL-58`), events appended in the same act (`DL-54`).
4. **Releases** — integer centavos, batches as plans (`DL-90`), self-release warning (`DL-91`).
5. **Referrals and field visits** — lawful basis inside the row lock (`DL-140`), observation kinds (`DL-85`).
6. **Dashboard, work queues, reports, search, saved views, events.**

**Phase 1a done** (`DL-173`, `taytay-backend` `7996668`): office roles on staff accounts, the casework
keys and the data scope on `/me` decided by the server from a table its test compares with
`ROLE_DEFINITIONS`, separation of duties enforced there, `requirePermission` for the routes to come,
and the office role given on Users and roles with a reason the server keeps. Finished in
`a4fa8d9` as the owner decided (`DL-174`): an office role narrows the platform keys too, and the
routes those keys describe check the key.

**Phase 1b done** (`DL-174`, `taytay-backend` `6544381`): the office's resident registry — people
the MSWDO serves, not app accounts — redacted and scoped on the server, served to the console through
`HttpResidentRepository`.

**Phase 1c done** (`DL-175`, `taytay-backend` `013d74c`, `154a052`, `0c19dd2`): saved views, the
office household register — not the residents' app households, which are untouched — and families,
each scoped and redacted as the registry is; a protected person's address is withheld from the
people she lives with as well as from her own record. The resident profile is read with its
household; its assistance history says it is not connected yet.

| Phase | What | State |
|---|---|---|
| 1a | Office roles on staff accounts, casework keys and scope on `/me`, the routes check the key | ✓ `DL-173`, `DL-174` |
| 1b | The office's resident registry | ✓ `DL-174` |
| 1c | Saved views, households, families; a module's menu entry gated by its primary port only | ✓ `DL-175` |
| 1d | Programmes, with guidelines and responsibility (`DL-65`, `DL-66`) | ✓ `DL-176` |
| 2a | The programme editor; assistance requests — intake, filing, the lifecycle, the duplicate check (`DL-60`, `DL-63`) | ✓ `DL-177` |
| 2b | The assessment, requirements and documents (append-only versions, `DL-77`), document requests | next |

**Phase 1 is complete** (1a–1d ✓). **Next: phase 2 — assistance requests**: intake → assessment →
approval, requirements and documents (append-only versions, `DL-77`), advisory evidence that decides
nothing (`DL-60`). Its screens already read `program`, now served; `assistance-request` is what keeps
them withheld.

**For the owner, from phase 1c** (`DL-175`): whether a barangay link should see a family between
addresses only while every member lives in its barangay (the choice made); whether a household's
income is means, withheld from the release officer, the barangay link and the auditor as a
resident's is (the choice made; the mock showed it to them); and whether the console needs to change
a household's address, income or classification, or dissolve a family — the API has no route for
either yet.

**Phase 1d done** (`DL-176`, `taytay-backend` `f887038`): the programme catalogue, served as records.
Utilization is counted from releases and is said to be not connected until phase 4 — no request is
made and no figure shown, never a zero.

**For the owner, from phase 1d** (`DL-176`; the form, the template editor and the reason were approved and built in phase 2a, `DL-177`; the transition rules for a programme's status are still open): whether the console should get a "new programme" form
with guidance, sources and documents (without one the API's catalogue is filled only by the seed or by
direct API calls); whether requirement templates need an editor or stay seed-only; whether a
programme's status needs transition rules (`closed` terminal, say — none was invented); and whether
a change to a programme should carry a reason (the console asks none; the revisions keep who, when
and what, not why).

**Phase 2a done** (`DL-177`, `taytay-backend` `54c68f0`, `cf42d64`): the programme editor — a
"new programme" form, a reason on every change kept beside the version, requirement templates written
with a reason and retired one way — and assistance requests served: intake drafts with no control
number, filing that issues one, the lifecycle as this console states it (moves appended with who, when
and why, refused by the database off the transitions), the duplicate check that decides nothing and
says what it could not read, scope and redaction as the registry's. Scheduling and releasing wait for
payouts (phase 4).

**Next: phase 2b** — the assessment (templates, answers, the recorded assessment), the requirement
review (verify, reject, waive, rule on a conditional document), document files as append-only versions
(`DL-77`) and document requests. Their methods are on the served adapter already and answer, in place,
that they are not connected yet.

**For the owner, from phase 2a** (`DL-177`): whether a social worker should read requests before cases
exist; whether an uncleared intake officer may start a protected person's request but not save over it
(the choice made); whether every status move needs a reason (the choice made) or only the refusing
ones; whether retiring a requirement template stays one way (the choice made); whether the programme
record's edit should become the full form; and the review windows, still conventions awaiting the
office's confirmation (`DL-68`).

**Phase 2b done** (`DL-178`, `taytay-backend` `240803d`), and **phase 2 is complete**.

**Phase 3 done** (`DL-179`, `taytay-backend` `aef52f8`, console `fc30e89`): cases. A case is opened
about one person and names the filed requests it covers, one link at a time; every write takes a
reason and appends its event in the same transaction, and the database refuses the change without
it; `closed` is terminal and a recurrence is a new case naming the closed one; the next action is an
open task; protected notes and a protected subject's words are withheld in the data layer. A social
worker's caseload is now the cases assigned to them as well as the requests, and nothing else.

**For the owner, from phase 3** (`DL-179`): whether a social worker should also see the unassigned
pool (`DL-57` as it was; refused now); whether a social worker on a case should see the subject's
household, family and the linked requests assigned to colleagues (refused now); whether intake
officers should assign cases (they do) when they do not assign requests; whether closing should
cancel open tasks rather than refuse (refused now); whether a wrongly linked request needs an
unlink (none now).

**Phase 4 done** (`DL-180`, `taytay-backend` `da22eec`, console `e6ce50a`): releases. A release is prepared for an
approved request — an amount in integer centavos, or goods described and never valued — with its
approver read from the request's history; every act appends an event in the same transaction, and
the request moves `approved → scheduled → released` through its own history as the payout is
scheduled and handed over; a payout session has no status and is counted from its members; the
payout list is composed by the server; a self-release is recorded and never refused; every money
write carries its idempotency key in the body.

**For the owner, from phase 4** (`DL-180`): whether the key in the body rather than a header is
acceptable; whether approval should record a granted amount the release may not exceed; whether a
prepared release needs a correction act rather than void-and-prepare; whether cancelling or expiring
a request should be refused while its release is open; whether a session needs a close; and whether
programme utilization and the resident's assistance history should now be counted from releases.
**Phase 5 done** (`DL-181`, `taytay-backend` `6436b70`): referrals and field visits. A referral is
drafted with nothing disclosed; the lawful basis and each field beyond the minimum are recorded as
their own acts, only while it is a draft; `send` takes only the id and is refused without a basis
under the row lock, by the route and by the database; the summary sheet is composed by the server
from what the reader could read; overdue and the answer are derived from the history. A visit's
observations each carry their kind and a third party is named; they are appended, never edited; a
visit closes once; and no table, field or parameter records where anybody was. A social worker reads
and writes only the referrals and visits of their own cases (and, for referrals, requests), and a
protected client's words are withheld in the data layer. Visits are scheduled from the case, on a
new page.

**For the owner, from phase 5** (`DL-181`): whether a social worker should see visits assigned to
them on a colleague's case, or visits with no case; whether "who else is in the household" on a
referral sheet should carry names rather than a count; who keeps the provider directory, and from
which screen (it is empty until then); whether the six checklist prompts are the office's; whether
an unsent draft referral should expire, and whether a referral needs a document attachment act.
**Next: phase 6 — the dashboard, work queues, reports, search and events.**
