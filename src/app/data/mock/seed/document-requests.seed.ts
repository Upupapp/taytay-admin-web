import {
  asId,
  asIsoDate,
  type AssistanceRequestId,
  type DocumentRequest,
  type DocumentRequestId,
  type RequirementId,
  type StaffUserId,
} from '@domain/index';

import { daysBeforeAnchor } from './seed-utils';

/**
 * Documents the office has asked applicants for.
 *
 * Two of the three are deliberately overdue, because an office's document
 * chasing is mostly a record of what has *not* come back — a seed where every
 * request was answered promptly would leave the overdue treatment untested and
 * looking fine.
 */
export const MOCK_DOCUMENT_REQUESTS: readonly DocumentRequest[] = [
  {
    id: asId<DocumentRequestId>('dr-0001'),
    assistanceRequestId: asId<AssistanceRequestId>('ar-0003'),
    requirementId: asId<RequirementId>('rq-0011'),
    state: 'open',
    channel: 'sms',
    message:
      'Pakidala po ang barangay certificate of indigency sa susunod ninyong pagpunta sa MSWDO.',
    neededBy: asIsoDate('2026-07-25'),
    requestedBy: asId<StaffUserId>('staff-intake'),
    requestedAt: daysBeforeAnchor(20),
    closedAt: null,
    withdrawnReason: null,
  },
  {
    id: asId<DocumentRequestId>('dr-0002'),
    assistanceRequestId: asId<AssistanceRequestId>('ar-0003'),
    requirementId: asId<RequirementId>('rq-0012'),
    state: 'answered',
    channel: 'in-person',
    message: 'Told at the counter to bring the medical certificate from the attending physician.',
    neededBy: asIsoDate('2026-07-20'),
    requestedBy: asId<StaffUserId>('staff-intake'),
    requestedAt: daysBeforeAnchor(24),
    closedAt: daysBeforeAnchor(18),
    withdrawnReason: null,
  },
  {
    id: asId<DocumentRequestId>('dr-0003'),
    assistanceRequestId: asId<AssistanceRequestId>('ar-0004'),
    requirementId: asId<RequirementId>('rq-0016'),
    state: 'withdrawn',
    channel: 'barangay-relay',
    message: 'Asked through the barangay for a copy of the death certificate.',
    neededBy: asIsoDate('2026-07-15'),
    requestedBy: asId<StaffUserId>('staff-sw-1'),
    requestedAt: daysBeforeAnchor(30),
    closedAt: daysBeforeAnchor(26),
    // Withdrawn rather than left open: the office confirmed the document
    // directly with the civil registrar, so chasing the family for a copy they
    // would have had to pay for was no longer necessary.
    withdrawnReason: 'Confirmed directly with the civil registrar; no copy needed from the family.',
  },
];
