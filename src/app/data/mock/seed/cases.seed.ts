import {
  asId,
  asIsoDate,
  EMPTY_CASE_SUBJECT,
  type AssistanceRequestId,
  type BarangayId,
  type CaseEvent,
  type CaseEventId,
  type CaseId,
  type CaseNote,
  type CaseNoteId,
  type CaseTask,
  type CaseTaskId,
  type FamilyId,
  type HouseholdId,
  type ResidentId,
  type SocialCase,
  type StaffUserId,
} from '@domain/index';

import { daysBeforeAnchor, stamp } from './seed-utils';

const socialCase = (id: string): CaseId => asId<CaseId>(id);
const person = (id: string): ResidentId => asId<ResidentId>(id);
const household = (id: string): HouseholdId => asId<HouseholdId>(id);
const family = (id: string): FamilyId => asId<FamilyId>(id);
const staff = (slug: string): StaffUserId => asId<StaffUserId>(`staff-${slug}`);
const brgy = (slug: string): BarangayId => asId<BarangayId>(`brgy-${slug}`);
const request = (id: string): AssistanceRequestId => asId<AssistanceRequestId>(id);
const task = (id: string): CaseTaskId => asId<CaseTaskId>(id);
const note = (id: string): CaseNoteId => asId<CaseNoteId>(id);

/**
 * Dates are stated relative to the seed anchor (2026-08-01) so the queues have
 * something in them on any day the application is opened: one case is overdue,
 * one is due within the week, one has not been touched in two months.
 */
const dueIn = (days: number): ReturnType<typeof asIsoDate> => {
  const date = new Date('2026-08-01T00:00:00.000Z');
  date.setUTCDate(date.getUTCDate() + days);
  return asIsoDate(date.toISOString().slice(0, 10));
};

/**
 * Cases, seeded so that every queue and every disclosure rule is visible on the
 * first screen a user opens.
 *
 * The arrangements that matter:
 *
 *  - **case-0003 is a gender-based-violence file** about a resident flagged
 *    `vawc-survivor`. Two of its notes are `protected`, so an intake officer
 *    sees that they exist and reads neither. It is the case that proves the
 *    third acceptance criterion rather than asserting it.
 *  - **case-0006 is unassigned**, which is what the `unassigned` queue is for.
 *  - **case-0002 is overdue** and **case-0001 is due within the week**, so the
 *    two time-based queues are never empty.
 *  - **case-0005 is closed**, and falls out of every queue but `all` while its
 *    file stays readable in full.
 *  - **case-0004 has had nothing recorded for two months** — the `stalled`
 *    queue exists because that is how a family is quietly dropped.
 */
