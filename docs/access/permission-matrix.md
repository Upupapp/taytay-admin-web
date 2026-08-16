# Permission Matrix (TAB 05)

Who may do what in the MSWDO staff console.

**Source of truth is code**, not this page: `ROLE_DEFINITIONS` in
`src/app/domain/access/permission.ts` is where a grant is written, and
`PERMISSION_MATRIX` in `permission-matrix.ts` is the derived view that tests
assert against. This table was generated from that code and is kept honest by
`npm run check:access`.

Decisions: `DL-30` (enforcement), `DL-31` (non-leaking denial), `DL-32` (no
self-registration), `DL-33` (accessible authentication).

---

## Roles

| Role                   | Short  | Data scope     | Purpose                                                          |
| ---------------------- | ------ | -------------- | ---------------------------------------------------------------- |
| `system-administrator` | Admin  | all-barangays  | Maintains accounts, roles and reference data. Not a case worker. |
| `mswdo-head`           | Head   | all-barangays  | Approves or rejects endorsed requests; oversees the office.      |
| `social-worker`        | SW     | assigned-cases | Assesses cases and endorses them.                                |
| `intake-officer`       | Intake | all-barangays  | Receives applicants, records requests, validates requirements.   |
| `disbursement-officer` | Disb   | all-barangays  | Schedules payouts and releases approved assistance.              |
| `barangay-link`        | Brgy   | own-barangay   | Barangay-based encoder. Sees only their own barangay.            |
| `auditor`              | Audit  | all-barangays  | Read-only oversight across the municipality.                     |

---

## Matrix

47 permissions × 7 roles. `X` means the role holds the permission.

| Permission                        | Admin | Head | SW  | Intake | Disb | Brgy | Audit |
| --------------------------------- | ----- | ---- | --- | ------ | ---- | ---- | ----- |
| `dashboard.view`                  | X     | X    | X   | X      | X    | X    | X     |
| `resident.view`                   | X     | X    | X   | X      | X    | X    | X     |
| `resident.view-sensitive`         | X     | X    | X   | X      |      |      |       |
| `resident.create`                 | X     | X    | X   | X      |      | X    |       |
| `resident.update`                 | X     | X    | X   | X      |      |      |       |
| `resident.deactivate`             | X     | X    |     |        |      |      |       |
| `resident.export`                 | X     | X    |     |        |      |      |       |
| `beneficiary.view`                | X     | X    | X   | X      |      |      | X     |
| `beneficiary.review-duplicates`   | X     | X    | X   |        |      |      |       |
| `beneficiary.export`              | X     | X    |     |        |      |      |       |
| `household.view`                  | X     | X    | X   | X      | X    | X    | X     |
| `household.manage`                | X     | X    | X   | X      |      |      |       |
| `household.correct-vulnerability` | X     | X    | X   |        |      |      |       |
| `family.view`                     | X     | X    | X   | X      | X    | X    | X     |
| `family.manage`                   | X     | X    | X   | X      |      |      |       |
| `case.view`                       | X     | X    | X   | X      |      |      | X     |
| `case.manage`                     | X     | X    | X   | X      |      |      |       |
| `case.note`                       | X     | X    | X   | X      |      |      |       |
| `case.view-protected-note`        | X     | X    | X   |        |      |      |       |
| `case.close`                      | X     | X    |     |        |      |      |       |
| `program.view`                    | X     | X    | X   | X      | X    | X    | X     |
| `program.manage`                  | X     | X    |     |        |      |      |       |
| `request.view`                    | X     | X    | X   | X      | X    | X    | X     |
| `request.create`                  | X     | X    | X   | X      |      | X    |       |
| `request.intake`                  | X     | X    | X   | X      |      |      |       |
| `request.assess`                  | X     | X    | X   |        |      |      |       |
| `request.endorse`                 | X     | X    | X   |        |      |      |       |
| `request.approve`                 | X     | X    |     |        |      |      |       |
| `request.reject`                  | X     | X    |     |        |      |      |       |
| `request.schedule`                | X     | X    |     |        |      |      |       |
| `request.close`                   | X     | X    |     |        |      |      |       |
| `request.view-sensitive`          | X     | X    | X   |        |      |      |       |
| `document.record`                 | X     | X    | X   | X      |      |      |       |
| `document.download`               | X     | X    | X   |        |      |      | X     |
| `document.view-full-number`       | X     | X    | X   |        |      |      |       |
| `disbursement.view`               | X     | X    |     |        | X    |      | X     |
| `disbursement.schedule`           | X     | X    |     |        | X    |      |       |
| `disbursement.release`            | X     |      |     |        | X    |      |       |
| `disbursement.void`               | X     | X    |     |        |      |      |       |
| `referral.view`                   | X     | X    | X   | X      |      | X    | X     |
| `referral.manage`                 | X     | X    | X   |        |      |      |       |
| `report.view`                     | X     | X    | X   |        | X    |      | X     |
| `report.export`                   | X     | X    |     |        |      |      | X     |
| `audit.view`                      | X     | X    |     |        |      |      | X     |
| `staff.view`                      | X     | X    |     |        |      |      | X     |
| `staff.manage`                    | X     |      |     |        |      |      |       |
| `settings.manage`                 | X     |      |     |        |      |      |       |

---

## The three rows worth reading twice

**`request.approve` and `disbursement.release` never appear together** except on
`system-administrator`. That is separation of duties (`DL-08`): the head
approves the money, the disbursing officer releases it, and no case-working role
can do both. `rolesBreachingSeparationOfDuties()` returns the offenders and the
test asserts it is empty, so this cannot regress quietly.

