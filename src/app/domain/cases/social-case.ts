import type { DataScope, Permission } from '../access/permission';
import type { AuditStamp } from '../shared/audit';
import type {
  AssistanceRequestId,
  BarangayId,
  CaseId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';
import { daysUntil, todayAsIsoDate } from './case-task';

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

/**
 * The words of a case withheld from this reader, by name, so a screen says "withheld" where they
 * would be and never shows a blank that reads as "nobody wrote anything" (`DL-38`, `DL-179`).
 *
 * - `summary`, `reasons`, `taskWords`, `notes`: the case is about a person under `vawc-survivor`
 *   or `cicl` today and the reader lacks `request.view-sensitive` — the rule and the key of a
 *   protected request. That reader cannot add to the case either.
 * - `householdContext`: the reader works a caseload (`assigned-cases`). A case admits its worker to
 *   the case and the person it is about, and does not widen what they read of the registry, so the
 *   subject's household and family are not named.
 */
export type CaseWithheldField = 'summary' | 'reasons' | 'taskWords' | 'notes' | 'householdContext';

/** What a protected case withholds from a reader without `request.view-sensitive`. */
export const PROTECTED_CASE_WITHHELD: readonly CaseWithheldField[] = [
  'summary',
  'reasons',
  'taskWords',
  'notes',
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
  /**
   * The subject's household today. Null while between addresses — the household may move — and
   * null when the household is withheld from this reader (`householdContext`, `DL-179`).
   *
   * There is no family on a case: who the subject belongs to is read from the families they are in
   * today, because a household is not a family and a family is not fixed (`DL-47`).
   */
  readonly householdId: HouseholdId | null;
  readonly barangayId: BarangayId;
  readonly category: CaseCategory;
  readonly status: CaseStatus;
  /**
   * The presenting problem, in one sentence a colleague can act on. `null` only when withheld from
   * this reader — `withheld` names it.
   */
  readonly summary: string | null;
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
  /** About a person under `vawc-survivor` or `cicl` today. Said even when nothing is withheld. */
  readonly isProtected: boolean;
  /** What this reader is not shown (`DL-179`). Empty for a reader cleared for all of it. */
  readonly withheld: readonly CaseWithheldField[];
  readonly audit: AuditStamp;
}

export function isCaseFieldWithheld(
  record: Pick<SocialCase, 'withheld'>,
  field: CaseWithheldField,
): boolean {
  return record.withheld.includes(field);
}

/**
 * Whether this reader may add anything to the case: nobody writes into a file whose words they
 * cannot read, and nothing is written on a closed one (`DL-53`, `DL-179`). The permission each act
 * needs is asked separately.
 */
export function isCaseWritable(record: Pick<SocialCase, 'status' | 'withheld'>): boolean {
  return isCaseOpen(record.status) && !isCaseFieldWithheld(record, 'summary');
}

/**
 * The list's filter. There is no sort and no page number: the server answers newest opened first, a
 * cursor page at a time (`DL-161`, `DL-179`). `search` is part of a case reference and nothing
 * else — the summary is free text, and matching on it would disclose it (`DL-109`).
 */
export interface CaseFilter {
  readonly search?: string;
  readonly status?: CaseStatus;
  readonly category?: CaseCategory;
  readonly barangayId?: BarangayId;
  readonly assignedTo?: StaffUserId;
  readonly residentId?: ResidentId;
  readonly queue?: CaseQueueId;
}

/** The shortest and longest search the server takes: part of a case reference. */
export const CASE_SEARCH_MIN_LENGTH = 2;
export const CASE_SEARCH_MAX_LENGTH = 40;

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

/**
 * The queue facts, derived on every read from the next action's due date and the moment anything
 * was last recorded — never stored, because a stored "days overdue" is wrong every morning until a
 * job runs (`DL-83`). Both adapters build them here, so the list, the counts and the workspace agree.
 */
export function caseQueueFacts(
  record: Pick<SocialCase, 'status' | 'assignedTo'>,
  nextActionDueOn: IsoDate | null,
  lastActivityAt: IsoDateTime | null,
  today: IsoDate = todayAsIsoDate(),
): CaseQueueFacts {
  return {
    status: record.status,
    assignedTo: record.assignedTo,
    daysUntilNextAction: nextActionDueOn === null ? null : daysUntil(nextActionDueOn, today),
    daysSinceLastActivity:
      lastActivityAt === null ? null : daysUntil(today, todayAsIsoDate(new Date(lastActivityAt))),
  };
}

/* ── Opening a case ────────────────────────────────────────────────────────── */

/** What opening a case takes (`DL-179`). Opened at intake, assigned to nobody. */
export interface CaseOpenDraft {
  readonly subjectResidentId: ResidentId;
  readonly category: CaseCategory;
  /** The presenting problem, between 8 and 500 characters. */
  readonly summary: string;
  /** A **closed** case this one continues, or `null`. Never a reopening (`DL-53`). */
  readonly continuesCaseId: CaseId | null;
  /** Filed requests about the subject or their household, each in no other case. May be empty. */
  readonly linkedRequestIds: readonly AssistanceRequestId[];
}

export const CASE_SUMMARY_MIN_LENGTH = 8;
export const CASE_SUMMARY_MAX_LENGTH = 500;

export type CaseOpenProblem = 'summary-too-short' | 'summary-too-long';

/** What stops a draft being sent. The server applies the same rules, and the rest. */
export function caseOpenProblems(
  draft: Pick<CaseOpenDraft, 'summary'>,
): readonly CaseOpenProblem[] {
  const summary = draft.summary.trim();
  if (summary.length < CASE_SUMMARY_MIN_LENGTH) {
    return ['summary-too-short'];
  }
  return summary.length > CASE_SUMMARY_MAX_LENGTH ? ['summary-too-long'] : [];
}

/* ── Who holds a case, and who owes its tasks ─────────────────────────────── */

/**
 * Whether this reader gives cases to people: `case.manage` from an account that is not itself a
 * caseload — intake, the head, an administrator. A social worker does not reassign their own case,
 * and the server refuses them the list of assignees (`DL-179`).
 */
export function assignsCases(scope: DataScope | null, holdsManage: boolean): boolean {
  return holdsManage && scope !== null && scope !== 'assigned-cases';
}

/**
 * Who a task may be owed by: the writer, whoever holds the case, or nobody yet (`DL-179`). Handing
 * a task to a social worker who does not hold the case would give them work on a file they cannot
 * open. Returned without duplicates, the writer first.
 */
export function taskAssigneeChoices(
  writerId: StaffUserId | null,
  caseAssignee: StaffUserId | null,
): readonly StaffUserId[] {
  const choices: StaffUserId[] = [];
  if (writerId !== null) {
    choices.push(writerId);
  }
  if (caseAssignee !== null && caseAssignee !== writerId) {
    choices.push(caseAssignee);
  }
  return choices;
}

export function isAllowedTaskAssignee(
  assignee: StaffUserId | null,
  writerId: StaffUserId | null,
  caseAssignee: StaffUserId | null,
): boolean {
  return assignee === null || taskAssigneeChoices(writerId, caseAssignee).includes(assignee);
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
