# Taytay, Rizal LGU Platform — Requirements and Implementation Plan

## 1. Document control

|              |                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deliverable  | "Approved requirements and implementation plan", one of the owner's five priority deliverables                                                     |
| Version      | 1.0                                                                                                                                                |
| Date         | 6 November 2026                                                                                                                                    |
| Status       | **Prepared for approval.** This document is **not approved yet**. It becomes the approved plan only when §9 is signed.                             |
| Repositories | `taytay-mobile-app` (resident app, Flutter) · `taytay-admin-web` (staff console, Angular) · `taytay-backend` (API, Node 20 / Express / PostgreSQL) |
| This file    | `taytay-admin-web/docs/project/requirements-and-implementation-plan.md`                                                                            |

**How to read it.** Every requirement has an id and a status, so it can be approved, changed or
struck one line at a time.

- **Done** means the feature is built and its repository checks pass.
- **In progress** means it is being built now.
- **Planned** means it is the agreed direction but has not started, or it waits for a decision.

Most staff screens were built before staging went live. Their records say "not run against a live
API", so testing them on staging is still a go-live item (GL-10).

Paths are relative to each repository. `DL-…` ids point into the console's
`docs/reference-audit/decision-log.md`.

## 2. Purpose and scope

The platform serves the residents of Taytay's five barangays and the staff of the Municipal Social
Welfare and Development Office (MSWDO). It has three parts:

| Part                                     | Who uses it                                                                                                                                               | What it does                                                                                                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Resident app "Taytay"** (Android, iOS) | Residents, in three states: guest, signed in but not yet verified, verified                                                                               | Creating an account, ID verification, the digital ID, the office directory, Balita news, Tulong information pages, messages to an office, and the resident's household |
| **Staff console** (web browser)          | MSWDO staff: intake officers, social workers, the MSWDO head, release (disbursing) officers, barangay focal persons, auditors and platform administrators | Reviewing IDs, running the app's content, the office inbox, and casework from intake to payout                                                                         |
| **API** (server)                         | Both apps. Nobody uses it directly                                                                                                                        | Stores all data and checks every permission. It is the only authority on what is allowed                                                                               |

**Out of scope for this plan:**

- Payments from residents to the LGU (taxes, permits): `DL-09`.
- Civil-registry document requests and internal office forms: `DL-10`.
- Disaster response (Sakuna), which is in the mandate but deferred: `DL-11`.
- Accounting: no chart of accounts, ledger or bank link (`DL-89`). A release is tracked, not posted.
- SMS or e-mail notices to residents beyond sign-up codes. No gateway was supplied.
- Any tracking of where staff or residents are (`DL-86`).
- Staff features in the resident app, and resident features in the console. Each repository's
  `CLAUDE.md` forbids it.
- The citizen web portal and the verifier kiosk. They are named as channels in the mobile
  `CLAUDE.md`, but no repository exists for either.
- A Filipino-language interface, which is deferred but not rejected (`DL-18`).

## 3. The five deliverables

