# TAB 05 — the 147-row mapping

One row per port method, built from `php artisan route:list` and `docs/api/openapi.json`, not
from the endpoint matrix — which the sweep found stale in places, and which this exercise confirms.

**148 rows, not 147.** The sweep counted 147; `completeMfa` was added to `StaffRepository` in
TAB 02, so the surface is now 148. Two of the sweep's per-port figures were also wrong
(`HouseholdRepository` is 5, not 6; `EventRepository` is 14, not 13) and the errors cancelled in
its total — the same pattern as ledger finding L-01.

A ⚠︎ beside a route means **the route does not exist as written** and the row needs revisiting
before that adapter is wired. Permissions are extracted from the controllers'
`authorize($actor, Permission::…)` calls; `—` means the endpoint enforces none that this
extraction could see, which is itself worth checking in TAB 07.

| Status | Count |
| --- | --- |
| maps cleanly | 66 |
| maps with transformation | 46 |
| **no counterpart** | 36 |
| **Total** | 148 |

The *no counterpart* rows are TAB 07's scope, handed over in writing as the command requires. Do
not invent an endpoint to close one.

### ResidentRepository (7)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/residents` | `resident.manage` | maps cleanly |  |
| `getById` | GET | `admin/residents/{resident}` | `resident.manage` | maps cleanly |  |
| `getHousehold` | GET | `admin/residents/{resident}/households` | `resident.view` | maps with transformation | Returns a collection; the console wants the one current household |
| `getProfile` | GET | `admin/residents/{resident}` | `resident.manage` | maps with transformation | Profile is assembled from resident + households + vulnerability + assistance-history — four calls or a TAB 07 projection |
| `create` | POST | `admin/residents` | `resident.manage` | maps cleanly |  |
| `update` | PATCH | `admin/residents/{resident}` | `resident.manage` | maps cleanly |  |
| `setActive` | POST | `admin/residents/{resident}/activation` | `resident.verify` | maps cleanly |  |

### HouseholdRepository (5)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/households` | `household.manage` | maps cleanly |  |
| `getById` | GET | `admin/households/{household}` | `household.manage` | maps cleanly |  |
| `changeMembership` | POST | `admin/households/{household}/members` | `household.manage` | maps with transformation | Console applies a batch transactionally; API is per-member add/remove — TAB 07 or client-side sequencing with a stated failure mode |
| `correctFactor` | POST | `admin/households/{household}/vulnerability-factors` | `vulnerability.manage` | maps cleanly |  |
| `clearCorrection` | DELETE | `admin/households/{household}/vulnerability-factors/{factor}` | `vulnerability.manage` | maps cleanly |  |

### FamilyRepository (8)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | — | — | `—` | **no counterpart** | No family list endpoint exists |
| `getById` | — | — | `—` | **no counterpart** | No family detail endpoint exists |
| `familiesOf` | — | — | `—` | **no counterpart** | No families-for-resident endpoint exists |
| `recordRelationship` | POST | `admin/residents/{resident}/relationships` | `household.manage` | maps cleanly |  |
| `endRelationship` | DELETE | `admin/residents/{resident}/relationships/{relationship}` | `household.manage` | maps cleanly |  |
| `transferResident` | POST | `admin/households/{household}/transfers` | `household.manage` | maps with transformation | Household-scoped on the wire, family-scoped in the console |
| `changeMemberRole` | POST | `admin/families/{family}/head` | `household.manage` | maps with transformation | Only the head role is settable; other roles have no endpoint |
| `historyForResident` | — | — | `—` | **no counterpart** | No kinship history endpoint exists |

### CaseRepository (11)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 — a continuing case has no endpoint |
| `queueCounts` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |
| `getById` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |
| `casesForResident` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |
| `changeStatus` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 — the 7-state case lifecycle has no server counterpart |
| `assign` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |
| `addNote` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |
| `addTask` | POST | `tasks` | `task.manage` | **no counterpart** | BLOCKED ON TAB 04 — Tasks exists but is not case-scoped |
| `completeTask` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |
| `assignTask` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |
| `rescheduleTask` | — | — | `—` | **no counterpart** | BLOCKED ON TAB 04 |

### SavedViewRepository (3)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `listFor` | GET | `admin/saved-views` | `request.view` | maps cleanly |  |
| `create` | POST | `admin/saved-views` | `request.view` | maps cleanly |  |
| `remove` | DELETE | `admin/saved-views/{view}` | `request.view` | maps cleanly |  |

