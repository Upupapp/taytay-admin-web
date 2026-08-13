import type { AuditStamp } from '../shared/audit';
import type {
  AssistanceRequestId,
  DisbursementId,
  IsoDate,
  IsoDateTime,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { Money } from '../shared/money';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

export type PayoutMethod = 'cash' | 'check' | 'e-wallet' | 'bank-transfer' | 'in-kind';

export const PAYOUT_METHOD_LABELS: Readonly<Record<PayoutMethod, string>> = {
  cash: 'Cash',
  check: 'Check',
  'e-wallet': 'E-wallet',
  'bank-transfer': 'Bank transfer',
  'in-kind': 'In-kind goods',
};

export type DisbursementStatus =
  'pending' | 'scheduled' | 'released' | 'claimed' | 'unclaimed' | 'voided';

export const DISBURSEMENT_STATUS_CATALOG: StatusCatalog<DisbursementStatus> = {
  pending: {
    value: 'pending',
    label: 'Pending',
    tone: 'neutral',
    description: 'Awaiting a payout schedule.',
  },
  scheduled: {
    value: 'scheduled',
    label: 'Scheduled',
    tone: 'info',
    description: 'Payout date and channel confirmed.',
  },
  released: {
    value: 'released',
    label: 'Released',
    tone: 'progress',
    description: 'Funds or goods issued by the disbursing officer.',
  },
  claimed: {
    value: 'claimed',
    label: 'Claimed',
    tone: 'success',
    description: 'Receipt acknowledged by the beneficiary.',
  },
  unclaimed: {
    value: 'unclaimed',
    label: 'Unclaimed',
    tone: 'warning',
    description: 'Not collected within the payout window.',
  },
  voided: {
    value: 'voided',
    label: 'Voided',
    tone: 'danger',
    description: 'Cancelled before release. Funds returned to the programme.',
  },
};

export const DISBURSEMENT_STATUS_TRANSITIONS: StatusTransitions<DisbursementStatus> = {
  pending: ['scheduled', 'voided'],
  scheduled: ['released', 'unclaimed', 'voided'],
  released: ['claimed', 'unclaimed'],
  claimed: [],
  unclaimed: ['scheduled', 'voided'],
  voided: [],
};

export interface Disbursement {
  readonly id: DisbursementId;
  readonly requestId: AssistanceRequestId;
  readonly residentId: ResidentId;
  readonly referenceNumber: string;
  readonly status: DisbursementStatus;
  readonly method: PayoutMethod;
  readonly amount: Money;
  readonly scheduledFor: IsoDate | null;
  readonly releasedAt: IsoDateTime | null;
  readonly releasedBy: StaffUserId | null;
  readonly acknowledgedAt: IsoDateTime | null;
  /** Cheque number, e-wallet reference or acknowledgement receipt number. */
  readonly instrumentReference: string | null;
  readonly remarks: string | null;
  readonly audit: AuditStamp;
}

export interface DisbursementFilter {
  readonly search?: string;
  readonly status?: DisbursementStatus;
  readonly method?: PayoutMethod;
  readonly scheduledFrom?: IsoDate;
  readonly scheduledTo?: IsoDate;
}
