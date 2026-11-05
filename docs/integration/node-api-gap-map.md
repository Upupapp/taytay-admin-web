# Gap map — taytay-admin-web (Angular staff console) vs taytay-backend (Node/Express/Postgres)

Read-only survey, 2026-11-05. Sources: admin-web `domain/ports/repositories.ts`, `data/http/http-repositories.ts`,
`data/http/api.contract.ts`, `domain/access/*`; backend `docs/api/endpoints.md`, `openapi/openapi.json` (102 ops,
matches the doc), `src/auth/*`, `src/modules/*/routes.ts`, `migrations/*`. All paths are under `/api/v1`.

## 0. Cross-cutting blockers (they hit every row)

| # | Topic | admin-web today | Node today | Consequence |
|---|---|---|---|---|
| B1 | Sign-in | `POST auth/tokens` (email+password), `auth/tokens/mfa`, `DELETE auth/tokens/current` | No sign-in route. Firebase client SDK signs in; API only verifies the Firebase ID token (`Authorization: Bearer`). Dev: `mock:<role>:<uid>` | Console needs the Firebase JS SDK (new dependency) or a dev mock-token path. No MFA, no server sign-out (`Server-side token revocation: Not covered`). |
| B2 | Identity | `GET me` -> `permissions[]`, `roles[]`, `scope`, `position` | `GET /me` -> single `role` + `office_id`; no permissions/roles/scope | `fromServerIdentity` grants zero permissions, falls back to role `auditor`, scope `assigned-cases` -> every guard bounces. |
| B3 | CORS | Browser app | No CORS middleware at all (`integration-readiness.md`: "does not embed a browser origin list yet") | Preflight with `Authorization` fails from any other origin. |
| B4 | Paging | Offset: `page`,`per_page`; meta `{page,per_page,total,total_pages,has_more}`; `Page<T>` shows totals | Cursor: `limit` 1-50 (default 20), `cursor`; meta.pagination `{has_more,next_cursor}`; no totals | `ApiClient.page`/`everyPage` must be rewritten; "N of M" and page numbers unfillable. |
| B5 | Envelope | `{data,meta}`; error `{error:{code,message,details,request_id}}` | Same shapes | FULL fit — `core/http/api-failure.ts` already reads it. |
| B6 | Base URL | `http://localhost:8000/api/v1` (local-api) | default `PORT=3000`, `/api/v1` | env change only. |
| B7 | Scope of the API | Case-management back office | Resident app back end (accounts, verification, directory, news, messaging, households, digital ID) | 13 of 20 ports have no endpoint at all. Events explicitly "Not covered". |

## 1. Port-by-port fit

Laravel paths are the `API_ENDPOINTS` values composed in `http-repositories.ts`.

