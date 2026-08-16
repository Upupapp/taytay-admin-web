======================================================================
TAB COMPLETION REPORT
======================================================================

TAB:
TAB 14 — Requirements, Documents & Verification

LOCAL COMPLETION:
100%

CERTIFICATION VERDICT:
CERTIFIED_WITH_NONBLOCKING_ENVIRONMENT_GAPS

COMPLETED SCOPE:
- Per-programme requirement checklist, extended in place on the TAB 11
  `SubmittedRequirement` and the TAB 12 `RequirementTemplate`. No parallel model.
- Required / optional / **conditional** classification, replacing `isMandatory`
  across 57 sites (seeds, adapters, screens, specs).
- Requirement states extended with `expired` and `needs-replacement`.
- `RequirementDocument` as an append-only version list, with file metadata,
  source, document number, issue and expiry dates.
- Replace-with-history: the superseded version is marked and kept, with a
  required reason.
- Verification action and history, reviewer and verification date.
- Document requests to the applicant, with channel, message, deadline, overdue.
- Masked document numbers everywhere; full number behind its own permission.
- Permission-aware open, via an access grant with a server-composed warning.
- Shared `DocumentPanel` and `REQUIREMENTS_COPY`; assessment checklist rebuilt.
- `tools/check-documents.mjs` in the verify gate.

DELIVERABLES:
- Case requirement checklist — DONE
- Document preview/version drawer — DONE (version history + access grant;
  rendering a preview image is backend work, see gaps)
- Verification action and history UI — DONE
- Masked sensitive identifiers — DONE

MATERIAL DECISIONS:
- DL-76 · Required / optional / conditional, and a person rules on it. A
  boolean could not say "only if you are claiming for a child": such a document
  had to be recorded as required (and every applicant who did not need it looked
  incomplete) or optional (and nobody chased it). A conditional requirement
  states its circumstances in words, starts `undecided`, and the software never
  evaluates the condition. An undecided conditional is not held against the
  applicant — it is a decision the office owes.
- DL-77 · Replacing a document appends; it never overwrites. The superseded
  copy is the evidence of what the office actually read when it decided.
  `openDocument` returns a grant rather than a URL, and `encoded` /
  `external-verification` hold no file because the office often verifies without
  keeping a copy.
- DL-78 · Completion counts; it never decides. No `isComplete`/`isEligible`/
  percentage-as-verdict, and the boundary sentence comes from the domain because
  a template is where it gets shortened to "Complete". Fourth surface for this
  doctrine, and the one where the temptation is strongest.
- DL-79 · A permission is a read or a write because it is listed, not because of
  its name. Corrects a latent defect the tab exposed.

RESEARCH / PRIMARY SOURCES:
No new external sources were required; the decisions follow from the master
command's acceptance criteria and doctrines already recorded. One office
convention is used and labelled: `EXPIRY_WARNING_DAYS = 30`, carried with
`EXPIRY_WARNING_BASIS` stating it is unconfirmed against a written issuance in
this offline run.

FINAL VERIFICATION:
- focused tests: PASS
- integration tests: PASS (944 tests across 51 files; +40 over TAB 13)
- typecheck: PASS (strict; no `any`/`!`/`@ts-ignore` added)
- build: PASS
- lint: PASS
- migration/schema verification: NOT_APPLICABLE (frontend-only)
- other: PASS — 10 repository checkers. The new `check:documents` was validated
  against **13 planted regressions and caught 13**. The first run caught 9;
  the misses were real:
    * a file-wide search for `'replacement-needs-a-reason'` passed while the
      rule raising it was commented out, because the string survived in the
      `DocumentProblem` union;
    * the same failure for `'undecided'`, surviving in a comparison after being
      removed from the type;
    * a scope-exclusion that skipped only the `export function` line and then
      flagged the very helper it meant to exempt;
    * one plant reported "stale" against a real anchor because the repo checks
      out CRLF on Windows.
  All four fixed, then re-validated at 13/13 with the working tree unchanged.

DEFECT FOUND AND FIXED (pre-existing):
`MUTATING_PERMISSIONS` classified permissions by name shape. `document.download`
reads a file and changes nothing, but by its spelling it made the auditor — a
read-only role by definition — classify as mutating. Caught by the existing
permission-matrix test, which asserts a property rather than a snapshot. Replaced
with an explicit `READ_ONLY_PERMISSIONS` list, which fails in the safe direction.

ENVIRONMENT / PRODUCTION-ONLY GAPS:
- No backend. Recording a document, requesting one and opening one all work
  through the port against in-memory adapters; `confirmOpen` reports what would
  happen rather than pretending a file arrived.
- No network retrieval; the expiry-window convention stays unconfirmed.

KNOWN GAPS (deliberate, recorded in docs/requirements/README.md):
- No upload form yet. Port, adapter, validation and version history are in place
  and tested; the screen that captures a file is not built, so the document
  panel is read-only.
- Document requests are modelled, seeded and callable, but the "ask the
  applicant" form is not composed from the UI.
- `redactedForSharing` is a flag; producing the redacted copy is backend work.

MEMORY CHECKPOINT:
SAVED
Path: .claude/master-supervisor/MEMORY.md

GIT / LOCAL STATE:
Branch: main
HEAD: a07d929
Local commits created: 3 — `8f0b981` (obligation migration), `820d558`
(document domain, ports and adapters), `a07d929` (screens, checker, docs)
Working tree: clean
Pre-existing unrelated dirty work preserved: NOT_APPLICABLE

REMOTE ACTIONS:
Push: NO
Deploy: NO
Production access: NO
Remote mutation: NO

NEXT INDEXED TAB:
TAB 15 — Referrals, Service Providers & Inter-Office Coordination

AUTOMATIC ADVANCEMENT:
AUTHORIZED

======================================================================
