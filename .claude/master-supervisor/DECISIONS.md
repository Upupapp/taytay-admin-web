# Supervisor Decision Log — pointer

Material decisions for this project are recorded in the project's own decision
log, which predates this supervision area and is the file the build's
documentation, `CLAUDE.md` and the commit messages all reference:

**`docs/reference-audit/decision-log.md`** — entries `DL-01` … `DL-70`.

Duplicating those entries here would create a second source of truth for
decisions, which is the exact failure mode `DL-66` and the project's "one
canonical source" principle exist to prevent. This file records only decisions
about *the supervision process itself*.

---

## SUP-01 · The project decision log stays canonical

**DECISION:** Record material engineering decisions in
`docs/reference-audit/decision-log.md`, not in
`.claude/master-supervisor/DECISIONS.md`.

**CONTEXT:** The autonomous execution protocol asks for a supervisor
`DECISIONS.md`. TABs 01–12 had already written 70 decision entries into the
project's audit log, which is referenced by `CLAUDE.md`, by the per-module
`docs/*/README.md` files and by commit messages.

**OPTIONS:**
1. Copy DL-01..DL-70 into the supervisor file and maintain both.
2. Write new decisions only into the supervisor file, splitting the record at
   TAB 13.
3. Keep one log and point at it.

**SELECTED:** 3.

**WHY:** Two logs drift, and a reader who finds one has no way to know the other
exists. Option 2 is worse than either: it splits the record mid-project at an
arbitrary boundary, so "why is closure terminal?" and "why is the beneficiary
registry shaped this way?" would live in different files for no reason a future
reader could infer.

**EVIDENCE:** `CLAUDE.md` cites DL numbers throughout; `git log` messages cite
them; `docs/reference-audit/decision-log.md` contains 70 entries under a stable
heading convention.

**PRIMARY SOURCES:** Not applicable — this is a bookkeeping decision.

**LOCAL IMPACT:** New decisions continue the `DL-nn` sequence from `DL-70`.

**BACKWARD COMPATIBILITY:** Full; nothing moved.

**PRODUCTION IMPACT:** None.

**DATE:** 2026-08-16

---

## SUP-02 · The supervision area starts at TAB 12, and says so

**DECISION:** Bootstrap `.claude/master-supervisor/` at TAB 12 certification
without back-filling per-TAB reports for TABs 01–11.

**CONTEXT:** The supervision area did not exist when TABs 01–11 ran.

**OPTIONS:**
1. Reconstruct eleven completion reports from git history.
2. Start the area at the current TAB and state the boundary.

**SELECTED:** 2.

**WHY:** A reconstructed completion report is an assertion about verification
that was never observed being run at that commit. Writing eleven of them would
manufacture exactly the false certification evidence this protocol exists to
prevent. The durable evidence for TABs 01–11 already exists and is better than a
reconstruction: their commits, their tests, their `docs/*/README.md` and their
DL entries.

**EVIDENCE:** `git log` shows per-TAB feature and docs commit pairs for TABs
01–12; `npm run verify` passes at HEAD, which exercises all of their checkers.

**LOCAL IMPACT:** `state.json.notes.priorTabsPredateThisArea` records the
boundary explicitly.

**PRODUCTION IMPACT:** None.

**DATE:** 2026-08-16
