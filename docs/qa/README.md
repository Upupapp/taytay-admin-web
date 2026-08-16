# QA, test data and acceptance scenarios

What was verified, what was already covered, and — as importantly — what this
environment cannot exercise.

Built in TAB 23. Decision record: `DL-121`.

---

## The dataset

Fictional Taytay data spanning **all five barangays** — Dolores, Muzon, San
Juan, Santa Ana, San Isidro.

| | |
| --- | --- |
| Residents | 12 named + 240 generated = **252** |
| Households, families | Interlinked, with one household holding more than one family |
| Cases | Every status including a closed one |
| Assistance requests | Across the lifecycle: draft, returned, assessment, endorsed, completed, rejected |
| Documents | Verified, pending, rejected, waived, and a superseded version |
| Referrals | Sent, acknowledged, answered — and at least one past its follow-up date |
| Field visits | Completed with all four observation kinds, scheduled, refused, nobody-home |
| Releases | Nine, covering every state including deferred, unclaimed, in-kind and voided |
| Audit trail | Eight entries, three with recorded values held behind their own permission |
| Correction requests | Raised, applied and refused |

**No record names a real person.** The acceptance suite asserts it, crudely but
usefully: no surname matches `test`, `lorem`, `foo`, `admin` or `sample`.

The generated block exists so that pagination, small-cell suppression and
sorting are exercised **by the data** rather than by a unit test with three
rows.

---

## Acceptance scenarios

`src/app/acceptance/acceptance.spec.ts` runs each scenario against the **real
mock adapter set** through `provideDataAccess` — not against per-test doubles
(`DL-121`).

That distinction is the whole value of the suite. A double that matches the
shape of a call proves the call was shaped correctly; it cannot prove that the
resident a request names is actually on file. TAB 17 had already found one
release pointing at a request belonging to a different resident, which is
exactly the class of defect only a cross-module test sees.

| # | Scenario | Where it is verified |
| --- | --- | --- |
| 1 | Existing resident applies | **Acceptance** — every request resolves to a real resident |
| 2 | Walk-in creates resident, then linkage | `features/residents`, `mock-household.repository.spec` |
| 3 | Duplicate warning | **Acceptance** + `beneficiary-registry.spec` — signals carry no values |
| 4 | Household with two families | **Acceptance** — a family holds no `householdId` (`DL-47`) |
| 5 | High-vulnerability household | `household-vulnerability.spec` |
| 6 | Missing requirements then resubmission | `assistance-request.spec`, `requirements.spec` |
| 7 | Referral and overdue follow-up | **Acceptance** — overdue exists, and surfaces as owed work |
| 8 | Approved case to release | **Acceptance** — every release resolves to a real request and resident |
| 9 | Rejected/returned with reason | `mock-assistance-request.repository.spec` |
| 10 | Case closure | **Acceptance** — a closed case exists; closure is terminal (`DL-53`) |
| 11 | Restricted user attempts sensitive export | **Acceptance** — refused at the adapter, three ways |
| 12 | Network failure during save | `core/network/network.spec` (`DL-118`) |
| 13 | Empty first-use state | **Acceptance** — an empty page, not an error |
| 14 | Large filtered datasets | **Acceptance** — 252 records paged and filtered |
| 15 | Mobile/tablet workflows | `layout.spec` with `FakeViewportService` — **partial**, see below |
| 16 | Keyboard-only workflows | `layout.spec`, overlay behaviour — **partial**, see below |
| 17 | Reduced-motion mode | `check:hardening` — **not a test**, see below |

Plus one the master command does not list, added because it is the widest
disclosure risk in the application: **a barangay-link account is confined to its
barangay**, and an account with no barangay set sees **nothing** rather than
everything.

---

## What this environment cannot exercise

Naming these is the point. A QA document that reports seventeen passes when
three of them were never run is worse than one that reports fourteen.

| Not exercised | Why | What stands in its place |
| --- | --- | --- |
| **200% browser zoom** | No visual regression harness; jsdom has no layout | Structural guards: no fixed pixel widths on containers, no `text-overflow` on a name, `check:hardening` |
| **Real tablet / touch** | No device in this environment | `FakeViewportService` exercises the breakpoint *semantics* — drawer vs column, focus trap, `aria-modal` |
| **An actual screen reader** | Not automatable here | Semantics are asserted: roles, labels, `visually-hidden` text on every matrix cell, polite live regions |
| **Reduced-motion rendering** | jsdom does not apply media queries | `check:hardening` asserts the contract: ambient animation removed outright, transitional collapsed (`DL-15`) |
| **Long Filipino names at width** | Same as zoom | Names wrap; nothing truncates a person's name anywhere |

Scenario 15 and 16 are marked **partial** for exactly this reason: the
behaviour that can be asserted is asserted, and the rendering is not.

---

## Automated quality

| Check | Result |
| --- | --- |
| `npm run lint` | Clean |
| `npm run typecheck` | Clean |
| 17 repository checkers | All pass; each validated against planted regressions |
| `npm test` | 1292 tests, 66 files, all pass |
| `npm run build` | **No warnings** |
| Console errors in tests | None |
| Foreign branding (`Esperanza`, `Get Hired`) | None outside the reference-audit history |

---

## Polish

The master command warns against redesigning for novelty at this stage, so
changes here needed a defect behind them.

| Found | Action |
| --- | --- |
| A column headed `Approved` beside a `Status` column, meaning *amount* approved | Renamed to `Amount approved` |
| Status labels hardcoded in templates | None found — every status renders through its domain catalog |
| Copy modules | 17 for 17 feature areas; `placeholder` correctly has none |
| Empty states | Present on every list and detail screen |

Nothing else was changed. Consistency was already high because the constraints
that produce it — one status catalog per domain, one copy module per feature,
one set of shared primitives — have been enforced by checkers since early TABs.

---

## Known gaps carried forward

These are recorded rather than hidden. Each is a screen that was deliberately
not built, with the domain, adapter and tests already in place behind it:

- **Role and scope assignment** is displayed, not editable (`DL-115`).
- **The correction capture form** is not built (`DL-117`).
- **Payout session creation** — `createBatch` is built and gated; no screen
  calls it (`DL-90`).
- **Task reassignment** has no staff picker (`DL-99`).
- **Document upload, referral composition, visit scheduling, enrollment** —
  ports, adapters and validation exist; the capture screens do not.
- **Filter chips and a per-list filtered count** — saved views and URL sync
  exist; the chip row does not.

None is a dead end: every one of them is a screen that would call an API that
already exists and is tested.
