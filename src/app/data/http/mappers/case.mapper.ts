import {
  CASE_CATEGORIES,
  CASE_NOTE_SENSITIVITIES,
  CASE_QUEUE_IDS,
  CASE_STATUS_CATALOG,
  CASE_TASK_KINDS,
  caseQueueFacts,
  type AssistanceRequest,
  type AssistanceRequestId,
  type CaseEvent,
  type CaseEventId,
  type CaseEventKind,
  type CaseId,
  type CaseNoteId,
  type CaseNoteSensitivity,
  type CaseNoteView,
  type CaseOpenDraft,
  type CaseQueueCount,
  type CaseStatus,
  type CaseSummary,
  type CaseTask,
  type CaseTaskDraft,
  type CaseTaskId,
  type CaseTaskKind,
  type CaseTaskStatus,
  type CaseWithheldField,
  type HouseholdId,
  type IsoDate,
  type ResidentId,
  type SocialCase,
  type SocialWorker,
  type StaffUserId,
} from '@domain/index';

import { toAssistanceRequest } from './assistance-request.mapper';
import { UNNAMED_ACTOR } from './household.mapper';
import { toResidentView, type BarangayIndex } from './resident.mapper';
import { bool, date, dateTime, field, id, int, oneOf, str } from './wire';

/**
 * Cases on the wire (`OfficeCase`, casework phase 3, `DL-179`).
 *
 * | wire                                   | domain                          | if absent or unknown          |
 * | -------------------------------------- | ------------------------------- | ----------------------------- |
 * | `id`, `reference_number`               | the same                        | the case is not readable      |
 * | `subject_resident_id`, `subject`       | the record's subject, disclosed | the case is not readable      |
 * | `household_id`                         | `householdId`                   | none today, or withheld       |
 * | `barangay_id`                          | `barangayId`, joined by name    | the case is not readable      |
 * | `category`, `status`                   | the same                        | the case is not readable      |
 * | `summary`                              | `summary`                       | withheld; otherwise unreadable|
 * | `assigned_to`, `assigned_to_name`      | `assignedTo`, `assignedToName`  | nobody                        |
 * | `linked_request_ids`                   | `linkedRequestIds`              | the case is not readable      |
 * | `continues_case_id`                    | `continuesCaseId`               | continues nothing             |
 * | `opened_on`, `closed_on`               | the same                        | opened: not readable          |
 * | `next_action`                          | `nextAction`                    | present and unreadable: not   |
 * | `open_task_count`, `open_request_count`| the same                        | the case is not readable      |
 * | `last_activity_at`                     | `lastActivityAt`                | nothing recorded              |
 * | `is_protected`, `withheld`             | the same, camelCased            | a field it cannot name: not   |
 * | `created_*`, `updated_*`               | `audit`                         | the case is not readable      |
 *
 * **The server has already redacted the case** (`DL-38`, `DL-179`): withheld words arrive as `null`
 * and `withheld` names them. This mapper applies no disclosure rule of its own and only says what
 * the server said. The queue facts are derived here from the next action's date and the last
 * activity, as the mock derives them (`DL-83`).
 *
 * **It refuses what it cannot read rather than default it.** A status, category or withheld field
 * it has no word for refuses the case: a case shown in the wrong state is acted on in the wrong way.
 *
 * @consumes GET office/cases
 */
