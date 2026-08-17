# Events

The office's side of a workflow that happens somewhere else.

Residents see events and register **in a separate mobile app**. This module
creates the events, manages the registrations that arrive, and records who came.
It never signs anybody up.

---

## What it does

| Screen                       | Route          | Permission       |
| ---------------------------- | -------------- | ---------------- |
| Event list (six views)       | `/events`      | `events.view`    |
| Composer                     | `/events/new`  | `events.create`  |
| Detail, registrants, history | `/events/:id`  | `events.view`    |

Acting costs more than reading: `events.publish`, `.cancel`, `.archive`,
`.manage-registrations`, `.mark-attendance` and `.export-registrations` are
separate keys. The auditor holds `events.view` and `events.view-insights` only.

Views are **Upcoming, Drafts, Published, Past, Cancelled, Archived**, with
search and category/date filters. Ordered by when the event *is* — the list
answers "what is next", and a newest-created ordering answers a question nobody
asked.

## The four rules

### Registration availability is derived (`DL-128`)

`not-required | not-open | open | closed | full`, computed every render from the
plan, the clock, the count and the status. No stored `registrationState`: a flag
about the passage of time is wrong every morning until a job fixes it.

### The client counts; the backend decides (`DL-129`)

`EventCapacitySummary` carries a required `asOf` and **no verdict** — no
`hasRoom`, no `canRegister`. The screen prints when the numbers were taken and
says the system of record decides who gets the last place.

Promotion from the waitlist is therefore **offered even when the office's own
figures say full**, with a warning rather than a disabled button. A place may
have opened a second ago; the attempt is made and the outcome read back.

### A registrant list is composed (`DL-130`)

| Held on `RegistrantView` | Never on it                                          |
| ------------------------ | ---------------------------------------------------- |
| reference, display name  | address, birth date, PhilSys digits                  |
| barangay, registered date| income, sector, household                            |
| status, attendance       | anything else a resident record carries              |
| notes (permission-gated) |                                                      |

The **display name comes from `discloseResident`**, the same reader the
residents module uses. A second surface formatting the name itself would hand an
events clerk the full name of somebody shown elsewhere as "Cordero, M."

### Cancelling is one-way, and past is not completed (`DL-131`)

`cancelled → archived` only; an event that is back on is a new one naming the
old. But cancelling *one registration* is freely reversible — that is one
person's place, not a public announcement.

**`hasFinished` is the clock's opinion; `completed` is the office's.** The gap
between them is where attendance gets marked, and it exists so that nothing
turns an unmarked registrant into a no-show. A no-show is a claim about a
person: that they took a place and did not come. Only somebody who was there
can make it.

Accordingly: `complete()` sweeps nothing, `describeAttendance` reports the
unmarked separately, and the attendance rate is `null` until the list is final.

## What is deliberately absent

- **No ticketing, pricing, seat maps, promo codes or payment.** An LGU medical
  mission is not a product being sold.
- **No recurring events**, until somebody asks.
- **No event chat and no event comments.** Moderation lives in the newsfeed.
- **No share link.** The command permits one *only if current deep-link
  contracts support it*; there is no deep-link contract, and a share button
  producing a URL nothing honours is worse than none (`DL-32`).
- **No registration from this console** — the one capability the resident
  contract reserves (`DL-123`).
- **No resident screen.**

## Guardrail

```bash
npm run check:events
```

Eight rule groups, validated against **71 planted regressions**. Six of those
runs found real weaknesses in the checker rather than in the code:

- a permission check satisfied by the permission's name appearing in an error
  message rather than in a guard;
- an availability rule satisfied by a destructuring statement while every
  comparison beneath it was disabled;
- `asOf` "rendered" by its own caption, `{{ copy.asOf }}`, while the number
  went unstamped;
- `\bticket\b` not matching `ticketPrice`, which is how a commercial field
  actually arrives;
- the Past-view rule reading the comment above the return rather than the
  return;
- one of two recording call sites removed while the other satisfied the rule.

Each is fixed; the seventh lesson is that a rule forbidding a *token* must read
comment-stripped source, or the first person to document the rule is the first
person to fail it.