| #   | Deliverable                                   | What it means                                                                                                                                                                  | Status                                                                                                                                                                                                        | Where it lives                                                                                                                                                                                                                                            | Remaining work                                                                                                                                                                                               |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Citizen registration workflow                 | A resident creates an account, verifies their e-mail, gives a profile and barangay, and submits an ID and a selfie. The office reviews it, and approval issues the digital ID. | **In progress.** The console's verification review and digital-ID issuance are served. The app's registration is being fixed today: the e-mail-code order, and saving the profile and barangay to the server. | App: `docs/taytay-registration-wizard.md`, `docs/frontend/backend-gaps.md` items 1–3 · Console: `/verification`, `/digital-ids` (`docs/verification`, `docs/digital-ids`) · API: `docs/sprints/02-verification.md`, `10-email-otp.md`, `11-digital-id.md` | Finish and test today's fix on staging. Get the S2 sign-in sprint approved. Register an iOS app in Firebase. Settle OD-1.                                                                                    |
| D2  | Citizen roster and administrative dashboard   | The office's own register of the people it serves, the app's account list, and a summary dashboard for the office.                                                             | **Roster done. Dashboard in progress** (being served today).                                                                                                                                                  | Console: `/residents` (office registry), `/users` (app accounts), `/households`, `/families`, `/dashboard` · API: `/office/residents`, `/office/households`, `/office/families`                                                                           | Finish the dashboard, then the work queues and reports (phase 6).                                                                                                                                            |
| D3  | Directory feature                             | Residents find municipal offices, hotlines and Tulong pages. Staff keep that information up to date.                                                                           | **Done** in the app (sprint S5) and in the console (`DL-170`).                                                                                                                                                | App: sprint S5 · Console: `/directory` (`docs/directory`) · API: `docs/sprints/03-directory.md`, `05-tulong.md`                                                                                                                                           | Some office details cannot be changed after creation because the API spec under-declares them. A hidden Tulong page has no admin list. Both need small API fixes (`docs/integration/node-api-migration.md`). |
| D4  | Approved requirements and implementation plan | This document                                                                                                                                                                  | **Prepared for approval**                                                                                                                                                                                     | This file                                                                                                                                                                                                                                                 | Line-by-line review, the statute check (NFR-PRIV-6) and signatures (§9)                                                                                                                                      |
| D5  | Cloud and database setup                      | Hosting, the database, sign-in, file storage and e-mail for staging and production                                                                                             | **Staging done; production not set up.**                                                                                                                                                                      | `taytay-backend/deploy/staging-shared-linode/README.md`, `docs/deploy-linode.md`, `docs/integration-readiness.md`                                                                                                                                         | The production go-live checklist (§7.4)                                                                                                                                                                      |

## 4. Functional requirements

`FR-RES` is the resident app, `FR-STAFF` the staff console and `FR-API` the server.

### 4.1 Registration and verification

| ID         | Requirement                                                                                                                                                                                                                                          | Status                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| FR-RES-1   | A guest can browse offices, Tulong pages, Balita and the home screen without an account.                                                                                                                                                             | Done                    |
| FR-RES-2   | A resident creates an account (Firebase e-mail and password), confirms the e-mail with a six-digit code, accepts the terms and privacy notice, and saves a profile and barangay to the server.                                                       | In progress (fix today) |
| FR-RES-3   | A resident submits an ID (type, front, optional back) and a selfie, and sees the status: not verified, pending, verified, or needs correction with the office's note. While the request is editable they can replace a picture or send a correction. | Done (S3 approved)      |
| FR-RES-4   | A forgotten password is reset with an e-mail code. A signed-in resident changes their password through Firebase.                                                                                                                                     | Done                    |
| FR-STAFF-1 | The review queue lists requests by status. ID pictures are shown only after a privacy warning and are discarded on leaving. Approval and rejection each show what will happen before the button (`DL-167`).                                          | Done                    |
| FR-API-1   | One pending request per account. Pictures are checked as JPEG, PNG or WebP and capped at 5 MB. Approval issues the digital ID.                                                                                                                       | Done                    |

### 4.2 Digital ID

| ID         | Requirement                                                                                                                                                                                                    | Status |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| FR-RES-5   | A verified resident sees their municipal card with a QR code that expires and refreshes.                                                                                                                       | Done   |
| FR-STAFF-2 | Staff check a card from a typed or pasted code (no camera; nothing kept). An administrator issues, suspends, revokes or replaces a card behind a confirmation that says what the resident will see (`DL-171`). | Done   |
| FR-API-2   | The server signs every card. Closing an account, or moving it off `verified`, revokes the card.                                                                                                                | Done   |

### 4.3 Directory

| ID         | Requirement                                                                                                                                                                       | Status            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| FR-RES-6   | Residents search offices and read an office's details, service lines and hotlines. A verified resident can message an office from its page.                                       | Done (S5)         |
| FR-STAFF-3 | An administrator adds, changes and deletes offices, Tulong pages and hotlines. Images are refused before upload if too large or not a picture. Deletes go through a confirmation. | Done              |
| FR-STAFF-4 | Every office detail can be changed after creation, and hidden Tulong pages are listed.                                                                                            | Planned (API fix) |

### 4.4 News and home

