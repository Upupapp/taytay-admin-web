---
description: Restyle an existing console page to docs/design/DESIGN_SYSTEM.md without changing what it does
argument-hint: <page or feature folder, e.g. "features/visits/visit-list-page">
---

# Restyle: $ARGUMENTS

Bring the page named above onto the design system. **Presentation only**: every service, port,
route, guard, validator, selector, input, output, live region and required sentence stays as it is.

## 1. Read first

1. `docs/design/DESIGN_SYSTEM.md` — tokens (§2), primitives (§3), pattern classes (§4), components
   (§5), page patterns (§7), rules (§8).
2. `CLAUDE.md` §7 (Design) and the domain rules for this module.
3. The page's `.html`, `.ts`, `.scss` and **its specs**. Grep the specs for every class, id and text
   they read (`querySelector`, `querySelectorAll<…>(`, `textContent`): those stay, beside any new
   class you add.
4. The module's `tools/check-*.mjs`, if any. Some read exact markup (for example `check:balita`
   reads `<div class="balita__act">`, `check:events` reads `<table class="registrants"`); keep it.
5. The reference page of the pattern this page is (list, detail, form, dashboard, inbox; table in
   DESIGN_SYSTEM.md §7) and, if useful, the mock-up's HTML source in `docs/design/admin/screens/`.

## 2. Restyle

1. Replace hand-made shapes with the shared ones: `app-page-header`, `.card.card--panel.card--padded`,
   `.toolbar` / `.field` / `.field__input--pill`, `app-data-table` or `.simple-table`, `dl.facts`,
   `.record-grid`, `.form-panel` / `.form-section` / `.form-footer`, `.callout`, `.effects`,
   `.note-box`, `.chip` (never for a status), `app-status-badge`, `.kpi`, `.icon-tile`, `.avatar`.
2. Delete from the component `.scss` every rule the primitives or patterns now cover. What stays is
   layout only.
3. Every remaining value: colour → a colour token, font size → `--fs-*`, weight → `--fw-*`, radius →
   `--r-*`, control height → `--h-*`, spacing → `--space-*`. No `box-shadow` but `none`, no
   `text-shadow`, no `!important` to fight a primitive.
4. Keep the four data states (loading skeleton, empty, error with Try again, offline) and the focus
   ring. A decision opens a centred `app-modal`.
5. A mock-up element that needs data the API does not send is left out and named in the commit body.
6. Stay under the 4 kB component-style budget: move a reusable rule to `_patterns.scss` or split a
   self-contained block into a child component.

## 3. Check

- Light: `npm run check:styles`, `npm run check:shell`, `npm run check:hardening`, the module's
  `check:*`, and `npx prettier --write` on the files you changed only (other files have old drift;
  `git checkout` any you did not mean to touch).
- Heavy, one at a time (free memory first, background, log outside the repo, read the tail):
  `npx ng test --include='src/app/features/<feature>/**/*.spec.ts'` and `npm run build`, then
  `npm run verify` before the commit.
- Browser at **1280** and **1440**: no sideways page scroll, every Tab stop shows the ring, text on
  glass still readable (DESIGN_SYSTEM.md §10).

## 4. Commit

`npm run verify` green, then commit on `main`, locally:

```
Restyle <feature>: <page> on the design system

What changed in its look (pattern used, shared pieces adopted, local CSS removed).
API fields left out, if any. Tests changed and why (should be none: presentation only).
Gates: npm run verify.

<the co-author trailer your session prescribes>
```

If a spec or check enforced an old visual rule the design overrides, change it narrowly and say so in
the body; never weaken a privacy, access, contract or money check. Never `git push`/`pull`/`fetch`
from the command line: commits stay local and the user pushes from GitHub Desktop.
