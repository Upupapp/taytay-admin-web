---
description: Build a new console page from a design pattern, shared/ui and real data
argument-hint: <feature/page and what it is for, e.g. "programs: enrolment list">
---

# New page: $ARGUMENTS

Build the page named above so that it looks and behaves like every other screen of the console,
from the patterns and shared components, on real data. Presentation is the easy part; the
repository's architecture and privacy rules still decide what the page may show.

## 1. Read first

1. `CLAUDE.md` — at least §2 (non-negotiable rules), §4 (architecture), the domain rules in §5 for
   this module, §6 (privacy), §7 (Design + components), §8 (conventions).
2. `docs/design/DESIGN_SYSTEM.md` — §2 tokens, §4 pattern classes, §5 components, §7 page patterns,
   §8 rules.
3. The decision-log entries (`docs/reference-audit/decision-log.md`) and the `tools/check-*.mjs`
   script for this module, if there are any: they outrank any mock-up.
4. The reference implementation of the pattern you pick (step 2), its `.html`, `.ts` and `.scss`.

## 2. Pick a pattern

Choose exactly one and say which in the commit body:

| Pattern   | Mock-up (`docs/design/admin/screens/`)                 | Reference page                                         |
| --------- | ------------------------------------------------------ | ------------------------------------------------------ |
| List      | `Residents.dc.html`                                    | `src/app/features/residents/resident-list-page.*`      |
| Detail    | `ResidentRecord.dc.html`                               | `src/app/features/residents/resident-detail-page.*`    |
| Form      | `ResidentRegister.dc.html`, `AppDirectoryEdit.dc.html` | `src/app/features/households/household-form-page.*`    |
| Dashboard | `Main.dc.html`                                         | `src/app/features/dashboard/dashboard-page.*`          |
| Inbox     | `OfficeInbox.dc.html`, `OfficeThread.dc.html`          | `src/app/features/inbox/inbox-page.*`, `thread-page.*` |

Read the mock-up's HTML source with grep/offset for the parts you need; do not open screenshots.
Its names, counts, dates and photos are **sample data**: never copy them.

## 3. Build

1. **Data.** Inject the domain port's token (`RESIDENT_REPOSITORY`, …), never `data/mock` or
   `data/http`. Lift the call with `toViewState()`, hold it with `toSignal(…, { initialValue: LOADING })`,
   render it with `<app-async-content>` (or `<app-data-table [loading]>` for a list). If the port is
   not served by the active adapter set, show `<app-not-connected port="…">`; never fill in mock data.
2. **Route.** Lazy `loadComponent`, guarded by the same permissions as its `NAVIGATION` entry; add a
   nav icon in `src/app/layout/navigation/nav-icons.ts` if it is in the menu.
3. **Component.** Standalone, `ChangeDetectionStrategy.OnPush`, `app-` selector, signal inputs,
   `inject()`, built-in control flow with `track`. Wording in a `<feature>.copy.ts`, not inline.
4. **Template.** Start from the pattern's skeleton in DESIGN_SYSTEM.md §7. Use `app-page-header`,
   `.card.card--panel.card--padded`, `.toolbar` / `.field`, `app-data-table`, `app-status-badge` for
   any status, `.chip` only for sectors and categories, `.effects` before any button whose effect
   needs saying, `app-modal` (centred) for a decision.
5. **Four states.** Loading (skeleton), empty (`app-empty-state`, `empty` vs `no-results` kept apart),
   error (Try again that reloads), offline (nothing queued; the shell's banner speaks).
6. **Styles.** The component `.scss` holds layout only: grid, gap, order, widths. Every colour, type
   size, radius and height is a `var(--…)` token; no `box-shadow` but `none`. If you need a shape two
   screens will share, add it to `src/styles/_patterns.scss`, not to the component. Stay under the
   4 kB component-style budget.
7. **Missing data.** A part of the mock-up the API does not provide is left out, not faked. Say so in
   the commit body (field, screen, what it would drive).
8. **Tests.** A focused spec beside the page: it renders the ready state from a stubbed port, the empty
   and error states, and the permission-hidden actions.

## 4. Check

- Light, as you go: `npm run check:styles`, `npm run check:shell`, `npm run check:hardening`, and the
  module's own `check:*`.
- Heavy, one at a time on this PC (check free memory first, run in the background with output to a
  log file outside the repo, read only the tail): the page's specs
  `npx ng test --include='src/app/features/<feature>/**/*.spec.ts'`, then `npm run verify`.
- In a browser at **1280** and **1440** wide (DESIGN_SYSTEM.md §10): no sideways scroll, a focus ring
  on every Tab stop, the four states reachable. Read the DOM, not screenshots.

## 5. Commit

`npm run verify` green, then commit on `main`, locally:

```
<Sentence saying what the office can now do on the new page> (DL-NNN if you recorded a decision)

Pattern: <list|detail|form|dashboard|inbox>, from <reference page>.
What it reads (port), who may open it (permission), what was left out for lack of an API field.
Gates: npm run verify (lint, typecheck, all checks, tests, build).

<the co-author trailer your session prescribes>
```

Never `git push`, `git pull` or `git fetch` from the command line, never `--no-verify`. Commits stay
local; the user pushes from GitHub Desktop.
