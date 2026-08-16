import {
  asId,
  asIsoDate,
  type CaseId,
  type FieldVisit,
  type FieldVisitId,
  type HouseholdId,
  type ResidentId,
  type StaffUserId,
  type VisitObservationId,
} from '@domain/index';

import { daysBeforeAnchor, stamp } from './seed-utils';

const staff = (slug: string): StaffUserId => asId<StaffUserId>(`staff-${slug}`);

/** The prompts a worker sets out with. Answers feed observations, never a score. */
const STANDARD_CHECKLIST = [
  { code: 'dwelling', label: 'Dwelling condition and tenure', checked: false, note: null },
  { code: 'members', label: 'Who is actually living there', checked: false, note: null },
  { code: 'water-sanitation', label: 'Water and sanitation', checked: false, note: null },
  { code: 'livelihood', label: 'Current income and work', checked: false, note: null },
  { code: 'children', label: 'Children in school', checked: false, note: null },
  { code: 'health', label: 'Health and care needs', checked: false, note: null },
] as const;

/**
 * Field visits.
 *
 * Between them these exercise every state the screens must handle: one
 * completed with a full mix of observation kinds, one where nobody was home,
 * one declined by the household, one **overdue** and still scheduled, and two
 * upcoming.
 *
 * Note what no record here carries: a coordinate, a check-in time or a route.
 * That absence is the point (`DL-86`).
 */
