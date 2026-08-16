# Work queues, alerts and notifications

What the office owes, what has happened, and what is wrong with the records.

Built in TAB 18. Decision records: `DL-96` … `DL-103`.

---

## Three things, deliberately not one

The master command's first acceptance criterion is that a user can tell "FYI"
from "action required". That is a modelling problem before it is a styling one,
so this module keeps three concepts apart (`DL-96`):

|                    | Owner | Due date | Completed | Goes away when          |
| ------------------ | ----- | -------- | --------- | ----------------------- |
| **Work item**      | yes   | usually  | yes       | somebody does it        |
| **Notification**   | no    | no       | no (read) | never — it is history   |
| **Office alert**   | no    | no       | no        | the record is fixed     |

Collapsing them is how a notification centre becomes noise. An office that has
to read every line to find out whether it is owed anything stops reading any of
them, and the two lines that mattered go with the rest.

The distinction is stated **in words on the screen**. The notification centre
opens with a sentence saying that nothing on it is a job. A user who has learnt
to ignore a colour has not learnt to ignore a sentence.

---

## Nothing is sent anywhere

`NotificationChannel` is `toast | inbox | both`. It must never gain `email`,
`sms`, `push` or a webhook.

The LGU supplied no mail relay, no SMS gateway and no push credentials, so this
application has no way to deliver anything and must not appear to. The failure
is concrete: a `channel: 'sms'` that silently no-ops leaves an office believing
a beneficiary was told to come on Tuesday. Nobody finds out until the family
does not arrive, and by then the record says they were notified.

`npm run check:work` fails the build if a delivery name appears anywhere in the
notification path.

---

## A queue is a view; the port is read-only

`WorkRepository` has three methods, all reads:

```ts
myQueue(asOf: IsoDate): Observable<WorkQueue>
teamQueue(asOf: IsoDate): Observable<TeamQueue>   // behind staff.view
alerts(): Observable<readonly OfficeAlert[]>
```

There is no `complete`, no `assign`, no `snooze`, and there must not be. A
`WorkItem` is a normalised view of something that already exists; acting on it
goes to the repository that owns the record, which already has the permission
checks, the reason requirement and the audit trail. A mutator here would be a
second task system with a second audit trail, and "what does this office owe
this family?" would have two answers again (`DL-55`, `DL-97`).

`WorkItem.isManageable` is true **only** for a `case-task`. The screen says so
on every other row: an unanswered referral is not something you snooze, it is
something you chase. Offering a control that quietly does nothing is worse than
offering none.

Task acts go through `CaseRepository`, each with a required reason that appends
a case event (`DL-54`):

| Act              | Method             | Event              |
| ---------------- | ------------------ | ------------------ |
| Create           | `addTask`          | `task-added`       |
| Mark done        | `completeTask`     | `task-completed`   |
| Hand over        | `assignTask`       | `task-reassigned`  |
| Move the date    | `rescheduleTask`   | `task-rescheduled` |

**"Snooze" is `rescheduleTask`** (`DL-99`). A hidden timer leaves a file showing
nothing while a household waits another month, and the question afterwards is
always "why did this take so long?".

---

## Where work comes from

Five sources, each producing items only where somebody actually owes something:

| Source                | Owed when                                          | Manageable |
| --------------------- | -------------------------------------------------- | ---------- |
| `case-task`           | the task is open                                    | **yes**    |
| `assistance-request`  | the status expects an act (submitted, assessment, endorsed, …) | no |
| `field-visit`         | the visit is still scheduled                        | no         |
| `referral`            | it is open and has a follow-up date                 | no         |
| `release`             | it is open and its state expects an act             | no         |

A request *status* is not itself work. `REQUEST_WORK` maps a status to what
somebody must **do** about it, which is the whole difference between a status
list and a queue. Statuses absent from the map owe nobody anything: a `draft` is
the applicant's, and `completed`, `rejected`, `cancelled` and `expired` are done.

**A possible duplicate is not on this list** (`DL-103`). The first build emitted
one item per candidate pair: 189 items for a social worker, 182 of them
duplicates, with seven genuinely late things buried underneath. It has no
assignee and no date, so it is an alert with a count.

---

## Dates, and the ones that do not exist