### ProgramRepository (7)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `programs` | `program.view` | maps with transformation | Reads are on the public catalog surface, not under admin/ |
| `getById` | GET | `programs/{program}` | `program.view` | maps with transformation | Public catalog surface |
| `listActive` | GET | `programs` | `program.view` | maps with transformation | Filter, not a route |
| `listRequirementTemplates` | — | — | `—` | **no counterpart** | Only POST exists; there is no read side for requirement templates |
| `save` | PATCH | `admin/programs/{program}` | `program.manage` | maps with transformation | Create and update are separate verbs on the wire |
| `utilizationFor` | — | — | `—` | **no counterpart** | No per-programme utilisation endpoint |
| `utilizationSummary` | — | — | `—` | **no counterpart** | No utilisation summary endpoint |

### AssistanceRequestRepository (14)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/assistance-requests` | `request.create` | maps cleanly |  |
| `getById` | GET | `admin/assistance-requests/{case}` | `request.view` | maps cleanly |  |
| `listNotes` | GET | `admin/assistance-requests/{case}/notes` | `request.view` | maps cleanly |  |
| `changeStatus` | POST | `admin/assistance-requests/{case}/transitions` | `request.view` | maps cleanly | The one transition endpoint; ADR 0007 §2 |
| `advisoryFor` | — | — | `—` | **no counterpart** | The intake advisory is computed console-side; no endpoint |
| `saveDraft` | POST | `admin/assistance-intakes` | `request.create` | maps with transformation |  |
| `submitIntake` | POST | `admin/assistance-requests/{case}/transitions` | `request.view` | maps with transformation | A transition, not its own route |
| `recordAssessment` | POST | `admin/assistance-requests/{case}/assessment` | `request.assess` | maps cleanly |  |
| `reviewRequirement` | POST | `admin/assistance-requests/{case}/requirements/{requirement}/verification` | `document.verify` | maps cleanly |  |
| `recordDocument` | POST | `admin/assistance-requests/{case}/requirements/{requirement}/documents` | `request.view` | maps cleanly |  |
| `decideApplicability` | POST | `admin/assistance-requests/{case}/requirements/{requirement}/applicability` | `document.verify` | maps cleanly |  |
| `requestDocument` | POST | `admin/assistance-requests/{case}/requirements/{requirement}/document-requests` | `document.manage` | maps cleanly |  |
| `listDocumentRequests` | GET | `admin/assistance-requests/{case}/document-requests` | `request.view` | maps cleanly |  |
| `openDocument` | POST | `admin/assistance-requests/{case}/requirements/{requirement}/documents/{version}/access` | `request.view` | maps cleanly | The audited grant, not a URL on the model |

### BeneficiaryRepository (8)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | — | — | `—` | **no counterpart** | No beneficiary projection endpoint — TAB 07 |
| `getByResidentId` | — | — | `—` | **no counterpart** | TAB 07 |
| `enrollmentsFor` | GET | `admin/enrollments` | `enrollment.manage` | maps with transformation | Filter by resident |
| `duplicateQueue` | GET | `admin/resident-duplicates` | `resident.merge` | maps cleanly |  |
| `duplicatesFor` | GET | `admin/resident-duplicates` | `resident.merge` | maps with transformation | Filter by resident |
| `previewResolution` | POST | `admin/resident-duplicates/{pair}/preview` | `resident.merge` | maps cleanly | It does exist |
| `resolveIdentity` | POST | `admin/resident-duplicates/{pair}/decide` | `resident.merge` | maps cleanly | ADR 0044 chose supersede — and `/decide` already implements it. `/merge` simply goes unused |
| `resolutionsFor` | — | — | `—` | **no counterpart** | No findings history endpoint |

### FieldVisitRepository (8)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/visits` | `visit.manage` | maps cleanly |  |
| `getById` | GET | `admin/visits/{visit}` | `visit.view` | maps cleanly |  |
| `mine` | GET | `admin/visits` | `visit.manage` | **no counterpart** | No `mine` scope — TAB 07 (scope, not a new resource) |
| `forResident` | GET | `admin/visits` | `visit.manage` | maps with transformation | Filter by resident |
| `schedule` | POST | `admin/visits` | `visit.manage` | maps cleanly |  |
| `recordObservations` | POST | `admin/visits/{visit}/observations` | `visit.manage` | maps cleanly |  |
| `setChecklist` | POST | `admin/visits/{visit}/checklist` | `visit.manage` | maps cleanly |  |
| `close` | POST | `admin/visits/{visit}/conclusion` | `visit.manage` | maps cleanly |  |