| ID         | Requirement                                                                                                                                                                                                          | Status                             |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| FR-RES-7   | The home screen shows banners, quick links, hotlines, the newest Balita and featured Tulong pages.                                                                                                                   | Done (S4 approved)                 |
| FR-RES-8   | Residents read Balita, with pinned articles first, filtered by category.                                                                                                                                             | In progress (S6 awaiting approval) |
| FR-STAFF-5 | Staff write, save as draft, publish, pin and take down Balita. A warning above the publish button says a published article cannot be recalled (`DL-171`).                                                            | Done                               |
| FR-STAFF-6 | An administrator manages banners, quick links and app settings: the contact line, terms and privacy versions, oldest supported app version and feature flags. Every change is reviewed in a confirmation (`DL-170`). | Done                               |
| FR-RES-9   | Events and registration, and Balita comments, reactions and bookmarks                                                                                                                                                | Planned, needs approval (OD-4)     |

### 4.5 Inbox and notifications

| ID         | Requirement                                                                                                                                                                             | Status  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| FR-RES-10  | A verified resident opens a conversation with an office, attaches a photo or PDF, and reads replies. In-app notifications are listed with read marks.                                   | Done    |
| FR-STAFF-7 | The office inbox lists conversations without previewing what residents wrote. Staff reply, mark read and close (with a confirmation). Attachments open only after a warning (`DL-168`). | Done    |
| FR-STAFF-8 | Staff attach an image to a reply.                                                                                                                                                       | Planned |
| FR-API-3   | Push notifications through a real provider, carrying a type and an id only. Today only a mock sender exists.                                                                            | Planned |

### 4.6 Residents, households and accounts

| ID          | Requirement                                                                                                                                                                                     | Status                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| FR-STAFF-9  | `/residents` is the office's registry of people it serves, not app accounts. The server removes what a role may not see. Sectors and retirements are kept as histories with reasons (`DL-174`). | Done                               |
| FR-STAFF-10 | Households and families are kept apart. Relationships and moves are appended, never overwritten, and the vulnerability snapshot is advice only (`DL-175`, `DL-42`).                             | Done                               |
| FR-STAFF-11 | `/users` lists every app account (name, e-mail, role, office). Role and office changes show their effects first, and nobody can change their own role (`DL-168`).                               | Done                               |
| FR-STAFF-12 | Beneficiary view and duplicate review: records are compared without showing values, and there is no merge (`DL-73`, `DL-74`).                                                                   | Planned (no API yet)               |
| FR-RES-11   | A resident keeps one household and sees its address, their role and the member count. Corrections and member management have no screen yet.                                                     | In progress                        |
| FR-RES-12   | My Account: profile, photo, notification preferences, consents (including withdrawal) and closing the account.                                                                                  | In progress (S8 awaiting approval) |

### 4.7 Programmes

