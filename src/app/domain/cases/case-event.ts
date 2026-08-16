import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import type {
  AssistanceRequestId,
  CaseEventId,
  CaseId,
  CaseNoteId,
  CaseTaskId,
  IsoDateTime,
  StaffUserId,
} from '../shared/ids';
import type { CaseStatus } from './social-case';

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
  /** Why. Required by the repository, not merely by a form. */
  readonly reason: string;
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
