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

- **Completed and certified:** TABs 01–18.
- **Current:** TAB 19 — Reports, Analytics, Exports & LGU Decision Support.
- **Remaining:** 20–23 (search, users/audit, hardening, QA), then 24–26
  (Newsfeed, Events).

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

`npm run verify` = lint + typecheck + 13 checkers + 1120 tests + build. Each
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
- **The remaining placeholder routes are `reports` and `administration`.**
  Assume their adapters are ungated until read: **three for three** so far
  (`DL-84`, `DL-95`, `DL-100`).

## A recurring defect worth naming

**A checker assertion that is not scoped to the declaration it is about will
pass while the rule is gone.** This has now bitten **nine** times, in five
shapes:

1. the string survives elsewhere in the same file (a problem code still in a
   union, a state still in a comparison, a statute still in a doc comment);
2. the identifier survives in an **import statement** (`check:releases`,
   `check:work` twice);
3. a **short label matches before the long description** it was meant to check;
4. one key is a **prefix of another** (`copy.overdue` matched `copy.overdueHint`);
5. `files.some(...)` passes because a **different file** still satisfies it.
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

Begin TAB 19 — Reports, Analytics, Exports & LGU Decision Support. **Read its
text in the PDF first** (page ~42).

The objective is reporting that supports planning and accountability **while
minimising exposure of citizen data**. Fourteen report areas: caseload,
assistance pipeline, programme utilisation, beneficiaries by barangay,
vulnerability indicators, demographic reach, case aging and turnaround,
requirements bottlenecks, referral outcomes, visit workload, release status,
repeat assistance, data completeness, and staff workload.

The tab's load-bearing constraints:

1. **Aggregate first.** No names by default. Drill to person level only when
   necessary, behind a permission and a privacy warning. This is the strongest
   statement of data minimisation in the whole master command, and `DL-38`
   already says redaction happens in the data layer — a report must not be the
   surface that reintroduces PII a screen was never handed.
2. **Every chart claim must be verifiable from tabular data**, and every
   visualisation gets summary text plus a tabular equivalent. `ChartTable`
   already exists and **is** a real table (`CLAUDE.md` §7) — extend it, do not
   build a second one.
3. **Charts must not rely on hue alone** — the same rule as `DL-102`, which the
   work queue already implements as sentence + heading + position.
4. **Exports state their applied filters and generation metadata**, so a
   printed report cannot be read as covering something it did not.
5. **Staff workload must avoid simplistic performance ranking.** The team queue
   (`DL-97`) already sorts by who is most behind *to direct help*, not to rank
   people; keep that framing and expect the checker to enforce the absence of a
   score, a league table or a productivity index.
6. The dashboard's `AttentionSignal` and `DashboardRepository.summary` already
   compute figures under a filter and echo it back — reuse that discipline
   rather than inventing a second one.

Then: `npm run verify`, commit locally, write `tab-reports/TAB-19-reports.md`,
advance state to TAB 20.

## Git

- Branch `main`, no remote configured. **Never push.**
- HEAD at TAB 18 certification: `378b8f8`.
- Working tree clean.
