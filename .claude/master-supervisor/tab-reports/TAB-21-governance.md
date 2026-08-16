# TAB 21 — User Management, Audit Trail & Data Governance

**Status:** COMPLETE — locally certified
**Commit:** `a9cbca4`
**Verify gate:** PASS — lint, typecheck, **16 checkers**, **1261 tests** (64 files), production build

**This TAB filled the last placeholder route.** Every route in the application
now loads a real screen.

---

## What was built

| Layer    | Artefact                                                                    |
| -------- | --------------------------------------------------------------------------- |
| Domain   | `governance/audit-view.ts` — the row/detail split, filtering, count sentences |
| Domain   | `governance/data-classification.ts` — 10 record types, 4 tiers, statutory basis |
| Domain   | `governance/retention.ts` — rules awaiting an office schedule                |
| Domain   | `governance/correction-request.ts` — states, transitions, the reason rule    |
| Domain   | `governance/staff-profile.ts` — the directory, `canHoldSession`, not-built notices |
| Domain   | `governance.spec.ts` — 33 tests                                              |
| Access   | New `audit.view-detail` permission, classified read-only                     |
| Ports    | `GovernanceRepository` — 8 reads, 1 write, no provisioning                   |
| Data     | `mock-governance.repository.ts`, `governance.seed.ts`, `HttpGovernanceRepository` |
| Data     | `mock-staff.repository.ts` — the deactivation fix                            |
| Features | `staff-page`, `roles-page`, `audit-page`, `governance-page` + copy           |
| Features | `administration.spec.ts` — 24 tests                                          |
| Build    | `tools/check-governance.mjs`, wired into `npm run verify`                     |
| Docs     | `docs/governance/README.md`; `DL-113` … `DL-117`; CLAUDE.md §5; permission matrix |

---

## Acceptance criteria

| Criterion (master command)                        | Where it is met                                        | State |
| -------------------------------------------------- | ------------------------------------------------------ | ----- |
| Sensitive actions have distinct permissions         | `audit.view` vs `audit.view-detail`; matrix screen      | PASS  |
| Deactivated users lose affordances in mock state    | `canHoldSession` in both auth paths (`DL-116`)          | PASS  |
| Audit UI readable and filterable without excess PII | Values are not on the row at all (`DL-114`)             | PASS  |
| User list/detail                                    | `staff-page`, composed from account + profile           | PASS  |
| Role/permission matrix                              | `roles-page`, built from the system's own source        | PASS  |
| Audit trail explorer                                | `audit-page`, searchable and filterable                 | PASS  |
| Data-governance settings UI                         | `governance-page`                                       | PASS  |
| Invite/provision placeholder only                   | Stated in a sentence; no method, no form                | PASS  |
| Activate / deactivate                               | With a required reason, appended to the trail           | PASS  |
| Reset-access placeholder                            | Stated in a sentence                                    | PASS  |
| Role and scope assignment                           | Displayed, not editable                                 | PARTIAL — see below |
| Data classification labels                          | 10 record types, cited to RA 10173                      | PASS  |
| Retention/purge placeholders                        | Every period null, `awaiting-office-policy` (`DL-113`)  | PASS  |
| Consent/authority metadata display                  | Referral disclosure basis (`DL-82`), release authority  | PASS — built in earlier TABs |
| Export warnings                                     | Person-level export warning (`DL-106`)                  | PASS — TAB 19 |
| Access rationale / help text                        | Audit detail rationale; classification basis            | PASS  |
| Record correction request workflow placeholder      | Record and states built; capture screen not (`DL-117`)  | PASS  |

---

## Decisions recorded

- **DL-113** — retention is empty on purpose, and says so.
- **DL-114** — an audit row says what changed, never what it changed to.
- **DL-115** — an account and a directory entry are different records.
- **DL-116** — deactivation ends a live session, not the next one.
- **DL-117** — a correction is raised, considered and answered, never applied silently.

---

## Defect found and fixed

**Deactivation did nothing to a live session.**

`MockStaffRepository.signIn` refused a deactivated account. `currentUser()` did
not — it resolved the same account into a fully permissioned identity. So an
account switched off at 10am kept **every grant** until the person happened to
sign out.

That is worse than either half alone. The office saw the account marked
inactive, believed access had been withdrawn, and it had not been. The one
moment deactivation matters most — somebody being walked out — is the moment it
did nothing.

`canHoldSession` now lives in the domain and both paths ask it, so sign-in and
session cannot drift apart again.

This is the fifth defect of this shape across the project: a rule enforced on
one path and not the parallel one. The others were four ungated adapters
(`DL-84`, `DL-95`, `DL-100`, and the saved-view sharing gap in `DL-111`).

---

## The modelling call worth naming

Adding employee ID, unit and contact number to `StaffUser` would have been the
obvious move, and it would have touched **28 spec files** — every permission
test would suddenly care about a phone number.

More importantly they are different data. A role is office structure; an
employee's contact number is personal information about that employee, with the
same protection a resident's has. `StaffProfile` is therefore its own record
keyed on `StaffUserId`, and `StaffAccount` composes both in the data layer
(`DL-115`). Twenty-eight fixtures stayed untouched, and a role can be shown
without showing a number.

---

## Checker validation

`tools/check-governance.mjs` enforces eight doctrines, validated against **27
planted regressions**: 27/27 caught, 0 missed, 0 stale, baseline restored clean.

**Three were missed on the first pass**, all the same recurring class in
familiar shapes:

| Missed | Why the checker passed |
| --- | --- |
| the permission removed from `PERMISSIONS` | it survived in the **auditor's role grant** |
| RA 9470 dropped from the notice | it survived in the **doc comment** above it |
| a classification losing its citation | **four sibling entries** kept theirs |

The third is a shape not seen before: a block-scoped search where **every entry
needed checking individually**, not the block as a whole. Fixed by iterating the
entries.

Two existing checks also fired, both doing exactly what they were written for:

- the **permission-matrix property test** caught `audit.view-detail` classified
  as a mutation, which would have made the auditor a mutating role — the same
  catch as `document.download` in TAB 14;
- **`check:access`** caught the permission missing from
  `docs/access/permission-matrix.md`.

---

## Carried forward

- **Role and scope assignment is displayed, not editable.** The screen shows a
  role, its barangay scope and any additional grants; changing them is not
  built. Editing a role is the single most consequential write in the
  application, and it needs the confirmation and audit design that
  `setAccountActive` got — plus a staff picker. Flagged rather than half-built.
- **The correction capture screen is not built** (`DL-117`), and the governance
  page says so.
- **No placeholder routes remain.** `FeaturePlaceholderPage` stays in the tree
  because the rule it serves still holds for future modules.
- `visit-detail-page.scss` is 79 bytes over budget — TAB 22 is the hardening
  pass and should clear it.
