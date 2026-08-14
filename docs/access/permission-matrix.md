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

30 permissions × 7 roles. `X` means the role holds the permission.

| Permission               | Admin | Head | SW  | Intake | Disb | Brgy | Audit |
| ------------------------ | ----- | ---- | --- | ------ | ---- | ---- | ----- |
| `dashboard.view`         | X     | X    | X   | X      | X    | X    | X     |
| `resident.view`          | X     | X    | X   | X      | X    | X    | X     |
| `resident.create`        | X     | X    | X   | X      |      | X    |       |
| `resident.update`        | X     | X    | X   | X      |      |      |       |
| `resident.deactivate`    | X     | X    |     |        |      |      |       |
| `resident.export`        | X     | X    |     |        |      |      |       |
| `program.view`           | X     | X    | X   | X      | X    | X    | X     |
| `program.manage`         | X     | X    |     |        |      |      |       |
| `request.view`           | X     | X    | X   | X      | X    | X    | X     |
| `request.create`         | X     | X    | X   | X      |      | X    |       |
| `request.intake`         | X     | X    | X   | X      |      |      |       |
| `request.assess`         | X     | X    | X   |        |      |      |       |
| `request.endorse`        | X     | X    | X   |        |      |      |       |
| `request.approve`        | X     | X    |     |        |      |      |       |
| `request.reject`         | X     | X    |     |        |      |      |       |
| `request.schedule`       | X     | X    |     |        |      |      |       |
| `request.close`          | X     | X    |     |        |      |      |       |
| `request.view-sensitive` | X     | X    | X   |        |      |      |       |
| `disbursement.view`      | X     | X    |     |        | X    |      | X     |
| `disbursement.schedule`  | X     | X    |     |        | X    |      |       |
| `disbursement.release`   | X     |      |     |        | X    |      |       |
| `disbursement.void`      | X     | X    |     |        |      |      |       |
| `referral.view`          | X     | X    | X   | X      |      | X    | X     |
| `referral.manage`        | X     | X    | X   |        |      |      |       |
| `report.view`            | X     | X    | X   |        | X    |      | X     |
| `report.export`          | X     | X    |     |        |      |      | X     |
| `audit.view`             | X     | X    |     |        |      |      | X     |
| `staff.view`             | X     | X    |     |        |      |      | X     |
| `staff.manage`           | X     |      |     |        |      |      |       |
| `settings.manage`        | X     |      |     |        |      |      |       |

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

---

## Per-user grants

`StaffUser.additionalPermissions` adds to the role baseline for one person — the
seeded social worker Jomar Villanueva holds `report.export` this way. It can
only ever **add**: nothing takes a role permission away, so the effective set is
always a superset of the role and stays easy to reason about
(`toAuthenticatedUser`). That is why this table describes roles, not people.

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
