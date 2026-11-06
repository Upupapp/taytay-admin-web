import type { AssistanceRequest, AssistanceRequestStatus } from '../assistance/assistance-request';
import type {
  AssistanceRequestId,
  CaseEventId,
  CaseId,
  CaseNoteId,
  CaseTaskId,
  IsoDateTime,
  StaffUserId,
} from '../shared/ids';
import type { CaseNoteView } from './case-note';
import type { CaseTask } from './case-task';
import type { CaseStatus, CaseWithheldField } from './social-case';

/**
 * Everything a case can be recorded as having had done to it.
 *
 * `request-status-changed` is here even though no case-management action
 * produces it: an assistance request moving is part of what happened to the
 * case, and a timeline that omitted it would show a family being helped with no
 * trace of the help (`DL-56`).
 */
export type CaseEventKind =
  | 'case-opened'
  | 'status-changed'
  | 'assigned'
  | 'unassigned'
  | 'note-added'
  | 'task-added'
  | 'task-completed'
  | 'task-reassigned'
  | 'task-rescheduled'
  | 'request-linked'
  | 'request-status-changed';

/**
 * What the event was about, as identifiers and enum values only.
 *
 * Never a rendered sentence. An event written today has to still read correctly
 * after the copy is rewritten, and a stored sentence freezes wording that a
 * later translation or correction cannot reach (`DL-48`, carried forward).
 */
export interface CaseEventSubject {
  readonly noteId: CaseNoteId | null;
  readonly taskId: CaseTaskId | null;
  readonly requestId: AssistanceRequestId | null;
  readonly staffUserId: StaffUserId | null;
}

export const EMPTY_CASE_SUBJECT: CaseEventSubject = {
  noteId: null,
  taskId: null,
  requestId: null,
  staffUserId: null,
};

/**
 * One immutable line of a case's history — **the audit-event seam**.
 *
 * Every material change to a case produces one of these, written in the same
 * act as the change itself. There is no update and no delete, here or on the
 * store that holds them: the only way this history changes is by growing
 * (`DL-54`). When the API arrives it inherits the same obligation, and
 * `tools/check-case-audit.mjs` fails the build if a mutation appears that does
 * not append.
 */
export interface CaseEvent {
  readonly id: CaseEventId;
  readonly caseId: CaseId;
  readonly kind: CaseEventKind;
  readonly fromStatus: CaseStatus | null;
  readonly toStatus: CaseStatus | null;
  /**
   * Why. Required by the repository, not merely by a form. `null` only when the case's words are
   * withheld from this reader (`reasons`, `DL-179`): the event is still listed.
   */
  readonly reason: string | null;
  readonly actorId: StaffUserId | null;
  readonly actorName: string;
  readonly occurredAt: IsoDateTime;
  readonly subject: CaseEventSubject;
}

/* ── The timeline ──────────────────────────────────────────────────────────── */

export type CaseTimelineSource = 'case' | 'note' | 'task' | 'assistance-request';

/**
 * One line of the case timeline, assembled at read time.
 *
 * Derived rather than stored, so the timeline can merge the case's own events
 * with the status history of the assistance requests attached to it. `detail`
 * has already been through the disclosure policy: a withheld note contributes a
 * line saying it exists, with no body (`DL-38`).
 */
export interface CaseTimelineEntry {
  readonly id: string;
  readonly source: CaseTimelineSource;
  readonly kind: CaseEventKind;
  readonly occurredAt: IsoDateTime;
  readonly actorName: string;
  readonly reason: string | null;
  /** The reason exists and is not this reader's to read — said, never shown as "none given". */
  readonly reasonWithheld: boolean;
  readonly fromCaseStatus: CaseStatus | null;
  readonly toCaseStatus: CaseStatus | null;
  readonly fromRequestStatus: AssistanceRequestStatus | null;
  readonly toRequestStatus: AssistanceRequestStatus | null;
  /** The record this line came from, e.g. a request reference or a task title. */
  readonly reference: string | null;
  /** Free text, already disclosed. `null` when withheld or not applicable. */
  readonly detail: string | null;
  readonly isWithheld: boolean;
}

export function byNewestEventFirst(
  a: { readonly occurredAt: IsoDateTime },
  b: { readonly occurredAt: IsoDateTime },
): number {
  return a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0;
}

export function eventsForCase(events: readonly CaseEvent[], caseId: CaseId): readonly CaseEvent[] {
  return events.filter((event) => event.caseId === caseId);
}

/** The most recent moment anything at all happened on a case. */
export function lastActivityAt(entries: readonly CaseTimelineEntry[]): IsoDateTime | null {
  return [...entries].sort(byNewestEventFirst)[0]?.occurredAt ?? null;
}

/** Said where the office record has no name for whoever acted. */
export const UNNAMED_STAFF = 'A member of staff with no name on record';