**`staff.manage` and `settings.manage` are administrator-only.** The head can
_see_ staff (`staff.view`) but cannot change roles. Whoever can grant permissions
should not also be working cases with them.

**`request.view-sensitive` is limited to Admin, Head and SW.** It gates records
flagged `vawc-survivor` (RA 9262) or `cicl` (RA 9344). An intake officer can
process an ordinary request without ever seeing a protection case.

**The two sensitive tiers are not the same grant** (`DL-38`).
`resident.view-sensitive` covers identity and means — the PhilSys reference
(RA 11055) and monthly income — and reaches Intake, who verify a presented card
and run the means test. `request.view-sensitive` is narrower and covers the
protected-sector tier, which is what unlocks a survivor's address and contact
details. A disbursing officer and an auditor hold neither: they need to know a
person exists and what was paid, not who they are.

**`household.correct-vulnerability` is narrower than `household.manage`** (`DL-42`).
Moving a person between households is clerical work and reaches intake. Saying
that the records are wrong about a family's circumstances is a judgement, and it
reaches the head, social workers and the administrator only. A correction always
carries a reason and is attributed; an indicator nobody can be named for is an
indicator nobody is answerable for.

**The case permissions are five, not one** (`DL-52`, `DL-58`). `case.view` opens
the file. `case.manage` moves it along, assigns it and records tasks.
`case.note` writes on the running record — a clerk may move a file without
adding to the social worker's notes. `case.view-protected-note` is the narrow
tier: safety planning under RA 9262, anything identifying a child in conflict
with the law under RA 9344, a confidence given in a session. `case.close` ends
the office's involvement, which is a decision rather than a step, and reaches
the head and the administrator only.

Three exclusions are deliberate rather than oversights. **`barangay-link` holds
no case permission at all** — a barangay encoder files requests and keeps the
registry current, and the casework record of their own neighbours is not theirs
to read; proximity is a reason to be stricter, not looser. **`disbursement-officer`
holds none either**: a payout is authorised by the approved request in front of
them, and the family's case file is not part of paying it out. **`auditor` holds
`case.view` and never `case.view-protected-note`** — oversight is checking that
a reason was recorded, an owner assigned and the work done in time, none of
which requires reading a survivor's safety plan.

**`family.manage` is separate from `household.manage`** (`DL-47`). A household
is an address and a family is a claim about who belongs to whom; the two are
edited by the same roles today but they are not the same authority, and one
address routinely holds several families. Keeping the permissions apart means a
later decision to narrow one does not silently narrow the other.

`barangay-link` is deliberately excluded from `resident.view-sensitive` even
though it may `resident.create`. A barangay encoder captures an identity number;
it does not need it read back, and the registry minimises by default. The
consequence — a barangay encoder cannot check their own typing after saving — is
accepted, and is the sort of thing a first office pilot should re-examine.

---

## Per-user grants

`StaffUser.additionalPermissions` adds to the role baseline for one person — the
seeded social worker Jomar Villanueva holds `report.export` this way. It can
only ever **add**: nothing takes a role permission away, so the effective set is
always a superset of the role and stays easy to reason about
(`toAuthenticatedUser`). That is why this table describes roles, not people.

**The beneficiary permissions separate reading from ruling** (`DL-71`, `DL-74`).
`beneficiary.view` opens the longitudinal record — everything the office has
done for one person, across every programme and year — and reaches intake,
because "have we helped them before?" is a counter question that changes the
conversation.

`beneficiary.review-duplicates` is the narrower grant, and it is withheld from
two roles on purpose. **Intake does not hold it:** the counter that created the
second record should not be the one that rules on whether it is a duplicate.
**The auditor does not hold it either:** oversight that can alter the identities
it is checking is not oversight. A caller without it receives no candidates at
all — the data layer withholds them rather than trusting a template to hide
them.

`beneficiary.export` is held apart from `report.export`, which produces
aggregates. Taking a named beneficiary list out of the system is the operation
TAB 05 called sensitive, and it reaches the head and the administrator only.

**The document permissions separate recording from reading the file** (`DL-77`).
`document.record` is intake work: the counter says what was presented and
replaces a copy when it lapses. `document.download` opens the file itself, and
intake does **not** hold it — recording what somebody handed over and pulling
the scan of their medical abstract off the system are different disclosures, and
the counter needs only the first. `document.view-full-number` is narrower again,
because a document number is disclosive on its own; everywhere else the number
is masked to its last four characters.

The auditor holds `document.download` and neither of the others: oversight has to
be able to check that the office held what it claims to have held.

---

## Where it is enforced

Three layers, and only the last two are protection:

1. **Navigation and controls** — `AppNav` filters by permission;
   `*appHasPermission` removes a control; `appDisableWithoutPermission` disables
   and explains one. Usability, not security.
2. **Routes** — `permissionGuard(...)` on every guarded route, mirroring the
   navigation entry so a user never sees a link that bounces them.
3. **The data layer** — the mock adapters re-check permission _and_ data scope
   before returning or changing anything, using `ACCESS_CONTEXT`. This is what
   makes bypassing the UI pointless, and it is what the real API will do.

See `docs/access/README.md` for how the three fit together.

---

## Checks

```bash
npm run check:access   # matrix doc matches the permission vocabulary in code
npm test               # matrix invariants + enforcement + auth behaviour
```
