# Permission reconciliation — console ↔ backend

TAB 03, step 1. **Built before any change was proposed**, because the master command is explicit
about the order: *"a rename applied to a key that was actually a split loses a distinction the
domain was drawing on purpose."*

Every key on both sides appears below exactly once, with a decision. Nothing is left to be
inferred from absence.

## Measured

| | Console | Backend |
| --- | --- | --- |
| Permissions | **68**, kebab-case `resource.action`, one array (`domain/access/permission.ts`) | **61**, PHP backed enum (`modules/AccessControl/Contracts/Permission.php`) |
| Identical strings | **21** | |
| No counterpart on the other side | **47** | **40** |
| Roles | **7** | **8** |
| Shared role names | **0** | |

Taken by enumerating `PERMISSIONS` and `Permission::cases()` on 18 August 2026. These figures
match the sweep; the backend's test and route counts did not (ledger L-01), so both were checked
rather than assumed.

## The convention decision

**The backend's catalog is canonical in *location*; the console's convention is canonical in
*form*.** That is the master command's recommendation and it survives inspection: the backend is
the enforcement point and is consumed by four clients, so *which* grants exist is its call; but its
enum mixes three conventions in one vocabulary, which is a model nobody can predict.

The three conventions, all currently live in the same enum:

| Shape | Example | Count |
| --- | --- | --- |
| kebab `resource.action` | `request.view-sensitive` | most |
| snake_case action | `resident.link_review`, `vulnerability.view_protected`, `services.view_unpublished` | 3 |
| three dotted segments | `document.view.sensitive`, `referral.disclose.protected`, `report.export.person-level` | 3 |

**Canonical form: a single kebab-case `resource.action`, two segments, lowercase.** Six backend
keys are renamed to reach it. None of the six changes what is granted.

| Backend today | Canonical |
| --- | --- |
| `resident.link_review` | `resident.link-review` |
| `vulnerability.view_protected` | `vulnerability.view-protected` |
| `services.view_unpublished` | `services.view-unpublished` |
| `document.view.sensitive` | `document.view-sensitive` |
| `referral.disclose.protected` | `referral.disclose-protected` |
| `report.export.person-level` | `report.export-person-level` |

---

## 1. Identical — adopt as-is (21)

`resident.view` · `household.manage` · `program.view` · `program.manage` · `request.view` ·
`request.create` · `request.intake` · `request.assess` · `request.endorse` · `request.approve` ·
`request.reject` · `request.schedule` · `request.close` · `request.view-sensitive` ·
`referral.view` · `referral.manage` · `report.view` · `audit.view` · `staff.view` ·
`staff.manage` · `newsfeed.publish`

No decision needed. Both sides already agree, in spelling and in meaning.

## 2. Renamed — same grant, different spelling (9)

| Console | Backend | Canonical | Note |
| --- | --- | --- | --- |
| `case.view-protected-note` | `case-note.view-protected` | **`case-note.view-protected`** | The backend's resource split is better: a protected note is a record, not a facet of a case |
| `view.share` | `saved-view.share` | **`saved-view.share`** | `view.share` is ambiguous outside the console's own vocabulary |
| `report.export` | `report.export.person-level` | **`report.export-person-level`** | Same grant. The console's `report.export` *is* the person-level export (`DL-104`); the backend's name says so and the console's does not |
| `newsfeed.moderate-comments` | `newsfeed.moderate` | **`newsfeed.moderate`** | Moderation applies to comments and nothing else on either side |
| `events.*` (9 keys) | `event.*` (4 keys) | **`event.*`** | Singular. Every other resource in both vocabularies is singular (`request`, `referral`, `document`) — `events` was the outlier |
| — | `resident.link_review` | **`resident.link-review`** | Form only |
| — | `vulnerability.view_protected` | **`vulnerability.view-protected`** | Form only |
| — | `services.view_unpublished` | **`services.view-unpublished`** | Form only |
| — | `referral.disclose.protected` | **`referral.disclose-protected`** | Form only |

## 3. Splits — the console draws a distinction the backend does not (4 groups)

These are the rows the master command warns about. Each is a deliberate console distinction, and
collapsing it to the backend's coarser key would lose a rule somebody reasoned about.

### 3.1 Newsfeed — console 7, backend 2

Console: `newsfeed.view` `newsfeed.create` `newsfeed.edit` `newsfeed.schedule` `newsfeed.archive`
`newsfeed.pin` `newsfeed.view-insights`, plus the shared `newsfeed.publish`.
Backend: `newsfeed.manage`, `newsfeed.publish`.

