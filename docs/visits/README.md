# Field visits, case notes and follow-up

Home and field visits, what was found there, and what the office owes next.

## The two things to understand first

### 1. Every line says whose claim it is

Three sentences a worker might write in one paragraph:

- "The roof is missing sheets over the sleeping area."
- "She says her husband has not sent money since March."
- "The household appears unable to meet its own food costs."

A fact, a report and a judgement. Written as prose they become
indistinguishable, and six months on a different worker reads all three as
established fact about the family — at which point the family is arguing with a
record rather than with a person.

So a `VisitObservation` carries its **kind** (`DL-85`):

| Kind | Means |
| --- | --- |
| `observed` | The worker saw or measured it. Checkable by another visit. |
| `client-said` | The household's account, recorded as theirs — not as verified. |
| `third-party-said` | Somebody else's account. **Must name who.** |
| `worker-assessed` | The worker's professional judgement. A later reader may disagree. |

Nothing prevents recording a judgement. It prevents a judgement from being
mistaken for something the family said.

Three details make this real rather than decorative:

- **The form asks for the kind first.** A worker who has already written a
  paragraph will not go back and reclassify it.
- **The kind is rendered**, and the checker fails the build if no screen shows
  it.
- **`isAllJudgement` surfaces a record built only of assessments** — not
  blocked, because a doorstep conversation can legitimately produce one, but
  visible, because that is the shape that hardens into a label.

Observations are **appended, never edited or removed**. A worker correcting an
earlier one records another saying so.

### 2. This is not a tracking product

There is **no coordinate, no check-in, no route and no geolocation call** —
anywhere in the domain, the adapters, the seed or the screens. `npm run
check:visits` scans all of them and fails the build on any of it (`DL-86`).

The master command forbids continuous tracking, covert tracking and geofencing
of clients. Those are easy to refuse as *features* and easy to acquire as
*fields*. A "visit location" column added in good faith to help a supervisor
plan routes is the first half of a system that records where poor families live
and which worker stood outside their door at which minute. The second half
arrives as a reporting request a year later, and by then the data exists.

What a visit *does* record is `addressVisited`, **copied** from the household at
scheduling rather than referenced — a household that later moves must not
silently rewrite where a past visit was made.

## Outcomes

`completed`, `not-found`, `refused` and `cancelled` are all terminal. A second
attempt is a second visit, so "how many times did we go?" keeps one answer
(`DL-88`).

The vocabulary matters more here than elsewhere, because these words describe a
family to the next worker who opens the file:

- **Nobody home** is the household doing nothing. A worker reading "failed
  visit" writes a different note than one reading "nobody home".
- **Declined by the household** is a decision they made, and their reason is
  kept in their words. A declined reason on any other outcome is refused —
  attaching one to a completed visit puts words in a household's mouth.
- **Cancelled** is the office calling it off, which is the office's own fact.

The list heading for a missed visit says *the office* owes it, not the family.

## Writing up in the field

`CaptureState` is `held-locally`, `sending`, `sent` or `send-failed`. **Exactly
one means the office record has it**, and a test asserts that (`DL-87`).

The failed state says in words that **nothing was queued in the background**.
A worker who believes a visit was filed and returns to find it was not has been
failed twice — once by the network and once by the interface, and only the
second is ours.

`unsentWarning` comes from the domain, not a template, so it cannot be softened
into "you have unsaved changes" — which reads as a browser nuisance rather than
a warning that a family's visit record is about to be lost.

## Built on what already existed

| Already there | From | How visits use it |
| --- | --- | --- |
| `CaseNote` two-tier model | TAB 10 (`DL-58`) | Unchanged — visits do not add a second note system |
| `CaseTask` next-action model | TAB 10 (`DL-55`) | Follow-ups become case tasks, not visit tasks |
| `case.view` / `case.manage` | TAB 05 | A visit record is casework; no new permission |

There is no second task system and no second note system. "What does this office
owe this family next?" has one answer.

## Known gaps

- **No scheduling form.** `schedule` works through the port and is tested; the
  screen that books a visit from a case or household is not built.
- **The follow-up task is not yet created from the visit screen.** Closing a
  visit records what the household needs; turning that into a `CaseTask` is the
  natural next wiring, and it must go through `CaseRepository` rather than
  growing a task here.
- **`VisitCapture` is modelled and tested but not yet wired to a screen.** The
  detail page writes straight through; the field-capture flow that uses the
  states is the piece a genuinely offline build would need.
- **Photos and attachments are not implemented.** When they are, they reuse the
  TAB 14 document grant rather than a second path, and only where necessary and
  consented.