| Port token | Methods | Feature screens | Laravel path(s) called | Node endpoint(s) | Fit |
|---|---|---|---|---|---|
| RESIDENT_REPOSITORY | list, getById, getProfile, create, update, setActive, recordSector, endSector | residents list/detail/form; PersonPicker (shared); requests intake + assessment | `admin/residents` GET/POST; `admin/residents/{id}` GET/PATCH, `/households`, `/assistance-history`, `/activation` POST, `/sectors` POST, `/sectors/{s}` DELETE | `GET /admin/users` | PARTIAL — list only; **admin role only**; population is app-account holders, not the office registry (no walk-ins); no q/barangay/sector filters; omits birthdate + address; no getById, profile, create, update, deactivate, sectors; no civil status, PSN last-4, income, sectors, household link. |
| HOUSEHOLD_REPOSITORY | list, getById, changeMembership, correctFactor, clearCorrection | households list/detail | `admin/households`, `/{id}`, `/{id}/members` POST, `/{id}/vulnerability-factors` POST, `/{code}` DELETE | `GET /households?barangay_id=` (staff, admin) | PARTIAL — list only; `barangay_id` **required** (no all-barangays view); returns `id, barangay_id, member_count, created_at` only — no head name, address, reference no., band, factor count; staff cannot read a household's members; no writes. |
| FAMILY_REPOSITORY | list, getById, familiesOf, recordRelationship, endRelationship, transferResident, changeMemberRole, historyForResident | families list/detail; resident detail | `admin/families`, `/{id}`, `/transfers`, `/{id}/head`; `admin/residents/{id}/relationships[/{rid}]`, `/kinship-history` | — (household member `relationship` exists only on resident-self `/households/current`) | NONE |
| CASE_REPOSITORY | list, queueCounts, getById, casesForResident, changeStatus, assign, addNote, addTask, completeTask, assignTask, rescheduleTask | cases list/workspace; my-work queue | `admin/cases`, `/queues`, `/{id}`, `/status`, `/assignment`, `/notes`, `/tasks`, `/tasks/{t}/complete|assignment|schedule` | — | NONE |
| SAVED_VIEW_REPOSITORY | listFor, create, remove | SavedViewsBar (every list) | `admin/saved-views`, `/{id}` DELETE | — | NONE |
| PROGRAM_REPOSITORY | list, getById, listActive, listRequirementTemplates, save, utilizationFor, utilizationSummary | programs list/detail; beneficiaries list; intake; assessment | `programs`, `programs/{id}`; `admin/programs` POST, `/{id}` PATCH, `/{id}/requirement-templates`, `/{id}/utilization`, `/utilization` | `GET /services`, `GET /services/{slug}`, `POST /admin/services`, `PATCH /admin/services/{id}`, `DELETE /admin/services/{id}`, `POST /admin/services/{id}/media` | PARTIAL — "Tulong" services are info pages. Detail by **slug** (write by id); **no admin list**, so `hidden_from_list` services are invisible to the console; `eligibility` is free text (no guidelines/weight/basis), `requirements` is `string[]` (no required/optional/conditional, no template ids); no code, status, funding source, max grant, `ProgramResponsibility`; no utilization; writes admin-only. |
| ASSISTANCE_REQUEST_REPOSITORY | list, getById, listNotes, changeStatus, advisoryFor, advisoryForCase, saveDraft, submitIntake, listAssessmentTemplates, openAssessment, answerAssessment, recordAssessment, reviewRequirement, recordDocument, decideApplicability, requestDocument, listDocumentRequests, withdrawDocumentRequest, openDocument | requests list; intake; assessment | `admin/assistance-requests`, `/{id}`, `/notes`, `/transitions`, `/advisory`, `/{id}/advisory`, `/assessment[/complete]`, `/requirements/{r}[/documents[/{v}/access]|/applicability]`, `/document-requests[/{d}/withdraw]`; `admin/assistance-intakes[/{id}]`; `admin/assessment-templates` | — | NONE |
| BENEFICIARY_REPOSITORY | list, getByResidentId, duplicateQueue, duplicatesFor, previewResolution, detectDuplicates, resolveIdentity, resolutionsFor | beneficiaries list/detail; duplicate review | `admin/beneficiaries[/{id}]`; `admin/resident-duplicates`, `/detect`, `/{p}/preview`, `/{p}/decide`; `admin/residents/{id}/duplicate-findings` | — (the verification queue reviews ID documents, not duplicate pairs) | NONE |
| FIELD_VISIT_REPOSITORY | list, getById, mine, forResident, schedule, recordObservations, setChecklist, close | visits list/detail; resident detail | `admin/visits`, `/{id}`, `/observations`, `/checklist`, `/conclusion` | — | NONE |
| RELEASE_REPOSITORY | list, getById, listForRequest, queue, approverFor, listBatches, getBatch, createBatch, manifestFor, markReleased, acknowledge, deferRelease, changeStatus | releases list/detail; payout session | `admin/releases`, `/{id}`, `/confirmation`, `/status`; `admin/release-batches`, `/{id}`, `/releases`, `/manifest` | — (no money field anywhere in Node) | NONE |
| REFERRAL_REPOSITORY | list, getById, forResident, queue, createDraft, recordDisclosureBasis, shareField, send, summaryFor, changeStatus, recordOutcome, reschedule, addNote, listProviders, getProvider | referrals list/detail; provider directory | `admin/referrals`, `/{id}`, `/authority`, `/shared-fields`, `/send`, `/summary`, `/status`, `/notes`; `admin/service-providers[/{id}]` | (`GET /offices`, `GET /offices/{slug}` = LGU offices only) | NONE — offices could stand in for internal providers only; no external orgs, no referral workflow. |
| STAFF_REPOSITORY | list, getById, currentUser, signIn, completeMfa, signOut | SessionStore (sign-in page, guards, nav, ACCESS_CONTEXT) | `staff`, `staff/{id}`, `me`, `auth/tokens`, `auth/tokens/mfa`, `DELETE auth/tokens/current` | `GET /me`; `GET /admin/users` | PARTIAL — currentUser -> `/me` but see B2 (no permissions/scope/position). signIn/completeMfa/signOut: NONE (Firebase client-side, B1). list: admin-only, cursor, no filters; getById: no `GET /admin/users/{id}`. |
| NOTIFICATION_REPOSITORY | listForCurrentUser, markRead, markAllRead | NotificationStore (inbox, toasts) | `me/notifications` GET, `me/notifications/{id}` PATCH, `me/notifications/read-all` | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read`, `GET /notifications/unread-count` | PARTIAL — transport fits (verb change PATCH->POST). Types only `verification_decided`, `message_received` (staff receive `message_received` for their office's threads); no severity, kind, action link; `markAllRead` returns `{updated}` not the list (re-fetch); cursor. |
| DASHBOARD_REPOSITORY | summary | dashboard | `admin/dashboard?…` | — | NONE |
| WORK_REPOSITORY | myQueue, teamQueue, alerts | my work; team queue | `admin/work/mine`, `/team`, `/alerts` | — | NONE |
| REPORT_REPOSITORY | catalogue, run, export | report hub; report view | `admin/reports`, `/{id}?…`, `/{id}/export` | — | NONE |
| SEARCH_REPOSITORY | search | search | `admin/search?term=` | — (`q` exists only on `/offices`, `/services`) | NONE |
| GOVERNANCE_REPOSITORY | accounts, accountById, setAccountActive, auditRows, auditDetail, classifications, retention, corrections | staff page; audit page; governance page | `staff`, `staff/{id}` GET/DELETE; `admin/audit-entries[/{id}]`; `admin/privacy/classifications`, `/retention`; `admin/resident-corrections` | `GET /admin/users`; `GET /admin/audit` | PARTIAL — accounts -> `/admin/users` (every account; filter `role in (staff,admin)` client-side; no position, isActive, lastSignInAt, profile). accountById: none. setAccountActive: none (only `PATCH role`/`office`; `/me/close` is self-only). auditRows -> `/admin/audit` = `id, actor_id, action, subject_type, subject_id, created_at` only; **no filters**, no actor name, summary, reason, source, changed fields. auditDetail, classifications, retention, corrections: none. |
| NEWSFEED_REPOSITORY | list, getById, saveDraft, publish, schedule, archive, setPinned, setCommentsEnabled, comments, moderate, history | post list/detail/composer | `admin/newsfeed`, `/{id}` GET/PATCH, `/status`, `/pin`, `/history`; `admin/newsfeed-comments`, `/{c}/moderation` | `GET /news`, `GET /news/{id}`, `POST /news`, `PATCH /news/{id}`, `POST`/`DELETE /news/{id}/pin`, `GET /news/categories`, `GET /news/{id}/cover` | PARTIAL — list is public **published-only** (staff cannot list drafts; a draft is reachable only by id); status `draft|published` only (no scheduled, archived, publish_at); publish = `PATCH status`; no reason field; no comments, reactions, moderation, comments toggle; cover has **no alt text** (DL-125); no history; writes multipart; staff restricted to own `office_id`. |
| EVENT_REPOSITORY | list, getById, saveDraft, publish, cancel, complete, archive, registrants, capacity, metrics, actOnRegistration, markAttendance, exportRegistrants, history | events list/detail/composer | `admin/events`, `/{id}`, `/status`, `/registrations[/{r}/attendance|/promote…]`, `/registration-summary`, `/registrants/export`, `/history` | — (endpoints.md: "Events — Not covered"; only a news category `events`) | NONE |

**Tally: FULL 0 · PARTIAL 7 (resident, household, program, staff, notification, governance, newsfeed) · NONE 13.**
`ACCESS_CONTEXT` is not an adapter port (bound to `SessionState`); it inherits B2.

## 2. Node staff-relevant endpoints with no admin-web port or screen

| Area | VERB /path | Role | Purpose |
|---|---|---|---|
| Verification | `GET /admin/verification-requests?status=` | admin | ID-verification queue (rows carry `user_id`, `id_type`, front/back/selfie media ids, `notes`) |
| | `POST /admin/verification-requests/{id}/approve` | admin | approve; user tier -> verified, role registered -> verified; issues digital ID |
| | `POST /admin/verification-requests/{id}/reject` | admin | reject with required `notes` (shown to resident as `rejection_reason`) |
| Media | `GET /media/{id}`, `GET /media/{id}/content` | staff, admin | read any media (needed to view verification images) |
| | `POST /media` | member | upload an image (e.g. banner image before `media_id`) |
| Users/roles | `PATCH /admin/users/{id}/role` | admin | set role registered/verified/staff/admin (not own) — roles page is read-only today |
| | `PATCH /admin/users/{id}/office` | admin | assign a staff account to an office |
| Digital ID | `POST /digital-id/verify` | staff, admin | scan a resident QR; returns name, photo id, status, barangay |
| | `GET /admin/users/{id}/digital-id` | admin | current card |
| | `POST /admin/users/{id}/digital-id` | admin | issue card |
| | `POST /admin/digital-ids/{id}/suspend` · `/revoke` · `/reissue` | admin | card lifecycle |
| Messaging | `GET /threads`, `GET /threads/{id}` | staff (own office), admin (all) | office inbox |
| | `GET /threads/{id}/messages`, `POST /threads/{id}/messages` | staff, admin | read / reply (text + image) |
| | `POST /threads/{id}/read`, `POST /threads/{id}/close` | staff, admin | mark read / close thread |
| Offices | `GET /offices`, `GET /offices/{slug}`, `/{slug}/hero` | public | directory read |
| | `POST /admin/offices`, `PATCH /admin/offices/{id}`, `DELETE /admin/offices/{id}` | admin | directory CRUD (multipart banner) |
| Services | `POST/PATCH/DELETE /admin/services[/{id}]`, `POST /admin/services/{id}/media` | admin | Tulong catalogue CRUD (overlaps programs only loosely, see §1) |
| Home | `GET/POST /admin/home/banners`, `PATCH/DELETE /admin/home/banners/{id}` | admin | app home carousel |
| | `GET/POST /admin/home/links`, `PATCH/DELETE /admin/home/links/{id}` | admin | home quick links |
| | `GET /home` | public | preview what residents see |
| Hotlines | `GET/POST /admin/hotlines`, `PATCH/DELETE /admin/hotlines/{id}` | admin | emergency hotline list |
| App config | `PATCH /admin/app/config` (read: `GET /app/config`) | admin | contact line, legal versions, min app version, feature flags |
| Reference | `GET /barangays` | public | barangay list (`id, code, name`) — console hardcodes `TAYTAY_BARANGAYS` |
| | `GET /news/categories` | public | the 5 news category slugs |
| Me | `GET /notifications/unread-count`; `GET/PATCH /me/notification-preferences`; `POST/DELETE /me/devices` | member | badge count; prefs; web push token (mock provider) |

## 3. Role model

### Backend (Node)
| Item | Finding |
|---|---|
| Roles | `guest, registered, verified, staff, admin` (`src/auth/roles.ts`); DB CHECK on `users.role`. |
| Where the role lives | **Database column `users.role`.** Firebase ID token verified (`AUTH_VERIFIER=firebase`) or `mock:<role>:<uid>` (dev default). A `role` **custom claim** is read only to seed the row on first contact (`users.getOrCreate(uid, role)`); after that `resolveUser` overwrites the actor's role with the DB value. Header/body/query role is ignored. |
| Granting staff/admin | `PATCH /admin/users/{id}/role` by an admin (own role -> 403), or the custom claim before first contact. registered -> verified also happens on verification approve. No documented first-admin bootstrap except the claim. |
| Granularity | None per permission. Each route calls `requireRole(...)`. Staff vs admin is the only staff-side distinction. |
| Scoping | Staff are scoped by **`office_id`** (news write/pin, threads); admin is global. No barangay scope; `users.barangay_id` is a resident's home barangay. |
| What staff (non-admin) can do | `GET /households?barangay_id`, `POST /digital-id/verify`, news create/edit/pin for own office, threads for own office, read any media. Everything else under `/admin/*` (users, audit, verification, offices, services, banners, hotlines, digital IDs, config) is **admin-only**. |
| Who am I | `GET /me` -> `id` (uuid), `firebase_uid`, `name`, `birthdate`, `sex`, `mobile`, `email`, `email_verified`, `barangay_id`, `address`, `street`, `purok`, `avatar_media_id`, `verification_status`, `verification_decided_at`, `rejection_reason`, **`role`**, **`office_id`**, `closed`, `closed_at`, timestamps. First call creates the row. |

### admin-web
| Item | Finding |
|---|---|
| Roles (7) | `system-administrator`, `mswdo-head`, `social-worker`, `intake-officer`, `release-officer`, `barangay-link`, `auditor` (`domain/access/permission.ts`). |
| Permissions | 70 keys over 20 areas: audit, beneficiary, case, case-note, dashboard, document, event, family, household, newsfeed, program, referral, release, report, request, resident, saved-view, settings, staff, visit (+ per-role `additionalPermissions`). |
| Scope | `all-barangays` / `own-barangay` (barangay-link) / `assigned-cases` (social-worker). |
| Identity source | `MeWire {id, display_name|name, email, position, barangay_id, scope, permissions[], roles[]}` -> `fromServerIdentity` (only server-sent keys are granted). |

### Role mapping
| admin-web role | Nearest Node role | Lost |
|---|---|---|
| system-administrator | admin | — |
| mswdo-head | admin (global) or staff + office=MSWDO | head-only powers (publish, moderate, `saved-view.share`) not expressible; as admin also gets user/role admin |
| social-worker, intake-officer, release-officer | staff | indistinguishable from each other; **separation of duties (approve vs release) cannot be enforced server-side** |
| barangay-link | staff | own-barangay scope does not exist |
| auditor | staff (or admin) | no read-only role; `GET /admin/audit` is admin-only, so an auditor either cannot read the trail or holds every admin write |

## 4. Field-shape notes for PARTIAL rows

| Topic | Node | admin-web | Mapping note |
|---|---|---|---|
| Ids | all `uuid` v4 (`randomUUID`) | branded strings via `asId` (mocks use slugs) | fine; adapters own `asId`. |
| Barangay | `{id uuid, code, name}`; codes `dolores`, `muzon`, …; ids random per seed; rows are **dev seed only** ("refuse production") | `TAYTAY_BARANGAYS` hardcoded, ids `brgy-dolores` etc., `psgcCode: null` | map by `code` (strip `brgy-`) or switch to `GET /barangays`; prod needs a barangay data load. |
| Person name | single `name` (1-120) | `PersonName {first, middle, last, suffix}` (residents and StaffUser) | split is lossy; `discloseResident` ("Cordero, M.") needs parts. |
| Sex | `male | female | unspecified` | `female | male` | `unspecified` has no home. |
| Birthdate | `birthdate` (YYYY-MM-DD); omitted from `/admin/users` | `birthDate: IsoDate` | only on `/me`. |
| Address | `address` free text + optional `street`, `purok` + `barangay_id`; omitted from `/admin/users` | `ResidentAddress {barangayId, streetAddress, purokOrSitio, …}` | close, but not exposed to staff. |
| Admin user row | `id, name, email, mobile, barangay_id, verification_status, role, office_id, created_at` | `StaffUser`/`StaffAccount`: name parts, role (7), position, barangayId, isActive, lastSignInAt, additionalPermissions, profile | no isActive/lastSignInAt/position; `office_id` has no admin-web field. |
| Household (staff) | `id, barangay_id, member_count, created_at` | `HouseholdSummary {household{id, referenceNumber, headResidentId, address, members, monthlyIncome, isIndigent}, headName, memberCount, band, presentFactorCount}` | only id/barangay/count map. |
| Service vs Program | `id, slug, name, category, summary, details, eligibility (text), requirements string[], contacts[], locations[], office_id, office_slug, legal_basis, claim_steps[], schedule, featured, hidden_from_list, media_id/hero_url` | `AssistanceProgram {id, code, name, category, status, description, legalBasis, fundingSource, maximumGrant: Money, eligibility: guidelines[], responsibility}` | `legal_basis`->`legalBasis`, `summary/details`->`description`; categories differ; no Money anywhere in Node. |
| News vs Post | `id, title, body, category (abiso|advisory|negosyo|safety|events), status (draft|published), cover_media_id, cover_url, office_id, office_slug, published_at, author_id, pinned, pinned_at, share_url` | `Post {headline?, body, category (announcement|public-advisory|community-update|program-update|general-news), status (draft|scheduled|published|archived), image {url, altText}, linkUrl, audience, commentsEnabled, isPinned, scheduledFor, publishedAt, publishedBy, reactionCount, commentCount}` | category vocabularies disjoint; Node `share_url` conflicts with "no share link" (DL-32); writes are multipart (`cover` file), `office_id` required for admin. |
| Notification | `id, type, title, body, subject_id, read_at, created_at` | `AppNotification {recipientId, severity, kind, title, body, channel, action, createdAt, readAt}` | `subject_id` is a thread id; kind/severity/action must be synthesised. |
| Audit | `id, actor_id, action (dotted code e.g. news.created), subject_type, subject_id, created_at` | `AuditRow {entityType, entityLabel, entityId, action, summary, reason, actorId, actorName, occurredAt, source, changedFields[], touchesSensitive, hasDetail}` | actor name needs a join to `/admin/users` (no by-id route); Node never stores values, consistent with DL-114. |
| Lists | cursor `limit<=50` | `Page<T>` with totals | see B4. |
