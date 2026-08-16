# TAB 22 — Responsive, Offline/Degraded, Accessibility & Performance

**Status:** COMPLETE — locally certified
**Commit:** `cebc676`
**Verify gate:** PASS — lint, typecheck, **17 checkers**, **1272 tests** (65 files), production build
**The build now emits no warnings at all.**

---

## Measured before changed

This was a hardening pass, so it began by measuring rather than assuming. Ten
things checked; **six were already sound**.

| Checked | Result |
| --- | --- |
| Network / offline handling | **Gap** — `navigator.onLine` appeared nowhere |
| Search debounce | **Gap** — 7 private copies of one constant; 5 screens with none |
| Shared style primitives | **Gap** — 5 stylesheets redefined the global `.field` divergently |
| Component style budget | **Gap** — one file over budget since TAB 16 |
| Focus trap in overlays | Already correct |
| Reduced motion | Already correct |
| Placeholder-as-label | Already correct — 21 placeholders, all labelled |
| `aria-live` discipline | Already correct — 2 regions, both polite |
| Fixed pixel widths (zoom) | Already correct — decorative only |
| Accessible chart alternatives | Already correct (`DL-108`) |

Recording the six is the point. A hardening pass that reports ten fixes is
usually a pass that invented some.

---

## What was built

| Layer   | Artefact                                                          |
| ------- | ----------------------------------------------------------------- |
| Core    | `network/network-status.ts` — the connection signal and three notices |
| Shared  | `ui/connection-banner/` — mounted once by the shell                 |
| Shared  | `state/debounced.ts` — `SEARCH_DEBOUNCE_MS`, `debounced`, `debouncedTerm` |
| Styles  | `.field + .field` in `styles.scss`; 5 divergent local copies removed |
| Tests   | `core/network/network.spec.ts` — 11 tests                           |
| Build   | `tools/check-hardening.mjs`, wired into `npm run verify`             |
| Docs    | `docs/hardening/README.md` — findings log + accessibility checklist  |

---

## Acceptance criteria

| Criterion (master command)                       | State |
| ------------------------------------------------- | ----- |
| Core workflows usable keyboard-only                | PASS — real controls throughout, focus trapped in overlays |
| 200% zoom does not hide critical controls          | PASS — no fixed pixel widths on containers |
| No misleading "saved" state during network failure | PASS — `DL-118`, enforced by the checker |
| No major avoidable layout shift or oversized images | PASS — skeletons via `AsyncContent`; the seal is the only image |
| Cross-module responsive fixes                      | PARTIAL — see below |
| Accessibility fixes and checklist                  | PASS — checklist in `docs/hardening/README.md` |
| Network/degraded-state components                  | PASS |
| Performance findings/fixes log                     | PASS |

---

## Decisions recorded

- **DL-118** — the office is warned about a lost connection; nothing is queued.
- **DL-119** — one debounce window, and only the typed term waits.
- **DL-120** — a shared primitive is defined once, or it is not shared.

---

## The finding worth keeping

**Five feature stylesheets had redefined the global `.field` with different
values** — `display: block` instead of flex, different label and hint colours.

Nobody chose that. Each screen copied a working block and adjusted it, and the
shared control quietly stopped being shared. The global's own comment had warned
about exactly this outcome since the shell TAB.

It also explains a symptom carried for **six TABs**: `visit-detail-page.scss`
had been over the component-style budget since TAB 16, and the budget warning
was the duplication showing through. Removing the copies cleared ~3kB and the
warning together.

---

## A judgement call on the checker

The first version of `check:hardening` re-measured the component-style budget
from raw source bytes. It flagged seven files that `ng build` accepts, because
Angular measures **compiled** CSS.

Two budgets with different numbers is the same drift this project refuses
everywhere else, so the byte check was removed. The checker now asserts that the
build's own budget still exists in `angular.json` — guarding the guard rather
than re-implementing it.

---

## Checker validation

`tools/check-hardening.mjs` enforces eight rules, validated against **19 planted
regressions**: 19/19 caught, 0 missed, 0 stale, baseline restored clean.

**Three were missed on the first pass**, all familiar shapes:

| Missed | Why the checker passed |
| --- | --- |
| the network service removed | an `existsSync` check a **rename survives** |
| focus no longer restored | `previouslyFocused` appears **four times**; three are the variable |
| ambient animation sped up instead of stopped | the block's **own comment** contains `animation: none` |

Two more were caught before the plants ran, both in the checker itself: a
`placeholder=` search that reported **zero** because the templates use Angular's
`[placeholder]` binding and format `<input>` across six lines. That one is
notable because the note read plausibly — "0 placeholders, every one with a real
label" — while the check was measuring nothing.

---

## Carried forward

- **Responsive work was verification, not change.** The breakpoint semantics
  (`ViewportService`), scrolling table containers and card fallbacks were built
  in earlier TABs and hold up. No screen was restructured, because none needed
  it — and restructuring at a hardening stage for novelty is what the master
  command explicitly warns against for TAB 23.
- **Virtualised lists were not added.** A municipal caseload does not reach the
  sizes that justify the complexity, and list caps are stated rather than
  implicit (`LIST_LIMIT = 300`).
- **Long Filipino names and 200% zoom were reasoned about, not exercised.** No
  automated visual test runs at 200%; the guards are structural (no fixed
  widths, no ellipsis on a name). TAB 23's QA scenarios should exercise them.
