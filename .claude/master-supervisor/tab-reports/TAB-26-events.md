# TAB 26 — Events Management

**Status:** Certified locally. Commit `49a8b48`. Nothing pushed.
**Gate:** `npm run verify` — lint, strict typecheck, **20 repository checks**,
**1437 tests** (71 files), production build with no budget warning.

**This is the final TAB. All 26 are complete.**

---

## What was built

| Layer    | Files                                                                      |
| -------- | -------------------------------------------------------------------------- |
| Domain   | `domain/events/event.ts`, `registration.ts`, `events.spec.ts`               |
| Ports    | `EventRepository` + token; `LguEventId`, `EventRegistrationId`              |
| Data     | `mock-event.repository.ts`, `seed/events.seed.ts`, HTTP adapter, endpoints  |
| Features | `event-list-page`, `event-composer-page`, `event-detail-page`, `events.copy`|
| Guard    | `tools/check-events.mjs` — 8 rule groups, **71 planted regressions**        |
| Docs     | `docs/events/README.md`, `DL-128`–`DL-131`, `CLAUDE.md` section             |

Six views (Upcoming, Drafts, Published, Past, Cancelled, Archived), search and
category/date filters, a single-form composer, and a detail screen carrying the
resident-facing preview, publication facts, capacity, attendance, the registrant
table and the audit history. Routes `/events`, `/events/new`, `/events/:id`,
each guarded by the permission its nav entry advertises.

The five model names the command asks for are all present: `LguEvent`,
`EventRegistration`, `EventCapacitySummary`, `EventAttendance` (as
`AttendanceStatus` + its catalog) and `EventMetrics`.

Tests: **1363 → 1437** (+74; 46 domain, 28 feature).

---

## The four decisions

**`DL-128` — Registration availability is derived.** `not-required | not-open |
open | closed | full`, computed from the plan, the clock, the count and the
status. No stored `registrationState`: a flag about the passage of time is wrong
every morning until a job fixes it.

**`DL-129` — The client counts; the backend decides.** The command forbids
inventing backend concurrency guarantees. `EventCapacitySummary` carries a
required `asOf` and no verdict field; the screen prints the timestamp and says
the system of record decides who gets the last place. Promotion from the
waitlist is offered **even when the office's own figures say full** — warned,
not blocked — because a place may have opened a second ago.

**`DL-130` — A registrant list is composed.** A closed field set, and the
display name produced by `discloseResident` rather than formatted locally. A
second surface formatting the name would hand an events clerk the full name of
somebody the residents module shows as "Cordero, M."

**`DL-131` — Cancelling is one-way, and past is not completed.** `hasFinished`
is the clock's opinion; `completed` is the office's. The gap is where attendance
is marked, and it exists so nothing turns an unmarked registrant into a no-show
— which is a claim about a person, and only somebody who was there can make it.

---

## Found by validation, not by review

Six of the 71 planted runs failed to trip the checker and exposed weaknesses in
the **checker**, not the code:

1. **A permission check satisfied by an error message.** The rule looked for
   the permission string in the method body; `new PermissionDeniedError(
   'events.mark-attendance')` in the not-found branch kept it there while the
   `denyUnless` guard was gone. Now the guard itself is matched.
2. **A derivation rule satisfied by a destructuring statement.** `const {
   opensAt, closesAt, capacity } = …` names all three inputs, so every
   comparison beneath could be replaced with `if (false)` and the rule passed.
   Now each comparison is asserted.
3. **`asOf` "rendered" by its own caption.** `{{ copy.asOf }}` prints the words
   "Counted at"; the rule accepted it while the number went unstamped.
4. **`\bticket\b` does not match `ticketPrice`** — which is exactly how a
   commercial field arrives. Prefix matching now, with `promo` narrowed to
   `promoCode` after it collided with the module's own waitlist *promotion*.
5. **The Past-view rule read the comment above the return** rather than the
   return.
6. **One of two recording call sites removed** while the other satisfied the
   rule. Both are counted now.

The seventh lesson, carried over from TAB 25 and re-learned here: a rule
forbidding a *token* must read comment-stripped source, or the first person to
document the rule is the first person to fail it.

One data defect was found the same way: the seed claimed the livelihood training
was full while seeding 4 registered against a capacity of 25, which made the
waitlisted rows look like a bug. Capacity is now 6 with six registered and three
waiting, and the seeded counts are **derived** from the seeded rows so the two
cannot disagree.

---

## Deliberately not built

- **No share link.** The command permits one *only if current deep-link
  contracts support it*. There is none, and a button producing a URL nothing
  honours is worse than no button (`DL-32`).
- **No tab counts on the six views.** They do not partition the set — a
  published event that has happened is in both `published` and `past` — so a
  correct count needs the whole list while the port takes a view. A wrong
  "Drafts (0)" reads as fact.
- No ticketing, pricing, seat maps, promo codes or payment; no recurring
  events; no event chat or comments; no resident screen; no method anywhere
  that registers a resident.

---

## Housekeeping

Events was the **last placeholder route**. The `placeholder()` helper is
removed and `app.routes.ts` says where to reintroduce it.
`FeaturePlaceholderPage` stays in the tree for the next module that needs it.

`.btn--small` was added to `styles.scss` rather than to the events stylesheet,
per `DL-120` — a shared primitive is defined once or it is not shared.

**Remote actions:** none taken. Local commit only.
