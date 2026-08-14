# Social Welfare Executive Dashboard (TAB 06)

An overview built to be acted on, not admired.

Decisions: `DL-34` (attention first), `DL-35` (the chart is the table),
`DL-36` (filter in the URL), `DL-37` (enforcement gap and two misnamed metrics)
in [`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## The three acceptance guarantees, and how each is evidenced

### 1. "What needs attention now?" — answered within seconds

The screen opens with a ranked list of things a person can do something about,
above every chart. Severity first, then size, ordered in the domain by
`sortAttention` so it cannot depend on object-key iteration.

Each line names an action rather than a status code — "3 requests waiting for
approval", not "3 endorsed" — and carries a **Review** link into exactly the
records it counted.

Six situations are surfaced today:

| Signal                       | Severity | Permission to act       |
| ---------------------------- | -------- | ----------------------- |
| Waiting for approval         | critical | `request.approve`       |
| Payout scheduled, unreleased | critical | `disbursement.release`  |
| Returned to applicant        | warning  | `request.intake`        |
| Missing a required document  | warning  | `request.intake`        |
| Released, not collected      | warning  | `disbursement.schedule` |
| Referral unanswered          | info     | `referral.manage`       |

**The permission is the one needed to act, not to see** (`DL-34`). A read
permission would put items on a read-only auditor's to-do list that they could
do nothing about. Zero-count signals are dropped; an empty list is a real
answer, worded differently depending on whether nothing needs doing or nothing
is _this user's_ to do.

_Evidence:_ `dashboard.spec.ts` asserts the attention block precedes the
analytics in the DOM, that wording names an action, that severity is stated in
words, that an intake officer is not shown approvals or releases, and that the
auditor gets the role-specific empty state.

### 2. Every metric traces back to filtered records

The filter (barangay, programme type, period) lives in the URL. The same filter
object is passed to `DashboardRepository.summary(filter)` **and** merged into
every drill-down link, so the list a number opens is constrained exactly as the
number was.

All four headline figures are links. Every breakdown row is a link. Every
attention signal is a link.

_Evidence:_ tests assert each metric is an `<a>`, that `?barangay=…` reaches the
drill-down URL, that changing the filter changes the figures, and that the
headline `awaitingApproval` equals the `endorsed` row of the status breakdown —
if those ever diverge the dashboard is lying about its own data.

### 3. Charts are readable without colour, and by keyboard and screen reader

`ChartTable` **is** a real `<table>`: caption, scoped headers, one row per
category, with the bar as an `aria-hidden` span behind the label.

- Nothing rests on colour — every row states its label and value as text, and
  the bar only repeats the number.
- Keyboard users tab through real links.
- A non-zero row always keeps a visible sliver, so "small but present" never
  looks identical to "none".

There is deliberately **no separate accessible data table** (`DL-35`). Two
artifacts drift; the table stops being updated and quietly starts lying to the
people who depend on it most.

_Evidence:_ `chart-table.spec.ts` asserts semantic structure, `scope`
attributes, values as text, `aria-hidden` bars, proportional widths, the
minimum sliver, and real links.

---

## Structure

| Piece                    | File                                         |
| ------------------------ | -------------------------------------------- |
| Filter, signals, summary | `domain/dashboard/dashboard-summary.ts`      |
| Figures + attention      | `data/mock/mock-dashboard.repository.ts`     |
| Chart/table primitive    | `shared/ui/chart-table/`                     |
| Page                     | `features/dashboard/dashboard-page.*`        |
| Copy (`DL-23`)           | `features/dashboard/dashboard.copy.ts`       |
| Drill-down routes        | `features/dashboard/dashboard-drill-down.ts` |

Routes live in the feature, never in the domain: the domain knows the
_situation_, not this application's URLs.

---

## Two honesty fixes made here (`DL-37`)

- `MockDashboardRepository` had **no access check**, despite `docs/access/`
  claiming `denyUnless(...)` was in every mock repository. It now requires
  `dashboard.view` and respects barangay scope.
- `disbursedThisMonth` never respected a month — it summed every released
  disbursement regardless of date. It is now `disbursedInPeriod`, governed by
  the explicit period filter.

---

## Known gaps

- **Quick actions link to screens later TABs will build.** "Record a request"
  reaches `/assistance-requests?action=new`; the intake form itself is not built
  yet, so the query parameter is a seam rather than a feature.
- **No trend over time.** Every figure is a current position; there is no
  period-on-period comparison, which is what an executive would ask for next.
  It needs historical snapshots the mock does not hold.
- **`assigned-cases` scope still does not narrow lists** (carried from TAB 05),
  so a social worker's dashboard counts the whole caseload rather than theirs.
- **Attention thresholds are counts, not ages.** "Waiting for approval" does not
  yet distinguish two days from two weeks; ageing needs a decision about what
  the office considers overdue.
