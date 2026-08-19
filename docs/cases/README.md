# Social Welfare Case Management (TAB 10)

The office's continuing file on a household — and what is owed on it next.

Decisions: `DL-52` (a case is not a request), `DL-53` (closure is terminal),
`DL-54` (the audit-event seam is structural), `DL-55` (the next action is a
record), `DL-56` (the timeline merges the case with its interventions), `DL-57`
(`assigned-cases` means mine and nobody's), `DL-58` (a withheld note is shown as
withheld), `DL-59` (assignment offers two choices) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## The distinction the whole TAB rests on

A **case** is the office's involvement with a household over time. An
**assistance request** is one intervention inside it (`DL-52`).

|           | Case                                                       | Assistance request               |
| --------- | ---------------------------------------------------------- | -------------------------------- |
| Lifetime  | Months to years                                            | Days to weeks                    |
| Owns      | The relationship                                           | One grant                        |
| Ends when | The office's involvement ends                              | The money is released or refused |
| Statuses  | `intake → assessment → intervention → monitoring → closed` | `draft → … → completed`          |

`SocialCase.linkedRequestIds` names the interventions explicitly. It is not
"every request this person ever filed", because one person may be the subject of
two open cases at once — an older-persons file and a crisis intervention after a
fire — and a request belongs to one of them.

---

## The three acceptance guarantees, and how each is evidenced

### 1. Context and next action without opening another module

Everything the workspace shows arrives in **one** `getById` call: the person
(disclosed), the address, the vulnerability snapshot, the family, the assistance
requests attached to the case, the running record, the tasks and the merged
timeline. Nothing is fetched a second time, so nothing on the page can be
describing a different moment from anything else on it.

The **next action** is first on the screen, because it is what a caseworker
opening a file is asking before anything else. It is an open `CaseTask` with a
due date and an owner — a record, never inferred from the status (`DL-55`). A
case with nothing scheduled says so, which is a prompt rather than a guess.

_Evidence:_ `mock-case.repository.spec.ts` asserts that the workspace carries
the person, the household, the family, the snapshot and the linked requests
together, and that a case whose subject has no household is readable rather than
broken. `cases.spec.ts` asserts the page leads with the next action and shows
the household reference, the family name and the money on one screen.

### 2. Every material status change produces an audit-event seam

Every mutation on `CaseRepository` takes a `reason: string`; there is no
optional one. Every mutation appends a `CaseEvent` **in the same act** as the
change, and returns the whole workspace, so a screen cannot show a status its
own timeline does not explain. Nothing on the port or the store edits or deletes
history (`DL-54`).

The timeline merges four sources — case events, notes, completed tasks and the
status history of every attached request — newest first (`DL-56`). "Endorsed on
the 4th, home visit on the 6th" is one column.

This is enforced by `tools/check-case-audit.mjs`, run in `npm run verify`, which
fails the build if a mutator stops appending, a mutation loses its reason, a
delete path appears, a status falls out of one of its four maps, or `closed`
stops being terminal. It was validated against **six planted regressions** and
caught all six.

_Evidence:_ `mock-case.repository.spec.ts` asserts that a move writes the from,
the to, the actor and the reason; that a change with a token reason is refused;
that an illegal move is refused even when the permission is held; that a retried
move adds no second event; and that a completed task keeps its row and its
outcome.

### 3. Protected notes are not exposed outside authorized contexts

Case notes have two tiers. `routine` is the running record. `protected` is
narrow: safety planning under RA 9262, anything identifying a child in conflict
with the law under RA 9344, a confidence given in a session.

Redaction happens in the **data layer** (`DL-38`, `DL-58`). Reads return
`CaseNoteView`, whose `body` is `null` when withheld — the screen cannot leak a
paragraph it never received, and no refactor of the markup can undo that.

A withheld note is **shown as withheld**, not dropped. Its author, its time and
the fact of its restriction are still disclosed, and the workspace says "2 notes
are restricted" in words. A caseworker who cannot see that entries exist reads
the file as complete and acts as though nothing happened.

Writing into the protected tier requires the clearance to read it.

