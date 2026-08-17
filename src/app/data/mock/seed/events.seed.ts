import {
  asId,
  type BarangayId,
  type EventRegistration,
  type EventRegistrationId,
  type LguEvent,
  type LguEventId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { daysAfterAnchor, daysBeforeAnchor, stamp } from './seed-utils';

const head = asId<StaffUserId>('staff-head');

const brgy = (slug: string): BarangayId => asId<BarangayId>(`brgy-${slug}`);

/**
 * An event without its counts.
 *
 * The counts are **derived** from `MOCK_REGISTRATIONS` below rather than
 * typed in beside each event. A seeded "20 registered" sitting above a seeded
 * list of 17 rows is a demo that contradicts itself, and whoever notices has
 * to work out which half to believe.
 */
type EventBase = Omit<LguEvent, 'registeredCount' | 'waitlistedCount'>;

/**
 * Municipal events, fictional but shaped like the real calendar of a Rizal
 * MSWDO: payouts, medical missions, feeding programmes, livelihood training.
 *
 * Between them these cover every status and every view, including the three
 * distinctions the screens exist to keep apart:
 *
 *   - **past but not completed** — held last month, attendance still being
 *     marked, and nobody turned into a no-show by the calendar (`DL-131`);
 *   - **cancelled**, with the event that replaced it recorded rather than the
 *     cancellation being undone;
 *   - **full**, where the waitlist is doing its job.
 *
 * Every cover image carries alt text, because an event that could not be
 * published without it should not be seeded without it either (`DL-125`).
 */
const EVENT_BASE: readonly EventBase[] = [
  {
    id: asId<LguEventId>('event-0001'),
    title: 'AICS payout — September, first tranche',
    summary: 'Approved medical and burial assistance, released at the Municipal Hall.',
    details:
      'Approved applicants for the first tranche will be called by barangay in the order posted ' +
      'at the door. Bring the voucher and a valid ID. If somebody else is collecting for you, ' +
      'they need a letter of authority and a copy of your ID. The lobby opens at 8am and the ' +
      'queue forms inside; nobody is served earlier for arriving first.',
    category: 'payout',
    status: 'published',
    image: {
      url: '/assets/events/payout-hall.svg',
      altText: 'The Municipal Hall lobby set up with numbered chairs and a service desk.',
    },
    startsAt: daysAfterAnchor(45, 8),
    endsAt: daysAfterAnchor(45, 16),
    venue: {
      name: 'Municipal Hall lobby',
      address: 'Taytay Municipal Hall, E. Rodriguez Ave, Taytay, Rizal',
      mapUrl: null,
      barangayId: brgy('san-juan'),
    },
    contact: { name: 'Grace Ocampo', office: 'MSWDO — Assistance Desk', phone: '(02) 8286 1234' },
    registration: {
      isRequired: false,
      opensAt: null,
      closesAt: null,
      capacity: null,
      waitlistEnabled: false,
      participationNote: 'For applicants already approved for this tranche. No walk-in applications.',
    },
    reminders: 'Bring the voucher and a valid ID. Water and seats are provided.',
    publishedAt: daysBeforeAnchor(4, 10),
    publishedBy: head,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    audit: stamp(6, 4),
  },
  {
    id: asId<LguEventId>('event-0002'),
    title: 'Medical mission — Barangay Dolores',
    summary: 'Free consultation, basic medicines and blood pressure screening.',
    details:
      'Run with the Rural Health Unit. General consultation, blood pressure and blood sugar ' +
      'screening, and basic medicines while stocks last. Priority numbers are given out from ' +
      '7:30am at the covered court.',
    category: 'medical-mission',
    status: 'published',
    image: {
      url: '/assets/events/medical-mission.svg',
      altText: 'A covered court with consultation tables under a tarpaulin banner.',
    },
    startsAt: daysAfterAnchor(52, 8),
    endsAt: daysAfterAnchor(52, 15),
    venue: {
      name: 'Dolores Covered Court',
      address: 'Barangay Dolores Covered Court, Dolores, Taytay, Rizal',
      mapUrl: 'https://maps.example.gov.ph/taytay/dolores-covered-court',
      barangayId: brgy('dolores'),
    },
    contact: { name: 'Dr. Ramon Villanueva', office: 'Rural Health Unit', phone: null },
    registration: {
      isRequired: true,
      opensAt: daysBeforeAnchor(2, 8),
      closesAt: daysAfterAnchor(50, 17),
      capacity: 200,
      waitlistEnabled: true,
      participationNote:
        'Open to all Taytay residents. Senior citizens and PWDs are served first regardless of ' +
        'registration order.',
    },
    reminders: 'Bring any current prescriptions and your senior citizen or PWD ID if you have one.',
    publishedAt: daysBeforeAnchor(3, 9),
    publishedBy: head,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    audit: stamp(8, 3),
  },
  {
    id: asId<LguEventId>('event-0003'),
    title: 'Livelihood training — food processing, batch 3',
    summary: 'Five-day training with a starter kit on completion.',
    details:
      'A five-day course on small-scale food processing and packaging, ending with a starter kit ' +
      'and a certificate. Attendance on all five days is required for the kit. Places are ' +
      'limited by the kitchen, not by the budget.',
    category: 'livelihood-training',
    status: 'published',
    image: {
      url: '/assets/events/livelihood.svg',
      altText: 'A training kitchen with work tables and sealed sample jars.',
    },
    startsAt: daysAfterAnchor(60, 8),
    endsAt: daysAfterAnchor(64, 16),
    venue: {
      name: 'MSWDO Training Room',
      address: 'Taytay Municipal Hall annex, 2nd floor, Taytay, Rizal',
      mapUrl: null,
      barangayId: brgy('san-juan'),
    },
    contact: { name: 'Marilou Santos', office: 'MSWDO — Livelihood Unit', phone: null },
    registration: {
      isRequired: true,
      opensAt: daysBeforeAnchor(6, 8),
      closesAt: daysAfterAnchor(55, 17),
      // Six work stations in the training kitchen, and the seeded rows fill
      // all six with three behind them. Small on purpose: an event seeded at
      // 4 of 25 with a waitlist makes the waitlist look broken.
      capacity: 6,
      waitlistEnabled: true,
      participationNote:
        'Priority for solo parents and 4Ps household members. Others are welcome and are placed ' +
        'on the waitlist first.',
    },
    reminders: 'Bring a hairnet and closed shoes. Materials are provided.',
    publishedAt: daysBeforeAnchor(7, 11),
    publishedBy: head,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    audit: stamp(10, 7),
  },
  {
    id: asId<LguEventId>('event-0004'),
    title: 'Supplementary feeding — Muzon day care, cycle 2',
    summary: 'Twelve-week cycle for enrolled day care children.',
    details:
      'Second cycle of the supplementary feeding programme for children enrolled at the Muzon ' +
      'day care centre. Parents are asked to attend the first session for the weighing and the ' +
      'consent forms.',
    category: 'feeding-programme',
    status: 'draft',
    image: null,
    startsAt: daysAfterAnchor(70, 8),
    endsAt: daysAfterAnchor(70, 11),
    venue: {
      name: 'Muzon Day Care Centre',
      address: 'Barangay Muzon Day Care Centre, Muzon, Taytay, Rizal',
      mapUrl: null,
      barangayId: brgy('muzon'),
    },
    contact: { name: 'Elena Bautista', office: 'MSWDO — Child Welfare', phone: null },
    registration: {
      isRequired: true,
      opensAt: null,
      closesAt: null,
      capacity: 60,
      waitlistEnabled: false,
      participationNote: 'For children already enrolled at the centre.',
    },
    reminders: null,
    publishedAt: null,
    publishedBy: null,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    audit: stamp(2, 1),
  },
  {
    id: asId<LguEventId>('event-0005'),
    title: 'Relief distribution — Santa Ana, flood-affected households',
    summary: 'Family food packs for households affected by the July flooding.',
    details:
      'Distribution of family food packs to households listed in the barangay flood assessment. ' +
      'One pack per household. Bring the assessment slip issued by the barangay.',
    category: 'relief-distribution',
    status: 'completed',
    image: {
      url: '/assets/events/relief.svg',
      altText: 'Stacked family food packs on pallets inside a barangay hall.',
    },
    startsAt: daysBeforeAnchor(20, 7),
    endsAt: daysBeforeAnchor(20, 14),
    venue: {
      name: 'Santa Ana Barangay Hall',
      address: 'Barangay Santa Ana Hall, Santa Ana, Taytay, Rizal',
      mapUrl: null,
      barangayId: brgy('santa-ana'),
    },
    contact: { name: 'Grace Ocampo', office: 'MSWDO — Assistance Desk', phone: null },
    registration: {
      isRequired: true,
      opensAt: daysBeforeAnchor(24, 8),
      closesAt: daysBeforeAnchor(21, 17),
      capacity: 120,
      waitlistEnabled: false,
      participationNote: 'Households on the barangay flood assessment list.',
    },
    reminders: 'Bring the barangay assessment slip and a valid ID.',
    publishedAt: daysBeforeAnchor(25, 9),
    publishedBy: head,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    audit: stamp(26, 19),
  },
  {
    id: asId<LguEventId>('event-0006'),
    title: 'Barangay assembly — social services briefing, San Isidro',
    summary: 'What the MSWDO offers, and how to apply.',
    details:
      'An open briefing on assistance programmes, requirements and the application process, ' +
      'followed by questions. Nothing is decided at the assembly; applications are filed at the ' +
      'MSWDO as usual.',
    category: 'assembly',
    // Held, and attendance not finished — the case the screens exist to keep
    // separate from `completed` (`DL-131`).
    status: 'published',
    image: null,
    startsAt: daysBeforeAnchor(9, 13),
    endsAt: daysBeforeAnchor(9, 16),
    venue: {
      name: 'San Isidro Barangay Hall',
      address: 'Barangay San Isidro Hall, San Isidro, Taytay, Rizal',
      mapUrl: null,
      barangayId: brgy('san-isidro'),
    },
    contact: { name: 'Marilou Santos', office: 'MSWDO', phone: null },
    registration: {
      isRequired: true,
      opensAt: daysBeforeAnchor(16, 8),
      closesAt: daysBeforeAnchor(10, 17),
      capacity: 80,
      waitlistEnabled: false,
      participationNote: 'Open to all San Isidro residents.',
    },
    reminders: null,
    publishedAt: daysBeforeAnchor(16, 9),
    publishedBy: head,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    audit: stamp(18, 9),
  },
  {
    id: asId<LguEventId>('event-0007'),
    title: 'Medical mission — Barangay Muzon (cancelled)',
    summary: 'Called off after the partner clinic withdrew its team.',
    details:
      'This mission was cancelled eight days before the date when the partner clinic withdrew ' +
      'its medical team. Everybody registered was notified. A replacement mission has been ' +
      'scheduled for Dolores.',
    category: 'medical-mission',
    status: 'cancelled',
    image: null,
    startsAt: daysBeforeAnchor(2, 8),
    endsAt: daysBeforeAnchor(2, 15),
    venue: {
      name: 'Muzon Covered Court',
      address: 'Barangay Muzon Covered Court, Muzon, Taytay, Rizal',
      mapUrl: null,
      barangayId: brgy('muzon'),
    },
    contact: { name: 'Dr. Ramon Villanueva', office: 'Rural Health Unit', phone: null },
    registration: {
      isRequired: true,
      opensAt: daysBeforeAnchor(20, 8),
      closesAt: daysBeforeAnchor(4, 17),
      capacity: 150,
      waitlistEnabled: true,
      participationNote: 'Open to all Taytay residents.',
    },
    reminders: null,
    publishedAt: daysBeforeAnchor(21, 9),
    publishedBy: head,
    cancelledAt: daysBeforeAnchor(10, 15),
    cancellationReason:
      'The partner clinic withdrew its medical team. Rescheduling at Muzon was not possible ' +
      'within the month, so a replacement mission was arranged at Dolores instead.',
    replacesEventId: null,
    audit: stamp(22, 10),
  },
  {
    id: asId<LguEventId>('event-0008'),
    title: 'Seminar — solo parent benefits under RA 11861',
    summary: 'What changed, and how to claim it.',
    details:
      'A short seminar on the benefits available to solo parents under RA 11861, the documents ' +
      'needed for the solo parent ID, and where to file. Run twice on the day.',
    category: 'seminar',
    status: 'archived',
    image: null,
    startsAt: daysBeforeAnchor(60, 9),
    endsAt: daysBeforeAnchor(60, 15),
    venue: {
      name: 'MSWDO Training Room',
      address: 'Taytay Municipal Hall annex, 2nd floor, Taytay, Rizal',
      mapUrl: null,
      barangayId: brgy('san-juan'),
    },
    contact: { name: 'Elena Bautista', office: 'MSWDO', phone: null },
    registration: {
      isRequired: false,
      opensAt: null,
      closesAt: null,
      capacity: null,
      waitlistEnabled: false,
      participationNote: null,
    },
    reminders: null,
    publishedAt: daysBeforeAnchor(70, 9),
    publishedBy: head,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    audit: stamp(72, 58),
  },
];

/**
 * Registrations, as they arrived from the resident app.
 *
 * Weighted deliberately: the livelihood training is **over** its capacity of
 * 25 with a real waitlist behind it, the assembly is past with attendance
 * half-marked, and the relief distribution is complete with both attended and
 * no-show rows. Between them they make the three counts that matter — marked,
 * unmarked and refused — visible on the screens rather than theoretical.
 */
function registration(
  index: number,
  eventId: string,
  residentSuffix: string,
  overrides: Partial<EventRegistration> = {},
): EventRegistration {
  const padded = String(index).padStart(4, '0');
  return {
    id: asId<EventRegistrationId>(`reg-${padded}`),
    eventId: asId<LguEventId>(eventId),
    reference: `TR-${eventId.slice(-4)}-${padded}`,
    residentId: asId<ResidentId>(`res-${residentSuffix}`),
    registeredAt: daysBeforeAnchor(5, 10),
    status: 'registered',
    attendance: 'not-checked-in',
    notes: null,
    statusReason: null,
    updatedBy: null,
    audit: stamp(5, 5),
    ...overrides,
  };
}

export const MOCK_REGISTRATIONS: readonly EventRegistration[] = [
  // Medical mission — well within capacity.
  registration(1, 'event-0002', '0002', { registeredAt: daysBeforeAnchor(2, 9) }),
  registration(2, 'event-0002', '0003', { registeredAt: daysBeforeAnchor(2, 11) }),
  registration(3, 'event-0002', '0005', { registeredAt: daysBeforeAnchor(1, 8) }),
  registration(4, 'event-0002', '0007', {
    registeredAt: daysBeforeAnchor(1, 14),
    status: 'cancelled',
    statusReason: 'Resident withdrew in the app — working that day.',
  }),

  // Livelihood training — at capacity, with a waitlist behind it.
  registration(5, 'event-0003', '0001', { registeredAt: daysBeforeAnchor(6, 9) }),
  registration(6, 'event-0003', '0004', { registeredAt: daysBeforeAnchor(6, 9) }),
  registration(7, 'event-0003', '0006', {
    registeredAt: daysBeforeAnchor(6, 10),
    notes: 'Asked whether the kit can be collected by a relative. Told yes, with authority.',
  }),
  registration(8, 'event-0003', '0008', { registeredAt: daysBeforeAnchor(5, 15) }),
  registration(21, 'event-0003', '0012', { registeredAt: daysBeforeAnchor(5, 16) }),
  registration(22, 'event-0003', '0013', { registeredAt: daysBeforeAnchor(5, 17) }),
  registration(9, 'event-0003', '0009', {
    registeredAt: daysBeforeAnchor(4, 8),
    status: 'waitlisted',
  }),
  registration(10, 'event-0003', '0010', {
    registeredAt: daysBeforeAnchor(4, 9),
    status: 'waitlisted',
  }),
  registration(11, 'event-0003', '0011', {
    registeredAt: daysBeforeAnchor(3, 16),
    status: 'waitlisted',
    notes: 'Solo parent — moved up first if a place opens.',
  }),

  // The assembly: held nine days ago, attendance half-marked and the event
  // still `published`. Nobody unmarked is a no-show.
  registration(12, 'event-0006', '0002', {
    registeredAt: daysBeforeAnchor(14, 9),
    attendance: 'attended',
  }),
  registration(13, 'event-0006', '0003', {
    registeredAt: daysBeforeAnchor(14, 10),
    attendance: 'attended',
  }),
  registration(14, 'event-0006', '0012', {
    registeredAt: daysBeforeAnchor(13, 11),
    attendance: 'attended',
  }),
  registration(15, 'event-0006', '0013', { registeredAt: daysBeforeAnchor(12, 9) }),
  registration(16, 'event-0006', '0014', { registeredAt: daysBeforeAnchor(12, 15) }),

  // Relief distribution: complete, with both outcomes recorded.
  registration(17, 'event-0005', '0005', {
    registeredAt: daysBeforeAnchor(23, 9),
    attendance: 'attended',
  }),
  registration(18, 'event-0005', '0006', {
    registeredAt: daysBeforeAnchor(23, 10),
    attendance: 'attended',
  }),
  registration(19, 'event-0005', '0015', {
    registeredAt: daysBeforeAnchor(22, 8),
    attendance: 'no-show',
    notes: 'Household collected at the barangay hall the following day instead.',
  }),
  registration(20, 'event-0005', '0016', {
    registeredAt: daysBeforeAnchor(22, 14),
    attendance: 'attended',
  }),
];

export const MOCK_EVENTS: readonly LguEvent[] = EVENT_BASE.map((event) => ({
  ...event,
  registeredCount: countFor(event.id, 'registered'),
  waitlistedCount: countFor(event.id, 'waitlisted'),
}));

function countFor(id: LguEventId, status: EventRegistration['status']): number {
  return MOCK_REGISTRATIONS.filter(
    (registration) => registration.eventId === id && registration.status === status,
  ).length;
}
