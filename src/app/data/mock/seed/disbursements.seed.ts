import {
  asId,
  asIsoDate,
  pesos,
  type AssistanceRequestId,
  type Disbursement,
  type DisbursementId,
  type ReleaseBatch,
  type ReleaseBatchId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { daysBeforeAnchor, stamp } from './seed-utils';

const disbursingOfficer = asId<StaffUserId>('staff-disbursement');
const head = asId<StaffUserId>('staff-head');

const AUGUST_BATCH = asId<ReleaseBatchId>('rbt-0001');

/**
 * Payout sessions.
 *
 * A batch groups releases for a table on a date. It carries no status of its
 * own — what it amounts to is counted from its members (`DL-90`), which is
 * what stops a session reading as "released" while somebody in it went home
 * with nothing.
 */
export const MOCK_RELEASE_BATCHES: readonly ReleaseBatch[] = [
  {
    id: AUGUST_BATCH,
    referenceNumber: 'RB-2026-0014',
    title: 'AICS payout — second week of August',
    scheduledFor: asIsoDate('2026-08-10'),
    venue: 'Municipal Hall lobby, Taytay',
    officerId: disbursingOfficer,
    disbursementIds: [
      asId<DisbursementId>('dsb-0001'),
      asId<DisbursementId>('dsb-0005'),
      asId<DisbursementId>('dsb-0006'),
    ],
    notes: 'Two cash grants and one food pack. Bring the acknowledgement sheets.',
    closedAt: null,
    audit: stamp(14, 14),
  },
];

/**
 * Releases.
 *
 * Between them these exercise every state the queue must handle, including the
 * two the office most needs told apart: **deferred**, where the family came and
 * the office could not pay, and **unclaimed**, where the family did not come.
 * One of those is the office's failing and the other is not, and a system that
 * records them the same way blames a household for a missing signature.
 *
 * One release is in kind, so the "goods are counted, never valued" rule is
 * exercised by a real record rather than only by a test.
 */
export const MOCK_DISBURSEMENTS: readonly Disbursement[] = [
  {
    id: asId<DisbursementId>('dsb-0001'),
    requestId: asId<AssistanceRequestId>('req-0003'),
    residentId: asId<ResidentId>('res-0003'),
    referenceNumber: 'DV-2026-00311',
    status: 'scheduled',
    method: 'cash',
    kind: 'money',
    amount: pesos(3000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: 'MSWDO-APR-2026-0311',
    batchId: AUGUST_BATCH,
    scheduledFor: asIsoDate('2026-08-10'),
    releasedAt: null,
    releasedBy: null,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: null,
    instrumentReference: null,
    remarks: 'Batch payout at the municipal hall lobby.',
    audit: stamp(14, 14),
  },
  {
    id: asId<DisbursementId>('dsb-0002'),
    requestId: asId<AssistanceRequestId>('req-0005'),
    residentId: asId<ResidentId>('res-0007'),
    referenceNumber: 'DV-2026-00188',
    status: 'completed',
    method: 'check',
    kind: 'money',
    amount: pesos(8000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: 'MSWDO-APR-2026-0188',
    batchId: null,
    scheduledFor: asIsoDate('2026-06-14'),
    releasedAt: daysBeforeAnchor(46, 10),
    releasedBy: disbursingOfficer,
    acknowledgedAt: daysBeforeAnchor(46, 10),
    acknowledgement: {
      kind: 'signature',
      acknowledgedAt: daysBeforeAnchor(46, 10),
      collectedBy: null,
      authority: null,
    },
    deferralReason: null,
    instrumentReference: 'CHK-0098412',
    remarks: null,
    audit: stamp(50, 44),
  },
  {
    id: asId<DisbursementId>('dsb-0003'),
    requestId: asId<AssistanceRequestId>('req-0005'),
    residentId: asId<ResidentId>('res-0007'),
    referenceNumber: 'DV-2026-00189',
    status: 'voided',
    method: 'cash',
    kind: 'money',
    amount: pesos(8000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: null,
    batchId: null,
    scheduledFor: asIsoDate('2026-06-12'),
    releasedAt: null,
    releasedBy: null,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: null,
    instrumentReference: null,
    remarks: 'Duplicate voucher. Replaced by DV-2026-00188.',
    audit: stamp(51, 50),
  },
  {
    id: asId<DisbursementId>('dsb-0004'),
    requestId: asId<AssistanceRequestId>('req-0001'),
    residentId: asId<ResidentId>('res-0001'),
    referenceNumber: 'DV-2026-00356',
    status: 'for-release',
    method: 'cash',
    kind: 'money',
    amount: pesos(8000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: 'MSWDO-APR-2026-0356',
    batchId: null,
    scheduledFor: null,
    releasedAt: null,
    releasedBy: null,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: null,
    instrumentReference: null,
    remarks: 'Approved. Waiting to be scheduled into a payout.',
    audit: stamp(8, 8),
  },
  {
    id: asId<DisbursementId>('dsb-0005'),
    requestId: asId<AssistanceRequestId>('req-0002'),
    residentId: asId<ResidentId>('res-0002'),
    referenceNumber: 'DV-2026-00372',
    // The family attended and the office could not pay. Recorded against the
    // office, with the reason named — never as "unclaimed".
    status: 'deferred',
    method: 'cash',
    kind: 'money',
    amount: pesos(5000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: 'MSWDO-APR-2026-0372',
    batchId: AUGUST_BATCH,
    scheduledFor: asIsoDate('2026-08-10'),
    releasedAt: null,
    releasedBy: null,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: 'approving-signature-missing',
    instrumentReference: null,
    remarks: 'He came at 9am. The countersignature was not on the voucher; rescheduled.',
    audit: stamp(6, 5),
  },
  {
    id: asId<DisbursementId>('dsb-0006'),
    requestId: asId<AssistanceRequestId>('req-0004'),
    residentId: asId<ResidentId>('res-0004'),
    referenceNumber: 'DV-2026-00380',
    status: 'claimed',
    method: 'in-kind',
    // Goods, so no peso figure. Putting one here would invent a number that
    // then appears in reports as though somebody counted it (`DL-93`).
    kind: 'in-kind',
    amount: null,
    inKindDescription: 'One family food pack: 10kg rice, 12 tinned goods, 1kg sugar, coffee.',
    fundingSourceLabel: 'Municipal disaster relief stock',
    approvingReference: 'MSWDO-APR-2026-0380',
    batchId: AUGUST_BATCH,
    scheduledFor: asIsoDate('2026-08-10'),
    releasedAt: daysBeforeAnchor(2, 10),
    releasedBy: disbursingOfficer,
    acknowledgedAt: daysBeforeAnchor(2, 10),
    acknowledgement: {
      kind: 'representative',
      acknowledgedAt: daysBeforeAnchor(2, 10),
      collectedBy: 'His eldest daughter',
      authority: 'Handwritten authorisation with a photocopy of his ID.',
    },
    deferralReason: null,
    instrumentReference: 'AR-2026-00380',
    remarks: null,
    audit: stamp(9, 2),
  },
  {
    id: asId<DisbursementId>('dsb-0007'),
    requestId: asId<AssistanceRequestId>('req-0006'),
    residentId: asId<ResidentId>('res-0005'),
    referenceNumber: 'DV-2026-00391',
    // Nobody came within the window. Distinct from deferred: the office was
    // ready, and this is not somebody's failing to record as one.
    status: 'unclaimed',
    method: 'cash',
    kind: 'money',
    amount: pesos(4000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: 'MSWDO-APR-2026-0391',
    batchId: null,
    scheduledFor: asIsoDate('2026-07-18'),
    releasedAt: null,
    releasedBy: null,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: null,
    instrumentReference: null,
    remarks: 'Not collected within the payout window. Social worker to follow up.',
    audit: stamp(20, 12),
  },
  {
    id: asId<DisbursementId>('dsb-0008'),
    requestId: asId<AssistanceRequestId>('req-0007'),
    residentId: asId<ResidentId>('res-0008'),
    referenceNumber: 'DV-2026-00395',
    status: 'needs-correction',
    method: 'cash',
    kind: 'money',
    amount: pesos(2500),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: null,
    batchId: null,
    scheduledFor: null,
    releasedAt: null,
    releasedBy: null,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: null,
    instrumentReference: null,
    remarks: 'Name on the voucher does not match the registry spelling. Held for correction.',
    audit: stamp(5, 3),
  },
  {
    id: asId<DisbursementId>('dsb-0009'),
    requestId: asId<AssistanceRequestId>('req-0004'),
    residentId: asId<ResidentId>('res-0004'),
    referenceNumber: 'DV-2026-00402',
    // Handed over, receipt not yet recorded. A real gap in an office day, and
    // the only state from which acknowledgement can be recorded at all.
    status: 'released',
    method: 'cash',
    kind: 'money',
    amount: pesos(6000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: 'MSWDO-APR-2026-0402',
    batchId: null,
    scheduledFor: asIsoDate('2026-08-04'),
    releasedAt: daysBeforeAnchor(1, 11),
    releasedBy: disbursingOfficer,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: null,
    instrumentReference: 'AR-2026-00402',
    remarks:
      'Cash grant following the food pack. Handed over at the window; the acknowledgement ' +
      'sheet is still with the officer.',
    audit: stamp(4, 1),
  },
];

/** Who approved each release, for the segregation-of-duties cue (`DL-91`). */
export const MOCK_RELEASE_APPROVERS: Readonly<Record<string, StaffUserId>> = {
  'dsb-0001': head,
  'dsb-0002': head,
  'dsb-0004': head,
  'dsb-0005': head,
  'dsb-0006': head,
  'dsb-0007': head,
  'dsb-0009': head,
};
