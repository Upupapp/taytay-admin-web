---
description: Make a console page look the same as its design board, with live data — screenshot, compare, fix, repeat
argument-hint: <board name from tools/visual-parity.json, e.g. "CitizensOverview">
---

# Match board: $ARGUMENTS

The page must look like `docs/design/admin/screens/$ARGUMENTS.dc.html` at 1440 and 1280: same
panels, same order, same sizes and spans, same type, colours and spacing. Only the data
differs — numbers, names and row counts come from the API.

## The rule: the board's look, the repo's behaviour

**Presentation only.** The board decides how things look; the repo decides what they do.

- Every service, port, route, guard, permission, validator, input, output, live region, spec
  selector and required sentence stays exactly as it is. No test changes except markup a spec
  reads (keep the old class/id beside the new one).
- **Repo has it, board doesn't** (a button, a column, a filter, a menu entry, a notice): keep it,
  drawn in the board's style, in the nearest matching place.
- **Board has it, repo doesn't** (an action, a filter, a link, a menu entry with no page): leave it
  out. Do not add features, routes or calls to make the page look complete. List it in the commit
  body under "On the board, not in the console".
- The same control in both: the repo's behaviour, the board's look. A select the board draws as
  tabs may become tabs only if it keeps the same options, value, query param and keyboard use.
- **Keep as the repo has them**: the Dark mode button and its place in the top bar (DL-207), the
  sidebar's entries and their order and permissions, every wording in `*.copy.ts`.

This command **overrides** `/restyle-page` §2.1 ("replace with the shared shapes") and
`/new-page` "do not open screenshots" for this page: where a shared piece draws something
different from the board, the board wins and the page gets its own markup and SCSS.
What still wins over the board: `CLAUDE.md` privacy, access and domain rules, the `check:*`
scripts, tokens only (no raw colours or sizes), no shadows or glows, the focus ring, the four
data states, wording in `<feature>.copy.ts`, the decision log.

## 0. Once per session

`npm start` running (local-mock) in a background terminal. The tool: `npm run parity -- <Board>`.

## 1. Look

1. `npm run parity -- $ARGUMENTS`
2. Open `.parity/$ARGUMENTS/side.png` (board left, console right) and
   `.parity/$ARGUMENTS/report.md`.
3. Write a numbered list of every difference, top to bottom, by region: shell (sidebar, top bar),
   page header and actions, filters, KPI row, each panel, tables, footer note. For each: what the
   board does, what the page does. Ignore data values. Mark each one **look** (fix it) or
   **function** (the repo's behaviour differs — leave it, per the rule above).

## 2. Fix, biggest first

For each difference, open the matching part of the board's HTML (grep its heading text) and port
it:

- **Structure**: same element order, same grid (`grid-template-columns`, `grid-column: span N`,
  `gap`), same panel padding and radius. Put the layout in the component SCSS; a shape two or more
  pages share goes in `src/styles/_patterns.scss`.
- **Values**: map every board value to the token with the same value (`DESIGN_SYSTEM.md` §2). No
  token for it → add one in `styles.scss` with a DL entry, never a raw value.
- **Template**: board `{{x}}` → a binding; `sc-for` → `@for`; `sc-if` → `@if`; board sample text
  → copy file or API field.
- **Charts**: draw what the board draws (line, bars, funnel, pyramid) — not a bar table instead.
  A chart gets its table equivalent for screen readers, not instead of it.
- **Controls**: drawn as the board draws them (tabs, segmented, chips, pill buttons), wired to
  the repo's existing control and state.
- **Data the API does not send**: a board panel the repo does not have is left out (it is a
  function, not a look). Close the gap it leaves using the board's own grid — widen the
  neighbours to fill the row, as the board would — so there are no holes or a lone panel. Add a
  line to `docs/design/admin/DATA-GAPS.md` (panel, field, endpoint needed). Never invent figures.
  A panel the repo already has keeps its existing empty / not-connected state, drawn in the
  board's style.

Component styles over the 4 kB warning are fine up to the 8 kB error; past that, split a panel into
a child component.

## 3. Repeat

Re-run step 1 after each batch. Stop when the only differences left are data values, lines in
`DATA-GAPS.md`, or **function** differences, then check once more with `npm run parity -- $ARGUMENTS --width 1280`
(no sideways scroll, nothing overlapping). At most 6 rounds; if something will not match, say why.

## 4. Check and commit

`npm run check:styles`, the module's `check:*`, its specs
(`npx ng test --include='src/app/features/<feature>/**/*.spec.ts'`), `npm run build`,
`npm run verify`. Then commit on `main`:

```
Match <Board>: <page> looks like its board

Differences fixed (the list from step 1, one line each).
Panels waiting on data (from DATA-GAPS.md).
On the board, not in the console (left out: function, not look).
Behaviour unchanged; specs unchanged.
```
