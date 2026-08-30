import type { AuditStamp } from '../shared/audit';
import type { AssessmentRecommendation } from '../intake/assessment';
import type { CaseNoteSensitivity } from '../cases/case-note';
import type {
  AssistanceRequestId,
  BarangayId,
  RequestNoteId,
  IsoDateTime,
  ProgramId,
  RequirementId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { Money } from '../shared/money';
import type { RequirementDocument } from '../requirements/requirement-document';
import type {
  ConditionalApplicability,
  RequirementObligation,
} from '../requirements/requirement-obligation';
import { isOutstandingObligation } from '../requirements/requirement-obligation';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * The MSWDO assistance lifecycle.
 *
 * draft → submitted → intake-review → assessment → endorsed → approved
 *       → scheduled → released → completed
 *
 * `returned` is the "needs more from the applicant" branch and re-enters at
 * intake-review. `rejected`, `cancelled`, `expired` and `completed` are
 * terminal. This ordering mirrors the standard AICS flow: intake and document
 * validation, social-worker assessment (case study), head endorsement/approval,
 * payout scheduling, then release and post-release closure.
 */
export type AssistanceRequestStatus =
  | 'draft'
  | 'submitted'
  | 'intake-review'
  | 'returned'
  | 'assessment'
  | 'endorsed'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'released'
  | 'completed'
  | 'cancelled'
  | 'expired';

export const ASSISTANCE_STATUS_CATALOG: StatusCatalog<AssistanceRequestStatus> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    tone: 'neutral',
    description: 'Started but not yet submitted for review.',
  },
  submitted: {
    value: 'submitted',
    label: 'Submitted',
    tone: 'info',
    description: 'Filed by or for the applicant. Awaiting intake.',
  },
  'intake-review': {
    value: 'intake-review',
    label: 'Intake review',
    tone: 'progress',
    description: 'Frontline staff validating identity and requirements.',
  },
  returned: {
    value: 'returned',
    label: 'Returned',
    tone: 'warning',
    description: 'Sent back to the applicant for missing or invalid requirements.',
  },
  assessment: {
    value: 'assessment',
    label: 'Assessment',
    tone: 'progress',
    description: 'Social worker conducting the case study or home visit.',
  },
  endorsed: {
    value: 'endorsed',
    label: 'Endorsed',
    tone: 'progress',
    description: 'Recommended by the social worker. Awaiting approval.',
  },
  approved: {
    value: 'approved',
    label: 'Approved',
    tone: 'success',
    description: 'Approved by the MSWDO head. Awaiting payout scheduling.',
  },
  rejected: {
    value: 'rejected',
    label: 'Rejected',
    tone: 'danger',
    description: 'Denied. The reason is recorded on the request.',
  },
  scheduled: {
    value: 'scheduled',
    label: 'Scheduled',
    tone: 'info',
    description: 'Payout date and channel set. Awaiting release.',
  },
  released: {
    value: 'released',
    label: 'Released',
    tone: 'success',
    description: 'Assistance handed over to the beneficiary.',
  },
  completed: {
    value: 'completed',
    label: 'Completed',
    tone: 'success',
    description: 'Closed after post-release validation.',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    tone: 'neutral',
    description: 'Withdrawn by the applicant or voided by staff.',
  },
  expired: {
    value: 'expired',
    label: 'Expired',
    tone: 'danger',
    description: 'Approval lapsed before the grant was claimed.',
  },
};

export const ASSISTANCE_STATUS_TRANSITIONS: StatusTransitions<AssistanceRequestStatus> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['intake-review', 'cancelled'],
  'intake-review': ['assessment', 'returned', 'rejected', 'cancelled'],
  returned: ['intake-review', 'cancelled', 'expired'],
  assessment: ['endorsed', 'returned', 'rejected', 'cancelled'],
  endorsed: ['approved', 'rejected', 'returned', 'cancelled'],
  approved: ['scheduled', 'cancelled', 'expired'],
  rejected: [],
  scheduled: ['released', 'cancelled', 'expired'],
  released: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
};

