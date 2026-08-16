# Master Supervisor — Recovery Checkpoint

Compact state for resuming this build. Not a transcript. The authoritative
records are `CLAUDE.md` (the constitution), `docs/reference-audit/decision-log.md`
(DL-01..DL-88) and the git history.

## Master Command

`Taytay_Rizal_LGUIDS_Admin_Portal_Master_Command_LATEST.pdf` — LGU IDS Taytay
Rizal Social Welfare Admin portal. Angular only. 26 TABs: 01–23 original,
24–26 late-phase (Newsfeed, Events).

Reference hierarchy: **Esperanza** = features/domain, **Get Hired** = design and
interaction, **Taytay Rizal** = branding, **Angular** = framework. Neither
reference repo is reachable in this environment; both were treated as documented
intent through the audit in `docs/reference-audit/`.

## Where the build is

- **Completed and certified:** TABs 01–21.
- **Current:** TAB 22 — Responsive, Offline/Degraded, Accessibility & Performance.
- **Remaining:** 23 (QA), then 24–26 (Newsfeed, Events).
- **There are no placeholder routes left.** Every route loads a real screen.

**The master command PDF is on disk** at
`C:\Users\paulg\Downloads\Taytay_Rizal_LGUIDS_Admin_Portal_Master_Command_LATEST.pdf`
(65 pages, readable with `pypdf`). **Read the TAB's text directly before
starting it.** The objectives recorded in `state.json` are summaries, and TAB 18
turned out materially richer than its summary — eleven named task types, a team
queue, assignment and snooze, and three acceptance criteria that shaped the
whole design.

## Architecture

Angular 20, standalone components, signals for view state, typed reactive forms,
lazy feature routes, strict TypeScript. No NgModules.

```
src/app/
  core/      app-level services, guards, interceptors
  data/      adapters + in-memory seed; the only place mock data lives
  domain/    entities, policy functions, ports (repository interfaces)
  features/  lazy route pages
  layout/    the shell
  shared/    reusable UI primitives
```

**The seam that matters:** views never touch data directly. Every feature reads
through a **port** (`domain/ports`) implemented by an adapter in `data/`. Swapping
in a real API is an adapter change, not a view change.

**Policy lives in `domain/`, never in a component.** Components render what they
are handed.

## Non-negotiables carried by build checkers

`npm run verify` = lint + typecheck + 16 checkers + 1261 tests + build. Each
checker was validated against planted regressions. Do not weaken one to pass.

| Checker | Refuses |
| --- | --- |
| `check:brand` | a modified official seal; missing attribution |
| `check:shell` | shell a11y regressions |
| `check:access` | a permission-gated action reachable without its guard |
| `check:vulnerability` | an indicator that decides eligibility |
| `check:case-audit` | a case mutation with no appended event and reason |
| `check:intake` | an advisory rendered as a verdict |
| `check:programs` | a component branching on a programme code; a national programme recorded as one the municipality runs |
| `check:beneficiary` | a `BeneficiaryId`; any merge or delete of a person; a match signal carrying a value; a stored standing flag |
| `check:documents` | removing a document version; an unexplained replacement; a raw document number in a template; a decision-shaped completion field |
| `check:referrals` | sending without a lawful basis; a bulk share; a resident field on a referral screen; a stored overdue flag; an ungated adapter read |
| `check:visits` | any location capture; an observation without its kind; an unattributed third-party account; an edited observation; a non-terminal outcome |
| `check:releases` | a ledger, account code, bank account or posting date; a status on a payout session; a session summarised as one verdict; a deferral reason blaming the beneficiary; an amount forced onto goods; an unmasked or over-full manifest; a screen composing its own manifest; self-release blocking; an ungated adapter method |
| `check:work` | an email/SMS/push/webhook channel; an alert with a due date, assignee or done state; a mutator on the work port; a stored urgency flag; lateness not said in words; a queue summarised as a verdict; duplicate review as work; an unfiltered notification read |
| `check:governance` | a recorded value on an audit row or field-change; a port that inlines values; `audit.view-detail` gone or misclassified; a deactivated account keeping its session; an invite/reset method or a form on an admin screen; an invented retention period; a correction answerable with no reason or reopenable; a matrix cell conveyed by mark alone; an ungated governance read |
| `check:search` | a free-text field on a search hit; the adapter reading a refused field; a port parameter that widens the read; `localStorage`/`sessionStorage`/cookie in the search path; a record type dropped instead of named; scope missing from a producer; a shared saved view creatable without `view.share` |
| `check:reports` | a second person-level report; a person-level report with no stated reason or only `report.view`; suppression dropped, rounded, applied to zero, or bypassable; a total taken after suppression; an optional series summary; a canvas or charting dependency; an export missing its filter/author/handling notice; a screen composing an export; a productivity or completion-rate field; staff workload sorted by volume |