_Evidence:_ `mock-case.repository.spec.ts` asserts that `JSON.stringify` of the
whole workspace contains none of the protected words for an intake officer,
that the same reader is told two entries exist, that the timeline keeps the
lines and drops the detail, that the cleared worker sees everything, and that
writing into the tier without the clearance is refused. `cases.spec.ts` asserts
the same at the rendered-DOM level.

---

## Work queues

A queue is a question asked at the start of the day, defined once in
`isInQueue()` so the sidebar count, the list and the workspace cannot disagree.

| Queue        | Means                                             |
| ------------ | ------------------------------------------------- |
| `mine`       | Open and assigned to you                          |
| `unassigned` | Open and owned by nobody. How work gets picked up |
| `overdue`    | The next action was due before today              |
| `due-soon`   | The next action falls due within seven days       |
| `stalled`    | Nothing recorded for thirty days or more          |
| `all`        | Everything you may see, open or closed            |

Closed cases fall out of every queue but `all`: a queue that keeps offering
finished work is a queue people stop reading. The queue lives in the URL beside
the filters, so "the overdue cases in Dolores" is a link a supervisor can send.
Counts come from the repository under the same scope and filters as the list.

---

## Access

Five permissions, deliberately not one (`DL-58`, and the matrix in
[`../access/permission-matrix.md`](../access/permission-matrix.md)):

| Permission                 | Opens                                    |
| -------------------------- | ---------------------------------------- |
| `case.view`                | The file and its routine notes           |
| `case.manage`              | Moving it, assigning it, recording tasks |
| `case.note`                | Writing on the running record            |
| `case.view-protected-note` | The protected tier                       |
| `case.close`               | Ending the office's involvement          |

Three exclusions are deliberate. `barangay-link` holds **no** case permission —
proximity to the household is a reason to be stricter, not looser.
`release-officer` holds none either: a payout is authorised by the approved
request, not by the family's case file. `auditor` holds `case.view` and never
`case.view-protected-note`.

`assigned-cases` finally narrows something (`DL-57`): a social worker sees their
own caseload and the unassigned pool, and not a colleague's.

---

## Structure

| Piece                      | File                                                        |
| -------------------------- | ----------------------------------------------------------- |
| Case, statuses, queues     | `domain/cases/social-case.ts`                               |
| Notes and their disclosure | `domain/cases/case-note.ts`                                 |
| Tasks and the next action  | `domain/cases/case-task.ts`                                 |
| Events and the timeline    | `domain/cases/case-event.ts`                                |
| The one-read aggregate     | `domain/cases/case-workspace.ts`                            |
| Adapter                    | `data/mock/mock-case.repository.ts`                         |
| Append-only state          | `data/mock/mock-case.store.ts`                              |
| List and workspace         | `features/cases/case-*-page.*`                              |
| Status transition control  | `shared/cases/status-transition.ts`                         |
| Timeline                   | `shared/cases/case-timeline.ts`                             |
| Copy (`DL-23`)             | `shared/cases/case.copy.ts`, `features/cases/cases.copy.ts` |
| Structural check           | `tools/check-case-audit.mjs`                                |

`StatusTransition` is generic over the status union and lives in `shared/`, so
the assistance-request screen inherits reason capture rather than re-inventing
it.

The assistance domain's `CaseNote` was renamed **`RequestNote`** in this TAB. It
was always a note on a request; keeping the name would have left two different
things called a case note, which is precisely the confusion `DL-52` exists to
remove.

---

## Known gaps

- **Cases cannot be opened or continued from the UI.** The registry reads and
  works what the seed holds. Opening a case, and opening the case that continues
  a closed one (`continuesCaseId`), are the natural next screens (`DL-53`).
- **Assignment offers "me" or "nobody", not a colleague** (`DL-59`). A
  supervisor reassigning between two named workers needs a scoped "assignable
  colleagues" read — not a wider `staff.view`.
- **Assistance requests are attached at seed time.** Linking a request to a case
  belongs to the assistance-request TAB.
- **Case events are tab-lifetime**, like the rest of the mock. Seeded history
  covers each case's opening and the closure of the crisis case only.
- **The timeline is recomputed on every read**, and the queue facts with it.
- **`assigned-cases` still does not narrow residents, households, families or
  requests** — only cases (`DL-57`).
