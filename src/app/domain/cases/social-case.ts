import type { Permission } from '../access/permission';
import type { AuditStamp } from '../shared/audit';
import type {
  AssistanceRequestId,
  BarangayId,
  CaseId,
  FamilyId,
  HouseholdId,
  IsoDate,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * A social welfare **case**: the office's continuing file on one person and the
 * people around them.
 *
 * Deliberately not the same thing as an assistance request. A request is one
 * intervention with a beginning and an end; a case is the thread that outlives
 * it — the medical grant in March, the child's schooling in June and the
 * follow-up visit in September are three interventions in one story (`DL-52`).
 * Modelling them as one record would mean either losing the history when a
 * request closes, or keeping requests open for years to hold it.
 */
export type CaseStatus =
  'intake' | 'assessment' | 'intervention' | 'monitoring' | 'on-hold' | 'referred-out' | 'closed';

/**
 * The phases of social case management as the office actually works them:
 * engagement and intake, assessment, planning and intervention, monitoring,
 * then termination. `on-hold` and `referred-out` are the two ways a case stops
 * moving without ending, and both are recordable states rather than silences.
 */
export const CASE_STATUS_CATALOG: StatusCatalog<CaseStatus> = {
  intake: {
    value: 'intake',
    label: 'Intake',
    tone: 'info',
    description: 'Opened and being screened. The presenting problem is recorded.',
  },
  assessment: {
    value: 'assessment',
    label: 'Assessment',
    tone: 'progress',
    description: 'A social worker is establishing the circumstances, usually by home visit.',
  },
  intervention: {
    value: 'intervention',
    label: 'Intervention',
    tone: 'progress',
    description: 'A plan is agreed and assistance or services are being delivered.',
  },
  monitoring: {
    value: 'monitoring',
    label: 'Monitoring',
    tone: 'info',
    description: 'Help has been delivered. The household is being followed up.',
  },
  'on-hold': {
    value: 'on-hold',
    label: 'On hold',
    tone: 'warning',
    description: 'Stalled for a recorded reason — unreachable household, awaiting a document.',
  },
  'referred-out': {
    value: 'referred-out',
    label: 'Referred out',
    tone: 'warning',
    description: 'Handled by another office or agency. The MSWDO keeps the record.',
  },
  closed: {
    value: 'closed',
    label: 'Closed',
    tone: 'neutral',
    description: 'Terminated with a recorded outcome. The file is kept in full.',
  },
};

/**
 * `closed` is terminal on purpose.
 *
 * A household whose situation recurs gets a **new** case that names the old one,
 * not a resurrected file. Reopening would make "when did this case end?" a
 * question with several answers, and the closure — with its outcome and its
 * date — is a fact about the office's work that should not be editable by
 * anyone who happens to see the family again (`DL-53`).
 */
export const CASE_STATUS_TRANSITIONS: StatusTransitions<CaseStatus> = {
  intake: ['assessment', 'referred-out', 'on-hold', 'closed'],
  assessment: ['intervention', 'referred-out', 'on-hold', 'closed'],
  intervention: ['monitoring', 'on-hold', 'referred-out', 'closed'],
  monitoring: ['intervention', 'on-hold', 'closed'],
  'on-hold': ['assessment', 'intervention', 'monitoring', 'closed'],
  'referred-out': ['monitoring', 'closed'],
  closed: [],
};

/**
 * Who may make each move.
 *
 * `CASE_STATUS_TRANSITIONS` says which moves are legal; this says who may make
 * them, exactly as `TRANSITION_PERMISSIONS` does for requests. Closure is held
 * apart from ordinary case work because ending the office's involvement with a
 * family is a decision, not a step.
 */
export const CASE_TRANSITION_PERMISSIONS: Readonly<Record<CaseStatus, Permission>> = {
  intake: 'case.manage',
  assessment: 'case.manage',
  intervention: 'case.manage',
  monitoring: 'case.manage',
  'on-hold': 'case.manage',
  'referred-out': 'case.manage',
  closed: 'case.close',
};

export function permissionForCaseTransition(to: CaseStatus): Permission {
  return CASE_TRANSITION_PERMISSIONS[to];
}

export function isCaseOpen(status: CaseStatus): boolean {
  return status !== 'closed';
}

/**
 * What kind of case this is, in the office's own vocabulary. Drives nothing —
 * it is how a supervisor finds the child protection files, not an input to any
 * entitlement.
 */
export type CaseCategory =
  | 'crisis-intervention'
  | 'child-protection'
  | 'family-welfare'
  | 'older-persons'
  | 'disability-support'
  | 'gender-based-violence'
  | 'livelihood';

export const CASE_CATEGORIES: readonly CaseCategory[] = [
  'crisis-intervention',
  'child-protection',
  'family-welfare',
  'older-persons',
  'disability-support',
  'gender-based-violence',
  'livelihood',
];

export interface SocialCase {
  readonly id: CaseId;
  /** Human-facing file number the office writes on paper. */
  readonly referenceNumber: string;
  /**
   * The person the file is about. A case has exactly one subject even when the
   * whole household is served, because responsibility has to land on a name.
   */
  readonly subjectResidentId: ResidentId;
  /** Where they live now. Null while between addresses — the household may move. */
  readonly householdId: HouseholdId | null;
  /** Who they belong to. Separate from the household, and separately nullable (`DL-47`). */
  readonly familyId: FamilyId | null;
  readonly barangayId: BarangayId;
  readonly category: CaseCategory;
  readonly status: CaseStatus;
  /** The presenting problem, in one sentence a colleague can act on. */
  readonly summary: string;
  readonly assignedTo: StaffUserId | null;
  /**
   * The interventions this case covers, named explicitly.
   *
   * Not inferred from "every request by this resident": a person may be the
   * subject of two cases at once — an older-persons file and a crisis
   * intervention after a fire — and a request belongs to one of them.
   */
  readonly linkedRequestIds: readonly AssistanceRequestId[];
  readonly openedOn: IsoDate;
  readonly closedOn: IsoDate | null;
  /** Set when this case continues one that was closed. Never a reopening. */
  readonly continuesCaseId: CaseId | null;
  readonly audit: AuditStamp;
}

export interface CaseFilter {
  readonly search?: string;
  readonly status?: CaseStatus;
  readonly category?: CaseCategory;
  readonly barangayId?: BarangayId;
  readonly assignedTo?: StaffUserId;
  readonly queue?: CaseQueueId;
}

export type CaseSortField = 'reference' | 'opened' | 'status' | 'nextAction' | 'updatedAt';

export function isCaseFilterActive(filter: CaseFilter): boolean {
  return (
    (filter.search ?? '').trim().length > 0 ||
    filter.status !== undefined ||
    filter.category !== undefined ||
    filter.barangayId !== undefined ||
    filter.assignedTo !== undefined ||
    (filter.queue !== undefined && filter.queue !== 'all')
  );
}

/* ── Work queues ───────────────────────────────────────────────────────────── */

/**
 * A queue is a question a caseworker asks at the start of the day, named once
 * so that the sidebar count, the list and the workspace cannot disagree about
 * what "overdue" means.
 */
export type CaseQueueId = 'mine' | 'unassigned' | 'overdue' | 'due-soon' | 'stalled' | 'all';

export const CASE_QUEUE_IDS: readonly CaseQueueId[] = [
  'mine',
  'unassigned',
  'overdue',
  'due-soon',
  'stalled',
  'all',
];

/** A case reduced to the few facts every queue predicate needs. */
export interface CaseQueueFacts {
  readonly status: CaseStatus;
  readonly assignedTo: StaffUserId | null;
  /** Days until the earliest open task is due. Negative when overdue. */
  readonly daysUntilNextAction: number | null;
  /** Days since anything at all was recorded on the case. */
  readonly daysSinceLastActivity: number | null;
}

export const DUE_SOON_DAYS = 7;
export const STALLED_AFTER_DAYS = 30;

/**
 * Queue membership, as one pure function.
 *
 * Closed cases fall out of every queue except `all`: a work queue that keeps
 * offering finished work is a queue people stop reading.
 */
export function isInQueue(
  queue: CaseQueueId,
  facts: CaseQueueFacts,
  viewerId: StaffUserId | null,
): boolean {
  if (queue === 'all') {
    return true;
  }
  if (!isCaseOpen(facts.status)) {
    return false;
  }
  switch (queue) {
    case 'mine':
      return viewerId !== null && facts.assignedTo === viewerId;
    case 'unassigned':
      return facts.assignedTo === null;
    case 'overdue':
      return facts.daysUntilNextAction !== null && facts.daysUntilNextAction < 0;
    case 'due-soon':
      return (
        facts.daysUntilNextAction !== null &&
        facts.daysUntilNextAction >= 0 &&
        facts.daysUntilNextAction <= DUE_SOON_DAYS
      );
    case 'stalled':
      return (
        facts.daysSinceLastActivity !== null && facts.daysSinceLastActivity >= STALLED_AFTER_DAYS
      );
  }
}

export interface CaseQueueCount {
  readonly queue: CaseQueueId;
  readonly count: number;
}

/* ── Reasons ───────────────────────────────────────────────────────────────── */

/**
 * The minimum a reason has to be before it is worth storing.
 *
 * Same threshold as a family transfer, for the same reason: "ok" recorded
 * against a status change is indistinguishable from no reason at all, and the
 * whole point of capturing one is that a colleague reading the file in two
 * years can tell why the office did what it did.
 */
export const CASE_REASON_MIN_LENGTH = 8;

export function isValidCaseReason(reason: string): boolean {
  return reason.trim().length >= CASE_REASON_MIN_LENGTH;
}