**Decision: adopt the console's split; the backend gains the finer keys.** `publish` is already
separate on both sides for the right reason — publication is irreversible and reaches residents
(`DL-124`). Once that is true, `archive` and `pin` are also outward acts and `create`/`edit` are
not, and `view-insights` is read-only and is what the auditor holds. Folding six grants into
`newsfeed.manage` would give anybody who can fix a typo the ability to archive a published advisory.

### 3.2 Events — console 10, backend 4

Console: `events.view` `create` `edit` `publish` `cancel` `archive` `manage-registrations`
`export-registrations` `mark-attendance` `view-insights`.
Backend: `event.manage` `event.publish` `event.mark-attendance` `event.export-registrants`.

**Decision: adopt the console's split, renamed singular.** The backend already separates the two
that matter most — `mark-attendance` (a claim about a person) and `export-registrants` (a file of
resident names leaving the building). `cancel` belongs with them: cancellation is one-way
(`DL-131`). The remainder collapse into `event.manage` only if the office is content that whoever
can edit a venue can also cancel the event.

### 3.3 Disbursement — console 4, backend 1

Console: `disbursement.view` `disbursement.schedule` `disbursement.release` `disbursement.void`.
Backend: `request.release`.

**Decision: adopt the console's split, and treat this as the highest-value row in the table.**
Separation of duties depends on it: the console's own test asserts that no non-administrator role
holds both `request.approve` and `disbursement.release`. With a single `request.release` the
server cannot express that separation at all, and TAB 08 has to build it anyway. The noun is
TAB 08's to settle (`disbursement` vs `release`); the *split* is settled here.

### 3.4 Case — console 5, backend 0

Console: `case.view` `case.manage` `case.note` `case.view-protected-note` `case.close`.
Backend: none — the backend's `welfare_cases` is the assistance request, guarded by `request.*`.

**Decision: deferred to TAB 04, and it must not be resolved here.** These five keys mean something
only once "what is a case" is settled. `case.close` is deliberately held apart from `case.manage`
because ending the office's involvement with a family is a decision rather than a step (`DL-53`) —
a distinction that survives under option A and evaporates under option B. Wiring them before the
TAB 04 session would bake in an answer nobody has given.

## 4. Merges — the console folded two things into one (2)

### 4.1 Field visits are guarded by `case.view` — and this is a live defect

The console has no `visit.*` key. `app.routes.ts:345` guards the visit list with
`permissionGuard('case.view')`. The backend has `visit.view` and `visit.manage`.

**A role granted `case.view` but not `visit.view` sees the Field visits link, opens it, and is
refused by the API.** That is precisely the "unusable product" TAB 03 exists to prevent, and it is
not hypothetical: the two vocabularies disagree today.

**Decision: adopt the backend's `visit.view` / `visit.manage`; the console adds them and repoints
the route guard.** Visits are a record with their own lifecycle, their own screens and their own
disclosure rules (`DL-85`, `DL-86`); guarding them with a case permission was convenience.

### 4.2 Documents — `document.record` vs `document.manage` + `document.verify`

Console: `document.record` `document.download` `document.view-full-number`.
Backend: `document.manage` `document.verify` `document.view.sensitive` `document.share`.

**Decision: adopt the backend's split, and keep the console's `document.view-full-number`.**
Verifying a document is a separate act from recording one — it is the act the office is
accountable for — and the backend is right to separate them. `document.view-full-number` is a
console distinction with no backend counterpart and is **kept**: masking a document number to its
last four characters is a data-minimisation rule (`RA 10173`), and the grant to see the whole
number is exactly the kind of thing that should cost a permission. It becomes a new backend key.

## 5. Console-only, kept — the backend gains them (6)

| Key | Why it stays |
| --- | --- |
| `dashboard.view` | The landing screen needs a grant like every other route, or the guard has an exception |
| `resident.view-sensitive` | The console's second, wider tier over identity and means (`philsysLastFour`, `monthlyIncome`) — distinct from `request.view-sensitive` |
| `beneficiary.export` | A file of beneficiary names leaves the building. Same reasoning as `event.export-registrants`, which the backend already has |
| `audit.view-detail` | Reading *that* a record changed is oversight; reading *what it changed to* is access to the record (`DL-114`). Held by the auditor and **not** the head |
| `household.correct-vulnerability` | Overriding an advisory factor is recorded against a person's name (`DL-42`) |
| `document.view-full-number` | See 4.2 |

`settings.manage` is **withdrawn** — see §7.

