# TAB 00 — Baseline, remotes and the evidence ledger

**Sequence:** Backend Integration Master Command (2026-08-18), command 1 of 20
**Date:** 18 August 2026
**Verdict:** **CERTIFIED LOCALLY — environmentally blocked.** Steps 1, 8, 9 complete. Steps 2–7 open and outside the boundary.

---

## Objective, as stated

> The console is backed up to a private remote, the backend's public remote has an owner's
> decision on the record, a working backend runs somewhere a developer can reach, and a single
> ledger records the measured starting state.

**Achieved:** the ledger, the measured starting state, a working backend running here, and the
visibility decision recorded with its evidence.
**Not achieved:** a *private* remote, branch protection, a reachable *staging* backend. All three
require remote administration or deployment, which this work is not authorized to perform.

## What this command produced

| Artefact | Location |
| --- | --- |
| Console evidence ledger | `docs/integration/evidence-ledger.md` |
| Backend evidence ledger | `taytay-backend/docs/integration/evidence-ledger.md` |
| Secret scanner (gitleaks substitute) | `docs/integration/tools/secret-scan.php`, both repositories |
| Integration supervisor state | `.claude/master-supervisor/integration/state.json` |

## Measured starting truth

**Console** — `npm run verify` green: 71 test files, 1437 tests, 20 repository checks, clean
production build. `dataSource: 'mock'` in both environments (F-01 reproduces). `apiBaseUrl`
`/api` and `http://localhost:8000/api` (F-03 reproduces).

**Backend** — 906 tests / 6696 assertions across 72 files. 266 registered routes: 263 under
`api/v1/`, 3 framework; 174 under `admin/`. 221 OpenAPI paths, 54 schemas, 38 migrations,
42 ADRs. Release gate NO-GO.

**Both HEADs recorded:** console `6df92ac` (71 commits), backend `22cb10d8` (48 commits).

## Findings

- **L-01 — the sweep's backend counts are wrong.** 906 tests, not 889; 263 `api/v1` routes, not
  262; 174 `admin/` routes, not 173. The suite declares exactly 906 `#[Test]` attributes and
  uses no data providers, so the figure is unambiguous, and both repositories sit at the commit
  counts the sweep itself recorded — so this is mis-measurement, not drift. TAB 05 must build
  its mapping from `route:list` and `openapi.json`, never from the sweep.
- **L-02 — the backend suite needs `memory_limit` above PHP's 128M default.** One image-derivation
  test kills the process with a *fatal*, not a failure, so the exit status misreports it. With
  `-d memory_limit=1G` a clean clone passes 906/906. Recorded, deliberately not fixed —
  TAB 00's guardrail forbids fixing anything here. Carried to TAB 18's configuration checklist.
- **L-03 — the console now has a remote and it is public.** F-14 closes as written; the
  condition F-28 describes now applies to both repositories.
- **F-08 confirmed unmodified** at `OpenApiGenerator.php:189` and `GenerateTypesCommand.php:98`.
  TAB 01 owns it.

## Secret scan — both histories, every blob

986 blobs (console) and 953 (backend) inspected across all commits on all branches.
**Console: 0 findings. Backend: 3, every one a synthetic fixture** inside a test asserting that
credentials do *not* leak. **Verdict: clean — nothing requires rotation.**

This matters most for the backend, whose history is already published, so TAB 00 treats its
scan as remedial. Publication is still not harmless: what is published is the schema, the
authorization model and the privacy design.

## Clean-clone reproduction

Both repositories cloned fresh onto a machine that had never seen them. Console: `npm ci` →
`npm run verify` green. Backend: `composer install` → 906 passed, identical to the working copy
(subject to L-02).

## Decisions

- **D-00-01** — Both repositories are public (measured: unauthenticated GitHub API returns 200
  for both). Recommendation is **private**, on the master command's guardrail and RA 10173's
  proportionality requirement for a system processing VAWC, child-protection and medical
  records. Execution is the owner's; recorded, not performed. While public, the secret scan is a
  standing pre-push gate rather than a one-off.
- **D-00-02** — The measured baseline supersedes the sweep's figures wherever they disagree.
- **D-00-03** — Ledger lives at `docs/integration/evidence-ledger.md` in each repository.
- **D-00-04** — The prior 26-TAB supervisor state is preserved; integration tracks separately.

## Open, and owned elsewhere

Private remote and branch protection (owner) · backend visibility (owner) · PostgreSQL 18,
Redis, object storage, Mailpit (deployment) · migrate against real Postgres (deployment) ·
seeded dataset (backend, needs a database) · staging (deployment).

**Start now, on lead time alone:** the DPO appointment (TAB 14) and the case-model session
(TAB 04). Neither is shortened by anything engineering does, and TAB 05 — the largest block in
the document — cannot begin until TAB 04 concludes.

## Git

Local commit only. Nothing pushed, nothing deployed, no remote touched.

## Next

**TAB 01 — Contract reconciliation.** Precondition as written is "a running backend to observe".
No staging API exists here, so TAB 01 proceeds against the repository as observed truth —
`route:list`, `openapi.json`, `conventions.md`, `config/cors.php` and the generators themselves —
and every acceptance criterion requiring a live call is recorded as environmentally deferred
rather than claimed.
