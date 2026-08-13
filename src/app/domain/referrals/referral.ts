import type { AuditStamp } from '../shared/audit';
import type {
  AssistanceRequestId,
  IsoDateTime,
  ReferralId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
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
  'draft' | 'sent' | 'acknowledged' | 'in-progress' | 'served' | 'declined' | 'closed';

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
  sent: ['acknowledged', 'declined', 'closed'],
  acknowledged: ['in-progress', 'declined', 'closed'],
  'in-progress': ['served', 'declined', 'closed'],
  served: ['closed'],
  declined: ['closed'],
  closed: [],
};

export interface Referral {
  readonly id: ReferralId;
  readonly referenceNumber: string;
  readonly residentId: ResidentId;
  readonly requestId: AssistanceRequestId | null;
  readonly destination: ReferralDestination;
  readonly destinationName: string;
  readonly status: ReferralStatus;
  readonly reason: string;
  readonly referredBy: StaffUserId;
  readonly referredAt: IsoDateTime;
  readonly respondedAt: IsoDateTime | null;
  readonly outcome: string | null;
  readonly audit: AuditStamp;
}

export interface ReferralFilter {
  readonly search?: string;
  readonly status?: ReferralStatus;
  readonly destination?: ReferralDestination;
}