### DisbursementRepository (13)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/releases` | `request.view` | maps with transformation | Noun differs; TAB 08 settles it |
| `getById` | GET | `admin/releases/{release}` | `request.view` | maps with transformation |  |
| `listForRequest` | GET | `admin/releases` | `request.view` | maps with transformation | Filter by request |
| `queue` | GET | `admin/releases` | `request.view` | maps with transformation | Filter by status |
| `approverFor` | — | — | `—` | **no counterpart** | Separation of duties needs the approver; no endpoint — TAB 08 |
| `listBatches` | — | — | `—` | **no counterpart** | No batch list endpoint — TAB 08 |
| `getBatch` | — | — | `—` | **no counterpart** | No batch detail endpoint — TAB 08 |
| `createBatch` | POST | `admin/release-batches` | `request.schedule` | maps with transformation |  |
| `manifestFor` | GET | `admin/release-batches/{batch}/manifest` | `request.view` | maps cleanly | It does exist — the sweep implied otherwise |
| `markReleased` | POST | `admin/releases/{release}/status` | `—` | maps with transformation | State machines differ 9 v 6 — TAB 08 |
| `acknowledge` | POST | `admin/releases/{release}/confirmation` | `request.release` | maps cleanly |  |
| `deferRelease` | POST | `admin/releases/{release}/status` | `—` | maps with transformation |  |
| `changeStatus` | POST | `admin/releases/{release}/status` | `—` | maps with transformation |  |

### ReferralRepository (13)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/referrals` | `referral.manage` | maps cleanly |  |
| `getById` | GET | `admin/referrals/{referral}` | `referral.manage` | maps cleanly |  |
| `forResident` | GET | `admin/referrals` | `referral.manage` | maps with transformation | Filter by resident |
| `queue` | GET | `admin/referrals` | `referral.manage` | maps with transformation | Filter by status |
| `createDraft` | POST | `admin/referrals` | `referral.manage` | maps cleanly |  |
| `send` | POST | `admin/referrals/{referral}/send` | `referral.send` | maps cleanly | The disclosure plan travels with the send |
| `summaryFor` | GET | `admin/referrals/{referral}/summary` | `referral.view` | maps cleanly |  |
| `changeStatus` | POST | `admin/referrals/{referral}/status` | `referral.manage` | maps cleanly |  |
| `recordOutcome` | POST | `admin/referrals/{referral}/status` | `referral.manage` | maps with transformation | Outcome is carried on the status transition |
| `reschedule` | PATCH | `admin/referrals/{referral}` | `referral.manage` | maps with transformation | Follow-up date is a field, not a route |
| `addNote` | POST | `admin/referrals/{referral}/notes` | `referral.manage` | maps cleanly |  |
| `listProviders` | GET | `admin/service-providers` | `provider.manage` | maps cleanly |  |
| `getProvider` | GET | `admin/service-providers/{provider}` | `provider.manage` | maps cleanly |  |

### StaffRepository (6)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `staff` | `staff.manage` | maps with transformation | The staff surface is not under admin/ |
| `getById` | GET | `staff/{staff}` | `staff.manage` | maps with transformation |  |
| `currentUser` | GET | `me` | `—` | maps cleanly | Wired in TAB 02/03 |
| `signIn` | POST | `auth/tokens` | `—` | maps cleanly | Wired in TAB 02 |
| `completeMfa` | POST | `auth/tokens/mfa` | `—` | maps cleanly | Wired in TAB 02 |
| `signOut` | DELETE | `auth/tokens/current` | `—` | maps cleanly | Wired in TAB 02 |

### NotificationRepository (4)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `listForCurrentUser` | GET | `me/notifications` | `—` | maps cleanly |  |
| `create` | — | — | `—` | **no counterpart** | DELETE THE PORT METHOD — the API is read-only for the actor |
| `markRead` | POST | `me/notifications/{notification}/read` | `—` | maps cleanly |  |
| `markAllRead` | POST | `me/notifications/read-all` | `—` | maps cleanly |  |

### WorkRepository (3)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `myQueue` | — | — | `—` | **no counterpart** | Derived queue — TAB 07, over the Tasks module |
| `teamQueue` | — | — | `—` | **no counterpart** | TAB 07 |
| `alerts` | — | — | `—` | **no counterpart** | TAB 07 |