Urgency is **derived** from an explicit `asOf`, never stored — a stored flag
needs a nightly job to stay true and is wrong every morning until it runs
(`DL-83`, `DL-88`). The due-soon window is imported from the case module rather
than redeclared: two constants meaning "due soon" is how two screens come to
disagree.

Most derived work has **no due date at all**, and that is not an omission
(`DL-101`). The LGU supplied no service standards, so an assistance request in
assessment has no deadline, and inventing "five working days" would be
fabricating policy the municipality never adopted. Those items carry
`waitingSince` — the day it was filed, a fact the office has — and the queue
says **"Waiting 9 days"**, never "3 days overdue". They are ordered by who has
waited longest, and the screen says why there is no date.

---

## Overdue, without red-only signalling

The master command asks for this, and it is an accessibility requirement rather
than a preference. Lateness is carried three ways before colour (`DL-102`):

1. **A sentence on every row** — `describeLateness` returns "Late by 3 days",
   from the domain, so no template can reduce it to a class name.
2. **A worded bucket heading** — "Late", with a sentence saying somebody set a
   date and it has passed.
3. **Position and a border rule** — the late bucket comes first and carries a
   left border, which survives printing.

Colour is the fourth carrier and the only optional one. The checker verifies the
sentence reaches **each** template that lists work, not merely one of them.

---

## Queues are counted, never verdicted

`describeQueue` returns "3 late, 2 due today, 5 later." — a sentence somebody
can act on. Not "behind schedule", which names nothing and hides how much. Same
doctrine as a payout session (`DL-90`).

The team queue groups **by person**, because a supervisor's question is about
people. Whoever is most behind sorts first. **Unassigned work is its own group**
and sorts last, labelled as a gap rather than as somebody's caseload — work
nobody picked up is the office's most common failure, and pooling it is how it
stays that way.

---

## Alerts describe the data and decide nothing

An `OfficeAlert` says something about the records is wrong or risky right now.
Nobody completes one; somebody fixes the record and it stops being true. So it
has no due date, no assignee and no done state — giving it any of those turns
"the data is wrong" into "somebody ticked a box" (`DL-98`).

Every alert states its **basis**: the rule it applied and what it read. An alert
nobody can check is one an office learns to dismiss.

This is the fifth surface where a signal could quietly become a decision engine,
after `DL-42`, `DL-60`, `DL-66` and `DL-78`. The checker refuses a
decision-shaped field and refuses a template that disables a control on one.

---

## Access

| Surface        | Permission        | Notes                                        |
| -------------- | ----------------- | -------------------------------------------- |
| My work        | `dashboard.view`  | filtered again by each item's own permission |
| The team's work| `staff.view`      | seeing a colleague's caseload is supervision |
| Alerts         | `dashboard.view`  | each alert filtered by its own permission    |
| Notifications  | recipient only    | `null` recipient = office-wide announcement  |

Every item names the permission needed to act on it, and the queue drops what
this user could not do — an intake officer's queue never contains a payout.
Barangay scope is applied per producer.

`MockNotificationRepository` had **none** of this before TAB 18: it returned
every notification to every caller, so a barangay-link account read the MSWDO
head's inbox. It is the third ungated adapter (`DL-84`, `DL-95`, `DL-100`), and
the first that was wired and in daily use — it was simply *named*
`listForCurrentUser` and did not know who that was.

---

## Files

| Path                                              | What it holds                          |
| ------------------------------------------------- | -------------------------------------- |
| `domain/work/work-item.ts`                        | Kinds, sources, priority, urgency, lateness |
| `domain/work/work-queue.ts`                       | Bucketing, counts, the team queue       |
| `domain/work/office-alert.ts`                     | Data-quality conditions                 |
| `domain/notifications/notification.ts`            | Channels, kinds, grouping, recipients   |
| `data/mock/mock-work.repository.ts`               | The read-only, gated adapter            |
| `features/work/work-queue-page.*`                 | My work, with task acts                 |
| `features/work/team-queue-page.*`                 | Who is carrying what                    |
| `features/work/notification-centre-page.*`        | Grouped, per-recipient event history    |
| `tools/check-work.mjs`                            | The build gate for all of the above     |

`npm run check:work` was validated against 29 planted regressions; every one
fails the build.