## Doctrines that constrain every later TAB

1. **Guidance never gates.** No score, indicator or checklist may decide
   eligibility. A licensed social worker decides. (`DL-42`, `DL-60`, `DL-66`)
2. **Say whose programme it is.** AICS is DSWD-administered with
   DSWD-disbursed funds; the LGU refers and may augment. (`DL-65`)
3. **Every material mutation appends an event with a reason.** History is
   append-only; nothing is rewritten. (`DL-54`)
4. **Closure is terminal.** A later need opens a linked successor case via
   `continuesCaseId`. (`DL-53`, `DL-64`)
5. **Permission denial does not leak the record.** Withheld is shown as
   withheld, never silently removed. (`DL-58`)
6. **Unverified citations are labelled.** This run is offline; every
   supervisor-supplied source carries `verifiedOn: null` and the screen says so.
   (`CLAUDE.md` §6)
7. **Separation of duties.** No single non-administrator role both approves a
   request and releases its assistance.
8. **One person, one record.** No entity duplicates a person. A beneficiary is a
   *standing* derived from records, keyed on `ResidentId`; identity findings
   supersede without deleting. (`DL-71`, `DL-74`)
9. **Assemble a fact once.** `historySummaryFor` is the single history
   assembly, shared by the resident profile and the beneficiary record. Two
   assemblies of the same fact eventually disagree in front of a family.

## Known gaps (deliberate, carried forward)

- **Linking a request to a case is not buildable from the UI.** When built it
  takes a reason and appends an event — never auto-attachment. (`DL-70`)
- **Opening a successor case** has no screen yet. (`DL-64`)
- **Enrollment is read-only.** States exist and are validated; no screen records
  an enrollment or an exit. (`DL-75`)
- **An identity finding cannot be corrected.** The opposite verdict is refused
  rather than silently applied; the correction screen is missing. (`DL-74`)
- **`beneficiary.export` has no export yet** — it exists for the reporting TAB.
- **No document upload form.** Port, adapter, validation and version history are
  built and tested; the screen that captures a file is not. (`DL-77`)
- **Document requests are callable but not composed from the UI.**
- **`redactedForSharing` is a flag**, not a renderer — the redacted copy is
  backend work.
- **No create-referral screen.** `createDraft`/`send` are built and tested; the
  form that composes a referral and its disclosure plan is not. (`DL-81`)
- **Referral attachments are modelled but not attachable** to the TAB 14
  document store. (`DL-82`)
- **No visit scheduling form**, and the follow-up `CaseTask` is not yet created
  from the visit screen. When it is, it goes through `CaseRepository`. (`DL-88`)
- **`VisitCapture` is modelled and tested but not wired to a screen.**
- **No screen creates a payout session.** `createBatch` is built, gated and
  tested; the scheduling form is not. (`DL-90`)
- **Task reassignment has no picker.** `CaseRepository.assignTask` is built,
  gated, reason-requiring and tested; the queue exposes complete and reschedule
  only. The staff picker belongs with the administration TAB. (`DL-99`)
- **Voiding a release has no screen** — `changeStatus` and `disbursement.void`
  exist and are gated.
- **Role and scope assignment is displayed, not editable.** Changing a role is
  the most consequential write in the application and needs the confirmation and
  audit design `setAccountActive` got, plus a staff picker. (`DL-115`)
- **The correction capture screen is not built** (`DL-117`); the page says so.
- **Filter chips and a per-list filtered count are not built.** Saved views, URL
  sync and clear-all exist; the chip row is a shared primitive that belongs with
  the list screens, and no list renders one yet.
- **The report filter bar renders 2 of 5 declared filters.** Programme, status
  and caseworker are honoured by the adapter and declared per report; their
  pickers need the programme and staff lists (TABs 20–21). Offering a control a
  report ignores would be a lie, so they are declared and not yet rendered.

## A recurring defect worth naming

**A checker assertion that is not scoped to the declaration it is about will
pass while the rule is gone.** This has now bitten **ten** times, in eight
shapes:

1. the string survives elsewhere in the same file (a problem code still in a
   union, a state still in a comparison, a statute still in a doc comment);
2. the identifier survives in an **import statement** (`check:releases`,
   `check:work` twice);
3. a **short label matches before the long description** it was meant to check;
4. one key is a **prefix of another** (`copy.overdue` matched `copy.overdueHint`);
5. `files.some(...)` passes because a **different file** still satisfies it;
6. the phrase survives in the **doc comment** above the declaration;
7. a lazy block regex terminates on a delimiter **inside a string literal**
   (`/SMALL_CELL_BASIS[\s\S]*?;/` stopped at "…practice; the MSWDO…");
8. the checker flags the **prose that satisfies the rule** as violating it — a
   caution warning against ranking necessarily contains the word "productivity".

**A fifth shape appeared in TAB 21:** a block-scoped search where **every entry
needed checking individually** — four sibling classification entries kept their
statutory citation while one lost it, and a block-wide `/RA 10173/` passed.

**And a counter-trap on the validation side:** a plant that edits the *wrong
occurrence* looks exactly like a checker weakness. Two of TAB 19's four misses
were that. Diagnose a miss by grepping for the surviving string **before**
rewriting the rule.

**A rule enforced on one path and not its parallel** is this project's other
recurring defect, now five instances: four ungated adapters (`DL-84`, `DL-95`,
`DL-100`, `DL-111`) and deactivation checked at sign-in but not on the live
session (`DL-116`). When a rule exists, ask **which other path could reach the
same state**.

`check:search` (TAB 20) is the first checker where **both halves passed first
time** — 21/21 caught, nothing to fix. The difference was applying the scoping
rule *per assertion while writing each one* (per-producer bodies, declaration
blocks, the `prose()` helper carried over from TAB 19), rather than holding it
as an intention at the top of the file.
**Scope every checker assertion to the declaration it is about** (the interface
block, the function body, the constant), not to the file.

Two related traps: the repo checks out **CRLF**, so a plant or check anchored on
a literal `\n` matches nothing and reports "stale" rather than failing; and a
detector that has only ever reported clean has not been tested, so plant
regressions before trusting one.

Both `check:releases` and `check:work` were written *with this rule in mind* and
ran clean on their first try. Both still contained instances of it — one and
four respectively — found **only by the planted regressions**.

Writing the rule down does not prevent it, because the failure is not one of
knowledge. **"Does this assertion have a scope?" has to be asked per assertion,
at the moment of writing each one.** An intention held at the top of a file does
not survive two hundred lines.

The plants are the only thing that has ever caught this. They are not a
formality.

## Next action

Begin TAB 22 — Responsive, Offline/Degraded, Accessibility & Performance.
**Read its text in the PDF first** (page ~48).

This is a **hardening pass over completed modules**, not a new feature. The
deliverables are cross-module fixes, an accessibility checklist,
network/degraded-state components, and a performance findings log.

Load-bearing constraints:

1. **Do not promise offline transactional integrity.** The master command is
   explicit: this is an admin system with no backend strategy for it. Banners,
   retry, a read-only cached shell where safe, and clear unsynced warnings —
   and **never silently queue a sensitive submission**. `DL-87` already settled
   the honest-capture doctrine for field visits; extend it, do not invent a
   second one.
2. **200% zoom must not hide critical controls**, and long Filipino names and
   purok addresses must not break layouts. Both are testable.
3. **Core workflows usable keyboard-only**, with a focus trap in dialogs and
   drawers. `Modal` and `Drawer` already exist — audit them rather than
   rebuilding.
4. **`aria-live` only for meaningful async updates.** Over-announcing is its own
   accessibility failure.
5. **No misleading "saved" state during network failure** — the same rule as
   `DL-87`, applied application-wide.
6. Charts already have table alternatives (`DL-108`); confirm rather than
   rebuild.

Start by **measuring**: run the existing checkers, look at the bundle, and find
the real gaps rather than assuming them. `visit-detail-page.scss` is 79 bytes
over its budget and has been for six TABs — clear it here.

Then: `npm run verify`, commit locally, write `tab-reports/TAB-22-hardening.md`,
advance state to TAB 23.

## Git

- Branch `main`, no remote configured. **Never push.**
- HEAD at TAB 21 certification: `a9cbca4`.
- Working tree clean.
