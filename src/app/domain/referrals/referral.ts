import type { AuditStamp } from '../shared/audit';
import type {
  AssistanceRequestId,
  CaseId,
  IsoDate,
  IsoDateTime,
  ReferralId,
  ReferralNoteId,
  ResidentId,
  ServiceProviderId,
  StaffUserId,
} from '../shared/ids';
import type { DisclosurePlan } from './referral-disclosure';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * Where a case is routed when it exceeds the MSWDO's own mandate — for example
 * a hospital's medical social-welfare unit, DSWD field office, PESO for
 * employment, or the WCPD for protection cases.
 */
export type ReferralDestination =
  | 'dswd-field-office'
  | 'hospital-msw'
  | 'philhealth'
  | 'peso'
  | 'barangay-vaw-desk'
  | 'women-and-children-protection-desk'
  | 'other-lgu-office'
  | 'ngo-partner';

/** Every kind of organisation the office refers into, in the order a caseworker scans them. */
export const REFERRAL_DESTINATIONS: readonly ReferralDestination[] = [
  'dswd-field-office',
  'hospital-msw',
  'philhealth',
  'peso',
  'barangay-vaw-desk',
  'women-and-children-protection-desk',
  'other-lgu-office',
  'ngo-partner',
];

export const REFERRAL_DESTINATION_LABELS: Readonly<Record<ReferralDestination, string>> = {
  'dswd-field-office': 'DSWD field office',
  'hospital-msw': 'Hospital medical social worker',
  philhealth: 'PhilHealth',
  peso: 'Public Employment Service Office',
  'barangay-vaw-desk': 'Barangay VAW desk',
  'women-and-children-protection-desk': 'Women and Children Protection Desk',
  'other-lgu-office': 'Other LGU office',
  'ngo-partner': 'NGO partner',
};

export type ReferralStatus =
  | 'draft'
  | 'sent'
  | 'acknowledged'
  | 'in-progress'
  | 'waiting-requirements'
  | 'served'
  | 'declined'
  | 'closed';

export const REFERRAL_STATUS_CATALOG: StatusCatalog<ReferralStatus> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    tone: 'neutral',
    description: 'Prepared but not yet transmitted.',
  },
  sent: {
    value: 'sent',
    label: 'Sent',
    tone: 'info',
    description: 'Transmitted to the receiving office.',
  },
  acknowledged: {
    value: 'acknowledged',
    label: 'Acknowledged',
    tone: 'info',
    description: 'Receipt confirmed by the receiving office.',
  },
  'in-progress': {
    value: 'in-progress',
    label: 'In progress',
    tone: 'progress',
    description: 'Being acted on by the receiving office.',
  },
  // Part of the universal status vocabulary every module is asked to stay
  // compatible with, not a referral-specific invention. It is also the state
  // an applicant most needs told apart from 'in progress': one means wait,
  // the other means bring something.
  'waiting-requirements': {
    value: 'waiting-requirements',
    label: 'Waiting requirements',
    tone: 'warning',
    description: 'The receiving office is waiting for something from the client.',
  },
  served: {
    value: 'served',
    label: 'Served',
    tone: 'success',
    description: 'Service delivered to the client.',
  },
  declined: {
    value: 'declined',
    label: 'Declined',
    tone: 'danger',
    description: 'Not accepted. The reason is recorded.',
  },
  closed: {
    value: 'closed',
    label: 'Closed',
    tone: 'neutral',
    description: 'Referral closed out by the MSWDO.',
  },
};

export const REFERRAL_STATUS_TRANSITIONS: StatusTransitions<ReferralStatus> = {
  draft: ['sent', 'closed'],
  sent: ['acknowledged', 'waiting-requirements', 'declined', 'closed'],
  acknowledged: ['in-progress', 'waiting-requirements', 'declined', 'closed'],
  'in-progress': ['waiting-requirements', 'served', 'declined', 'closed'],
  // Returns to progress once the client supplies what was asked for. The one
  // loop in the lifecycle, and it exists because families routinely come back
  // with the missing paper.
  'waiting-requirements': ['in-progress', 'served', 'declined', 'closed'],
  served: ['closed'],
  declined: ['closed'],
  closed: [],
};

/** Still with the receiving office, and still the MSWDO's to chase. */
export function isReferralOpen(status: ReferralStatus): boolean {
  return status !== 'closed' && status !== 'declined';
}

/**
 * How soon the receiving office is being asked to act.
 *
 * Advisory to them and operational to us: it sets the default follow-up date
 * and orders our own queue. It confers no priority the MSWDO can actually grant
 * over another office's work, and the screens must not imply otherwise.
 */
export type ReferralUrgency = 'routine' | 'priority' | 'urgent';

export const REFERRAL_URGENCIES: readonly ReferralUrgency[] = ['routine', 'priority', 'urgent'];

export const REFERRAL_URGENCY_LABELS: Readonly<Record<ReferralUrgency, string>> = {
  routine: 'Routine',
  priority: 'Priority',
  urgent: 'Urgent',
};

/** Days before this office chases, by urgency. The office's own convention. */
export const FOLLOW_UP_DAYS: Readonly<Record<ReferralUrgency, number>> = {
  routine: 14,
  priority: 7,
  urgent: 2,
};

export const FOLLOW_UP_BASIS =
  'Office convention for when to chase a referral, pending confirmation against a written issuance.';

export interface ReferralNote {
  readonly id: ReferralNoteId;
  readonly body: string;
  readonly authorId: StaffUserId;
  readonly authorName: string;
  readonly recordedAt: IsoDateTime;
}