## 6. Backend-only, adopted by the console (17)

Grants the API enforces that the console currently cannot express. Each becomes a console key so a
screen can hide what the server would refuse.

`resident.manage` · `resident.verify` · `request.assign` · `vulnerability.view` ·
`vulnerability.manage` · `vulnerability.view-protected` · `enrollment.view` · `enrollment.manage` ·
`document.manage` · `document.verify` · `document.view-sensitive` · `document.share` ·
`referral.send` · `referral.disclose-protected` · `provider.manage` · `visit.view` ·
`visit.manage` · `safeguarding.view` · `safeguarding.manage` · `task.view` · `task.manage` ·
`services.view-unpublished` · `services.manage` · `saved-view.share`

## 7. Backend-only, **not** adopted — outside this console (7)

| Key | Why not |
| --- | --- |
| `kyc.review`, `kyc.approve` | Identity verification is the citizen/verifier surface, not MSWDO casework |
| `credential.manage` | Digital ID lifecycle. `Credential` is listed in the sweep's own module table as *"not consumed by this console"* |
| `operations.view` | Operational readiness — the `operations_engineer` role, which has no MSWDO counterpart |
| `privacy.manage` | The DPO's surface. TAB 14 decides who holds it and whether the console exposes it at all |
| `resident.merge` | **Doctrinal, deferred to TAB 04.** The console's domain states there is no merge (`DL-74`); the backend ships one. Not a naming difference, and not resolvable here |
| `settings.manage` (console-only, withdrawn) | Nothing in the console reads it. A grant with no screen behind it is a grant nobody can reason about |

## 8. Roles — zero shared names

| Console (7) | Backend (8) | Mapping |
| --- | --- | --- |
| `system-administrator` | `lgu_admin` | Direct |
| `mswdo-head` | `lgu_staff` + elevated grants | The backend has no head-of-office role; it is `lgu_staff` plus the approval and publication grants |
| `social-worker` | `lgu_staff` | Direct |
| `intake-officer` | `lgu_staff` | Direct — the backend does not distinguish intake from casework by role, only by grant |
| `disbursement-officer` | `disbursing_officer` | **The closest pair, and not the same string.** One character apart, and neither side would match the other |
| `barangay-link` | `lgu_staff` + barangay scope | Scope, not role. Reconciled with `ScopeResolver` in step 9 |
| `auditor` | — | No backend counterpart. Read-only oversight |
| — | `data_protection_officer` | **Unassigned, and release-gate blocker 1.** Holds `audit.view`, and nobody holds the role |
| — | `security_officer` | No MSWDO counterpart |
| — | `operations_engineer` | No MSWDO counterpart |
| — | `verifier` | Device, not a person |
| — | `resident` | Not staff |

**Decision: the backend's role *names* are canonical, and the console's role *set* is canonical for
staff.** Three backend roles — `security_officer`, `operations_engineer`, `verifier` — have no
MSWDO counterpart and are **kept**, because they guard surfaces this console does not render; they
simply never appear in it. `data_protection_officer` stays unassigned until the LGU appoints one
(TAB 14).

The one role that must not be quietly merged is `auditor`. It is read-only oversight, and it holds
`audit.view-detail` where the head does not. Mapping it onto `lgu_staff` would give the person
checking the work the same grants as the people doing it.

## 9. Data scope

Console: `all-barangays` | `own-barangay` | `assigned-cases`. Backend: `ScopeResolver`.

**Not yet reconciled** — it needs the same treatment as the permission table, against
`ScopeResolver`'s actual behaviour, and it carries its own acceptance criterion ("a caseworker
cannot reach another barangay's records by any client-side manipulation") which cannot be proven
without a running API. Carried as an open row of this table rather than assumed equivalent.

---

## What this table commits to

| | Count |
| --- | --- |
| Adopt unchanged | 21 |
| Renamed (form or resource) | 9 |
| Console split adopted; backend gains keys | 4 groups, 22 keys |
| Backend split adopted; console gains keys | 2 groups |
| Console-only kept | 6 |
| Backend-only adopted by the console | 24 |
| Backend-only not adopted | 6 |
| Withdrawn | 1 (`settings.manage`) |
| **Deferred to TAB 04** | **6** (`case.*` ×5, `resident.merge`) |
| **Open** | data scope |

Nothing in this table is applied yet. Applying it is TAB 03's remaining work: the backend renames
need a migration over stored role-permission rows, and the console must move onto the permissions
`GET /api/v1/me` resolves rather than computing them from `ROLE_DEFINITIONS`.