export const MOCK_FIELD_VISITS: readonly FieldVisit[] = [
  {
    id: asId<FieldVisitId>('fv-0001'),
    referenceNumber: 'HV-2026-0071',
    caseId: asId<CaseId>('case-0002'),
    residentId: asId<ResidentId>('res-0005'),
    householdId: asId<HouseholdId>('hh-0005'),
    status: 'completed',
    purpose: 'initial-assessment',
    assignedTo: staff('sw-1'),
    scheduledFor: asIsoDate('2026-07-24'),
    scheduledWindow: 'Morning',
    addressVisited: '22 Sampaguita Street, Purok 5, Santa Ana',
    checklist: STANDARD_CHECKLIST.map((item) =>
      item.code === 'children' ? { ...item, checked: true, note: 'Both in Grade 4 and Grade 1.' } : { ...item, checked: true, note: null },
    ),
    // The full mix: what the worker saw, what the client said, what a
    // neighbour said with the neighbour named, and the worker's own judgement
    // kept visibly separate from all three (`DL-85`).
    observations: [
      {
        id: asId<VisitObservationId>('vob-0001'),
        kind: 'observed',
        body: 'One room, roof intact. Two mats and a small gas stove. No running water inside; a shared tap two doors down.',
        attributedTo: null,
        recordedBy: staff('sw-1'),
        recordedAt: daysBeforeAnchor(8, 11),
      },
      {
        id: asId<VisitObservationId>('vob-0002'),
        kind: 'client-said',
        body: 'She has not received support from the children’s father since March and is doing laundry work three days a week.',
        attributedTo: null,
        recordedBy: staff('sw-1'),
        recordedAt: daysBeforeAnchor(8, 11),
      },
      {
        id: asId<VisitObservationId>('vob-0003'),
        kind: 'third-party-said',
        body: 'Said the children are at school every day and that she has been managing alone since the spring.',
        attributedTo: 'Barangay Santa Ana kagawad, Purok 5',
        recordedBy: staff('sw-1'),
        recordedAt: daysBeforeAnchor(8, 11),
      },
      {
        id: asId<VisitObservationId>('vob-0004'),
        kind: 'worker-assessed',
        body: 'Household income is irregular and below what the family needs. Solo parent support and continued protection follow-up are both warranted.',
        attributedTo: null,
        recordedBy: staff('sw-1'),
        recordedAt: daysBeforeAnchor(8, 12),
      },
    ],
    serviceNeeds: 'Solo parent support; continued coordination with the protection desk.',
    declinedReason: null,
    outcome:
      'Visit made and the household seen. Assessment recorded; solo parent support recommended.',
    completedAt: daysBeforeAnchor(8, 12),
    audit: stamp(14, 8),
  },
  {
    id: asId<FieldVisitId>('fv-0002'),
    referenceNumber: 'HV-2026-0068',
    caseId: null,
    residentId: asId<ResidentId>('res-0004'),
    householdId: asId<HouseholdId>('hh-0004'),
    status: 'not-found',
    purpose: 'verification',
    assignedTo: staff('intake'),
    scheduledFor: asIsoDate('2026-07-20'),
    scheduledWindow: 'Afternoon',
    addressVisited: '9 Rizal Extension, Purok 2, Muzon',
    checklist: [...STANDARD_CHECKLIST],
    observations: [
      {
        id: asId<VisitObservationId>('vob-0005'),
        kind: 'observed',
        body: 'House closed and shuttered at 2pm. No response after several minutes.',
        attributedTo: null,
        recordedBy: staff('intake'),
        recordedAt: daysBeforeAnchor(12, 14),
      },
    ],
    serviceNeeds: null,
    // Nobody home is not the household's failing, and the outcome says so
    // rather than implying non-cooperation.
    declinedReason: null,
    outcome: 'Nobody at the address. Left a note asking him to call the office; will try again.',
    completedAt: daysBeforeAnchor(12, 14),
    audit: stamp(18, 12),
  },
  {
    id: asId<FieldVisitId>('fv-0003'),
    referenceNumber: 'HV-2026-0074',
    caseId: null,
    residentId: asId<ResidentId>('res-0008'),
    householdId: null,
    status: 'refused',
    purpose: 'monitoring',
    assignedTo: staff('sw-1'),
    scheduledFor: asIsoDate('2026-07-28'),
    scheduledWindow: null,
    addressVisited: '4 Bayanihan Street, Purok 1, Dolores',
    checklist: [...STANDARD_CHECKLIST],
    observations: [],
    serviceNeeds: null,
    declinedReason:
      'Said he is back in regular work and does not want a monitoring visit while his employer might see it.',
    outcome: 'Household declined. Explained that the livelihood record stays open and he may call us.',
    completedAt: daysBeforeAnchor(4, 10),
    audit: stamp(9, 4),
  },
  {
    id: asId<FieldVisitId>('fv-0004'),
    referenceNumber: 'HV-2026-0079',
    caseId: asId<CaseId>('case-0003'),
    residentId: asId<ResidentId>('res-0002'),
    householdId: asId<HouseholdId>('hh-0002'),
    // Scheduled, and the date has passed on the seed anchor: the overdue state
    // reached honestly rather than by a flag.
    status: 'scheduled',
    purpose: 'follow-up',
    assignedTo: staff('sw-1'),
    scheduledFor: asIsoDate('2026-07-26'),
    scheduledWindow: 'Morning',
    addressVisited: '7 Mabini Extension, Dolores',
    checklist: [...STANDARD_CHECKLIST],
    observations: [],
    serviceNeeds: null,
    declinedReason: null,
    outcome: null,
    completedAt: null,
    audit: stamp(20, 20),
  },
  {
    id: asId<FieldVisitId>('fv-0005'),
    referenceNumber: 'HV-2026-0083',
    caseId: null,
    residentId: asId<ResidentId>('res-0001'),
    householdId: asId<HouseholdId>('hh-0001'),
    status: 'scheduled',
    purpose: 'monitoring',
    assignedTo: staff('sw-1'),
    scheduledFor: asIsoDate('2026-08-05'),
    scheduledWindow: 'Afternoon',
    addressVisited: '18 Rizal Street, Purok 3, San Juan',
    checklist: [...STANDARD_CHECKLIST],
    observations: [],
    serviceNeeds: null,
    declinedReason: null,
    outcome: null,
    completedAt: null,
    audit: stamp(6, 6),
  },
  {
    id: asId<FieldVisitId>('fv-0006'),
    referenceNumber: 'HV-2026-0084',
    caseId: null,
    residentId: asId<ResidentId>('res-0007'),
    householdId: null,
    status: 'scheduled',
    purpose: 'document-collection',
    assignedTo: staff('intake'),
    scheduledFor: asIsoDate('2026-08-12'),
    scheduledWindow: 'Morning',
    addressVisited: '31 Aguinaldo Street, Purok 4, San Isidro',
    checklist: [...STANDARD_CHECKLIST],
    observations: [],
    serviceNeeds: null,
    declinedReason: null,
    outcome: null,
    completedAt: null,
    audit: stamp(3, 3),
  },
];
