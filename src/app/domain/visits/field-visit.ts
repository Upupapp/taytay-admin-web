import type { AuditStamp } from '../shared/audit';
import type {
  CaseId,
  FieldVisitId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';
import type { VisitObservation } from './visit-observation';

/**
 * A home or field visit.
 *
 * **This is not a tracking product**, and the model is shaped so it cannot
 * quietly become one. There is no coordinate field, no check-in, no route, no
 * arrival timestamp taken from a device, and no field that records where a
 * worker was rather than what they found. `tools/check-visits.mjs` fails the
 * build if one appears.
 *
 * The master command forbids continuous location tracking, covert tracking,
 * geofencing of clients and background surveillance. Those are easy to refuse
 * as features and easy to acquire as fields, which is why the absence is
 * enforced rather than merely intended. A "visit location" column added in good
 * faith to help a supervisor plan routes is the first half of a system that
 * records where poor families live and who visited them when.
 *
 * What the visit *does* record is the address it was made to, which the
 * household registry already holds anyway, and what happened there.
 */

export type VisitPurpose =
  | 'initial-assessment'
  | 'verification'
  | 'follow-up'
  | 'monitoring'
  | 'crisis-response'
  | 'document-collection';

export const VISIT_PURPOSES: readonly VisitPurpose[] = [
  'initial-assessment',
  'verification',
  'follow-up',
  'monitoring',
  'crisis-response',
  'document-collection',
];

export const VISIT_PURPOSE_LABELS: Readonly<Record<VisitPurpose, string>> = {
  'initial-assessment': 'Initial assessment',
  verification: 'Verification',
  'follow-up': 'Follow-up',
  monitoring: 'Monitoring',
  'crisis-response': 'Crisis response',
  'document-collection': 'Collecting documents',
};

export type VisitStatus =
  | 'scheduled'
  | 'completed'
  | 'not-found'
  | 'refused'
  | 'cancelled';

export const VISIT_STATUS_CATALOG: StatusCatalog<VisitStatus> = {
  scheduled: {
    value: 'scheduled',
    label: 'Scheduled',
    tone: 'info',
    description: 'Planned. Not yet made.',
  },
  completed: {
    value: 'completed',
    label: 'Completed',
    tone: 'success',
    description: 'The worker reached the household and recorded what they found.',
  },
  // Held apart from `refused`, and both apart from `cancelled`. "Nobody was
  // home" and "the family asked us to leave" are different facts about a
  // household, and only one of them should ever colour how the next visit is
  // planned.
  'not-found': {
    value: 'not-found',
    label: 'Nobody home',
    tone: 'warning',
    description: 'The worker attended and found nobody. The household did nothing.',
  },
  refused: {
    value: 'refused',
    label: 'Declined by the household',
    tone: 'warning',
    description: 'The household declined the visit. Their reason is recorded if they gave one.',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    tone: 'neutral',
    description: 'Called off by the office before it was made.',
  },
};

export const VISIT_STATUS_TRANSITIONS: StatusTransitions<VisitStatus> = {
  scheduled: ['completed', 'not-found', 'refused', 'cancelled'],
  // Every outcome is terminal. A visit that happened, happened; a second
  // attempt is a second visit, so "how many times did we go?" keeps one answer.
  completed: [],
  'not-found': [],
  refused: [],
  cancelled: [],
};

export function isVisitOpen(status: VisitStatus): boolean {
  return status === 'scheduled';
}

/** The visit was attended, whatever the household did when the worker arrived. */
export function wasAttended(status: VisitStatus): boolean {
  return status === 'completed' || status === 'not-found' || status === 'refused';
}

/* ── The checklist ────────────────────────────────────────────────────────── */

/**
 * What the worker set out to check. A prompt, never a score: the answers feed
 * the observations a person writes, and nothing derives an eligibility or a
 * vulnerability rating from them (`DL-42`).
 */
export interface VisitChecklistItem {
  readonly code: string;
  readonly label: string;
  readonly checked: boolean;
  readonly note: string | null;
}

export interface FieldVisit {
  readonly id: FieldVisitId;
  readonly referenceNumber: string;
  readonly caseId: CaseId | null;
  readonly residentId: ResidentId;
  readonly householdId: HouseholdId | null;
  readonly status: VisitStatus;
  readonly purpose: VisitPurpose;
  readonly assignedTo: StaffUserId;
  readonly scheduledFor: IsoDate;
  /** Roughly when, in the office's own words: "morning", "after 2pm". */
  readonly scheduledWindow: string | null;
  /**
   * The address visited, copied from the household record at scheduling.
   *
   * Copied rather than referenced because a household that moves must not
   * silently rewrite where a past visit was made — the record would then claim
   * the worker went somewhere they did not.
   */
  readonly addressVisited: string;
  readonly checklist: readonly VisitChecklistItem[];
  readonly observations: readonly VisitObservation[];
  /** What the household needs, in the worker's words. Feeds the follow-up. */
  readonly serviceNeeds: string | null;
  /** Why the household declined, if they said. Only for `refused`. */
  readonly declinedReason: string | null;
  readonly outcome: string | null;
  readonly completedAt: IsoDateTime | null;
  readonly audit: AuditStamp;
}

/* ── Scheduling and filtering ─────────────────────────────────────────────── */

export interface FieldVisitFilter {
  readonly search?: string;
  readonly status?: VisitStatus;
  readonly purpose?: VisitPurpose;
  readonly assignedTo?: StaffUserId;
  readonly residentId?: ResidentId;
  readonly caseId?: CaseId;
  readonly from?: IsoDate;
  readonly to?: IsoDate;
  /** Scheduled, and the date has passed. */
  readonly overdueOnly?: boolean;
}

export const EMPTY_VISIT_FILTER: FieldVisitFilter = {};

export function isVisitFilterActive(filter: FieldVisitFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.status !== undefined ||
    filter.purpose !== undefined ||
    filter.assignedTo !== undefined ||
    filter.residentId !== undefined ||
    filter.caseId !== undefined ||
    filter.from !== undefined ||
    filter.to !== undefined ||
    filter.overdueOnly === true
  );
}

