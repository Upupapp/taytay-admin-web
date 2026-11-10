---
description: Run a whole console redesign in phases — tokens, shared/ui, features — with a PROGRESS.md and a commit per phase
argument-hint: <where the new design is, e.g. "design/ (new mock-ups and README)">
---

# Redesign the console from: $ARGUMENTS

A redesign changes how every screen looks and nothing about what any screen does. It goes **tokens →
shared/ui and the frame → features → sweep → docs**, one phase at a time, each phase committed on its
own with a green gate, so that a crash, a `/clear` or a new session can carry on from the notes.

## 0. Set up

1. Put the new design in `design/` at the repo root (it is in `.gitignore`; never commit it).
2. Read `CLAUDE.md` in full, `docs/design/DESIGN_SYSTEM.md` (the current system: what exists, how it
   is guarded) and the new design's README and mock-ups (HTML source, grep with offset/limit; no
   screenshots in the conversation).
3. Create `design/PROGRESS.md` with: a batch table (phase, scope, status, commit hashes), "Next up",
   "API fields needed", "Tests changed", and "Notes for the next agent" (tokens, classes, decisions,
   pitfalls). Update it after every batch; a fresh session must be able to continue from it alone.
4. `git status --short` must be clean before the first edit; stop and ask about changes you did not
   make.

## 1. Phases

**Phase 1 — Tokens.** Translate the design's colours, gradients, type scale, radii and sizes into the
`:root` tokens in `src/styles.scss` (focus ring and spacing aliases in `_brand-tokens.scss`), and
apply them to the global primitives (`.btn`, `.field`, `.card`, `.check`) and `_patterns.scss`. Keep
the mock-ups' own token names where they have them. Update `brand-palette.ts`, `check-contrast.mjs`
and `check-brand-assets.mjs` for every colour that changes (stricter, never weaker). Commit
`Redesign (admin): Phase 1 styles`.

**Phase 2 — shared/ui and the frame.** Restyle every component in `src/app/shared/ui` and the shell in
`src/app/layout` without changing a selector, input, output or slot. Add the design's repeated shapes
to `_patterns.scss`. Commit `Redesign (admin): Phase 2 shared UI and shell`.

**Phase 3 — Features**, one feature per commit (`Redesign (admin): <feature>`), using
`.claude/commands/restyle-page.md` for each page. Map each feature to the design's list, detail,
form, dashboard or inbox pattern. Batch them (four to seven features per session) and record each
hash in PROGRESS.md.

**Phase 4 — Finish.** Grep for anything still on old values (old token names, literals, local copies
of a primitive), retire the old token names, and run the browser sweep at 1280 and 1440
(DESIGN_SYSTEM.md §10): overflow, focus rings, contrast on glass. Fix what it finds. Commit
`Redesign (admin): Phase 4 finish`.

**Phase 5 — Write it down.** Copy the design's reference into `docs/design/` (keep `design/`
ignored; keep the copy out of lint, Prettier, build and checks), update
`docs/design/DESIGN_SYSTEM.md` from the code as it now is, `CLAUDE.md` §7, these commands and
`tools/check-styles.mjs` if the rules changed. Commit
`Redesign (admin): design system docs, commands and guard rules`.

Record each phase's decisions in the decision log (`docs/reference-audit/decision-log.md`, next free
`DL-NNN`), as `DL-200` to `DL-203` did.

## 2. Rules for every phase

- **Presentation only.** Services, ports, adapters, stores, routes, guards, validators, component
  APIs, live regions and every sentence a check or decision requires stay. The checks outrank the
  mock-ups.
- **Real data only.** No sample names, counts, dates or photos from the mock-ups. An element whose data
  the API does not send is left out and listed under "API fields needed".
- **Four data states** on every data view; **no shadows or glows**; **centred dialogs**; **visible
  focus**; **1280 and 1440** without sideways scroll.
- If a spec or check enforces an old _visual_ rule the design overrides, change it narrowly, record it
  under "Tests changed" and in the commit body. Never weaken a privacy, access, contract or money
  check.

## 3. Gates

Heavy jobs one at a time on this PC (check free memory, run in the background with output to a log
outside the repo, read only the tail). Per feature: its specs
(`npx ng test --include='src/app/features/<feature>/**/*.spec.ts'`) and `npm run build`. Before every
commit: `npm run verify` (lint, typecheck, every `check:*` including `check:styles`, the full test
suite, the production build, `check:bundle`). Never commit on a red gate, never `--no-verify`.

## 4. Commits

On `main`, locally, one per phase or feature:

```
Redesign (admin): <phase or feature>

What changed; patterns and tokens added; API fields left out; tests or checks changed and why.

<the co-author trailer your session prescribes>
```

Record the hash in PROGRESS.md as "committed, not pushed". Never `git push`, `git pull` or `git fetch`
from the command line, never rewrite history, never deploy: the user pushes from GitHub Desktop.
