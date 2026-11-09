# Known limitations and open items

As of 2026-11-07, with the newsfeed's retirement on 2026-11-09 (`DL-194`). Each item names its
source so it can be checked and closed. Ids such as `GL-3`,
`OD-3`, `FR-STAFF-4` and `T-5` refer to the requirements document,
`docs/project/requirements-and-implementation-plan.md` (version 1.4, not approved).

## 1. The platform is not ready for production

- **The launch gate is NO-GO.** `docs/integration/launch-gate.md` was last measured on
  2026-08-29, before the Node API and before staging existed, and its own totals disagree (four or
  five lines with evidence). Lines 13 and 18 were brought up to date for staging on 2026-11-07
  (deployed; nightly backups and a tested restore) and stay NO-GO; the rest is due to be
  re-measured after phase 6 (requirements §7.3, R-1).
- **Production does not exist.** No server, database, bucket, domain, Firebase project, store
  account or signing key has been supplied
  ([environments-and-hosting.md](environments-and-hosting.md)).
- **No acceptance round has been run.** The UAT pack is ready (`docs/uat/`), the test accounts are
  not yet created, and nothing is signed.
- **The requirements document is not approved** (see section 4).

## 2. Console modules the API does not serve

**None since 9 November 2026.** The newsfeed was the last of the console's data ports bound to an
"unserved" adapter. The owner retired it, with its screens, in favour of Balita, the news residents
read in the app (`DL-194`), so all 32 ports are served by the API and `UNSERVED_HTTP_PORTS`
(`src/app/data/http/unserved-repositories.ts`) is empty. `check:routes` now fails the build on any
port bound to an unserved adapter.

The mechanism stays for a module built ahead of its API: such a screen makes no request, is hidden
from the menu and is named on the console's "Not connected yet" page. With nothing unserved, that
page says every part of the console is served, and the menu links it only for a staff account that
is not assigned to an office, to tell it why it has no office inbox (`DL-168`).

Comments and reactions on Balita, which the newsfeed would have counted, are not built (FR-RES-9,
FR-STAFF-34, OD-4): see section 8.

## 3. Other things not built or not finished

From `docs/uat/README.md` ("Not in this UAT round") and the requirements document:

- **Console:** ending a family relationship (FR-STAFF-10), a resident's sector history
  (FR-STAFF-9) and a programme's change history (FR-STAFF-13) are recorded but no screen shows
  them; programme use counted from releases (FR-STAFF-14); images in staff replies in the inbox
  (FR-STAFF-8).
- **Governance** (`DL-191`): the audit trail records who, what, which record and when — not which
  fields changed, their values or the reason, so the auditor's "recorded values" say none were
  stored and "only sensitive" cannot be used. A staff member's employee ID, unit, contact, position
  and last sign-in are not recorded. Retention periods wait for the office's RA 9470 schedule.
  Capturing a correction request is not built.
- **Directory:** some office details cannot be changed after the office is created, and hidden
  Tulong pages have no admin list. Both need small API fixes (FR-STAFF-4).
- **Staff two-factor sign-in** is off (FR-STAFF-29, NFR-SEC-7; decision OD-3 below).
- **Push notifications:** the API has only a mock sender and the app has no push plugin
  (FR-API-3, T-14). In-app notifications work.
- **Events** (`DL-192`): served to the console and to the residents' app, which is wired to them
  (app `bc9a201`, D-191) but has no staging build that includes them yet. A published event cannot be corrected; a registrant's name is the one on
  their app account; residents are told of a cancellation or a moved place in the app only.
- **Residents' app:** applying for assistance from the app (FR-RES-14, waits for OD-4); events
  (served and wired, D-191, awaiting a staging build) and Balita reactions (FR-RES-9); My Account details and the household screen (FR-RES-11, FR-RES-12,
  in progress); emergency alerts (FR-RES-16, proposed). **No iOS build exists**, and iOS cannot
  sign in until an iOS app is registered in Firebase.