/** What a case's timeline is assembled from, each already disclosed for the reader. */
export interface CaseTimelineSources {
  /** The case's own events, **newest first**, as the office record answers them. */
  readonly events: readonly CaseEvent[];
  readonly notes: readonly CaseNoteView[];
  readonly tasks: readonly CaseTask[];
  /** The linked requests this reader may read — never the ones they may not (`DL-179`). */
  readonly requests: readonly Pick<
    AssistanceRequest,
    'id' | 'referenceNumber' | 'statusHistory' | 'withheld'
  >[];
  /** What the case withholds from this reader. */
  readonly withheld: readonly CaseWithheldField[];
}

const BLANK_ENTRY: Omit<CaseTimelineEntry, 'id' | 'source' | 'kind' | 'occurredAt' | 'actorName'> =
  {
    reason: null,
    reasonWithheld: false,
    fromCaseStatus: null,
    toCaseStatus: null,
    fromRequestStatus: null,
    toRequestStatus: null,
    reference: null,
    detail: null,
    isWithheld: false,
  };

/**
 * The case's own events, its notes, its completed tasks and the status history of every linked
 * request this reader may read — merged, newest first (`DL-56`).
 *
 * One function for both adapters, so the timeline a caseworker reads is the same assembly whether
 * the record came from the office server or the mock: two assemblies of one history eventually
 * disagree, in front of the family.
 *
 * An event that records a note or a task carries that record on its own line — the note's words,
 * or the task's title — so a note is not told twice. A note or completed task with no event of its
 * own (history recorded before events were) still gets its line. A withheld word is said to be
 * withheld, never left blank (`DL-38`, `DL-179`).
 */
export function caseTimeline(sources: CaseTimelineSources): readonly CaseTimelineEntry[] {
  const notes = new Map(sources.notes.map((note) => [note.id, note]));
  const tasks = new Map(sources.tasks.map((task) => [task.id, task]));
  const requests = new Map(sources.requests.map((request) => [request.id, request]));
  const reasonsWithheld = sources.withheld.includes('reasons');
  const taskWordsWithheld = sources.withheld.includes('taskWords');
  const toldNotes = new Set<string>();
  const toldTasks = new Set<string>();

  const entries: CaseTimelineEntry[] = sources.events.map((event) => {
    const line: CaseTimelineEntry = {
      ...BLANK_ENTRY,
      id: `case:${event.id}`,
      source: 'case',
      kind: event.kind,
      occurredAt: event.occurredAt,
      actorName: event.actorName,
      reason: event.reason,
      reasonWithheld: event.reason === null && reasonsWithheld,
      fromCaseStatus: event.fromStatus,
      toCaseStatus: event.toStatus,
    };
    const note = event.subject.noteId === null ? undefined : notes.get(event.subject.noteId);
    if (event.kind === 'note-added' && note !== undefined) {
      toldNotes.add(note.id);
      return { ...line, source: 'note', detail: note.body, isWithheld: note.isWithheld };
    }
    const task = event.subject.taskId === null ? undefined : tasks.get(event.subject.taskId);
    if (task !== undefined) {
      if (event.kind === 'task-completed') {
        toldTasks.add(task.id);
      }
      return {
        ...line,
        source: 'task',
        reference: task.title,
        isWithheld: task.title === null && taskWordsWithheld,
      };
    }
    if (event.kind === 'request-linked') {
      const request =
        event.subject.requestId === null ? undefined : requests.get(event.subject.requestId);
      return { ...line, source: 'assistance-request', reference: request?.referenceNumber ?? null };
    }
    return line;
  });

  for (const note of sources.notes) {
    if (toldNotes.has(note.id)) {
      continue;
    }
    entries.push({
      ...BLANK_ENTRY,
      id: `note:${note.id}`,
      source: 'note',
      kind: 'note-added',
      occurredAt: note.createdAt,
      actorName: note.authorName,
      detail: note.body,
      isWithheld: note.isWithheld,
    });
  }

  for (const task of sources.tasks) {
    if (task.completedAt === null || toldTasks.has(task.id)) {
      continue;
    }
    entries.push({
      ...BLANK_ENTRY,
      id: `task:${task.id}`,
      source: 'task',
      kind: 'task-completed',
      occurredAt: task.completedAt,
      actorName: task.completedByName ?? UNNAMED_STAFF,
      reason: task.outcome,
      reasonWithheld: task.outcome === null && taskWordsWithheld,
      reference: task.title,
      isWithheld: task.title === null && taskWordsWithheld,
    });
  }

  for (const request of sources.requests) {
    const reasonsHeld = request.withheld.includes('statusReasons');
    for (const [index, change] of request.statusHistory.entries()) {
      entries.push({
        ...BLANK_ENTRY,
        id: `req:${request.id}:${String(index)}`,
        source: 'assistance-request',
        kind: 'request-status-changed',
        occurredAt: change.occurredAt,
        actorName: change.actorName,
        reason: change.reason,
        reasonWithheld: change.reason === null && reasonsHeld,
        fromRequestStatus: change.from,
        toRequestStatus: change.to,
        reference: request.referenceNumber,
      });
    }
  }

  // A stable sort: two lines recorded in the same millisecond keep the order they were given in,
  // which for the events is the office record's own, newest first.
  return entries.sort(byNewestEventFirst);
}