export function toCaseSummary(wire: unknown, barangays: BarangayIndex): CaseSummary | null {
  const caseId = id<CaseId>(field(wire, 'id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const subjectResidentId = id<ResidentId>(field(wire, 'subject_resident_id'));
  const subject = toResidentView(field(wire, 'subject'), barangays);
  const barangayId = barangays.toConsole(str(field(wire, 'barangay_id')));
  const category = oneOf(field(wire, 'category'), CASE_CATEGORIES);
  const status = oneOf(field(wire, 'status'), CASE_STATUSES);
  const linkedRequestIds = toIds(field(wire, 'linked_request_ids'));
  const openedOn = date(field(wire, 'opened_on'));
  const openTaskCount = int(field(wire, 'open_task_count'));
  const openRequestCount = int(field(wire, 'open_request_count'));
  const withheld = toWithheld(field(wire, 'withheld'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    caseId === null ||
    referenceNumber === null ||
    subjectResidentId === null ||
    subject === null ||
    barangayId === null ||
    category === null ||
    status === null ||
    linkedRequestIds === null ||
    openedOn === null ||
    openTaskCount === null ||
    openRequestCount === null ||
    withheld === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  const summary = str(field(wire, 'summary'));
  const actionWire = field(wire, 'next_action');
  const nextAction =
    actionWire === null || actionWire === undefined ? null : toCaseTask(actionWire);
  // A summary missing without being withheld would read as a case opened about nothing, and a next
  // action the console cannot read would read as nothing being owed: both refuse the case.
  if (
    (summary === null && !withheld.includes('summary')) ||
    (actionWire !== null && actionWire !== undefined && nextAction === null)
  ) {
    return null;
  }

  const assignedTo = id<StaffUserId>(field(wire, 'assigned_to'));
  const lastActivityAt = dateTime(field(wire, 'last_activity_at'));
  const record: SocialCase = {
    id: caseId,
    referenceNumber,
    subjectResidentId,
    householdId: id<HouseholdId>(field(wire, 'household_id')),
    barangayId,
    category,
    status,
    summary,
    assignedTo,
    linkedRequestIds,
    openedOn,
    closedOn: date(field(wire, 'closed_on')),
    continuesCaseId: id<CaseId>(field(wire, 'continues_case_id')),
    isProtected: bool(field(wire, 'is_protected')),
    withheld,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };

  return {
    record,
    subject,
    // Held by somebody the server could put no name to is still held: never "nobody".
    assignedToName:
      assignedTo === null ? null : (str(field(wire, 'assigned_to_name')) ?? UNNAMED_ACTOR),
    openTaskCount,
    nextAction,
    facts: caseQueueFacts(record, nextAction?.dueOn ?? null, lastActivityAt),
    lastActivityAt,
    openRequestCount,
  };
}

/** A case's whole file as the server answers it, before the household context is composed. */
export interface CaseWorkspaceParts {
  readonly summary: CaseSummary;
  readonly tasks: readonly CaseTask[];
  readonly notes: readonly CaseNoteView[];
  /** Newest first, as the server sends them. */
  readonly events: readonly CaseEvent[];
  /** The linked requests this reader may read, as their own route answers them. */
  readonly requests: readonly AssistanceRequest[];
}

/**
 * The workspace (`OfficeCaseWorkspace`): the row above with its tasks, notes, events and the
 * linked requests this reader may read. Every write answers with it.
 *
 * **Whole or not at all.** A task, note, event or request it cannot read refuses the workspace: a
 * file missing an entry reads as complete (`DL-58`), and a history missing a line tells the next
 * worker it never happened.
 *
 * @consumes GET office/cases/{id}
 * @consumes POST office/cases
 * @consumes POST office/cases/{id}/status
 * @consumes POST office/cases/{id}/assignment
 * @consumes POST office/cases/{id}/notes
 * @consumes POST office/cases/{id}/tasks
 * @consumes POST office/cases/{id}/tasks/{taskId}/complete
 * @consumes POST office/cases/{id}/tasks/{taskId}/assignment
 * @consumes POST office/cases/{id}/tasks/{taskId}/reschedule
 * @consumes POST office/cases/{id}/requests
 */
export function toCaseWorkspaceParts(
  wire: unknown,
  barangays: BarangayIndex,
): CaseWorkspaceParts | null {
  const summary = toCaseSummary(wire, barangays);
  const tasks = whole(field(wire, 'tasks'), toCaseTask);
  const notes = whole(field(wire, 'notes'), toCaseNote);
  const events = whole(field(wire, 'events'), toCaseEvent);
  const requests = whole(field(wire, 'requests'), (entry) => toAssistanceRequest(entry, barangays));

  if (
    summary === null ||
    tasks === null ||
    notes === null ||
    events === null ||
    requests === null
  ) {
    return null;
  }

  return { summary, tasks, notes, events, requests };
}

/**
 * One queue's count, under the list's own filters.
 *
 * @consumes GET office/cases/queue-counts
 */
export function toCaseQueueCount(wire: unknown): CaseQueueCount | null {
  const queue = oneOf(field(wire, 'queue'), CASE_QUEUE_IDS);
  const count = int(field(wire, 'count'));

  if (queue === null || count === null) {
    return null;
  }

  return { queue, count };
}

/**
 * An open social-worker account a case can be given to: an id and a name, nothing more.
 *
 * @consumes GET office/cases/assignees
 */
export function toCaseAssignee(wire: unknown): SocialWorker | null {
  const workerId = id<StaffUserId>(field(wire, 'id'));

  if (workerId === null) {
    return null;
  }

  return { id: workerId, name: str(field(wire, 'name')) ?? UNNAMED_ACTOR };
}

/* ── what is sent ─────────────────────────────────────────────────────────── */

/**
 * What `POST office/cases` reads (`OfficeCaseOpen`), and nothing else: the body is strict. Who
 * opened it, when, and its number are the server's to record.
 */
export interface CaseOpenWire {
  readonly subject_resident_id: string;
  readonly category: CaseOpenDraft['category'];
  readonly summary: string;
  readonly continues_case_id: string | null;
  readonly linked_request_ids: readonly string[];
  readonly reason: string;
}

export function toWireCaseOpen(draft: CaseOpenDraft, reason: string): CaseOpenWire {
  return {
    subject_resident_id: draft.subjectResidentId,
    category: draft.category,
    summary: draft.summary.trim(),
    continues_case_id: draft.continuesCaseId,
    linked_request_ids: [...new Set(draft.linkedRequestIds)],
    reason: reason.trim(),
  };
}

/** What `POST office/cases/{id}/status` reads (`OfficeCaseStatusWrite`). */
export interface CaseStatusWire {
  readonly to: CaseStatus;
  readonly reason: string;
}

export function toWireCaseStatus(to: CaseStatus, reason: string): CaseStatusWire {
  return { to, reason: reason.trim() };
}

/** What `POST office/cases/{id}/assignment` reads (`OfficeCaseAssignmentWrite`): `null` is nobody. */
export interface CaseAssignmentWire {
  readonly assignee_id: string | null;
  readonly reason: string;
}

export function toWireCaseAssignment(
  assigneeId: StaffUserId | null,
  reason: string,
): CaseAssignmentWire {
  return { assignee_id: assigneeId, reason: reason.trim() };
}

/** What `POST office/cases/{id}/notes` reads (`OfficeCaseNoteWrite`). */
export interface CaseNoteWire {
  readonly body: string;
  readonly sensitivity: CaseNoteSensitivity;
  readonly reason: string;
}

export function toWireCaseNote(
  body: string,
  sensitivity: CaseNoteSensitivity,
  reason: string,
): CaseNoteWire {
  return { body: body.trim(), sensitivity, reason: reason.trim() };
}

/** What `POST office/cases/{id}/tasks` reads (`OfficeCaseTaskWrite`). */
export interface CaseTaskWire {
  readonly title: string;
  readonly kind: CaseTaskKind;
  readonly due_on: IsoDate;
  readonly assignee_id: string | null;
  readonly reason: string;
}

export function toWireCaseTask(draft: CaseTaskDraft, reason: string): CaseTaskWire {
  return {
    title: draft.title.trim(),
    kind: draft.kind,
    due_on: draft.dueOn,
    assignee_id: draft.assignedTo,
    reason: reason.trim(),
  };
}

/** What `POST office/cases/{id}/tasks/{taskId}/complete` reads: the reason is the outcome. */
export interface CaseTaskCompletionWire {
  readonly reason: string;
}

export function toWireCaseTaskCompletion(reason: string): CaseTaskCompletionWire {
  return { reason: reason.trim() };
}

/** What `POST office/cases/{id}/tasks/{taskId}/assignment` reads (`OfficeCaseTaskAssignmentWrite`). */
export interface CaseTaskAssignmentWire {
  readonly assignee_id: string | null;
  readonly reason: string;
}

export function toWireCaseTaskAssignment(
  assigneeId: StaffUserId | null,
  reason: string,
): CaseTaskAssignmentWire {
  return { assignee_id: assigneeId, reason: reason.trim() };
}

/** What `POST office/cases/{id}/tasks/{taskId}/reschedule` reads (`OfficeCaseTaskReschedule`). */
export interface CaseTaskRescheduleWire {
  readonly due_on: IsoDate;
  readonly reason: string;
}

export function toWireCaseTaskReschedule(dueOn: IsoDate, reason: string): CaseTaskRescheduleWire {
  return { due_on: dueOn, reason: reason.trim() };
}

/** What `POST office/cases/{id}/requests` reads (`OfficeCaseRequestLink`). */
export interface CaseRequestLinkWire {
  readonly request_id: string;
  readonly reason: string;
}

export function toWireCaseRequestLink(
  requestId: AssistanceRequestId,
  reason: string,
): CaseRequestLinkWire {
  return { request_id: requestId, reason: reason.trim() };
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

const CASE_STATUSES: readonly CaseStatus[] = Object.values(CASE_STATUS_CATALOG).map(
  (entry) => entry.value,
);

const TASK_STATUSES: readonly CaseTaskStatus[] = ['open', 'done', 'cancelled'];

/** The kinds the server records. `request-status-changed` is the console's own, from a request. */
const EVENT_KINDS: readonly CaseEventKind[] = [
  'case-opened',
  'status-changed',
  'assigned',
  'unassigned',
  'note-added',
  'task-added',
  'task-completed',
  'task-reassigned',
  'task-rescheduled',
  'request-linked',
];

const WITHHELD: Readonly<Record<string, CaseWithheldField>> = {
  summary: 'summary',
  reasons: 'reasons',
  task_words: 'taskWords',
  notes: 'notes',
  household_context: 'householdContext',
};

/** Every entry read, or `null` when there is no list or one entry cannot be read. */
function whole<T>(value: unknown, read: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const entries = value.map(read);
  return entries.every((entry): entry is T => entry !== null) ? entries : null;
}

function toIds(value: unknown): AssistanceRequestId[] | null {
  return whole(value, (entry) => id<AssistanceRequestId>(entry));
}

/**
 * What the server held back, or `null` when it names a field this console cannot: a screen that
 * cannot say what is hidden would show a blank that reads as "none given".
 */
function toWithheld(value: unknown): CaseWithheldField[] | null {
  return whole(value, (entry) => {
    const name = str(entry);
    return name !== null && Object.hasOwn(WITHHELD, name) ? (WITHHELD[name] ?? null) : null;
  });
}

function toCaseTask(value: unknown): CaseTask | null {
  const taskId = id<CaseTaskId>(field(value, 'id'));
  const caseId = id<CaseId>(field(value, 'case_id'));
  const kind = oneOf(field(value, 'kind'), CASE_TASK_KINDS);
  const status = oneOf(field(value, 'status'), TASK_STATUSES);
  const dueOn = date(field(value, 'due_on'));
  const createdAt = dateTime(field(value, 'created_at'));
  const updatedAt = dateTime(field(value, 'updated_at'));

  if (
    taskId === null ||
    caseId === null ||
    kind === null ||
    status === null ||
    dueOn === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  const assignedTo = id<StaffUserId>(field(value, 'assigned_to'));
  const completedBy = id<StaffUserId>(field(value, 'completed_by'));
  return {
    id: taskId,
    caseId,
    title: str(field(value, 'title')),
    kind,
    status,
    dueOn,
    assignedTo,
    assignedToName:
      assignedTo === null ? null : (str(field(value, 'assigned_to_name')) ?? UNNAMED_ACTOR),
    completedAt: dateTime(field(value, 'completed_at')),
    completedBy,
    completedByName:
      completedBy === null ? null : (str(field(value, 'completed_by_name')) ?? UNNAMED_ACTOR),
    outcome: str(field(value, 'outcome')),
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(value, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(value, 'updated_by')),
    },
  };
}

/**
 * A note as the server disclosed it (`DL-58`): a withheld body is `null` and the entry still
 * listed. A body neither present nor withheld is a note the console cannot read — an empty entry
 * would read as somebody having written nothing.
 */
function toCaseNote(value: unknown): CaseNoteView | null {
  const noteId = id<CaseNoteId>(field(value, 'id'));
  const caseId = id<CaseId>(field(value, 'case_id'));
  const sensitivity = oneOf(field(value, 'sensitivity'), CASE_NOTE_SENSITIVITIES);
  const createdAt = dateTime(field(value, 'created_at'));
  const body = str(field(value, 'body'));
  const isWithheld = bool(field(value, 'is_withheld'));

  if (noteId === null || caseId === null || sensitivity === null || createdAt === null) {
    return null;
  }
  if (body === null && !isWithheld) {
    return null;
  }

  return {
    id: noteId,
    caseId,
    authorName: str(field(value, 'author_name')) ?? UNNAMED_ACTOR,
    sensitivity,
    createdAt,
    body: isWithheld ? null : body,
    isWithheld,
  };
}

function toCaseEvent(value: unknown): CaseEvent | null {
  const eventId = id<CaseEventId>(field(value, 'id'));
  const caseId = id<CaseId>(field(value, 'case_id'));
  const kind = oneOf(field(value, 'kind'), EVENT_KINDS);
  const occurredAt = dateTime(field(value, 'occurred_at'));
  const fromRaw = field(value, 'from_status');
  const toRaw = field(value, 'to_status');
  const fromStatus = fromRaw === null ? null : oneOf(fromRaw, CASE_STATUSES);
  const toStatus = toRaw === null ? null : oneOf(toRaw, CASE_STATUSES);

  if (eventId === null || caseId === null || kind === null || occurredAt === null) {
    return null;
  }
  // A move to a status the console has no word for is a line it cannot explain.
  if ((fromRaw !== null && fromStatus === null) || (toRaw !== null && toStatus === null)) {
    return null;
  }

  return {
    id: eventId,
    caseId,
    kind,
    fromStatus,
    toStatus,
    reason: str(field(value, 'reason')),
    actorId: id<StaffUserId>(field(value, 'actor_id')),
    actorName: str(field(value, 'actor_name')) ?? UNNAMED_ACTOR,
    occurredAt,
    subject: {
      noteId: id<CaseNoteId>(field(value, 'note_id')),
      taskId: id<CaseTaskId>(field(value, 'task_id')),
      requestId: id<AssistanceRequestId>(field(value, 'request_id')),
      staffUserId: id<StaffUserId>(field(value, 'staff_user_id')),
    },
  };
}