export const MOCK_CASES: readonly SocialCase[] = [
  {
    id: socialCase('case-0001'),
    referenceNumber: 'CASE-2026-0117',
    subjectResidentId: person('res-0001'),
    householdId: household('hh-0001'),
    familyId: family('fam-0001'),
    barangayId: brgy('san-juan'),
    category: 'older-persons',
    status: 'intervention',
    summary:
      'Widowed senior managing hypertension on a pension that does not cover maintenance medicines.',
    assignedTo: staff('sw-1'),
    linkedRequestIds: [request('req-0001')],
    openedOn: asIsoDate('2026-05-14'),
    closedOn: null,
    continuesCaseId: null,
    audit: stamp(79, 6),
  },
  {
    id: socialCase('case-0002'),
    referenceNumber: 'CASE-2026-0121',
    subjectResidentId: person('res-0002'),
    householdId: household('hh-0002'),
    familyId: family('fam-0003'),
    barangayId: brgy('dolores'),
    category: 'disability-support',
    status: 'assessment',
    summary:
      'Household head lost work after an injury; PWD identification and school costs for one child outstanding.',
    assignedTo: staff('sw-1'),
    linkedRequestIds: [request('req-0002')],
    openedOn: asIsoDate('2026-06-02'),
    closedOn: null,
    continuesCaseId: null,
    audit: stamp(60, 11),
  },
  {
    // The protected file. Everything about how this record behaves for a role
    // without `case.view-protected-note` is decided by the notes below.
    id: socialCase('case-0003'),
    referenceNumber: 'CASE-2026-0064',
    subjectResidentId: person('res-0005'),
    householdId: household('hh-0005'),
    familyId: family('fam-0005'),
    barangayId: brgy('san-isidro'),
    category: 'gender-based-violence',
    status: 'intervention',
    summary: 'Survivor and two children relocated. Safety planning and livelihood support ongoing.',
    assignedTo: staff('sw-2'),
    linkedRequestIds: [request('req-0006')],
    openedOn: asIsoDate('2026-03-09'),
    closedOn: null,
    continuesCaseId: null,
    audit: stamp(145, 3),
  },
  {
    // Nothing recorded since June. This is what "stalled" is for.
    id: socialCase('case-0004'),
    referenceNumber: 'CASE-2026-0088',
    subjectResidentId: person('res-0007'),
    householdId: household('hh-0006'),
    familyId: family('fam-0006'),
    barangayId: brgy('dolores'),
    category: 'older-persons',
    status: 'on-hold',
    summary: 'Senior with mobility loss living alone. Follow-up paused while a carer is arranged.',
    assignedTo: staff('sw-2'),
    linkedRequestIds: [request('req-0005')],
    openedOn: asIsoDate('2026-02-11'),
    closedOn: null,
    continuesCaseId: null,
    audit: stamp(171, 64),
  },
  {
    id: socialCase('case-0005'),
    referenceNumber: 'CASE-2026-0033',
    subjectResidentId: person('res-0004'),
    householdId: household('hh-0004'),
    familyId: null,
    barangayId: brgy('muzon'),
    category: 'crisis-intervention',
    status: 'closed',
    summary: 'Displaced worker after a factory closure. Transport and food support delivered.',
    assignedTo: staff('sw-1'),
    linkedRequestIds: [request('req-0004')],
    openedOn: asIsoDate('2026-01-20'),
    closedOn: asIsoDate('2026-06-30'),
    continuesCaseId: null,
    audit: stamp(193, 32),
  },
  {
    // Nobody owns this yet. The unassigned queue is how it gets picked up.
    id: socialCase('case-0006'),
    referenceNumber: 'CASE-2026-0140',
    subjectResidentId: person('res-0008'),
    householdId: null,
    familyId: family('fam-0004'),
    barangayId: brgy('santa-ana'),
    category: 'livelihood',
    status: 'intake',
    summary:
      'Family between addresses after eviction. Referred by the barangay for livelihood help.',
    assignedTo: null,
    linkedRequestIds: [request('req-0007')],
    openedOn: asIsoDate('2026-07-28'),
    closedOn: null,
    continuesCaseId: null,
    audit: stamp(4, 4),
  },
  {
    id: socialCase('case-0007'),
    referenceNumber: 'CASE-2026-0102',
    subjectResidentId: person('res-0003'),
    householdId: household('hh-0003'),
    familyId: null,
    barangayId: brgy('santa-ana'),
    category: 'family-welfare',
    status: 'monitoring',
    summary:
      'Solo parent of three under 4Ps. Schooling costs met; household budget being reviewed.',
    assignedTo: staff('sw-2'),
    linkedRequestIds: [request('req-0003')],
    openedOn: asIsoDate('2026-04-06'),
    closedOn: null,
    continuesCaseId: null,
    audit: stamp(117, 9),
  },
];