### ReportRepository (3)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `catalogue` | — | — | `—` | **no counterpart** | No catalogue endpoint — TAB 07 |
| `run` | — | — | `—` | **no counterpart** | No synchronous aggregate run — TAB 07 |
| `export` | POST | `admin/exports` | `report.view` | maps with transformation | Async lifecycle; the console expects a composed file |

### SearchRepository (1)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `search` | GET | `admin/search` | `request.view` | maps cleanly | One parameter, closed field set |

### GovernanceRepository (8)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `accounts` | GET | `staff` | `staff.manage` | maps with transformation |  |
| `accountById` | GET | `staff/{staff}` | `staff.manage` | maps with transformation |  |
| `setAccountActive` | DELETE | `staff/{staff}` | `staff.manage` | maps with transformation | Deactivation is a DELETE on the assignment, not a status flag |
| `auditRows` | GET | `admin/audit-entries` | `audit.view` | maps cleanly |  |
| `auditDetail` | GET | `admin/audit-entries/{entry}` | `audit.view` | maps cleanly | Behind audit.view-detail |
| `classifications` | — | — | `—` | **no counterpart** | TAB 07 |
| `retention` | GET | `admin/privacy/retention` | `privacy.manage` | maps with transformation |  |
| `corrections` | GET | `admin/resident-corrections` | `resident.manage` | maps with transformation |  |

### NewsfeedRepository (11)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/newsfeed` | `newsfeed.manage` | maps cleanly |  |
| `getById` | GET | `admin/newsfeed/{post}` | `newsfeed.manage` | maps cleanly |  |
| `saveDraft` | POST | `admin/newsfeed` | `newsfeed.manage` | maps cleanly |  |
| `publish` | POST | `admin/newsfeed/{post}/status` | `—` | maps with transformation | Status transition, not its own verb |
| `schedule` | PATCH | `admin/newsfeed/{post}` | `newsfeed.manage` | maps with transformation | Scheduled time is a field; visibility is derived from the clock |
| `archive` | POST | `admin/newsfeed/{post}/status` | `—` | maps with transformation |  |
| `setPinned` | POST | `admin/newsfeed/{post}/pin` | `newsfeed.publish` | maps cleanly |  |
| `setCommentsEnabled` | PATCH | `admin/newsfeed/{post}` | `newsfeed.manage` | maps with transformation | A field on the post |
| `comments` | GET | `admin/newsfeed-comments` | `newsfeed.moderate` | maps with transformation | Moderation queue is global, filtered by post |
| `moderate` | POST | `admin/newsfeed-comments/{comment}/moderation` | `newsfeed.moderate` | maps cleanly |  |
| `history` | — | — | `—` | **no counterpart** | No post history endpoint |

### EventRepository (14)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `list` | GET | `admin/events` | `event.manage` | maps cleanly |  |
| `getById` | GET | `admin/events/{event}` | `event.manage` | maps cleanly |  |
| `saveDraft` | POST | `admin/events` | `event.manage` | maps cleanly |  |
| `publish` | POST | `admin/events/{event}/status` | `—` | maps with transformation |  |
| `cancel` | POST | `admin/events/{event}/status` | `—` | maps with transformation |  |
| `complete` | POST | `admin/events/{event}/status` | `—` | maps with transformation |  |
| `archive` | POST | `admin/events/{event}/status` | `—` | maps with transformation |  |
| `registrants` | GET | `admin/events/{event}/registrations` | `event.manage` | maps cleanly | Closed field set, never resident records |
| `capacity` | GET | `admin/events/{event}/registration-summary` | `event.manage` | maps cleanly | Carries asOf; the server decides who gets the last place |
| `metrics` | — | — | `—` | **no counterpart** | No event metrics endpoint |
| `actOnRegistration` | POST | `admin/events/{event}/registrations/{registration}/cancel` | `event.manage` | maps with transformation | Three routes — cancel, restore, promote — not one status verb |
| `markAttendance` | POST | `admin/events/{event}/registrations/{registration}/attendance` | `event.mark-attendance` | maps cleanly |  |
| `exportRegistrants` | POST | `admin/exports` | `report.view` | maps with transformation | Goes through the export lifecycle; its own permission still applies |
| `history` | — | — | `—` | **no counterpart** | No event history endpoint |

### DashboardRepository (1)

| Port method | Verb | Route | Permission | Status | Note |
| --- | --- | --- | --- | --- | --- |
| `summary` | GET | `admin/dashboard` | `report.view` | maps with transformation | Shape unverified against DashboardSummary |
