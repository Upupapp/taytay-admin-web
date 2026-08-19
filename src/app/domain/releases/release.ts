import type { AuditStamp } from '../shared/audit';
import type {
  AssistanceRequestId,
  ReleaseId,
  IsoDate,
  IsoDateTime,
  ReleaseBatchId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import { sumMoney, ZERO_PESOS, type Money } from '../shared/money';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

export type PayoutMethod = 'cash' | 'check' | 'e-wallet' | 'bank-transfer' | 'in-kind';

export const PAYOUT_METHOD_LABELS: Readonly<Record<PayoutMethod, string>> = {
  cash: 'Cash',
  check: 'Check',
  'e-wallet': 'E-wallet',
  'bank-transfer': 'Bank transfer',
  'in-kind': 'In-kind goods',
};

export type ReleaseStatus =
  | 'for-release'
  | 'scheduled'
  | 'released'
  | 'claimed'
  | 'unclaimed'
  | 'deferred'
  | 'needs-correction'
  | 'completed'
  | 'voided';

export const RELEASE_STATUS_CATALOG: StatusCatalog<ReleaseStatus> = {
  // Renamed from `pending` in TAB 17 to match the queue the office actually
  // works: "for release" says what the next act is, where "pending" only says
  // that nothing has happened.
  'for-release': {
    value: 'for-release',
    label: 'For release',
    tone: 'neutral',
    description: 'Approved and waiting to be scheduled into a payout.',
  },
  scheduled: {
    value: 'scheduled',
    label: 'Scheduled',
    tone: 'info',
    description: 'Payout date, place and channel confirmed.',
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
  // Held apart from `unclaimed`: the beneficiary came and the office could not
  // release. Recording that as "unclaimed" would blame a family for the
  // office's own missing signature.
  deferred: {
    value: 'deferred',
    label: 'Deferred',
    tone: 'warning',
    description: 'Attended but not released — the reason is recorded against the office.',
  },
  'needs-correction': {
    value: 'needs-correction',
    label: 'Needs correction',
    tone: 'warning',
    description: 'Something on the voucher is wrong. It cannot be released as it stands.',
  },
  completed: {
    value: 'completed',
    label: 'Completed',
    tone: 'success',
    description: 'Acknowledged and closed out by the office.',
  },
  voided: {
    value: 'voided',
    label: 'Voided',
    tone: 'danger',
    description: 'Cancelled before release. Nothing was handed over.',
  },
};

export const RELEASE_STATUS_TRANSITIONS: StatusTransitions<ReleaseStatus> = {
  'for-release': ['scheduled', 'needs-correction', 'voided'],
  scheduled: ['released', 'deferred', 'unclaimed', 'needs-correction', 'voided'],
  released: ['claimed', 'unclaimed'],
  claimed: ['completed'],
  unclaimed: ['scheduled', 'voided'],
  // Both recoverable: a deferred payout goes back on a schedule once the
  // office fixes whatever stopped it, and so does a corrected voucher.
  deferred: ['scheduled', 'voided'],
  'needs-correction': ['for-release', 'scheduled', 'voided'],
  completed: [],
  voided: [],
};

/** Something actually reached the beneficiary. */
export function isReleased(status: ReleaseStatus): boolean {
  return status === 'released' || status === 'claimed' || status === 'completed';
}

/** Still the office's to act on. */
export function isReleaseOpen(status: ReleaseStatus): boolean {
  return status !== 'completed' && status !== 'voided';
}

/**
 * What is being handed over.
 *
 * A grant of money and a sack of rice are not the same record. Forcing a peso
 * value onto in-kind goods invents a figure that then appears in reports as
 * though somebody counted it (`DL-93`), so an in-kind release carries a
 * **description** and no amount, and a cash release carries an amount and no
 * description.
 */
export type ReleaseKind = 'money' | 'in-kind';

export const RELEASE_KIND_LABELS: Readonly<Record<ReleaseKind, string>> = {
  money: 'Money',
  'in-kind': 'Goods',
};

/**
 * Why a payout did not happen when the beneficiary attended.
 *
 * Every reason here is the **office's**, which is the point of holding
 * `deferred` apart from `unclaimed`. If the family did not come, that is
 * `unclaimed`; this list is what the office got wrong or could not do.
 */
export type DeferralReason =
  | 'funds-not-yet-released-to-office'
  | 'approving-signature-missing'
  | 'identification-mismatch'
  | 'voucher-error'
  | 'office-closed';

export const DEFERRAL_REASON_LABELS: Readonly<Record<DeferralReason, string>> = {
  'funds-not-yet-released-to-office': 'Funds had not reached the office',
  'approving-signature-missing': 'An approving signature was missing',
  'identification-mismatch': 'Identification did not match the voucher',
  'voucher-error': 'The voucher was wrong',
  'office-closed': 'The office was closed when they came',
};

/** How the beneficiary's receipt was evidenced. */
export type AcknowledgementKind = 'signature' | 'thumbprint' | 'representative' | 'digital';

export const ACKNOWLEDGEMENT_KIND_LABELS: Readonly<Record<AcknowledgementKind, string>> = {
  signature: 'Signed for',
  thumbprint: 'Thumbmark',
  representative: 'Collected by an authorised representative',
  digital: 'Digital acknowledgement',
};

export interface ReleaseAcknowledgement {
  readonly kind: AcknowledgementKind;
  readonly acknowledgedAt: IsoDateTime;
  /** Who collected it, when that was not the beneficiary. */
  readonly collectedBy: string | null;
  /** The authority a representative presented. Required when there is one. */
  readonly authority: string | null;
}

export interface Release {
  readonly id: ReleaseId;
  readonly requestId: AssistanceRequestId;
  readonly residentId: ResidentId;
  readonly referenceNumber: string;
  readonly status: ReleaseStatus;
  readonly method: PayoutMethod;
  readonly kind: ReleaseKind;
  /** Set for `money`, `null` for `in-kind`. Never both (`DL-93`). */
  readonly amount: Money | null;
  /** Set for `in-kind`, `null` for `money`. */
  readonly inKindDescription: string | null;
  /**
   * The fund the office says this comes from, as a **label it was given**.
   *
   * A name, not an account code, and nothing here posts to it. This application
   * tracks release operations; it is not the treasury system (`DL-89`).
   */
  readonly fundingSourceLabel: string | null;
  /** The approval this release rests on — a document reference, not a link. */
  readonly approvingReference: string | null;
  readonly batchId: ReleaseBatchId | null;
  readonly scheduledFor: IsoDate | null;
  readonly releasedAt: IsoDateTime | null;
  readonly releasedBy: StaffUserId | null;
  readonly acknowledgedAt: IsoDateTime | null;
  readonly acknowledgement: ReleaseAcknowledgement | null;
  readonly deferralReason: DeferralReason | null;
  /** Cheque number, e-wallet reference or acknowledgement receipt number. */
  readonly instrumentReference: string | null;
  readonly remarks: string | null;
  readonly audit: AuditStamp;
}

/**
 * A release record is coherent when what it says it is matches what it carries.
 *
 * Asserted rather than assumed: a screen that trusts `kind` and a report that
 * trusts `amount` must never disagree about whether a family received money.
 */
export function releaseProblems(release: Release): readonly string[] {
  const problems: string[] = [];

  if (release.kind === 'money' && release.amount === null) {
    problems.push('money-release-without-an-amount');
  }
  if (release.kind === 'money' && release.inKindDescription !== null) {
    problems.push('money-release-with-goods-described');
  }
  if (release.kind === 'in-kind' && release.amount !== null) {
    problems.push('in-kind-release-with-an-amount');
  }
  if (release.kind === 'in-kind' && (release.inKindDescription ?? '').trim().length === 0) {
    problems.push('in-kind-release-without-a-description');
  }
  if (isReleased(release.status) && release.releasedBy === null) {
    problems.push('released-by-nobody');
  }
  if (release.status === 'deferred' && release.deferralReason === null) {
    problems.push('deferred-without-a-reason');
  }
  if (
    release.acknowledgement?.kind === 'representative' &&
    (release.acknowledgement.authority ?? '').trim().length === 0
  ) {
    problems.push('representative-without-authority');
  }

  return problems;
}

/** Sums what was actually handed over. In-kind contributes nothing to a peso total. */
export function sumReleased(releases: readonly Release[]): Money {
  const amounts = releases
    .filter((release) => isReleased(release.status) && release.amount !== null)
    .map((release) => release.amount as Money);
  return amounts.length === 0 ? ZERO_PESOS : sumMoney(amounts);
}

export interface ReleaseFilter {
  readonly search?: string;
  readonly status?: ReleaseStatus;
  readonly method?: PayoutMethod;
  readonly kind?: ReleaseKind;
  readonly batchId?: ReleaseBatchId;
  readonly residentId?: ResidentId;
  readonly scheduledFrom?: IsoDate;
  readonly scheduledTo?: IsoDate;
  readonly openOnly?: boolean;
}

export const EMPTY_RELEASE_FILTER: ReleaseFilter = {};

export function isReleaseFilterActive(filter: ReleaseFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.status !== undefined ||
    filter.method !== undefined ||
    filter.kind !== undefined ||
    filter.batchId !== undefined ||
    filter.residentId !== undefined ||
    filter.scheduledFrom !== undefined ||
    filter.scheduledTo !== undefined ||
    filter.openOnly === true
  );
}

export type ReleaseSortField = 'scheduledFor' | 'status' | 'amount' | 'referenceNumber';