export const MOCK_CASE_TASKS: readonly CaseTask[] = [
  {
    id: task('task-0001'),
    caseId: socialCase('case-0001'),
    title: 'Confirm the pharmacy accepts the purchase order',
    kind: 'follow-up',
    status: 'open',
    dueOn: dueIn(4),
    assignedTo: staff('sw-1'),
    completedAt: null,
    completedBy: null,
    outcome: null,
    audit: stamp(12, 12),
  },
  {
    id: task('task-0002'),
    caseId: socialCase('case-0001'),
    title: 'Home visit to verify the household composition',
    kind: 'home-visit',
    status: 'done',
    dueOn: asIsoDate('2026-06-20'),
    assignedTo: staff('sw-1'),
    completedAt: daysBeforeAnchor(44, 15),
    completedBy: staff('sw-1'),
    outcome: 'Visited 18 June. Grandson confirmed living in the same house as a separate family.',
    audit: stamp(52, 44),
  },
  {
    // Overdue on purpose.
    id: task('task-0003'),
    caseId: socialCase('case-0002'),
    title: 'Collect the medical certificate for the PWD identification card',
    kind: 'document',
    status: 'open',
    dueOn: dueIn(-9),
    assignedTo: staff('sw-1'),
    completedAt: null,
    completedBy: null,
    outcome: null,
    audit: stamp(30, 30),
  },
  {
    id: task('task-0004'),
    caseId: socialCase('case-0003'),
    title: 'Review the safety plan with the survivor',
    kind: 'review',
    status: 'open',
    dueOn: dueIn(2),
    assignedTo: staff('sw-2'),
    completedAt: null,
    completedBy: null,
    outcome: null,
    audit: stamp(18, 18),
  },
  {
    id: task('task-0005'),
    caseId: socialCase('case-0004'),
    title: 'Identify a barangay health worker who can visit weekly',
    kind: 'referral',
    status: 'open',
    dueOn: dueIn(-38),
    assignedTo: staff('sw-2'),
    completedAt: null,
    completedBy: null,
    outcome: null,
    audit: stamp(75, 64),
  },
  {
    id: task('task-0006'),
    caseId: socialCase('case-0007'),
    title: 'Second monitoring visit before the school term',
    kind: 'home-visit',
    status: 'open',
    dueOn: dueIn(21),
    assignedTo: staff('sw-2'),
    completedAt: null,
    completedBy: null,
    outcome: null,
    audit: stamp(9, 9),
  },
  {
    id: task('task-0007'),
    caseId: socialCase('case-0005'),
    title: 'Confirm receipt of the transport allowance',
    kind: 'follow-up',
    status: 'done',
    dueOn: asIsoDate('2026-06-25'),
    assignedTo: staff('sw-1'),
    completedAt: daysBeforeAnchor(36, 11),
    completedBy: staff('sw-1'),
    outcome: 'Acknowledged in person on 26 June. Case closed at the next review.',
    audit: stamp(48, 36),
  },
];

/**
 * The running record.
 *
 * `note-c0003-*` are the point of the third acceptance criterion: two of the
 * three notes on the survivor's file are `protected`, and a role without
 * `case.view-protected-note` receives them with no body at all.
 */
export const MOCK_CASE_NOTES: readonly CaseNote[] = [
  {
    id: note('cnote-0001'),
    caseId: socialCase('case-0001'),
    authorId: staff('sw-1'),
    authorName: 'Grace Ocampo',
    body: 'Home visit conducted. Household confirmed at the declared address; the grandson is recorded as a separate family under the same roof.',
    sensitivity: 'routine',
    createdAt: daysBeforeAnchor(44, 15),
  },
  {
    id: note('cnote-0002'),
    caseId: socialCase('case-0001'),
    authorId: staff('intake'),
    authorName: 'Liezl Padilla',
    body: 'Applicant advised that the medicine purchase order will be released through the accredited pharmacy.',
    sensitivity: 'routine',
    createdAt: daysBeforeAnchor(9, 10),
  },
  {
    id: note('cnote-0003'),
    caseId: socialCase('case-0002'),
    authorId: staff('sw-1'),
    authorName: 'Grace Ocampo',
    body: 'Household income is below the provincial threshold once the lost wage is taken out. Recommending assessment for educational assistance in the next cycle.',
    sensitivity: 'routine',
    createdAt: daysBeforeAnchor(20, 11),
  },
  {
    id: note('cnote-0004'),
    caseId: socialCase('case-0003'),
    authorId: staff('sw-2'),
    authorName: 'Jomar Villanueva',
    body: 'Relocation completed. Barangay informed only that the household has moved, with no forwarding address given.',
    sensitivity: 'routine',
    createdAt: daysBeforeAnchor(60, 14),
  },
  {
    id: note('cnote-0005'),
    caseId: socialCase('case-0003'),
    authorId: staff('sw-2'),
    authorName: 'Jomar Villanueva',
    body: 'Safety plan agreed: contact only through the case manager, no home visits announced in advance, and the children collected from school by a named relative.',
    sensitivity: 'protected',
    createdAt: daysBeforeAnchor(58, 9),
  },
  {
    id: note('cnote-0006'),
    caseId: socialCase('case-0003'),
    authorId: staff('sw-2'),
    authorName: 'Jomar Villanueva',
    body: 'Disclosure given in confidence during the third session. Recorded here because the protection order application relies on it.',
    sensitivity: 'protected',
    createdAt: daysBeforeAnchor(21, 16),
  },
  {
    id: note('cnote-0007'),
    caseId: socialCase('case-0004'),
    authorId: staff('sw-2'),
    authorName: 'Jomar Villanueva',
    body: 'No carer identified yet. Case held pending a barangay health worker assignment.',
    sensitivity: 'routine',
    createdAt: daysBeforeAnchor(64, 10),
  },
  {
    id: note('cnote-0008'),
    caseId: socialCase('case-0005'),
    authorId: staff('sw-1'),
    authorName: 'Grace Ocampo',
    body: 'Transport and food support delivered and acknowledged. Household reports re-employment from July. Closing with the outcome recorded.',
    sensitivity: 'routine',
    createdAt: daysBeforeAnchor(32, 11),
  },
  {
    id: note('cnote-0009'),
    caseId: socialCase('case-0007'),
    authorId: staff('sw-2'),
    authorName: 'Jomar Villanueva',
    body: 'Second monitoring call. All three children enrolled; the household budget review is scheduled with the next visit.',
    sensitivity: 'routine',
    createdAt: daysBeforeAnchor(9, 13),
  },
];

