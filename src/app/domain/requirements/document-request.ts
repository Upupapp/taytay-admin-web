import type {
  AssistanceRequestId,
  DocumentRequestId,
  IsoDate,
  IsoDateTime,
  RequirementId,
  StaffUserId,
} from '../shared/ids';

/**
 * The office asking an applicant for a document, recorded.
 *
 * Before this, "we told them to bring the barangay certificate" lived in
 * somebody's memory or in a note nobody could search. That fails the applicant
 * twice: they are asked again on their next visit by a different clerk, and if
 * they say they were never told, the office has nothing to check.
 *
 * A request is **not** a task in the case sense (`DL-55`) — it is owed by the
 * applicant, not by staff — but it produces staff work when it goes unanswered,
 * which is why it carries a `neededBy` and surfaces as overdue.
 */

export type DocumentRequestChannel = 'in-person' | 'sms' | 'phone-call' | 'barangay-relay';

export const DOCUMENT_REQUEST_CHANNEL_LABELS: Readonly<
  Record<DocumentRequestChannel, string>
> = {
  'in-person': 'Told at the counter',
  sms: 'Text message',
  'phone-call': 'Phone call',
  'barangay-relay': 'Relayed through the barangay',
};

export type DocumentRequestState = 'open' | 'answered' | 'withdrawn';

export const DOCUMENT_REQUEST_STATE_LABELS: Readonly<Record<DocumentRequestState, string>> = {
  open: 'Waiting on the applicant',
  answered: 'Provided',
  withdrawn: 'No longer needed',
};

export interface DocumentRequest {
  readonly id: DocumentRequestId;
  readonly assistanceRequestId: AssistanceRequestId;
  readonly requirementId: RequirementId;
  readonly state: DocumentRequestState;
  readonly channel: DocumentRequestChannel;
  /** What the applicant was actually told, in the words used. */
  readonly message: string;
  readonly neededBy: IsoDate | null;
  readonly requestedBy: StaffUserId;
  readonly requestedAt: IsoDateTime;
  /** Set when the state leaves `open`. Never unset. */
  readonly closedAt: IsoDateTime | null;
  /** Why it was withdrawn. `null` when it was simply answered. */
  readonly withdrawnReason: string | null;
}

export interface DocumentRequestDraft {
  readonly requirementId: RequirementId;
  readonly channel: DocumentRequestChannel;
  readonly message: string;
  readonly neededBy: IsoDate | null;
}

export type DocumentRequestProblem = 'message-required' | 'needed-by-in-the-past';

export function documentRequestProblems(
  draft: DocumentRequestDraft,
  today: IsoDate,
): readonly DocumentRequestProblem[] {
  const problems: DocumentRequestProblem[] = [];

  // The message is what the applicant was told. An empty one leaves a record
  // that something was asked for without saying what, which is worse than no
  // record: it looks like the office followed up when it cannot show that.
  if (draft.message.trim().length === 0) {
    problems.push('message-required');
  }
  if (draft.neededBy !== null && draft.neededBy < today) {
    problems.push('needed-by-in-the-past');
  }

  return problems;
}

/**
 * Named for its subject rather than as a bare `isOverdue`: a case task is
 * overdue when *staff* are late, and a document request when the *applicant*
 * is. Two different obligations, and the barrel exports both.
 */
export function isDocumentRequestOverdue(request: DocumentRequest, today: IsoDate): boolean {
  return request.state === 'open' && request.neededBy !== null && request.neededBy < today;
}

/** Open requests first, then most recently asked. */
export function byRequestUrgency(a: DocumentRequest, b: DocumentRequest): number {
  if ((a.state === 'open') !== (b.state === 'open')) {
    return a.state === 'open' ? -1 : 1;
  }
  return a.requestedAt < b.requestedAt ? 1 : a.requestedAt > b.requestedAt ? -1 : 0;
}
