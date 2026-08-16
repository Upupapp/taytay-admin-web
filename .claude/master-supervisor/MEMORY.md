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

- **Completed and certified:** TABs 01–19.
- **Current:** TAB 20 — Global Search, Saved Filters & Record Discovery.
- **Remaining:** 21–23 (users/audit, hardening, QA), then 24–26 (Newsfeed,
  Events).

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

`npm run verify` = lint + typecheck + 14 checkers + 1180 tests + build. Each
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
- **`administration` is the last placeholder route.** Assume its adapters are
  ungated until read: **three for three** so far (`DL-84`, `DL-95`, `DL-100`).
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

**And a counter-trap on the validation side:** a plant that edits the *wrong
occurrence* looks exactly like a checker weakness. Two of TAB 19's four misses
were that. Diagnose a miss by grepping for the surviving string **before**
rewriting the rule.
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

Begin TAB 20 — Global Search, Saved Filters & Record Discovery. **Read its text
in the PDF first** (page ~44).

The objective is making large municipal datasets navigable in seconds **without
exposing too much sensitive information in search results**.

**Inspect what exists first.** `SavedViewRepository` and `SAVED_VIEW_REPOSITORY`
were built in an early TAB as a hook, with `saved-views.seed.ts` and a
`SavedViewsBar` primitive already in `@shared`. Extend them; do not start a
second system.

The tab's load-bearing constraints:

1. **Safe snippets only.** Name, ID, barangay, status and limited context.
   **Never case-note text in global results** — and `DL-58` already withholds a
   protected note's body in the data layer, so search must not become the
   surface that reintroduces it. Expect the checker to enforce the absence.
2. **Results reveal only role-appropriate data.** Search crosses six entity
   types, each with its own permission and scope. This is the widest surface in
   the application for an access mistake, and the disclosure rules already exist
   (`DL-38` for residents, `DL-58` for notes, `DL-73` for duplicates) — reuse
   them rather than writing a seventh.
3. **Recent searches may be local-only and must not persist sensitive query
   content.** A resident's name typed into a search box and kept in
   `localStorage` is a disclosure the office never decided to make. Note that
   `CLAUDE.md` §2.5 already forbids this app putting tokens in `localStorage`;
   apply the same caution here and prefer in-memory.
4. **Personal saved views first; shared team views need a permission.**
5. **Filters stay understandable and removable** — chips, clear-all, a count of
   filtered records, and URL sync **where safe**. "Where safe" is the
   interesting part: a query string containing a resident's name ends up in
   browser history and in any screenshot of the address bar.

Then: `npm run verify`, commit locally, write `tab-reports/TAB-20-search.md`,
advance state to TAB 21.

## Git

- Branch `main`, no remote configured. **Never push.**
- HEAD at TAB 19 certification: `70d7976`.
- Working tree clean.
