# TAB 24 — Late-Phase Admin Scope & Permissions Guardrail

**Status:** COMPLETE — locally certified
**Commit:** `0648fcd`
**Verify gate:** PASS — lint, typecheck, **18 checkers**, **1314 tests** (67 files), production build

The first of three late-phase TABs. This one is **scope, permissions, audit
seams and a contract** — not screens. TABs 25 and 26 build the modules.

---

## What was built

| Layer | Artefact |
| --- | --- |
| Access | 19 permission keys added to the existing `PERMISSIONS` array |
| Access | Read-only classification extended for insights and registration export |
| Audit | 10 actions added to the existing `AuditAction` union, with labels |
| Domain | `community/resident-contract.ts` — the resident boundary, **types only** |
| Domain | `community/community.spec.ts` — 22 tests |
| Nav | A new **Community** section with Newsfeed and Events |
| Routes | Two guarded placeholder routes |
| Build | `tools/check-community.mjs`, wired into `npm run verify` |
| Docs | `docs/community/README.md`; `DL-122`, `DL-123`; CLAUDE.md §5; permission matrix |

**All 1292 tests from TABs 01–23 still pass, unchanged.**

---

## Acceptance criteria

| Criterion (late-phase command) | State |
| --- | --- |
| TABs 01–23 continue to work | PASS — 1292 prior tests unchanged and green |
| Unauthorised admin users cannot execute restricted actions | PASS — every key guarded; route guards wired |
| No resident Angular portal or mobile interface added | PASS — types only, enforced by the checker |
| No duplicate permission architecture introduced | PASS — one array, guarded |
| Additive Newsfeed and Events navigation | PASS — new section, existing four intact |
| RBAC extended with module-specific keys | PASS — 19 keys |
| Typed resident-facing contracts, no resident UI | PASS |
| Audit-event seams for the named acts | PASS — 10 actions |

---

## Decisions recorded

- **DL-122** — Newsfeed and Events extend the one permission model.
- **DL-123** — the resident contract is written down and never implemented.

---

## Two judgement calls

**The command suggests snake_case keys** (`newsfeed.moderate_comments`,
`newsfeed.view_insights`). They are written kebab-case, because "extend the
existing centralized permission model" governs the *shape* as well as the
location — and one array holding both `newsfeed.moderate_comments` and
`request.view-sensitive` is a model nobody can predict from memory. The command
labels them "suggested permissions", which reads as naming the capabilities
rather than fixing their spelling.

**"Events Registration Staff" was deliberately not created as a role.** The
command says to map its example roles *only if compatible with roles already
built*. Five of the six map cleanly onto the existing seven. That one does not,
and inventing a role to hold a permission nobody has been assigned yet is
speculative — when the office names a person, the grant already exists to give
them. Recorded rather than quietly skipped.

---

## The classification that would have broken quietly

`events.export-registrations` and both `view-insights` keys had to be classified
**read-only**, or adding them to the auditor would have turned a deliberately
read-only role into a mutating one.

This is the **third** time the same trap has appeared: `document.download` in
TAB 14, `audit.view-detail` in TAB 21, and now these three. Each time the
permission-matrix property test is what would have caught it; each time the
right fix was to classify explicitly rather than rely on a name-shape heuristic.

Worth noting that the pattern is now predictable enough to anticipate: **any
permission that discloses without changing** needs an explicit read-only entry.

---

## Checker validation

`tools/check-community.mjs` enforces five doctrines, validated against **17
planted regressions**: 17/17 caught, 0 missed, 0 stale, baseline restored clean.

**One was missed on the first pass**: a second permission array declared as
`export const COMMUNITY_PERMISSIONS: readonly string[] = [];` slipped past a
pattern that required a space before the colon. A narrow regex describing one
spelling of a declaration, when the ordinary spelling is different — the same
family as every other miss this project has produced.

---

## Carried forward

- **The two routes are placeholders**, and that is the point: TABs 25 and 26
  build the screens. `FeaturePlaceholderPage` exists for exactly this, and the
  rule it serves — a nav entry never points at nothing — is enforced by
  `check:community`.
- **No adapters, ports or seed data** for either module yet. The permission and
  audit vocabulary they will use is settled; the models are TAB 25 and TAB 26's
  work.
- **The resident contract has no implementation and must not gain one** in this
  repository, whatever a later TAB appears to ask for.