| ID          | Requirement                                                                                                                                                                                                                                            | Status         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| FR-STAFF-13 | Programmes are records, not code. Each says who runs it and who holds the funds (AICS is DSWD's). Guidance never refuses anybody. Documents are required, optional or conditional. Every change keeps a reason (`DL-65`, `DL-66`, `DL-176`, `DL-177`). | Done           |
| FR-STAFF-14 | Programme use is counted from releases.                                                                                                                                                                                                                | Planned (OD-5) |
| FR-RES-13   | Residents read Tulong information pages. There is no "apply" button.                                                                                                                                                                                   | Done           |

### 4.8 Assistance requests

| ID          | Requirement                                                                                                                                                                                                                                     | Status                         |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| FR-STAFF-15 | Intake is saved as a draft with no control number. Filing issues the number. The duplicate check is shown as evidence and decides nothing (`DL-60`, `DL-63`).                                                                                   | Done                           |
| FR-STAFF-16 | Requests move only along the agreed lifecycle (draft → submitted → intake review → assessment → endorsed → approved → scheduled → released → completed). Each move records who, when and why, and the server refuses any other move (`DL-177`). | Done                           |
| FR-STAFF-17 | Assessment, requirement review, document versions (replaced, never deleted), masked document numbers, files opened through a one-time grant after a warning, and document requests to the applicant (`DL-178`).                                 | Done                           |
| FR-RES-14   | Residents apply for assistance and upload requirements from the app.                                                                                                                                                                            | Planned, needs approval (OD-4) |

### 4.9 Cases

| ID          | Requirement                                                                                                                                                                                                                                                   | Status |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| FR-STAFF-18 | A case is opened about one person and names the requests it covers. Tasks are the next action. Protected notes are withheld by the server. Every change carries a reason and an event. A closed case stays closed, and a recurrence is a new case (`DL-179`). | Done   |

### 4.10 Releases

| ID          | Requirement                                                                                                                                                                                                                                                                          | Status |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| FR-STAFF-19 | A release is prepared for an approved request: money in whole centavos, or goods described without a value. Payout sessions are counted from their members. The payout sheet is composed by the server. A self-release is warned about but not blocked (`DL-180`, `DL-91`, `DL-93`). | Done   |

### 4.11 Referrals and field visits

| ID          | Requirement                                                                                                                                                                                                                                              | Status                                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| FR-STAFF-20 | A referral cannot be sent without a recorded lawful basis, checked by the server. Each field shared beyond the minimum is chosen with a stated need. The summary sheet is composed by the server, and "overdue" is derived (`DL-81`, `DL-82`, `DL-140`). | In progress (server done, console finishing) |
| FR-STAFF-21 | Every visit observation says whose claim it is (seen, said by the client, said by a named third party, or the worker's judgement). Observations are appended only, and no location is recorded (`DL-85`, `DL-86`).                                       | In progress (server done, console finishing) |

### 4.12 Dashboard and reports

| ID          | Requirement                                                                                                                                        | Status              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| FR-STAFF-22 | An administrative dashboard summarises requests, cases and requests by barangay.                                                                   | Done (`DL-182`)     |
| FR-STAFF-23 | Work queues show what a named person owes, and office alerts show what is wrong with the data. Lateness is said in words (`DL-96`–`DL-103`).       | Planned (phase 6)   |
| FR-STAFF-24 | Fourteen reports, thirteen of them aggregate. Small counts are withheld, and every export carries its own handling conditions (`DL-104`–`DL-108`). | Planned (phase 6)   |
| FR-STAFF-25 | Search covers names, reference numbers, barangay and status only. Recent searches are never saved (`DL-109`, `DL-110`).                            | Planned (phase 6)   |
| FR-STAFF-26 | Newsfeed and events (staff side), plus governance: retention, corrections and the casework audit trail (`DL-113`–`DL-117`, `DL-122`–`DL-131`).     | Planned (phase 6)   |
| FR-STAFF-27 | The app's audit trail: six fields per row and no stored values (`DL-171`).                                                                         | Done                |

### 4.13 Accounts, roles and the API

| ID          | Requirement                                                                                                                                                                                                                                                                | Status          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| FR-STAFF-28 | Staff sign in with Firebase e-mail and password. Signing out ends every session of that account on the server (`DL-166`).                                                                                                                                                  | Done            |
| FR-STAFF-29 | Staff two-factor sign-in (TOTP). It is built, but it needs Firebase Identity Platform, which requires billing.                                                                                                                                                             | Planned (OD-3)  |
| FR-API-4    | Office roles (intake officer, social worker, MSWDO head, release officer, barangay link, auditor, administrator) and their permissions are decided by the server and published on `/me`. Data scope is all barangays, own barangay or assigned cases (`DL-173`, `DL-174`). | Done            |
| FR-API-5    | One response shape with stable error codes and a request id. Lists are read a page at a time. The API description is served at `/docs`.                                                                                                                                    | Done            |
| FR-API-6    | Rate limit of 120 calls a minute per client and path. Request bodies are capped at 100 KB and images at 5 MB.                                                                                                                                                              | Done            |
| FR-API-7    | The first administrator can be created without a database edit.                                                                                                                                                                                                            | Planned (GL-13) |

## 5. Non-functional requirements

| ID         | Requirement                                                                                                                                                                                                                                                         | How it is held                                                  | Status                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| NFR-PRIV-1 | Personal data follows the **Data Privacy Act of 2012 (RA 10173)**. No field is added without a stated need.                                                                                                                                                         | Console `CLAUDE.md` §6, mobile `CLAUDE.md` Art. 5               | Done                                                              |
| NFR-PRIV-2 | **PhilSys (RA 11055):** only the last four digits of a PhilSys number are ever held or shown.                                                                                                                                                                       | Domain model; no full-number field exists                       | Done                                                              |
| NFR-PRIV-3 | **Sensitive sectors** (VAWC survivors, RA 9262; children in conflict with the law, RA 9344) are withheld **by the server**, so a screen cannot show what it never received (`DL-38`).                                                                               | Server redaction by role                                        | Done                                                              |
| NFR-PRIV-4 | No personal data in logs, error messages or analytics. Residents never see raw server messages.                                                                                                                                                                     | Log redaction (API); `toString` redaction (app)                 | Done                                                              |
| NFR-PRIV-5 | No real resident data in any repository, fixture or screenshot.                                                                                                                                                                                                     | Each repository's `CLAUDE.md`                                   | Done                                                              |
| NFR-PRIV-6 | The statute citations above were written from knowledge and have **not** been checked against the primary text. Verify them before formal adoption (console `CLAUDE.md` §6).                                                                                        | Legal review                                                    | Planned                                                           |
| NFR-SEC-1  | Sign-in uses a **Firebase ID token**, a short-lived pass sent with each request as a "bearer" header. The server verifies it on every call.                                                                                                                         | API `AUTH_VERIFIER=firebase`                                    | Done                                                              |
| NFR-SEC-2  | Tokens are **never stored in the browser** (no local storage, cookie or URL). They are held in memory only. The app keeps its session in memory until a keystore store exists.                                                                                      | Console `check:contract`; mobile Art. 5.3                       | Done                                                              |
| NFR-SEC-3  | **Exact-origin CORS:** the API answers only the console addresses it names, with no wildcard and no credentials header.                                                                                                                                             | API `src/http/cors.ts`                                          | Done                                                              |
| NFR-SEC-4  | **The server re-checks every permission.** A hidden button is never the protection.                                                                                                                                                                                 | Route guards on the API                                         | Done                                                              |
| NFR-SEC-5  | A strict content-security policy without inline exceptions, verified on the deployed sites (`DL-172`).                                                                                                                                                              | Caddy config on staging                                         | In progress                                                       |
| NFR-SEC-6  | No secrets in a repository or app binary. The Firebase client identifiers are the one named exception (mobile D-185).                                                                                                                                               | Secret files on the server only                                 | Done                                                              |
| NFR-MON-1  | **Money is whole centavos.** No decimal arithmetic on amounts, ever. Pesos are formatted only on screen. Every money write carries a one-time key, so a repeated click cannot pay twice.                                                                            | Console `check:money`; API idempotency key                      | Done                                                              |
| NFR-REC-1  | **Records are appended with reasons, never overwritten:** request moves, case events, document versions, relationships and visit observations (`DL-48`, `DL-54`, `DL-77`, `DL-85`). The single exception: removing a resident comment deletes its words (`DL-127`). | Database refuses a change without its event                     | Done                                                              |
| NFR-DEC-1  | **The software advises; people decide.** No score, eligibility verdict or automatic approval anywhere (`DL-42`, `DL-60`, `DL-66`, `DL-78`).                                                                                                                         | Console `check:intake`, `check:vulnerability`, `check:programs` | Done                                                              |
| NFR-SOD-1  | **Separation of duties:** no non-administrator role may both approve a request and release its money. This is enforced by the server, and a self-release is warned about (`DL-91`, `DL-173`).                                                                       | API role table plus a console test                              | Done                                                              |
| NFR-A11Y-1 | **WCAG 2.2 Level AA** in both apps (`DL-20`): contrast tested, 48 dp touch targets, text scaling up to 200%, reduced motion respected, status in words as well as colour.                                                                                           | Lint rules (console); theme tests (app)                         | Done; still to be checked against real data (launch gate line 16) |
| NFR-PERF-1 | **Low-end phones:** the app must stay usable on Android phones with under 2 GB of memory and on weak connections. Images are decoded at display size (about 18 times less memory), and the font is bundled rather than downloaded.                                  | `taytay-mobile-app/docs/taytay-offline-and-performance.md`      | Done; still to be measured on `docs/frontend/device-matrix.md`    |
| NFR-OFF-1  | **Honest offline behaviour:** a lost connection shows a warning ("Not reaching Taytay LGU"). Nothing is queued or retried in the background, and nothing is called saved until the server confirms it (`DL-87`, `DL-118`).                                          | Both apps                                                       | Done                                                              |

## 6. Architecture and environments

```text
 Resident app (Android/iOS) ─┐                      ┌─▶ PostgreSQL database
                             ├─ HTTPS + Firebase ──▶│  API /api/v1 (Node)
 Staff console (browser) ────┘   ID token           ├─▶ File storage (ID pictures, covers)
                                                    ├─▶ Firebase Auth (checks the sign-in)
                                                    └─▶ E-mail (sign-up and reset codes)
```

Both apps are clients only. The API is the single authority (console `CLAUDE.md` §1, mobile
`CLAUDE.md` Art. 3).

|                | local-mock                   | local-api                            | staging                                                                                  | production                              |
| -------------- | ---------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| Purpose        | Design and demos on a laptop | Developer testing                    | Office acceptance testing                                                                | Real residents and staff                |
| API            | None (sample data)           | `http://localhost:3000/api/v1`       | https://taytay-api.139-162-51-165.sslip.io/api/v1                                        | `api.<approved-domain>`, not chosen     |
| Console        | `npm start`                  | `ng serve --configuration local-api` | https://taytay.139-162-51-165.sslip.io                                                   | Not set up                              |
| Sign-in        | Sample accounts              | Development tokens                   | Firebase `taytay-lgu-ids-staging`                                                        | No Firebase project yet                 |
| Database       | None                         | In-memory or Docker PostgreSQL       | PostgreSQL in Docker, 33 migrations, nightly dump kept 7 days, restore tested 2026-11-06 | Managed PostgreSQL with TLS, not set up |
| Files / e-mail | None                         | Local folder / not sent              | Local volume / not sent (`EMAIL_SENDER=mock`)                                            | Private object storage / SMTP           |
| Server         | Laptop                       | Laptop                               | Shared Linode (2 GB) with three other systems, Docker, Caddy                             | Not set up                              |

The resident app chooses its environment when it is built (`dev`, `staging` or `prod`). Sample data
is allowed only in a development debug build. Staging and production builds refuse to start with it.

## 7. Implementation plan

### 7.1 Platform and staff console

| Step | What                                                                                                                                       | Status                                                                                     | Date                            | Record                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------- |
| 0    | The Node API replaces the retired Laravel backend                                                                                          | Done                                                                                       | 2026-10-20                      | `DL-164`                                      |
| T    | Console connects to the Node API: exact-origin CORS, permissions on `/me`, server sign-out, Firebase sign-in with tokens in memory         | Done                                                                                       | 2026-11-05/06                   | `DL-165`, `DL-166`                            |
| P    | Platform screens: ID review, inbox, users and roles, directory, home screen, app settings, digital IDs, Balita, app audit trail            | Done                                                                                       | 2026-11-05/06                   | `DL-167`–`DL-171`                             |
| S    | Staging deployed, with Firebase staging project, CSP nonce and nightly backups                                                             | Done                                                                                       | 2026-11-05 (backups 2026-11-06) | `DL-169`, `DL-172`                            |
| 1    | Casework foundation: office roles and separation of duties on the server, resident registry, saved views, households, families, programmes | Done                                                                                       | 2026-11-06                      | `DL-173`–`DL-176`                             |
| 2    | Assistance requests: intake, filing, lifecycle, assessment, documents, document requests                                                   | Done                                                                                       | 2026-11-06                      | `DL-177`, `DL-178`                            |
| 3    | Cases                                                                                                                                      | Done                                                                                       | 2026-11-06                      | `DL-179`                                      |
| 4    | Releases and payout sessions                                                                                                               | Done                                                                                       | 2026-11-06                      | `DL-180`                                      |
| 5    | Referrals and field visits                                                                                                                 | **In progress**: the server is done (`taytay-backend` `6436b70`), the console is finishing | 2026-11-06                      | `DL-181` (cited; not yet in the decision log) |
| 6    | Dashboard, work queues, reports, search, newsfeed and events, governance                                                                   | **Next**. The dashboard is served (`DL-182`)                                               | —                               | —                                             |

The phase detail and the owner's open questions from each phase are in
`taytay-admin-web/docs/integration/node-api-migration.md`.

### 7.2 Resident app sprints

This table follows `taytay-mobile-app/docs/frontend/sprint-signoffs.md`.

| Sprint                                                           | State                                                              |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| S0 Foundations, S1 Welcome, S4 Shell and Home                    | Approved by design review (Ui/Ux Taytay)                           |
| S3 Verification                                                  | Approved by the owner, merged                                      |
| S5 Directory                                                     | Approved by the owner, according to the table (but see Appendix A) |
| S2 Sign-in, S6 Balita, S8 My Account                             | In review, not approved                                            |
| S7 Tulong, S9 Polish                                             | Recorded, no approval                                              |
| Registration fix (e-mail-code order, profile and barangay saved) | In progress today                                                  |

### 7.3 After phase 6

Run acceptance on staging with one test account per role, then re-measure the launch gate
(`docs/integration/launch-gate.md`, last measured 2026-08-29 and still **NO-GO**). Then work through
§7.4.

### 7.4 Production go-live checklist

| #     | Item                                                                                                                                                                                                                                                                                                                                                                              | Needs                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| GL-1  | A production Firebase project, separate from staging, with Android and iOS apps registered, and its service-account key placed only on the production server                                                                                                                                                                                                                      | A person: account, possibly billing |
| GL-2  | Domain and DNS: approved names for the API and the console (and `staging.lguids.com.ph` in place of sslip.io), TLS certificates, then the API's allowed origins, the console CSP, the console production `apiBaseUrl` and the app's `TAYTAY_API_BASE_URL`                                                                                                                         | A person, then the developer        |
| GL-3  | An SMTP account for sign-up and password-reset codes (`EMAIL_SENDER=smtp`)                                                                                                                                                                                                                                                                                                        | A person                            |
| GL-4  | A private Linode Object Storage bucket and access key (`MEDIA_STORE=linode`), never a public bucket                                                                                                                                                                                                                                                                               | A person, then the developer        |
| GL-5  | Managed PostgreSQL that is not reachable from the internet, with verified TLS (`DATABASE_SSL=require`) and migrations through `npm run migrate:prod`. Backups kept off the server, a restore performed and timed, and a rollback rehearsed (launch gate line 18)                                                                                                                  | The developer                       |
| GL-6  | The Firebase browser key restricted to the console's web address (HTTP referrer), on staging and production                                                                                                                                                                                                                                                                       | The developer                       |
| GL-7  | The API runs with `NODE_ENV=production`. It then refuses to start with mock sign-in, local file storage, mock e-mail, an unencrypted database, a missing digital-ID signing key or a non-https web address, and the seed script refuses to run. Console production builds cannot contain sample data (`check:environments`, `check:bundle`), and app release builds refuse mocks. | The developer                       |
| GL-8  | App store releases. Android: an upload keystore kept safe (losing it blocks updates) and a Play listing. iOS: an Apple Team ID, an iOS app in Firebase and an App Store listing. Both: the production API address built in (`taytay-mobile-app/docs/release.md`).                                                                                                                 | A person and the developer          |
| GL-9  | Privacy notice text published through the API (it is a placeholder today), a Data Protection Officer appointed, and a retention schedule approved (launch gate line 14)                                                                                                                                                                                                           | LGU                                 |
| GL-10 | Every screen exercised on staging with real role accounts, six role sign-offs, WCAG checked against real data, and the CSP inspected on the live sites (launch gate lines 13, 16, 17)                                                                                                                                                                                             | Office staff and the developer      |
| GL-11 | Backend fixes: `trust proxy` behind the proxy (or every client shares one rate limit), expose `Retry-After`, and answer an unexpected upload field with 4xx, not 500                                                                                                                                                                                                              | The developer                       |
| GL-12 | Service targets and alerts that reach a named person (launch gate line 15)                                                                                                                                                                                                                                                                                                        | LGU and the developer               |
| GL-13 | A written procedure for creating the first administrator                                                                                                                                                                                                                                                                                                                          | The developer                       |
| GL-14 | Decide where the console is hosted in production: Linode with Caddy (as on staging) or Netlify (named in `docs/integration-readiness.md`)                                                                                                                                                                                                                                         | The owner                           |

## 8. Risks and open decisions

| ID  | Risk                                                                                                                    | Response                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| R-1 | Production does not exist, and the launch gate is NO-GO on a document older than the Node API                           | Re-measure the gate after phase 6 (§7.3)          |
| R-2 | Staging shares a 2 GB server with three other systems, and its backups are on the same machine                          | Use it for testing only. Production follows GL-5. |
| R-3 | Staging runs `NODE_ENV=development` (no SMTP or storage yet), so production's start-up refusals have not been exercised | Exercise them as part of GL-7                     |
| R-4 | Staging sends no e-mail, so the sign-up code cannot be tested with a real inbox                                         | GL-3                                              |
| R-5 | No Data Protection Officer and no retention schedule. These have the longest lead time.                                 | Start GL-9 now                                    |
| R-6 | One Firebase project serves residents and staff, so signing out ends every session of that account, on both apps        | Accept, or keep staff accounts separate           |
| R-7 | Statute citations are unverified                                                                                        | NFR-PRIV-6                                        |

| ID   | Open decision for the owner or the LGU                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OD-1 | Should the ID reviewer see the account's name and birth date to compare with the ID? (This shows more personal data, and the API would need a change.)                                                                                                                                      |
| OD-2 | Should the office inbox name the resident? Should closing a conversation tell them, and keep a reason?                                                                                                                                                                                      |
| OD-3 | Should staff two-factor sign-in be turned on? It needs Identity Platform, which needs billing.                                                                                                                                                                                              |
| OD-4 | Events, Balita comments and reactions, and assistance applications from the app: approve or keep out? The API lists them as not covered until approved, while console phase 6 plans events.                                                                                                 |
| OD-5 | The casework questions raised in phases 1c–5, for example: the social worker's view of the unassigned pool, closing a case with open tasks, a granted-amount ceiling, programme use from releases, and who keeps the referral provider directory (`node-api-migration.md`, "For the owner") |
| OD-6 | The review windows and the small-count threshold are conventions that await the office's confirmation (`DL-68`, `DL-105`)                                                                                                                                                                   |
| OD-7 | Who signs resident-app sprint approvals. The sign-off file asks for Paul's words but records approvals by design review and by the owner.                                                                                                                                                   |

## 9. Approval

Signing below approves the requirements in §4–§5 and the plan in §7 as written. A change after
approval is issued as a new version.

| Role                             | Name | Signature | Date |
| -------------------------------- | ---- | --------- | ---- |
| Prepared by                      |      |           |      |
| Reviewed by (developer)          |      |           |      |
| Approved by (owner / MSWDO head) |      |           |      |

| Version | Date       | Change                               |
| ------- | ---------- | ------------------------------------ |
| 1.0     | 2026-11-06 | First version, prepared for approval |

## Appendix A. Sources and how current they are

| Source                                                                                                                                                                   | Use                                                      | Currency                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `taytay-admin-web/CLAUDE.md`                                                                                                                                             | Rules: privacy, money, append-only, separation of duties | Current, except it still says 2 of 20 ports are served (the migration record says 8 remain unserved)                                      |
| `taytay-admin-web/docs/integration/node-api-migration.md`                                                                                                                | Phase plan and owner questions                           | Current in its step table. Its summary table, phase table (2b "next") and "For the owner to decide" list are out of date                  |
| `taytay-admin-web/docs/integration/launch-gate.md`                                                                                                                       | Go-live conditions                                       | Measured 2026-08-29, before the Node API and staging. Its own totals disagree (four or five lines with evidence)                          |
| `taytay-admin-web/docs/reference-audit/feature-source-matrix.md`, `decision-log.md`                                                                                      | Module origins and decisions                             | The matrix's statuses date from TAB 01 (for example, Balita is listed as excluded but is built under `DL-171`). The log runs to `DL-180`. |
| `taytay-mobile-app/CLAUDE.md`, `docs/frontend/backend-gaps.md`, `docs/frontend/sprint-signoffs.md`                                                                       | App rules, API gaps, sprint approvals                    | Mostly current. The app's default development API port (8000) is not the Node API's (3000)                                                |
| `taytay-mobile-app/docs/taytay-mobile-feature-matrix.md`, `docs/master-command/`                                                                                         | Early feature mapping                                    | **Stale.** Dated August 2026 and pinned to the retired PHP (Laravel) backend                                                              |
| `taytay-backend/README.md`, `docs/api/endpoints.md`, `docs/sprints/`, `docs/integration-readiness.md`, `docs/deploy-linode.md`, `deploy/staging-shared-linode/README.md` | API surface, providers, deployment                       | Current. `integration-readiness.md` still says no service-account key exists, though staging runs with one                                |
