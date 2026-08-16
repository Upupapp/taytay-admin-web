# Newsfeed

The only module in this application that speaks **outward**.

Everything else here is read by staff. A post is read by residents, and once it
has been, nothing in this repository can take that back. Every decision below
follows from that one difference.

---

## What it does

| Screen                   | Route            | Permission          |
| ------------------------ | ---------------- | ------------------- |
| Post list (six views)    | `/newsfeed`      | `newsfeed.view`     |
| Composer                 | `/newsfeed/new`  | `newsfeed.create`   |
| Post detail + moderation | `/newsfeed/:id`  | `newsfeed.view`     |

Acting on a post costs more than reading it: `newsfeed.publish`,
`.schedule`, `.archive`, `.pin` and `.moderate-comments` are separate keys, held
by the MSWDO head. The auditor holds `newsfeed.view` and
`newsfeed.view-insights` and nothing else (`DL-122`).

## The four rules

### Publishing is one-way (`DL-124`)

`published → archived` and nothing else. No unpublish, no retract, no unsend.
Archiving removes the post from the feed going forward and reaches nobody who
already read it, and the badge says exactly that.

The warning is shown **before** the publish button rather than as a
confirmation after it. Somebody deciding should read it; somebody who has
already decided will dismiss it.

`archived → published` is allowed, because taking a post down can itself be a
mistake.

### An image is described before it goes out (`DL-125`)

`PostImage.altText` is a required string. `postProblems` refuses to publish
without it and — deliberately — allows a **draft** to be saved without it: a
half-written post is somebody working, not an accessibility failure.

The field sits beside the image. `check:newsfeed` fails the build on a
`<details>` in the composer.

### Reach is counts (`DL-126`)

`reactionCount` and `commentCount`. There is no method anywhere that could
answer *which* residents reacted, read or shared, and the checker fails the
build if one appears. The screen states the limit rather than leaving the office
to discover it.

### Hiding keeps the words; removal deletes them (`DL-127`)

| Outcome     | The words        | Reversible | Kept on file            |
| ----------- | ---------------- | ---------- | ----------------------- |
| **Hidden**  | unchanged        | yes        | who, when, why          |
| **Removed** | `body` → `null`  | **no**     | who, when, why          |

Removal is the only act on the screen behind a modal, and the confirmation
offers hiding as the alternative. Hiding takes its reason inline. Making the
reversible act as heavy as the permanent one is how both come to feel routine.

## Scheduling

`isLiveToResidents(post, now)` derives visibility from the clock: a scheduled
post whose time has passed is live whether or not anything ran. There is no
timer, no `setTimeout`, no client-side scheduler — sending on time is the
backend's job, and a browser tab that happens to be open is not a guarantee
this application can make. The checker fails the build on a timer here.

## What is deliberately absent

- **No resident screen.** The resident contract is types only (`DL-123`).
- **No draft autosave to the browser.** Draft wording about a family or a flood
  is personal information; `localStorage` is refused by the checker (`DL-110`).
- **No engagement analytics beyond counts.**
- **No second RBAC and no second audit vocabulary** (`DL-122`).

## Guardrail

```bash
npm run check:newsfeed
```

Eight rule groups, validated against **57 planted regressions** — each rule
switched off one at a time, with the checker required to notice. Two findings
came out of that run rather than out of review: a file-wide search for
`permissionGuard('newsfeed.view')` was satisfied by a sibling route while
another lost its guard, and a doc comment explaining why a word is forbidden
tripped the rule forbidding it. Both are fixed; the checker now reads the route
block structurally and strips comments before scanning what a screen says.
