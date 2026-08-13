import {
  asId,
  type AssistanceRequestId,
  type Referral,
  type ReferralId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { daysBeforeAnchor, stamp } from './seed-utils';

const staff = (slug: string): StaffUserId => asId<StaffUserId>(`staff-${slug}`);

export const MOCK_REFERRALS: readonly Referral[] = [
  {
    id: asId<ReferralId>('ref-0001'),
    referenceNumber: 'RF-2026-0044',
    residentId: asId<ResidentId>('res-0005'),
    requestId: asId<AssistanceRequestId>('req-0006'),
    destination: 'women-and-children-protection-desk',
    destinationName: 'PNP Taytay Women and Children Protection Desk',
    status: 'in-progress',
    reason: 'Protective services and safety planning alongside the solo parent grant.',
    referredBy: staff('sw-1'),
    referredAt: daysBeforeAnchor(5, 15),
    respondedAt: daysBeforeAnchor(4, 9),
    outcome: null,
    audit: stamp(5, 4),
  },
  {
    id: asId<ReferralId>('ref-0002'),
    referenceNumber: 'RF-2026-0039',
    residentId: asId<ResidentId>('res-0001'),
    requestId: asId<AssistanceRequestId>('req-0001'),
    destination: 'philhealth',
    destinationName: 'PhilHealth Local Health Insurance Office — Rizal',
    status: 'served',
    reason: 'Membership reactivation so future confinements are partly covered.',
    referredBy: staff('sw-1'),
    referredAt: daysBeforeAnchor(9, 13),
    respondedAt: daysBeforeAnchor(6, 10),
    outcome: 'Membership reactivated under the indigent programme.',
    audit: stamp(9, 6),
  },
  {
    id: asId<ReferralId>('ref-0003'),
    referenceNumber: 'RF-2026-0051',
    residentId: asId<ResidentId>('res-0004'),
    requestId: asId<AssistanceRequestId>('req-0004'),
    destination: 'peso',
    destinationName: 'Taytay Public Employment Service Office',
    status: 'sent',
    reason: 'Job matching while the livelihood programme remains suspended.',
    referredBy: staff('sw-2'),
    referredAt: daysBeforeAnchor(2, 11),
    respondedAt: null,
    outcome: null,
    audit: stamp(2, 2),
  },
];
