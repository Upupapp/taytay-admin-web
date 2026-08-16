# TAB 18 — Notifications, Tasks, Alerts & Work Queues

**Status:** COMPLETE — locally certified
**Commit:** `378b8f8`
**Verify gate:** PASS — lint, typecheck, **13 checkers**, **1120 tests** (59 files), production build

The master command PDF was located on disk this TAB and **TAB 18's text was read
directly** rather than worked from the objective recorded in supervisor state.
The spec turned out richer than the summary: eleven named task types, a team
queue, assignment and snooze, and three acceptance criteria.

---

## What was built

| Layer    | Artefact                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| Domain   | `work/work-item.ts` — 11 `WorkKind`s, 5 `WorkSource`s, priority, derived urgency, `describeLateness`, `describeWaiting`, `compareWork` |
| Domain   | `work/work-queue.ts` — `bucketWork`, `describeQueue`, `buildTeamQueue`        |
| Domain   | `work/office-alert.ts` — data-quality conditions that decide nothing          |
| Domain   | `notifications/notification.ts` extended — `NotificationKind`, `groupNotifications`, `isForRecipient` |
| Domain   | `work/work.spec.ts` — 27 tests                                                |
| Ports    | `WorkRepository` (3 reads, **no mutator**); `CaseRepository.assignTask` / `rescheduleTask` |
| Data     | `mock-work.repository.ts` — read-only, gated, scoped, derives from 5 sources  |
| Data     | `mock-notification.repository.ts` — rewritten with recipient filtering        |
| Data     | `HttpWorkRepository`; `api.contract.ts` gained a read-only `work` endpoint     |
| Features | `work-queue-page`, `team-queue-page`, `notification-centre-page` + copy       |
| Features | `work.spec.ts` — 21 tests                                                     |
| Build    | `tools/check-work.mjs`, wired into `npm run verify`                           |
| Docs     | `docs/work/README.md`; `DL-96` … `DL-103`; CLAUDE.md §5                       |

Routes `/work`, `/work/team` (behind `staff.view`) and `/notifications`, plus a
"My work" nav entry at the top of Casework.

---

## Acceptance criteria

| Criterion (master command)                          | Where it is met                                          | State |
| ---------------------------------------------------- | -------------------------------------------------------- | ----- |
| Users can distinguish 'FYI' from 'action required'    | Three separate models; the centre says it in a sentence   | PASS  |
| Overdue work obvious **without red-only signalling**  | Sentence per row + worded heading + position + border     | PASS  |
| Tasks directly linked to records and next actions     | Every item carries a `WorkLink`; asserted per row in tests | PASS  |
| Personal task inbox                                   | `/work`                                                   | PASS  |
| Team queue where permitted                            | `/work/team`, behind `staff.view`                         | PASS  |
| Due today / overdue / upcoming                        | Five buckets incl. undated                                | PASS  |
| Priority and status                                   | `WorkPriority` catalog + source label                     | PASS  |
| Linked entity preview                                 | `subject` + `preview` on every item                       | PASS  |
| Assignment / reassignment                             | `CaseRepository.assignTask`, reason required              | PARTIAL — port and store built and tested; the queue screen exposes reschedule and complete, not the hand-over picker |
| Snooze / remind-later                                 | `rescheduleTask` with a recorded reason (`DL-99`)         | PASS  |
| Mark complete with outcome                            | Outcome required before the button enables                | PASS  |
| Notification centre, read/unread, grouped events      | `/notifications`                                          | PASS  |
| Deep links into exact record context                  | `WorkLink.routerLink`                                     | PASS  |
| Avoid notification overload                           | See defect 2 below — found and fixed                      | PASS  |

---

## Decisions recorded

- **DL-96** — three surfaces, and no channel the LGU did not supply.
- **DL-97** — a work queue is a view; the port is read-only.
- **DL-98** — an office alert describes the data; it decides nothing.
- **DL-99** — snooze is a recorded change of date, not a hidden timer.
- **DL-100** — the notification adapter did not know who the current user was.
- **DL-101** — no service standard was supplied, so the queue reports waiting.
- **DL-102** — overdue is obvious without red-only signalling.
- **DL-103** — a possible duplicate is a condition of the data, not a job.

---

## Defects found and fixed

1. **`MockNotificationRepository` returned every notification to every caller.**
   `recipientId` existed on the model and nothing read it, so a barangay-link
   account signing in saw the MSWDO head's inbox — case assignments, suspended
   programmes, payout preparations.

   This is the **third** ungated adapter (`DL-84`, `DL-95`), and the first that
   was **wired, reachable and in daily use**. The other two were behind
   placeholder routes. This one was simply *named* `listForCurrentUser` and did
   not know who that was. A name is not an implementation.

2. **My own first build of the queue caused the exact overload the master
   command warns against.** One work item per duplicate candidate pair produced
   **189 items for a social worker, 182 of them duplicates**, burying seven
   genuinely late things.

   The cause was blurring the distinction this module exists to keep: a
   duplicate pair has no assignee and no due date, so it was never work. It is
   now one counted alert. A feature test asserts the personal queue stays under
   thirty items.

3. **A seed release named a request belonging to a different resident**
   (`dsb-0008`, carried over from TAB 17) — corrected.

---

## Checker validation

`tools/check-work.mjs` enforces eight doctrines, validated against **29 planted
regressions**: 29/29 caught, 0 missed, 0 stale, baseline restored clean.

**Five were missed on the first pass**, and four of them were the same recurring
class this suite has now produced repeatedly:

| Missed plant | Why the checker passed |
| --- | --- |
| scope dropped from the adapter | file-wide search matched the surviving **import** |
| the screen bypassing `CaseRepository` | file-wide search matched the surviving **token** |
| the lateness sentence dropped | `viewFiles.some(...)` — the **other** template still had it |
| the late bucket losing its heading | `copy.overdue` is a **prefix of** `copy.overdueHint` |

Each was fixed by scoping the assertion: to the method body, to the call site,
to each template individually, to the exact binding.

---

## The recurring lesson, sixth and seventh instances

The rule has been written down since TAB 14: **scope a checker assertion to the
declaration it is about, never to the file.** It was applied while writing
`check:releases` and `check:work`, and both ran clean on the first try.

And both still contained instances of it — four in this one, found only by the
plants. Writing the rule down did not stop me reproducing it, because the
failure is not one of knowledge. It is that "does this assertion have a scope?"
has to be asked **per assertion**, at the moment of writing each one, and an
intention held at the top of a file does not survive two hundred lines.

The plants are not a formality. They are the only thing that has ever caught
this.

---

## Carried forward

- **Reassignment has no picker on the queue screen.** `assignTask` is built,
  gated, reason-requiring and tested at the domain and adapter level; the UI
  exposes complete and reschedule only. A staff picker belongs with the
  administration TAB that builds the staff list.
- **`reports` and `administration` remain placeholder routes.** Assume their
  adapters are ungated until read — three for three so far.
- `visit-detail-page.scss` is 79 bytes over budget (pre-existing, non-blocking).
- No screen creates a payout session (`createBatch`, carried from TAB 17).
