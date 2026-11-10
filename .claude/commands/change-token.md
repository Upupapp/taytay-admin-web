---
description: Change a design token in one place, re-run the contrast and brand audits and the browser sweep
argument-hint: <token and new value, e.g. "--muted #4a5366" or "--r-card 20px">
---

# Change token: $ARGUMENTS

A token is changed **where it is declared and nowhere else**. Every screen reads it through
`var(--…)`, so one edit restyles the console; a screen that needs a different value gets a new token,
not a literal.

## 1. Read first

1. `docs/design/DESIGN_SYSTEM.md` §2 (which group the token is in, what uses it) and §8–§9.
2. Where it is declared: `src/styles.scss` (`:root`: colours, surfaces, gradients, type, radii,
   heights, spacing, status tones) or `src/styles/_brand-tokens.scss` (focus ring, semantic spacing,
   seal sizes and placeholder colours), `_interaction.scss` (`--target-min`, `--focus-scroll-margin`),
   `_motion.scss` (`--motion-*`).
3. For a colour: `src/app/shared/brand/brand-palette.ts` (the audited mirror), the `TOKEN_MAP` in
   `tools/check-brand-assets.mjs`, and the pairs in `tools/check-contrast.mjs` that use it.
4. Who uses it: `grep -rn -- "--<token>\b" src/` (count, and which screens to look at afterwards).

## 2. Change

1. Edit the one declaration. Keep colour tokens as hex or `var()` of a hex token: the audits resolve
   aliases to a hex and fail on what they cannot resolve.
2. **Colour:** update the same value in `brand-palette.ts` if the token is in `TOKEN_MAP`. If the
   token is newly painted as text or as a boundary somewhere, add its pair to `check-contrast.mjs`
   (text 4.5:1, large text and boundaries 3:1). Never lower a threshold or drop a pair to make it
   pass; change the colour.
3. **New token:** add it beside its group with a comment saying what it is for; then use it.
4. **Rename or removal:** replace every use in the same commit (grep), and the checks' maps; leave no
   alias behind unless something outside this repository reads the old name.
5. Never put the new value in a component stylesheet. `npm run check:styles` fails on a literal
   outside the token declarations.

## 3. Check

- Light: `npm run check:contrast`, `npm run check:brand`, `npm run check:styles`,
  `npm run check:shell`.
- Heavy, one at a time (free memory first, background, log outside the repo, read the tail): the
  brand palette spec `npx ng test --include='src/app/shared/brand/**/*.spec.ts'`, then
  `npm run verify`.
- **Browser sweep** for a colour, surface, size or radius change (DESIGN_SYSTEM.md §10): build the mock
  console, visit every route at 1280 and 1440, and confirm no new overflow, no Tab stop without a
  ring, and — for colours on glass — no text run below AA. The static audits cannot see translucent
  surfaces.

## 4. Commit

`npm run verify` green, then commit on `main`, locally:

```
Design token: <token> <old> -> <new>, <why in a few words>

Where it is painted (count of uses / screens looked at). Contrast: pairs audited and their new
ratios; sweep result at 1280/1440. Checks or mirrors updated (brand-palette.ts, check-contrast.mjs).

<the co-author trailer your session prescribes>
```

A colour change that alters the audited palette gets a decision-log entry (`DL-NNN`) like `DL-202`.
Never `git push`/`pull`/`fetch` from the command line: commits stay local and the user pushes from
GitHub Desktop.
