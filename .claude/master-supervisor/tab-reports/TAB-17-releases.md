# TAB 17 — Release / Distribution / Disbursement Tracking

**Status:** COMPLETE — locally certified
**Commits:** `8337c10` (domain, adapters, ports), `fb65486` (screens, routes, checker, docs)
**Verify gate:** PASS — lint, typecheck, 12 checkers, 1074 tests (57 files), production build

---

## What was built

| Layer    | Artefact                                                                        |
| -------- | ------------------------------------------------------------------------------- |
| Domain   | `disbursement.ts` (9 statuses, transitions, `ReleaseKind`, `DeferralReason`, `AcknowledgementKind`, `disbursementProblems`, `sumReleased`) |
| Domain   | `release-batch.ts` (`ReleaseBatch` with **no status**, `batchProgress`, `describeBatch`, `batchProblems`) |
| Domain   | `release-manifest.ts` (`composeManifest`, `maskReference`, `MANIFEST_NOTICE`, `isSelfRelease`, `SELF_RELEASE_WARNING`) |
| Domain   | `releases.spec.ts` — 26 tests                                                   |
| Ports    | `DisbursementRepository` expanded to 13 methods; `ReleaseAcknowledgementDraft`   |
| Data     | `mock-disbursement.repository.ts` rewritten — gated, scoped, disclosing         |
| Data     | `disbursements.seed.ts` — 9 releases exercising every state, 1 payout session   |
| Data     | `HttpDisbursementRepository` + `api.contract.ts` kept in step                    |
| Features | `release-list-page`, `release-detail-page`, `payout-session-page` + copy         |
| Features | `releases.spec.ts` — 22 tests                                                    |
| Build    | `tools/check-releases.mjs`, wired into `npm run verify`                          |
| Docs     | `docs/releases/README.md`; `DL-89` … `DL-95`; CLAUDE.md §5                       |

Routes `/releases`, `/releases/sessions`, `/releases/:id` replaced the
`/disbursements` placeholder; the old path redirects rather than 404s.

---

## Acceptance criteria

| Criterion (master command)                    | Where it is met                                              | State |
| --------------------------------------------- | ------------------------------------------------------------ | ----- |
| Release queue with the full status set         | `release-list-page`, bucketed by who must act                | PASS  |
| Release record detail with acknowledgement     | `release-detail-page`                                        | PASS  |
| Batch schedule and printable manifest          | `payout-session-page` + `@media print`                       | PASS  |
| Masked data on anything printed                | `maskReference`, enforced by the checker                      | PASS  |
| Segregation-of-duties cues                     | `isSelfRelease` against the real approver                     | PASS  |
| No fabricated accounting or banking            | `check:releases` rule 1, plus the on-screen boundary notice   | PASS  |
| Batch tools never hide individual status       | `ReleaseBatch` has no status; counts derived from members     | PASS  |
| Audit seams                                    | `AuditStamp` on every write; reason required on each move     | PASS  |

---

## Decisions recorded

- **DL-89** — this module tracks releases; it is not the treasury system.
- **DL-90** — a payout session has no status of its own.
- **DL-91** — self-release warns; it does not block.
- **DL-92** — the payout list is composed, and carries the minimum, masked.
- **DL-93** — goods are counted; they are never valued.
- **DL-94** — deferred is the office's failing; unclaimed is nobody's.
- **DL-95** — the release adapter had no permission checks either.

---

## Defects found and fixed

1. **`MockDisbursementRepository` was completely ungated.** No permission check
   and no barangay scoping on `list`, `getById` or `listForRequest`. Any caller,
   unauthenticated included, could read every payout record — each of which
   names a person, an amount, and a date and place they can be found collecting
   money. This is the **second** adapter found in that state after
   `MockReferralRepository` (`DL-84`); both sat behind placeholder routes so
   nothing exercised them. Fixed: every method gated, scope applied through the
   beneficiary, not-found and not-yours read identically.

2. **A seed release named a request belonging to a different resident.**
   `dsb-0008` carried `req-0007` with `res-0009`, where `req-0007` is
   `res-0008`'s. Corrected.

3. **The checker itself passed on a surviving import.** Plant 24 renamed the
   scope call inside `isReadable`; the file-wide search for
   `isWithinBarangayScope` still matched the import line and reported clean.
   Fixed by scoping the assertion to the method body. This is the same class as
   the four instances in TABs 14–16 — noted again below.

---

## Checker validation

`tools/check-releases.mjs` enforces seven doctrines and was validated against
**24 planted regressions**. 24/24 caught, 0 missed, 0 stale, baseline restored
clean.

Plants covered: an account code on the model; a posting method on the port; the
boundary notice removed from copy; the notice no longer rendered; a status on a
session; a dropped progress count; a session summarised as one verdict; a
deferral reason about the family; a label blaming the family; a deferral with no
reason; a representative with no authority; a peso figure forced onto goods;
goods coerced to zero in a total; an unmasked voucher; the RA 10173 citation
stripped; income printed on the payout list; a pre-filled acknowledgement; a
screen composing its own manifest; self-release blocking; the control disabled
on self-release; the warning never shown; an ungated `approverFor`; scope
dropped from `isReadable`; `isReadable` removed entirely.

---

## The recurring lesson, fifth instance

A checker assertion must be scoped to **the declaration it is about**, never to
the file. Four times in TABs 14–16 a string survived elsewhere in the same file
and a real regression passed. Here it happened a fifth time — and only the
planted regression caught it, because the identifier survived in the import
statement.

Writing the checker with the rule in mind produced a clean first run (as in TAB
16). Validating it still found the one place the rule had not been applied.
**The plants are not a formality.**

---

## Carried forward

- The remaining placeholder routes — **reports** and **administration** — should
  be assumed to have ungated adapters until read. Two for two says this is the
  norm, not an accident.
- `visit-detail-page.scss` is 79 bytes over its 4 kB budget (pre-existing
  warning from TAB 16, non-blocking).
- No release screen creates a payout session yet; `createBatch` exists on the
  port and adapter and is exercised by the domain tests. Scheduling UI belongs
  with the work-queue TAB if the master command places it there.
