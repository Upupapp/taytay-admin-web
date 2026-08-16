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

- **Completed and certified:** TABs 01–17.
- **Current:** TAB 18 — Notifications, Tasks, Alerts & Work Queues.
- **Remaining:** 19–23 (reports, search, users/audit, hardening, QA),
  then 24–26 (Newsfeed, Events).

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

`npm run verify` = lint + typecheck + 12 checkers + 1074 tests + build. Each
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
- **Voiding a release has no screen** — `changeStatus` and `disbursement.void`
  exist and are gated.
- **The remaining placeholder routes are `reports` and `administration`.**
  Assume their adapters are ungated until read: two for two so far (`DL-84`,
  `DL-95`).

## A recurring defect worth naming

**A file-wide string search in a checker passes when the string survives
elsewhere in the same file.** This has now bitten five times — a problem code
still present in a type union, a state still present in a comparison, a statute
still present in a doc comment, a short label matching before the long
description, and a scope helper still named in an **import statement** — each
time letting a deleted rule report clean.
**Scope every checker assertion to the declaration it is about** (the interface
block, the function body, the constant), not to the file.

Two related traps: the repo checks out **CRLF**, so a plant or check anchored on
a literal `\n` matches nothing and reports "stale" rather than failing; and a
detector that has only ever reported clean has not been tested, so plant
regressions before trusting one.

Applying this while *writing* `check:visits` produced the first checker to catch
14/14 on the first run, and `check:releases` ran clean first time too. But the
fifth instance was found **only by a planted regression** — the checker looked
right and was wrong. Scope up front, and still plant. The plants are not a
formality.

## Next action

Begin TAB 18 — Notifications, Tasks, Alerts & Work Queues.

**Inspect what exists first, and extend it.** Three mechanisms are already
built and must not be duplicated:

1. `core/notifications/notification.store.ts` + `NotificationRepository` —
   `info` / `success` / `warning` / `error` / `notify()`, deciding toast versus
   inbox. Errors persist until dismissed and always reach the inbox. `ToastHost`
   is mounted once by `App`.
2. **`CaseTask` is already the next-action model** (`DL-55`): what this office
   undertook to do, by when, and who owes it — deliberately *not* derived from a
   status. A work queue is a view over these, not a second task entity.
3. `FieldVisit` follow-ups (`DL-88`) and `Referral` follow-up dates (`DL-83`)
   already produce work that is owed. Overdue is **derived**, never stored.

The tab's load-bearing constraints:

1. **No channel the LGU did not supply.** No push service, no email sending, no
   SMS gateway, no webhook. Same doctrine as `DL-89` refusing accounting: a
   notification the office believes was sent, and was not, is worse than none.
   Expect the checker to enforce the absence.
2. **A work queue says who owes what, by when.** Roles differ — a disbursing
   officer's queue is not a social worker's. Derive from permission and scope,
   never a hard-coded role branch.
3. **An alert must not become a decision.** Same line as `DL-42`, `DL-60` and
   `DL-78`: it surfaces evidence and gates nothing.
4. **Nothing personal in a notification body** that a toast would render to
   somebody outside the record's scope. Redaction happens in the data layer
   (`DL-38`).
5. **Deriving overdue** stays derived. A stored flag is wrong every morning
   until a job runs.

Then: `npm run verify`, commit locally, write
`tab-reports/TAB-18-notifications.md`, advance state to TAB 19.

## Git

- Branch `main`, no remote configured. **Never push.**
- HEAD at TAB 17 certification: `fb65486`.
- Working tree clean.
