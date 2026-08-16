# TAB 23 — QA, Test Data, Acceptance Testing & Final Polish

**Status:** COMPLETE — locally certified
**Commit:** `274efb6`
**Verify gate:** PASS — lint, typecheck, **17 checkers**, **1292 tests** (66 files), production build with **no warnings**

**This completes the original 23 TABs.** TABs 24–26 are the late-phase Newsfeed
and Events additions.

---

## What was built

| Artefact | What it is |
| --- | --- |
| `src/app/acceptance/acceptance.spec.ts` | 20 scenario tests against the **real** adapter set |
| `docs/qa/README.md` | The dataset, the 17 scenarios, and what cannot be exercised |
| `tools/check-hardening.mjs` | Gained rule 9: the acceptance suite must use real adapters |
| `DL-121` | An acceptance test uses the real adapters, or it is a unit test |

One polish change: a column headed `Approved` beside a `Status` column, meaning
*amount* approved, renamed to `Amount approved`.

---

## Acceptance criteria

| Criterion (master command) | State |
| --- | --- |
| Build/tests pass in the available environment | PASS — 1292 tests, no build warnings |
| No known broken core route or dead-end workflow | PASS — every route loads a real screen since TAB 21 |
| No Esperanza/Get Hired branding remains | PASS — grep clean outside the reference-audit history |
| Realistic linked mock dataset | PASS — 252 residents across all five barangays, verified by test |
| QA/test scenario document | PASS — `docs/qa/README.md` |
| Automated tests for highest-risk workflows | PASS — the acceptance suite |
| Final polish log | PASS — in the QA document |

---

## The finding worth keeping

**No test in the project checked whether the seed was coherent.**

Every feature spec wires its own repository doubles, which is correct — a screen
test should not depend on seed data it did not choose. But the consequence is
that a double returning a plausible `Disbursement` proves the release screen
renders one, and proves nothing about whether that release names a request that
exists, belonging to the resident it pays.

TAB 17 found exactly that defect **by hand** (`dsb-0008` citing `req-0007` while
naming a resident who belonged elsewhere). Nothing automated would have caught
it.

`acceptance.spec.ts` closes that gap by wiring the real adapter set through
`provideDataAccess` and walking whole paths across modules. It may override
exactly one token — `STAFF_REPOSITORY`, to choose the signed-in role — and
`check:hardening` fails the build if any other is doubled (`DL-121`).

---

## The suite found a defect in itself

A scope assertion read:

```ts
expect(barangays.size).toBeLessThanOrEqual(1);
```

That is also true of an **empty** result — and the result *was* empty, because
the test fixture built a barangay-link account with `barangayId: null`.

Asserting non-emptiness first turned a vacuous pass into a real check. It also
produced a second test worth having: an account scoped to `own-barangay` with no
barangay set sees **nothing**, which is the fail-closed reading of a
misconfiguration and the opposite of handing the whole municipality to an
account somebody forgot to finish setting up.

That is the third time this project has caught an assertion that was true of an
empty set. It belongs beside the checker-scoping lesson as its test-side twin:
**assert the precondition before asserting the property.**

---

## Where I did not trust my own measurement

My first pass audited the 17 scenarios by keyword-matching spec files. It
reported 16 of 17 covered — including "case closure" matching
`network.spec.ts` and "empty first-use state" matching `access.guards.spec.ts`.

Both are plainly false positives, of the same shape as the checker false-cleans
this project keeps producing: a loose match reporting coverage that does not
exist. So the audit was discarded and replaced with tests that actually run.

The QA document reports what is genuinely covered, what is **partial**
(scenarios 15 and 16 — semantics asserted, rendering not), and what this
environment **cannot exercise at all**: 200% zoom, real tablets, an actual
screen reader, reduced-motion rendering. Naming those is the point; a document
reporting seventeen passes when three were never run is worse than one
reporting fourteen.

---

## Verified, not changed

Consistency was already high, because the constraints that produce it have been
enforced by checkers since early TABs:

- status labels render through domain catalogs — no hardcoded label found;
- 17 copy modules for 17 feature areas (`placeholder` correctly has none);
- empty states on every list and detail screen;
- no console errors during tests;
- no foreign branding.

The master command warns against redesigning for novelty at this stage. One
change was made, and it had a defect behind it.

---

## Known gaps, carried forward and recorded

Each is a screen deliberately not built, with domain, adapter and tests already
in place behind it — none is a dead end:

- Role and scope assignment displayed, not editable (`DL-115`)
- Correction capture form (`DL-117`)
- Payout session creation (`DL-90`)
- Task reassignment picker (`DL-99`)
- Document upload, referral composition, visit scheduling, enrollment
- Filter chips and per-list filtered counts