export type FieldVisitSortField = 'scheduledFor' | 'status' | 'purpose';

/** A visit still scheduled after its date. The worker owes it, not the family. */
export function isVisitOverdue(visit: FieldVisit, today: IsoDate): boolean {
  return isVisitOpen(visit.status) && visit.scheduledFor < today;
}

export function isDueToday(visit: FieldVisit, today: IsoDate): boolean {
  return isVisitOpen(visit.status) && visit.scheduledFor === today;
}

export function isUpcoming(visit: FieldVisit, today: IsoDate): boolean {
  return isVisitOpen(visit.status) && visit.scheduledFor > today;
}

/** Overdue first, then soonest. The order a worker plans their day in. */
export function byVisitDate(a: FieldVisit, b: FieldVisit): number {
  return a.scheduledFor < b.scheduledFor ? -1 : a.scheduledFor > b.scheduledFor ? 1 : 0;
}

/** Calendar buckets for the day-grouped view. */
export interface VisitDay {
  readonly date: IsoDate;
  readonly visits: readonly FieldVisit[];
}

export function groupVisitsByDay(visits: readonly FieldVisit[]): readonly VisitDay[] {
  const days: VisitDay[] = [];
  for (const visit of [...visits].sort(byVisitDate)) {
    const current = days.at(-1);
    if (current !== undefined && current.date === visit.scheduledFor) {
      days[days.length - 1] = { date: current.date, visits: [...current.visits, visit] };
      continue;
    }
    days.push({ date: visit.scheduledFor, visits: [visit] });
  }
  return days;
}

/* ── Drafting ─────────────────────────────────────────────────────────────── */

export interface FieldVisitDraft {
  readonly caseId: CaseId | null;
  readonly residentId: ResidentId;
  readonly householdId: HouseholdId | null;
  readonly purpose: VisitPurpose;
  readonly assignedTo: StaffUserId;
  readonly scheduledFor: IsoDate;
  readonly scheduledWindow: string | null;
  readonly addressVisited: string;
  readonly checklist: readonly VisitChecklistItem[];
}

export type VisitDraftProblem =
  | 'address-required'
  | 'assignee-required'
  | 'scheduled-in-the-past';

export function visitDraftProblems(
  draft: FieldVisitDraft,
  today: IsoDate,
): readonly VisitDraftProblem[] {
  const problems: VisitDraftProblem[] = [];

  if (draft.addressVisited.trim().length === 0) {
    problems.push('address-required');
  }
  if (draft.assignedTo.trim().length === 0) {
    problems.push('assignee-required');
  }
  if (draft.scheduledFor < today) {
    problems.push('scheduled-in-the-past');
  }

  return problems;
}

/**
 * What closing a visit records.
 *
 * `declinedReason` belongs to `refused` alone: attaching one to a completed
 * visit would put words in a household's mouth, and attaching none to a refusal
 * loses the only thing the family actually said.
 */
export interface VisitOutcomeDraft {
  readonly status: Exclude<VisitStatus, 'scheduled'>;
  readonly outcome: string;
  readonly serviceNeeds: string | null;
  readonly declinedReason: string | null;
}

export type VisitOutcomeProblem =
  | 'outcome-required'
  | 'declined-reason-not-applicable'
  | 'not-a-closing-status';

export function visitOutcomeProblems(
  draft: VisitOutcomeDraft,
): readonly VisitOutcomeProblem[] {
  const problems: VisitOutcomeProblem[] = [];

  if (draft.outcome.trim().length === 0) {
    problems.push('outcome-required');
  }
  if (draft.status !== 'refused' && (draft.declinedReason ?? '').trim().length > 0) {
    problems.push('declined-reason-not-applicable');
  }
  if (!(['completed', 'not-found', 'refused', 'cancelled'] as string[]).includes(draft.status)) {
    problems.push('not-a-closing-status');
  }

  return problems;
}

export class VisitInvalidError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super('That visit needs correcting before it can be saved.');
    this.name = 'VisitInvalidError';
    this.problems = problems;
  }
}

export function isVisitInvalid(error: unknown): error is VisitInvalidError {
  return error instanceof VisitInvalidError;
}
