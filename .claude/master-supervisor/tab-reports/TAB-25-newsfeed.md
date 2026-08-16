# TAB 25 — Newsfeed Management

**Status:** Certified locally. Commit `e31de5e`. Nothing pushed.
**Gate:** `npm run verify` — lint, strict typecheck, 19 repository checks,
**1363 tests** (69 files), production build with no budget warning.

---

## What was built

| Layer    | Files                                                                     |
| -------- | ------------------------------------------------------------------------- |
| Domain   | `domain/newsfeed/post.ts`, `comment.ts`, `newsfeed.spec.ts`                |
| Ports    | `NewsfeedRepository` + `NEWSFEED_REPOSITORY`; `PostId`, `CommentId`        |
| Data     | `mock-newsfeed.repository.ts`, `seed/newsfeed.seed.ts`, HTTP adapter       |
| Features | `post-list-page`, `post-composer-page`, `post-detail-page`, `newsfeed.copy`|
| Guard    | `tools/check-newsfeed.mjs` — 8 rule groups, **57 planted regressions**     |
| Docs     | `docs/newsfeed/README.md`, `DL-124`–`DL-127`, `CLAUDE.md` section          |

Routes `/newsfeed`, `/newsfeed/new`, `/newsfeed/:id`, each guarded by the
permission its navigation entry advertises. Six list views (all, drafts,
scheduled, published, archived, pinned), search debounced through the one
shared window (`DL-119`), pinned posts first.

Tests: **1314 → 1363** (+49; 31 domain, 18 feature).

---

## The four decisions

**`DL-124` — Publishing is one-way.** `published → archived` and nothing else.
No unpublish, retract or unsend anywhere in the module. The warning is shown
*before* the publish button rather than as a confirmation after it: somebody
deciding reads it, somebody who has decided dismisses it. `archived →
published` is allowed, because taking a post down can itself be a mistake.

**`DL-125` — An image is described before publication, and not before.**
`PostImage.altText` is a required `string`; `postProblems` refuses to publish
without it and deliberately allows a **draft** to save without it. The field
sits beside the image — the checker fails the build on a `<details>` in the
composer — and the message names the resident it fails rather than the rule.

**`DL-126` — Reach is counts.** No method in the port, either adapter or any
screen can answer *which* residents reacted, read or shared. The question is
left unanswerable rather than answered-and-not-rendered.

**`DL-127` — Hiding keeps the words; removal deletes them.** `Comment.body` is
nullable for that reason. The one place the append-only doctrine is not
followed for a record's *content*: the act is append-only, the words are not.
Removal is the only act behind a modal, and its confirmation offers hiding as
the alternative.

---

## Found by validation, not by review

Both of these passed review and failed the planted-regression run.

1. **A guard check satisfied by a sibling route.** Three newsfeed routes ask
   for two permissions. The check tested that `permissionGuard('newsfeed.view')`
   appeared *somewhere* in `app.routes.ts`, so removing the guard from the list
   route left the detail route's guard to satisfy it and the build stayed green.
   The checker now reads the newsfeed children out of the route block and
   asserts each path against its own permission — and notices a fourth route
   arriving with no guard at all. This is the same class as the TAB 17 and TAB 18
   findings: a file-wide search passes on something that survived.

2. **A doc comment tripping the rule it documents.** The rule forbidding a
   screen to offer "unpublish" was failed by `newsfeed.copy.ts`'s own header,
   which explains that archiving must never read as unpublish. Left alone, the
   first person to hit that would have weakened the rule to get a green build.
   The scan now strips comments and reads what a screen actually says.

---

## Open, not fixed here

**`.facts` is defined twice across eight stylesheets.** Three screens
(residents, households, families) render it as a responsive grid; five
(referrals, releases, visits, payout sessions, newsfeed) render it as a
bordered stack. Same class, same markup, two appearances — the pattern `DL-120`
settled for `.field`, `.card` and `.btn`, which did not cover `.facts`.

Not collapsed here: picking one look changes seven screens certified in earlier
TABs, and that is a design decision rather than a newsfeed one. The newsfeed
file was brought under the 4 kB budget by merging its own duplicated rule sets
(three rows of buttons are one rule; a comment row and a history row are the
same shape) rather than by raising the budget.

---

## Boundaries held

- No resident screen, component or route (`DL-123`); the contract stays types.
- One RBAC and one audit vocabulary (`DL-122`).
- No `localStorage`, `sessionStorage` or cookie — refused by the checker.
- No timer, `setTimeout` or client-side scheduler; visibility derived from the
  clock.
- Features import ports, never `data/`; the mock/HTTP seam still flips.
- No `any`, `@ts-ignore`, `!` assertion or disabled lint rule added.

**Remote actions:** none taken. Local commit only.
