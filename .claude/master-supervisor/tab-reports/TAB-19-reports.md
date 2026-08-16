# TAB 19 — Reports, Analytics, Exports & LGU Decision Support

**Status:** COMPLETE — locally certified
**Commit:** `70d7976`
**Verify gate:** PASS — lint, typecheck, **14 checkers**, **1180 tests** (61 files), production build

---

## What was built

| Layer    | Artefact                                                                        |
| -------- | ------------------------------------------------------------------------------- |
| Domain   | `reports/report-definition.ts` — the 14-report catalogue as **data**, grain, per-report permissions, cautions, `reportProblems` |
| Domain   | `reports/report-disclosure.ts` — small-cell suppression, its basis, the notice |
| Domain   | `reports/report-result.ts` — filters, `describeFilter`, rows, series, `ExportManifest`, CSV quoting |
| Domain   | `reports/reports.spec.ts` — 34 tests                                            |
| Ports    | `ReportRepository` — `catalogue`, `run`, `export`. No way to bypass suppression  |
| Data     | `mock-report.repository.ts` — 14 producers, gated per report, scoped, composes the export |
| Data     | `HttpReportRepository`; `api.contract.ts` gained a `reports` endpoint            |
| Features | `report-hub-page`, `report-view-page` + copy                                     |
| Features | `reports.spec.ts` — 26 tests                                                     |
| Build    | `tools/check-reports.mjs`, wired into `npm run verify`                           |
| Docs     | `docs/reports/README.md`; `DL-104` … `DL-108`; CLAUDE.md §5                       |

Routes `/reports` and `/reports/:id` replaced the placeholder.

---

## Acceptance criteria

| Criterion (master command)                              | Where it is met                                          | State |
| -------------------------------------------------------- | -------------------------------------------------------- | ----- |
| Aggregate analytics available without exposing names      | 13 of 14 reports are counts; suppression on people series | PASS  |
| All chart claims verifiable from tabular data             | `ChartTable` **is** the table; summary required           | PASS  |
| Exports clearly show applied filters and generation metadata | `ExportManifest` written into the file itself          | PASS  |
| Reports hub                                                | `/reports`, grouped by area                               | PASS  |
| Reusable report filter bar                                 | Period + barangay, rendered only where honoured           | PARTIAL — programme, status and caseworker are declared in `ReportFilterSupport` and honoured by the adapter; the bar renders period and barangay. Offering a control the report ignores would be a lie, so the rest wait for their pickers |
| Accessible charts + table views                            | One artifact; bar is `aria-hidden`                        | PASS  |
| Permission-aware export flow                               | `report.export` + per-report permission + warning         | PASS  |
| Charts must not rely on hue alone                          | Every row states label and value as text                  | PASS  |
| Staff workload avoids performance ranking                  | Counts only, alphabetical, cautioned                      | PASS  |
| Aggregate-first, drill to PII only when necessary          | One person-level report with a stated reason              | PASS  |

---

## Decisions recorded

- **DL-104** — reports are aggregate first; naming people has to argue for itself.
- **DL-105** — an aggregate is not automatically anonymous.
- **DL-106** — an export carries its own conditions, inside the file.
- **DL-107** — staff workload counts what people carry; it does not rank them.
- **DL-108** — a chart that is not a table is a claim nobody can check.

---

## The judgement call worth naming

**Small-cell suppression was not asked for.** The master command asks for
aggregate-first reporting and for minimising exposure; it does not mention a
threshold.

I added one because aggregate-first alone does not achieve what it is for. A
report saying "Barangay San Juan: 1 VAWC survivor served" contains no names and
is still a disclosure — and it is exactly the kind of figure a service-reach
report produces. Publishing it while believing the report was anonymous is the
failure mode the requirement exists to prevent.

The threshold itself is **not presented as policy**. Five is common practice, no
Taytay issuance was supplied fixing it, so it carries
`convention-pending-confirmation` and says so on screen — the same treatment as
the intake review windows (`DL-68`) and the opposite of inventing a number and
letting it become policy by age.

---

## Checker validation

`tools/check-reports.mjs` enforces seven doctrines, validated against **32
planted regressions**: 32/32 caught, 0 missed, 0 stale, baseline restored clean.

**Four were missed on the first pass.** Two were defects in my *plants* — they
edited the first matching occurrence, which was in `ReportResult` rather than
`ExportManifest`, and in the first line of a notice rather than the line holding
the citation. That is worth recording as its own trap: a plant that edits the
wrong occurrence reports a checker weakness that does not exist, and would have
sent me rewriting a rule that was already correct.

The other two were real, and both of the recurring class:

| Missed | Why the checker passed |
| --- | --- |
| threshold presented as settled policy | the phrase survived in the **doc comment** above the constant |
| export downgraded to `report.view` | `'report.export'` survived in a **second call in the same method** |

A third variant surfaced while fixing them: `/export const SMALL_CELL_BASIS[\s\S]*?;/`
terminated on a semicolon **inside the string literal** ("…practice; the
MSWDO…"), so the block was half a declaration read as the whole.

And one more shape, found before the plants ran: the checker's own ranking scan
flagged the caution that **warns against** ranking, because the warning
necessarily contains the word "productivity". Fixed by matching identifiers
rather than prose.

---

## The recurring lesson — now with a named counter-trap

Ten instances across six checkers. This TAB added three new shapes:

6. the phrase survives in a **doc comment** above the declaration;
7. a lazy block regex terminates on a delimiter **inside a string literal**;
8. the checker flags the **prose that satisfies the rule** as violating it.

Plus a counter-trap on the validation side: **a plant that edits the wrong
occurrence looks exactly like a checker weakness.** Two of the four misses here
were that, and diagnosing them by grepping for the surviving string took less
time than "fixing" a rule that was never broken would have.

Both halves need the same discipline: scope the assertion to the declaration,
and scope the plant to the occurrence the rule is about.

---

## Carried forward

- **The filter bar renders two of five declared filters.** Programme, status and
  caseworker are honoured by the adapter and declared per report; their pickers
  need the programme list and staff list, which belong with TAB 20's saved-view
  work and TAB 21's user management.
- **`ExportFormat` includes `printable`** and the print stylesheet is in place,
  but the CSV path is the only one that composes a file. A PDF/print hook is a
  browser concern the master command lists as "view hooks", which the
  `@media print` rule satisfies.
- `reports` is no longer a placeholder route. **`administration` is the last
  one** — assume its adapters are ungated until read (three for three).
- `visit-detail-page.scss` is 79 bytes over budget (pre-existing, non-blocking).
