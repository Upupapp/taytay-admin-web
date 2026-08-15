import type { AuditStamp } from '../shared/audit';
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

export type RequirementStatus = 'pending' | 'submitted' | 'verified' | 'rejected' | 'waived';

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
};

export interface SubmittedRequirement {
  readonly id: RequirementId;
  readonly code: string;
  readonly label: string;
  readonly status: RequirementStatus;
  readonly isMandatory: boolean;
  readonly submittedAt: IsoDateTime | null;
  readonly reviewedBy: StaffUserId | null;
  readonly remarks: string | null;
}

export type RequestNoteVisibility = 'internal' | 'shared-with-applicant';

export interface RequestNote {
  readonly id: RequestNoteId;
  readonly requestId: AssistanceRequestId;
  readonly authorId: StaffUserId;
  readonly authorName: string;
  readonly body: string;
  readonly visibility: RequestNoteVisibility;
  readonly createdAt: IsoDateTime;
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

export function outstandingRequirements(
  request: AssistanceRequest,
): readonly SubmittedRequirement[] {
  return request.requirements.filter(
    (requirement) =>
      requirement.isMandatory &&
      requirement.status !== 'verified' &&
      requirement.status !== 'waived',
  );
}