export interface Referral {
  readonly id: ReferralId;
  readonly referenceNumber: string;
  readonly residentId: ResidentId;
  readonly requestId: AssistanceRequestId | null;
  /**
   * The continuing case this referral belongs to, where there is one.
   *
   * Separate from `requestId` because a case outlives its interventions
   * (`DL-52`): a family may be referred to a hospital's medical social worker
   * with no assistance request open at the time.
   */
  readonly caseId: CaseId | null;
  readonly destination: ReferralDestination;
  readonly destinationName: string;
  /** The directory entry, where the destination is one the office keeps on file. */
  readonly providerId: ServiceProviderId | null;
  readonly status: ReferralStatus;
  readonly urgency: ReferralUrgency;
  /** What is being asked for, in the words the receiving office will read. */
  readonly serviceRequested: string;
  readonly reason: string;
  /** Who at the receiving office, where a named person was reached. */
  readonly destinationContact: string | null;
  /**
   * The lawful basis and the fields chosen for disclosure (`DL-81`, `DL-82`).
   * `null` on a draft, and **required before the referral can be sent**.
   */
  readonly disclosure: DisclosurePlan | null;
  readonly referredBy: StaffUserId;
  readonly referredAt: IsoDateTime;
  /** When this office intends to chase. Derived from urgency, then editable. */
  readonly followUpOn: IsoDate | null;
  readonly respondedAt: IsoDateTime | null;
  readonly outcome: string | null;
  /** Notes passed between offices about this referral. Append-only. */
  readonly handoffNotes: readonly ReferralNote[];
  readonly audit: AuditStamp;
}

/** A referral this office said it would chase by now, and has not heard about. */
export function isReferralOverdue(referral: Referral, today: IsoDate): boolean {
  return (
    isReferralOpen(referral.status) &&
    referral.respondedAt === null &&
    referral.followUpOn !== null &&
    referral.followUpOn < today
  );
}

/**
 * The default date to chase, counted from the day it was sent.
 *
 * A default, not a rule: the screen offers it and a worker may change it. A
 * provider that answers in a day and one that answers in a month are both real,
 * and neither is described by a constant.
 */
export function defaultFollowUpDate(sentOn: IsoDate, urgency: ReferralUrgency): IsoDate {
  const date = new Date(`${sentOn}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + FOLLOW_UP_DAYS[urgency]);
  return date.toISOString().slice(0, 10) as IsoDate;
}

/** Overdue first, then most urgent, then oldest — the order a queue is worked in. */
export function byReferralUrgency(a: Referral, b: Referral, today: IsoDate): number {
  const overdue = Number(isReferralOverdue(b, today)) - Number(isReferralOverdue(a, today));
  if (overdue !== 0) {
    return overdue;
  }
  const rank: Readonly<Record<ReferralUrgency, number>> = { urgent: 0, priority: 1, routine: 2 };
  const byUrgency = rank[a.urgency] - rank[b.urgency];
  if (byUrgency !== 0) {
    return byUrgency;
  }
  return a.referredAt < b.referredAt ? -1 : a.referredAt > b.referredAt ? 1 : 0;
}


export interface ReferralFilter {
  readonly search?: string;
  readonly status?: ReferralStatus;
  readonly destination?: ReferralDestination;
  readonly urgency?: ReferralUrgency;
  readonly residentId?: ResidentId;
  readonly caseId?: CaseId;
  /** Only referrals the office undertook to chase and has not heard about. */
  readonly overdueOnly?: boolean;
  readonly openOnly?: boolean;
}

export const EMPTY_REFERRAL_FILTER: ReferralFilter = {};

export function isReferralFilterActive(filter: ReferralFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.status !== undefined ||
    filter.destination !== undefined ||
    filter.urgency !== undefined ||
    filter.residentId !== undefined ||
    filter.caseId !== undefined ||
    filter.overdueOnly === true ||
    filter.openOnly === true
  );
}

export type ReferralSortField = 'referredAt' | 'urgency' | 'status' | 'followUpOn';

/**
 * What the create form submits. Identity, reference number, time and actor are
 * the store's, like every other draft in this application.
 */
export interface ReferralDraft {
  readonly residentId: ResidentId;
  readonly requestId: AssistanceRequestId | null;
  readonly caseId: CaseId | null;
  readonly providerId: ServiceProviderId | null;
  readonly destination: ReferralDestination;
  readonly destinationName: string;
  readonly destinationContact: string | null;
  readonly urgency: ReferralUrgency;
  readonly serviceRequested: string;
  readonly reason: string;
  readonly followUpOn: IsoDate | null;
}

export type ReferralDraftProblem =
  | 'service-required'
  | 'reason-required'
  | 'destination-required'
  | 'follow-up-in-the-past';

export function referralDraftProblems(
  draft: ReferralDraft,
  today: IsoDate,
): readonly ReferralDraftProblem[] {
  const problems: ReferralDraftProblem[] = [];

  if (draft.serviceRequested.trim().length === 0) {
    problems.push('service-required');
  }
  if (draft.reason.trim().length === 0) {
    problems.push('reason-required');
  }
  if (draft.destinationName.trim().length === 0) {
    problems.push('destination-required');
  }
  if (draft.followUpOn !== null && draft.followUpOn < today) {
    problems.push('follow-up-in-the-past');
  }

  return problems;
}

export class ReferralDraftInvalidError extends Error {
  readonly problems: readonly ReferralDraftProblem[];

  constructor(problems: readonly ReferralDraftProblem[]) {
    super('That referral needs correcting before it can be saved.');
    this.name = 'ReferralDraftInvalidError';
    this.problems = problems;
  }
}

export function isReferralDraftInvalid(error: unknown): error is ReferralDraftInvalidError {
  return error instanceof ReferralDraftInvalidError;
}

