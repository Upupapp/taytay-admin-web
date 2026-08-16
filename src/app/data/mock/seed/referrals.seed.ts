import {
  asId,
  asIsoDate,
  type AssistanceRequestId,
  type CaseId,
  type Referral,
  type ReferralId,
  type ReferralNoteId,
  type ResidentId,
  type ServiceProviderId,
  type StaffUserId,
} from '@domain/index';

import { daysBeforeAnchor, stamp } from './seed-utils';

const staff = (slug: string): StaffUserId => asId<StaffUserId>(`staff-${slug}`);
const provider = (slug: string): ServiceProviderId => asId<ServiceProviderId>(`svp-${slug}`);

/**
 * Referrals out of the MSWDO.
 *
 * Between them these exercise every state the queue has to handle: one in
 * progress and answered, one served and closed out, one **overdue** with nobody
 * having heard back, one waiting on the client, and one still a draft with no
 * disclosure plan — which is the state that must be refused at sending.
 */
export const MOCK_REFERRALS: readonly Referral[] = [
  {
    id: asId<ReferralId>('ref-0001'),
    referenceNumber: 'RF-2026-0044',
    residentId: asId<ResidentId>('res-0005'),
    requestId: asId<AssistanceRequestId>('req-0006'),
    caseId: asId<CaseId>('case-0002'),
    destination: 'women-and-children-protection-desk',
    destinationName: 'PNP Taytay Women and Children Protection Desk',
    providerId: provider('wcpd-taytay'),
    status: 'in-progress',
    urgency: 'urgent',
    serviceRequested: 'Protection order assistance and safety planning',
    reason: 'Protective services and safety planning alongside the solo parent grant.',
    destinationContact: 'Desk officer on duty',
    // A protection case, and the disclosure is correspondingly narrow: the desk
    // can open a case without the survivor's address, so it is not shared.
    disclosure: {
      authority: {
        basis: 'vital-interest',
        note: 'Immediate risk to the client and her children; referral made the same day and explained to her afterwards.',
        recordedBy: staff('sw-1'),
        recordedOn: asIsoDate('2026-07-27'),
      },
      extraFields: [
        {
          field: 'contact-number',
          because: 'The desk needs to reach her directly to arrange the protection order hearing.',
        },
      ],
      attachments: [],
    },
    referredBy: staff('sw-1'),
    referredAt: daysBeforeAnchor(5, 15),
    followUpOn: asIsoDate('2026-07-29'),
    respondedAt: daysBeforeAnchor(4, 9),
    outcome: null,
    handoffNotes: [
      {
        id: asId<ReferralNoteId>('rfn-0001'),
        body: 'Desk confirmed receipt by phone. Hearing set; client advised to bring a valid ID only.',
        authorId: staff('sw-1'),
        authorName: 'Jomar Villanueva',
        recordedAt: daysBeforeAnchor(4, 10),
      },
    ],
    audit: stamp(5, 4),
  },
  {
    id: asId<ReferralId>('ref-0002'),
    referenceNumber: 'RF-2026-0039',
    residentId: asId<ResidentId>('res-0001'),
    requestId: asId<AssistanceRequestId>('req-0001'),
    caseId: null,
    destination: 'philhealth',
    destinationName: 'PhilHealth Local Health Insurance Office — Rizal',
    providerId: provider('philhealth-rizal'),
    status: 'served',
    urgency: 'routine',
    serviceRequested: 'Membership reactivation and point-of-service enrolment',
    reason: 'Membership reactivation so future confinements are partly covered.',
    destinationContact: 'Member services',
    disclosure: {
      authority: {
        basis: 'client-consent',
        note: 'Explained at the counter that her name and birth date would go to PhilHealth Rizal to trace her old membership. She agreed.',
        recordedBy: staff('sw-1'),
        recordedOn: asIsoDate('2026-07-23'),
      },
      extraFields: [
        {
          field: 'birth-date',
          because: 'Needed to trace an existing membership record.',
        },
      ],
      attachments: [],
    },
    referredBy: staff('sw-1'),
    referredAt: daysBeforeAnchor(9, 13),
    followUpOn: asIsoDate('2026-08-06'),
    respondedAt: daysBeforeAnchor(2, 11),
    outcome: 'Membership reactivated. Point-of-service enrolment completed for the confinement.',
    handoffNotes: [],
    audit: stamp(9, 2),
  },
  {
    id: asId<ReferralId>('ref-0003'),
    referenceNumber: 'RF-2026-0051',
    residentId: asId<ResidentId>('res-0004'),
    requestId: null,
    caseId: asId<CaseId>('case-0003'),
    destination: 'peso',
    destinationName: 'Taytay Public Employment Service Office',
    providerId: provider('peso-taytay'),
    status: 'sent',
    urgency: 'priority',
    serviceRequested: 'Job matching for a displaced garments worker',
    reason: 'Retrenched in June. Looking for factory work within Taytay while the store gets going.',
    destinationContact: null,
    disclosure: {
      authority: {
        basis: 'client-consent',
        note: 'Agreed at the counter that his contact number and previous work would be shared with PESO.',
        recordedBy: staff('intake'),
        recordedOn: asIsoDate('2026-07-12'),
      },
      extraFields: [
        {
          field: 'contact-number',
          because: 'PESO calls applicants directly when a matching vacancy opens.',
        },
      ],
      attachments: [],
    },
    referredBy: staff('intake'),
    referredAt: daysBeforeAnchor(20, 10),
    // Overdue on the seed anchor and never answered: the state the queue exists
    // to surface, reached honestly rather than by a flag.
    followUpOn: asIsoDate('2026-07-19'),
    respondedAt: null,
    outcome: null,
    handoffNotes: [],
    audit: stamp(20, 20),
  },
  {
    id: asId<ReferralId>('ref-0004'),
    referenceNumber: 'RF-2026-0055',
    residentId: asId<ResidentId>('res-0002'),
    requestId: asId<AssistanceRequestId>('req-0002'),
    caseId: null,
    destination: 'hospital-msw',
    destinationName: 'Taytay Doctors Hospital — Medical Social Work Unit',
    providerId: provider('taytay-doctors'),
    status: 'waiting-requirements',
    urgency: 'priority',
    serviceRequested: 'Charity classification for physical therapy sessions',
    reason: 'Ongoing therapy after a workplace injury; household cannot meet the co-pay.',
    destinationContact: 'Duty medical social worker',
    disclosure: {
      authority: {
        basis: 'client-consent',
        note: 'Consented to the hospital seeing the household income figure used for the means test.',
        recordedBy: staff('sw-1'),
        recordedOn: asIsoDate('2026-07-30'),
      },
      extraFields: [
        {
          field: 'income',
          because: 'The hospital sets the charity classification from household income.',
        },
      ],
      attachments: [],
    },
    referredBy: staff('sw-1'),
    referredAt: daysBeforeAnchor(3, 14),
    followUpOn: asIsoDate('2026-08-05'),
    respondedAt: daysBeforeAnchor(2, 9),
    outcome: null,
    handoffNotes: [
      {
        id: asId<ReferralNoteId>('rfn-0002'),
        body: 'Unit asked for the barangay indigency certificate before classifying. Client informed by text.',
        authorId: staff('sw-1'),
        authorName: 'Jomar Villanueva',
        recordedAt: daysBeforeAnchor(2, 10),
      },
    ],
    audit: stamp(3, 2),
  },
  {
    id: asId<ReferralId>('ref-0005'),
    referenceNumber: 'RF-2026-0058',
    residentId: asId<ResidentId>('res-0007'),
    requestId: null,
    caseId: null,
    destination: 'dswd-field-office',
    destinationName: 'DSWD Field Office IV-A (CALABARZON)',
    providerId: provider('dswd-fo4a'),
    status: 'draft',
    urgency: 'routine',
    serviceRequested: 'AICS medical assistance beyond the municipal ceiling',
    reason: 'Dialysis costs exceed what the office can grant this quarter.',
    destinationContact: null,
    // No disclosure plan yet. This is the referral that must be refused at
    // sending until somebody records a lawful basis (`DL-81`).
    disclosure: null,
    referredBy: staff('sw-1'),
    referredAt: daysBeforeAnchor(1, 16),
    followUpOn: null,
    respondedAt: null,
    outcome: null,
    handoffNotes: [],
    audit: stamp(1, 1),
  },
];