export const TERMINAL_ASSISTANCE_STATUSES: readonly AssistanceRequestStatus[] = [
  'rejected',
  'completed',
  'cancelled',
  'expired',
];

export function isTerminalAssistanceStatus(status: AssistanceRequestStatus): boolean {
  return TERMINAL_ASSISTANCE_STATUSES.includes(status);
}

export type RequirementStatus =
  | 'pending'
  | 'submitted'
  | 'verified'
  | 'rejected'
  | 'waived'
  | 'expired'
  | 'needs-replacement';

export const REQUIREMENT_STATUS_CATALOG: StatusCatalog<RequirementStatus> = {
  pending: {
    value: 'pending',
    label: 'Pending',
    tone: 'neutral',
    description: 'Not yet provided by the applicant.',
  },
  submitted: {
    value: 'submitted',
    label: 'Submitted',
    tone: 'info',
    description: 'Provided. Awaiting verification.',
  },
  verified: {
    value: 'verified',
    label: 'Verified',
    tone: 'success',
    description: 'Checked and accepted by staff.',
  },
  rejected: {
    value: 'rejected',
    label: 'Rejected',
    tone: 'danger',
    description: 'Unacceptable. A replacement is required.',
  },
  waived: {
    value: 'waived',
    label: 'Waived',
    tone: 'warning',
    description: 'Excused for a documented reason.',
  },
  // Held apart from `rejected`: the applicant did nothing wrong, and telling
  // somebody their certificate was "rejected" when it simply lapsed is both
  // inaccurate and needlessly bruising at a counter.
  expired: {
    value: 'expired',
    label: 'Expired',
    tone: 'warning',
    description: 'Was valid when presented. Now past its expiry date.',
  },
  'needs-replacement': {
    value: 'needs-replacement',
    label: 'Needs replacement',
    tone: 'warning',
    description: 'A fresh copy is needed — damaged, illegible or superseded.',
  },
};

export interface SubmittedRequirement {
  readonly id: RequirementId;
  readonly code: string;
  readonly label: string;
  readonly status: RequirementStatus;
  /**
   * Replaced the `isMandatory` boolean in TAB 14 (`DL-76`). A boolean cannot
   * express "only if you are claiming for a child", so a conditional document
   * had to be recorded as required — making every applicant who did not need it
   * look incomplete.
   */
  readonly obligation: RequirementObligation;
  /** Whether a conditional document applies here. A person decides (`DL-76`). */
  readonly applicability: ConditionalApplicability;
  /** The circumstances a conditional document is needed in, in words. */
  readonly appliesWhen: string | null;
  /** Who ruled on applicability, and why. Both `null` while undecided. */
  readonly applicabilityDecidedBy: StaffUserId | null;
  readonly applicabilityReason: string | null;
  readonly submittedAt: IsoDateTime | null;
  readonly reviewedBy: StaffUserId | null;
  readonly reviewedAt: IsoDateTime | null;
  readonly remarks: string | null;
  /** What was presented against it, with every version ever presented (`DL-77`). */
  readonly document: RequirementDocument | null;
}

/**
 * A note on an assistance request, as a particular viewer is allowed to see it.
 *
 * ## Why this is not `CaseNoteView`
 *
 * The two are the same shape and deliberately not the same type. `DL-52` is explicit that **a case
 * is not an assistance request** — a case is the office's continuing involvement with a household
 * and a request is one intervention inside it — so a note keyed on `AssistanceRequestId` cannot be
 * typed as one keyed on `CaseId` without asserting the thing that entry exists to deny.
 *
 * What they *do* share is the disclosure rule, and that is shared properly: the `sensitivity` union
 * and its permission map come from `domain/cases/case-note.ts` rather than being restated here. A
 * second vocabulary for the same tier is what `DL-122` refuses for permissions, for the same
 * reason — the checker that generates the office reference would not see it.
 *
 * ## `body` is nullable, and the entry is still listed
 *
 * `DL-58`. A withheld note is **removed by the data layer, not hidden by a template** (`DL-38`), so
 * a screen cannot leak a paragraph it never received. Its existence, its author and its time are
 * still disclosed: a caseworker who cannot see that three restricted entries exist will read the
 * file as complete and act as though nothing happened. Knowing a record is there, and that it is
 * not yours to read, is what makes it possible to ask the right person.
 *
 * ## `visibility` is gone
 *
 * It was `internal | shared-with-applicant`, and **nothing could produce the second value**: the
 * office record holds one axis, how closely a note is held, and no notion of a note shown to the
 * applicant. A field a screen could set and no system of record carries is the defect `DL-151`
 * found on a document request's `withdrawn` state. The capability is recorded as a gap rather than
 * modelled here (`DL-158`).
 */