- **App sprints awaiting approval:** S2 Sign-in, S6 Balita and S8 My Account are in review; S7
  Tulong and S9 Polish are recorded with no approval; the S5 Directory record contradicts itself
  (requirements §7.2).
- **API fixes before production** (GL-11): done on 8 November 2026. The API trusts only
  private-network proxies, so each client has its own rate limit and OTP throttle (backend
  `b6f206f`; `TRUST_PROXY` if production's proxy is elsewhere); CORS exposes `Retry-After`; and every
  malformed upload is answered with a 413 or 422 rather than a 500 (`e32be23`).

## 4. Decisions waiting on the owner or the LGU

| Decision                                                                    | Who decides                                                | Source                                                          | What waits on it                                                                                                                        |
| --------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Which e-mail sender (SMTP account) to use**                               | Owner                                                      | GL-3, R-4                                                       | Sign-up codes on staging and production; UAT cases REG-04 to REG-07 and REG-12 are blocked until then                                   |
| **Whether staff sign-in needs a second step** (two-factor)                  | Owner ("to decide later", 6 Nov 2026)                      | OD-3, C-3                                                       | Needs Firebase Identity Platform, which needs billing. NPC Circular 2023-06 §16 is cited                                                |
| **Approval of the requirements document**                                   | Owner, the MSWDO head, and the Data Privacy Officer for §5 | §9, OD-9                                                        | Everything that counts as "approved requirements", including what the warranty covers                                                   |
| **The Terms of Use and Privacy Notice texts**                               | The LGU, with its Data Privacy Officer                     | GL-9, NFR-PRIV-12, `DL-186`                                     | Both are placeholders. An administrator publishes them in the console (App settings); a new version asks every resident to accept again |
| **Production accounts and infrastructure**                                  | Paul Espinas to supply                                     | GL-1, GL-2, GL-4, GL-5, GL-8                                    | Production; see the register                                                                                                            |
| Where the console is hosted in production: Linode with Caddy, or Netlify    | Owner                                                      | GL-14                                                           | Console production deployment                                                                                                           |
| Confirming the Data Privacy Officer; NPC registration; retention schedule   | LGU leadership and the DPO                                 | GL-9, GL-15, R-5                                                | Launch gate line 14. Longest lead time of any item                                                                                      |
| A breach-management procedure and response team                             | LGU (DPO) with the developer                               | GL-16 (Proposed)                                                | Go-live                                                                                                                                 |
| Service targets and alerts that reach a named person                        | LGU with the developer                                     | GL-12                                                           | Launch gate line 15                                                                                                                     |
| Events, Balita comments and reactions, and applying from the app            | Owner, with the LGU's agreement (the TOR names them)       | OD-4, R-11                                                      | Balita comments and reactions (FR-RES-9, FR-STAFF-34), events, FR-RES-14                                                                |
| ~~Retire the console's newsfeed in favour of Balita~~ **Decided 2026-11-09: retired** | Owner ("do what's best")                         | OD-4, `DL-171`, `DL-192`, `DL-194`                              | Nothing now. No port is unserved; the other launch-gate lines still apply. The backend still lists the nine `newsfeed.*` keys, and its console-parity test fails until they go (`DL-194`) |
| Whether the ID reviewer sees the account's name and birth date              | Owner and office                                           | OD-1                                                            | Deliverable D1's acceptance                                                                                                             |
| Whether the office inbox names the resident, and closing notices            | Owner and office                                           | OD-2                                                            | —                                                                                                                                       |
| Casework questions from phases 1 to 6f                                      | Owner                                                      | OD-5; `docs/integration/node-api-migration.md`, "For the owner" | —                                                                                                                                       |
| Review windows and the small-count threshold                                | MSWDO head                                                 | OD-6 (`DL-68`, `DL-105`)                                        | Both show "pending confirmation" on screen until recorded                                                                               |
| Who signs resident-app sprint approvals                                     | Owner                                                      | OD-7                                                            | Sprints S2, S6 to S9                                                                                                                    |
| PhilSys: which four digits are held, and the IRR duty                       | Owner with the DPO                                         | OD-8                                                            | —                                                                                                                                       |
| Document Request scope: which documents and offices, fees shown, collection | Owner and the LGU                                          | OD-10                                                           | The catalogue the LGU enters (section 5)                                                                                                |
| Emergency alerts: separate from hotlines? who sends, to whom                | Owner and the LGU                                          | OD-11                                                           | Phase 8                                                                                                                                 |
| Barangay validation and endorsement: which acts, which accounts             | Owner and the LGU                                          | OD-12                                                           | Phase 8                                                                                                                                 |

## 5. Data the LGU must enter

The software invents no office data or policy (requirements A-1). Before the office relies on the
platform, the LGU enters and checks:

- **Document types for Document Request.** The catalogue is empty on staging (as recorded by the
  developer on 7 November 2026; not re-checked against the server for this package). An
  administrator keeps it in the console under **Resident document requests**. For each document:
  the issuing office, what the resident must bring, and any fee to display (nothing is paid
  online, `DL-09`). Processing times follow the Citizen's Charter once it is supplied
  (FR-STAFF-30). Do not use the "(sample)" types that `npm run seed` would add.
- **The directory.** `npm run seed` creates nine offices with their names only. Each office's
  details, its hotlines and the Tulong pages are entered in the console under **Directory**, and
  the app's home screen under **Home screen**.
- **The programme catalogue** for casework: each programme, who administers and funds it, and its
  guidelines (FR-STAFF-13, `DL-65`, `DL-66`).
- **Office conventions:** review windows and the small-count threshold (OD-6), and the retention
  schedule (GL-9). Until then, screens say "No schedule recorded" or "pending confirmation".
- **Staff accounts:** one per member of staff, with role, office and office role (section 8 of
  [operations-runbook.md](operations-runbook.md) for the first administrator).
- **The Terms of Use and Privacy Notice** (section 4).

## 6. Testing caveats

Recorded by the developer and **not re-run for this package**.

- **27 golden-image tests in the residents' app fail only on the developer's PC.** The reference
  images were made with Flutter 3.44 (the version in the app's README); the developer's PC, with
  Flutter recorded as 3.47, renders fonts differently. Run them on a machine with the reference
  version before treating a failure as a defect.
- **Timing flakes under memory pressure** on the developer's 8 GB PC: the console's
  `src/app/features/digital-ids/digital-ids.spec.ts`, the backend's `retry_after` test in
  `tests/email-otp.test.ts`, and first-test timeouts. Each passes when run alone.
- **No hosted build service (CI).** Tests run only when the developer runs them before a push.
- **Not yet checked on staging:** the content-security policy inspected on the live site
  (NFR-SEC-5), accessibility (WCAG 2.2 AA) against realistic data (NFR-A11Y-1), role sign-offs
  (GL-10), and direct checks against the API for rate limits, size caps and CORS.

## 7. Staging limitations

- **No e-mail.** Sign-up codes never arrive, so registration cannot be finished there.
- **Android only** for the app; no iOS build.
- **Reloading the staff console signs the user out.** This is by design: the sign-in token is
  kept in memory only (NFR-03 in the UAT pack).
- **A shared 2 GB server**, with its backups on the same machine (R-2). Test data only.
- **`NODE_ENV=development`**, so production's start-up refusals have never been exercised (R-3).
- **An sslip.io address**, and the Firebase browser key has no HTTP-referrer restriction yet
  (GL-6).
- **One Firebase project serves residents and staff**, so signing out ends every session of that
  account, on both apps (R-6, A-2).

## 8. TOR modules not built: phases 6 to 8

The requirements document traces the Terms of Reference (TOR) through the developer's brief of
4 November 2026, not through the TOR itself (§3.2, R-10). Its phases 6 to 8 hold what is not built:

| TOR feature                                                     | Status on 7 Nov 2026                                                                                                 | Phase                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| T-10 Beneficiary records, fund tracking, duplicate-claim checks | Built (`DL-187`): the registry, duplicate review and utilization from releases. Programme membership is not recorded | 6b                                                                 |
| T-12 Audit trails                                               | Built (`DL-191`): the office's trail in words and the app's by id. No field, value or reason is recorded             | 6b                                                                 |
| T-18 Analytics and reports, dashboards, exports                 | Built: the dashboard, search, the work queues (`DL-189`) and the fourteen reports with their exports (`DL-190`)      | 6b                                                                 |
| T-16 Event and program postings                                 | Built for the office, on the API (`DL-192`) and wired in the residents' app (D-191)                            | 6b, after OD-4                                                     |
| T-17 Engagement monitoring                                      | Deferred: Balita has no comments or reactions to count. The console's newsfeed was retired (`DL-194`)                | A future Balita feature, after OD-4                                |
| T-9 Tulong applications from the app                            | The staff side is built; applying from the app is not offered                                                        | After OD-4                                                         |
| T-11 Barangay validation and endorsement                        | Not started                                                                                                          | 8, after OD-12                                                     |
| T-15 Emergency alerts                                           | Partly built: hotlines and Balita advisories. No alert feature                                                       | 8, if OD-11 adopts it                                              |
| T-14 Push notifications                                         | Partly built: in-app only                                                                                            | Needs a sender, the app plugin and the production Firebase project |
| T-5 Document Request (phase 7)                                  | **Built on staging** on 7 Nov 2026 (API, console and app); UAT still to run                                          | 7 (done)                                                           |

## 9. Gaps and inconsistencies in the documentation

Found while preparing this package. The contradictions and runbook gaps fixed on 7 November 2026
are no longer listed (console `1564ea0`, `5210aa1`; backend `9f42f49`; mobile `8e3a771`): the
requirements plan's phase 7 rows, launch gate lines 13 and 18, the staging rollback, the Firebase
key note in the backend, the staging environment comment, the PHP secret scanner (now
`npm run scan:secrets`), the UAT workbook, the Android upload keystore (decision D-186 in the
mobile repository; see the register) and the backup script, which is now in the backend
repository. What remains is for the developer or the owner:

- **The backend's `CLAUDE.md` calls Paul "repository owner"**; the requirements document names
  Michaela Angela E. Cailing as the project owner who approves.
- **The secret scan is clean** (`npm run scan:secrets`, 7 November 2026: 5 accepted, 0 findings).
  Four findings were read and accepted in `docs/integration/secret-scan-allowlist.txt`, each with
  its reason: sign-in fixtures in three `*.spec.ts` files that no account uses, and the staging
  Firebase browser key, which is public configuration (`DL-169`). The key still needs its
  HTTP-referrer restriction (GL-6, above).
- **The first-administrator command is rehearsed on staging, not yet signed off** (GL-13,
  `DL-188`): `npm run admin:grant -- --email …`, run inside `taytay-api`. Rehearsed on staging on 7 November 2026 (backend `a7a1884`): run twice for the existing administrator, it answered "granted administrator to …" both times and changed nothing the second time; for an address with no Firebase account it refused and said why. The owner signs
  the rehearsal off before it is run in production
  ([operations-runbook.md](operations-runbook.md), section 8).
- **The intake advisory does not read payouts to other people at the applicant's address**
  (`DL-188`). It reads the applicant's own payouts and open cases, and says in the panel that the
  household's were not read, so "Someone else at this address received assistance" is never
  raised yet.
- **The residents' app does not send `idempotency_key` with an office message** (`DL-188`). The API
  accepts it and the console sends it with every reply; until the app sends one, a resident's retry
  after a timeout can still post a message twice.
- **Rollback, restore and key rotation are written down but not rehearsed or timed** on staging
  (launch gate line 18).