/**
 * History that existed before this session.
 *
 * Only what genuinely happened is here: each case's opening, and the moves that
 * took the crisis case to closure. Everything else in a timeline — notes, tasks,
 * request decisions — is derived from the records above, so nothing is invented
 * twice. Events recorded during a session are appended to this list and, like
 * the rest of the mock, last for the lifetime of the tab.
 */
const opened = (
  serial: string,
  caseId: string,
  actor: StaffUserId | null,
  actorName: string,
  daysAgo: number,
  reason: string,
): CaseEvent => ({
  id: asId<CaseEventId>(`cevt-${serial}`),
  caseId: socialCase(caseId),
  kind: 'case-opened',
  fromStatus: null,
  toStatus: 'intake',
  reason,
  actorId: actor,
  actorName,
  occurredAt: daysBeforeAnchor(daysAgo, 9),
  subject: EMPTY_CASE_SUBJECT,
});

export const MOCK_CASE_EVENTS: readonly CaseEvent[] = [
  opened(
    '00001',
    'case-0001',
    staff('intake'),
    'Liezl Padilla',
    79,
    'Walk-in at the office with a prescription she could not fill.',
  ),
  opened(
    '00002',
    'case-0002',
    staff('intake'),
    'Liezl Padilla',
    60,
    'Referred by the barangay after the injury was reported.',
  ),
  opened(
    '00003',
    'case-0003',
    staff('sw-2'),
    'Jomar Villanueva',
    145,
    'Referred by the Women and Children Protection Desk.',
  ),
  opened(
    '00004',
    'case-0004',
    staff('sw-2'),
    'Jomar Villanueva',
    171,
    'Reported by a neighbour during a barangay assembly.',
  ),
  opened(
    '00005',
    'case-0005',
    staff('intake'),
    'Liezl Padilla',
    193,
    'Group intake after the factory closure was announced.',
  ),
  opened(
    '00006',
    'case-0006',
    staff('brgy-link'),
    'Anabelle Gatchalian',
    4,
    'Endorsed by the barangay after the eviction.',
  ),
  opened(
    '00007',
    'case-0007',
    staff('intake'),
    'Liezl Padilla',
    117,
    'Identified during the 4Ps household validation.',
  ),
  {
    id: asId<CaseEventId>('cevt-00008'),
    caseId: socialCase('case-0005'),
    kind: 'status-changed',
    fromStatus: 'intervention',
    toStatus: 'monitoring',
    reason: 'Transport and food support delivered; moving to follow-up for one month.',
    actorId: staff('sw-1'),
    actorName: 'Grace Ocampo',
    occurredAt: daysBeforeAnchor(45, 11),
    subject: EMPTY_CASE_SUBJECT,
  },
  {
    id: asId<CaseEventId>('cevt-00009'),
    caseId: socialCase('case-0005'),
    kind: 'status-changed',
    fromStatus: 'monitoring',
    toStatus: 'closed',
    reason: 'Household re-employed from July and reports no further need. Closed with agreement.',
    actorId: staff('head'),
    actorName: 'Teodoro Lim',
    occurredAt: daysBeforeAnchor(32, 10),
    subject: EMPTY_CASE_SUBJECT,
  },
];