export interface RequestNote {
  readonly id: RequestNoteId;
  readonly requestId: AssistanceRequestId;
  readonly authorId: StaffUserId | null;
  readonly authorName: string;
  /** `null` when this viewer may not read it. The row is still here. */
  readonly body: string | null;
  readonly isWithheld: boolean;
  readonly sensitivity: CaseNoteSensitivity;
  readonly createdAt: IsoDateTime;
}

/** Derived, never read from the wire — the same rule as every other count (`DL-83`). */
export function withheldRequestNoteCount(notes: readonly RequestNote[]): number {
  return notes.filter((note) => note.isWithheld).length;
}

/** One recorded move through the lifecycle. Append-only. */
export interface StatusChange {
  readonly from: AssistanceRequestStatus | null;
  readonly to: AssistanceRequestStatus;
  readonly reason: string | null;
  readonly actorId: StaffUserId | null;
  readonly actorName: string;
  readonly occurredAt: IsoDateTime;
}

export interface SocialWorkerAssessment {
  readonly assessedBy: StaffUserId;
  readonly assessedAt: IsoDateTime;
  readonly findings: string;
  readonly recommendedAmount: Money | null;
  readonly homeVisitConducted: boolean;
  /**
   * What the assessor advised. Nullable because assessments recorded before the console asked for
   * one carry none — and an absent recommendation is not the same claim as "insufficient
   * information", which somebody chose.
   */
  readonly recommendation: AssessmentRecommendation | null;
  /** Why, when the recommendation was refusal. The server requires it for that one value. */
  readonly recommendationReason: string | null;
}

export interface AssistanceRequest {
  readonly id: AssistanceRequestId;
  /** Human-facing control number printed on the applicant's copy. */
  readonly referenceNumber: string;
  readonly residentId: ResidentId;
  readonly programId: ProgramId;
  readonly barangayId: BarangayId;
  readonly status: AssistanceRequestStatus;
  readonly requestedAmount: Money | null;
  readonly approvedAmount: Money | null;
  readonly reasonForRequest: string;
  readonly assignedTo: StaffUserId | null;
  readonly requirements: readonly SubmittedRequirement[];
  readonly assessment: SocialWorkerAssessment | null;
  readonly statusHistory: readonly StatusChange[];
  readonly decisionRemarks: string | null;
  readonly submittedAt: IsoDateTime | null;
  readonly audit: AuditStamp;
}

export interface AssistanceRequestFilter {
  readonly search?: string;
  readonly status?: AssistanceRequestStatus;
  readonly programId?: ProgramId;
  readonly barangayId?: BarangayId;
  readonly assignedTo?: StaffUserId;
  readonly openOnly?: boolean;
}

export type AssistanceRequestSortField = 'referenceNumber' | 'status' | 'submittedAt' | 'updatedAt';

/**
 * Documents this applicant still owes.
 *
 * Reads `isOutstandingObligation` rather than a boolean, so a conditional
 * document nobody has ruled on is not counted against the applicant, and one
 * ruled applicable is counted exactly like a required one (`DL-76`).
 */
export function outstandingRequirements(
  request: AssistanceRequest,
): readonly SubmittedRequirement[] {
  return request.requirements.filter(
    (requirement) =>
      isOutstandingObligation(requirement.obligation, requirement.applicability) &&
      requirement.status !== 'verified' &&
      requirement.status !== 'waived',
  );
}
