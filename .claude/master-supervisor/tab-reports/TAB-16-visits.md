======================================================================
TAB COMPLETION REPORT
======================================================================

TAB:
TAB 16 — Field Visits, Case Notes & Follow-Up

LOCAL COMPLETION:
100%

CERTIFICATION VERDICT:
CERTIFIED_WITH_NONBLOCKING_ENVIRONMENT_GAPS

COMPLETED SCOPE:
- `FieldVisit`: purpose, status, assignee, scheduled date and window, the
  address visited (copied, not referenced), checklist, observations, service
  needs, declined reason and outcome.
- `VisitObservation` with four kinds and enforced attribution for third-party
  accounts; `observationMix` and `isAllJudgement` for what a record consists of.
- `VisitCapture` with four honest states and a domain-owned unsent warning.
- `FieldVisitRepository` and both adapters; permission and barangay scope
  enforced in the mock adapter.
- Visit list bucketed into overdue / due today / upcoming, plus closed by day,
  with a My-visits toggle.
- Visit workspace: checklist ticking, observation entry with kind-first
  selection, and closing with the four outcomes.
- Route and navigation entry replacing nothing (new surface).
- `tools/check-visits.mjs` in the verify gate.

DELIVERABLES:
- Field visit list/calendar — DONE (bucketed and day-grouped; a month grid was
  not built, and the buckets answer the planning question better)
- Visit detail/edit flow — DONE
- Follow-up task integration — PARTIAL: closing records what the household
  needs; creating the `CaseTask` from that is stated as a gap and must go
  through `CaseRepository` rather than growing a second task system.
- Case timeline integration — PARTIAL: visits are readable per resident through
  `forResident`; adding them to the assistance timeline is TAB 19/20 work.

MATERIAL DECISIONS:
- DL-85 · An observation says whose claim it is. A fact, a report and a
  judgement written as one paragraph become indistinguishable, and are then read
  as established fact about a family. The form asks for the kind first; the kind
  is rendered; observations are appended, never edited.
- DL-86 · The visit model holds no location, and the absence is enforced across
  domain, adapters, seed and screens. Tracking is easy to refuse as a feature
  and easy to acquire as a field.
- DL-87 · A field capture never says "probably saved". Exactly one state means
  the office record has it, and a failed send says nothing was queued in the
  background.
- DL-88 · Every outcome is terminal, and nobody-home is not a refusal. The
  vocabulary matters because these words describe a family to the next worker.

RESEARCH / PRIMARY SOURCES:
No new retrieval (offline). The privacy position follows the master command's
own prohibition and the RA 10173 minimisation duty already recorded in
`.claude/master-supervisor/RESEARCH.md`.

FINAL VERIFICATION:
- focused tests: PASS
- integration tests: PASS (1026 tests across 55 files; +35 over TAB 15)
- typecheck: PASS (strict; no `any`/`!`/`@ts-ignore` added)
- build: PASS
- lint: PASS
- migration/schema verification: NOT_APPLICABLE (frontend-only)
- other: PASS — 12 repository checkers. `check:visits` was validated against
  **14 planted regressions and caught 14 on the first run** — the first checker
  this session to do so, having applied the scoping lesson from TABs 13–15
  while writing it rather than after.

DEFECT FOUND AND FIXED (during this tab):
An Angular `#body` template reference shadowed the component's `body()` signal,
so the observation textarea bound to a `TemplateRef` instead of the text. Caught
by the compiler (`TS2349: This expression is not callable`), not by review.
Renamed to `#visitContent`.

ENVIRONMENT / PRODUCTION-ONLY GAPS:
- No backend. Scheduling, recording and closing work through the port against
  in-memory adapters.
- No network retrieval.

KNOWN GAPS (deliberate, recorded in docs/visits/README.md):
- No scheduling form; `schedule` is built and tested but has no screen.
- The follow-up `CaseTask` is not yet created from the visit screen.
- `VisitCapture` is modelled and tested but not wired to a screen — the detail
  page writes straight through.
- Photos and attachments are not implemented; when they are, they reuse the
  TAB 14 document grant.

MEMORY CHECKPOINT:
SAVED
Path: .claude/master-supervisor/MEMORY.md

GIT / LOCAL STATE:
Branch: main
HEAD: 0ab610c
Local commits created: 2 — `ca80e37` (domain, adapters, seed),
`0ab610c` (screens, checker, docs)
Working tree: clean
Pre-existing unrelated dirty work preserved: NOT_APPLICABLE

REMOTE ACTIONS:
Push: NO
Deploy: NO
Production access: NO
Remote mutation: NO

NEXT INDEXED TAB:
TAB 17 — Release / Distribution / Disbursement Tracking

AUTOMATIC ADVANCEMENT:
AUTHORIZED

======================================================================
