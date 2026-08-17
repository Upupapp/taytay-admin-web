import { asId, type IsoDateTime, type LguEventId } from '../shared/ids';
import {
  EVENT_STATUS_CATALOG,
  EVENT_STATUS_TRANSITIONS,
  EVENT_TIMEZONE,
  countsByEventView,
  duplicateOf,
  eventProblems,
  hasFinished,
  isVisibleToResidents,
  matchesEventView,
  registrationAvailability,
  type EventDraft,
  type LguEvent,
} from './event';
import {
  ATTENDANCE_CATALOG,
  REGISTRATION_STATUS_TRANSITIONS,
  attendanceRateOf,
  canOfferPromotion,
  describeAttendance,
  describeCapacity,
  placesRemaining,
  promotionExceedsCapacity,
  registrationProblems,
  targetStatusOf,
  type EventCapacitySummary,
  type EventRegistration,
} from './registration';

const NOW = '2026-08-16T02:00:00.000Z' as IsoDateTime;
const LATER = '2026-09-16T02:00:00.000Z' as IsoDateTime;
const EARLIER = '2026-07-16T02:00:00.000Z' as IsoDateTime;

function draft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    title: 'Medical mission — Dolores',
    summary: 'Free consultation and basic medicines.',
    details: 'Run with the Rural Health Unit.',
    category: 'medical-mission',
    image: null,
    startsAt: LATER,
    endsAt: ('2026-09-16T08:00:00.000Z' as IsoDateTime),
    venue: {
      name: 'Dolores Covered Court',
      address: 'Barangay Dolores Covered Court, Taytay, Rizal',
      mapUrl: null,
      barangayId: null,
    },
    contact: { name: 'Dr. Villanueva', office: 'Rural Health Unit', phone: null },
    registration: {
      isRequired: true,
      opensAt: null,
      closesAt: null,
      capacity: 200,
      waitlistEnabled: false,
      participationNote: null,
    },
    reminders: null,
    ...overrides,
  };
}

function event(overrides: Partial<LguEvent> = {}): LguEvent {
  const base = draft();
  return {
    id: asId<LguEventId>('event-1'),
    title: base.title,
    summary: base.summary,
    details: base.details,
    category: base.category,
    status: 'published',
    image: null,
    startsAt: LATER,
    endsAt: ('2026-09-16T08:00:00.000Z' as IsoDateTime),
    venue: base.venue,
    contact: base.contact,
    registration: base.registration,
    reminders: null,
    publishedAt: NOW,
    publishedBy: null,
    cancelledAt: null,
    cancellationReason: null,
    replacesEventId: null,
    registeredCount: 0,
    waitlistedCount: 0,
    audit: { createdAt: NOW, createdBy: null, updatedAt: NOW, updatedBy: null },
    ...overrides,
  };
}

function registration(overrides: Partial<EventRegistration> = {}): EventRegistration {
  return {
    id: asId<EventRegistration['id']>('reg-1'),
    eventId: asId<LguEventId>('event-1'),
    reference: 'TR-0001-0001',
    residentId: asId<EventRegistration['residentId']>('res-0001'),
    registeredAt: NOW,
    status: 'registered',
    attendance: 'not-checked-in',
    notes: null,
    statusReason: null,
    updatedBy: null,
    audit: { createdAt: NOW, createdBy: null, updatedAt: NOW, updatedBy: null },
    ...overrides,
  };
}

function summary(overrides: Partial<EventCapacitySummary> = {}): EventCapacitySummary {
  return {
    capacity: 25,
    registeredCount: 20,
    waitlistedCount: 3,
    cancelledCount: 1,
    attendedCount: 0,
    noShowCount: 0,
    asOf: NOW,
    ...overrides,
  };
}

/* ── Registration availability is derived ─────────────────────────────────── */

describe('whether somebody could register right now', () => {
  it('is open on a published event inside its window', () => {
    expect(registrationAvailability(event(), 10, NOW)).toBe('open');
  });

  it('is not open before the opening time', () => {
    const later = event({ registration: { ...event().registration, opensAt: LATER } });

    expect(registrationAvailability(later, 0, NOW)).toBe('not-open');
  });

  it('is closed after the deadline', () => {
    const past = event({ registration: { ...event().registration, closesAt: EARLIER } });

    expect(registrationAvailability(past, 0, NOW)).toBe('closed');
  });

  it('is closed once the event itself has finished', () => {
    // Derived from the clock rather than from a job having run. A stored flag
    // would be wrong every morning until something updated it (`DL-128`).
    const finished = event({ startsAt: EARLIER, endsAt: EARLIER });

    expect(registrationAvailability(finished, 0, NOW)).toBe('closed');
  });

  it('is full at capacity', () => {
    expect(registrationAvailability(event(), 200, NOW)).toBe('full');
  });

  it('is closed on anything that is not published', () => {
    for (const status of ['draft', 'cancelled', 'completed', 'archived'] as const) {
      expect(registrationAvailability(event({ status }), 0, NOW)).toBe('closed');
    }
  });

  it('says so plainly when no registration is wanted', () => {
    const walkIn = event({ registration: { ...event().registration, isRequired: false } });

    expect(registrationAvailability(walkIn, 0, NOW)).toBe('not-required');
  });
});

/* ── The client counts; the backend decides ───────────────────────────────── */

describe('capacity, honestly', () => {
  it('carries the moment it was taken', () => {
    // Required rather than optional, and printed on screen (`DL-129`).
    expect(summary().asOf).toBe(NOW);
  });

  it('offers no verdict on whether a place exists', () => {
    const shape = summary() as unknown as Record<string, unknown>;

    for (const field of ['hasRoom', 'canRegister', 'isAvailable', 'isFull']) {
      expect(shape).not.toHaveProperty(field);
    }
  });

  it('never reports a negative number of places', () => {
    // A backend that accepted more than capacity has told the office something
    // true; "-3 remaining" turns that into an apparent display bug.
    expect(placesRemaining(summary({ registeredCount: 28 }))).toBe(0);
    expect(placesRemaining(summary({ capacity: null }))).toBeNull();
  });

  it('still offers promotion when its own numbers say full', () => {
    // The numbers are a snapshot; somebody may have cancelled a second ago,
    // and only the backend knows (`DL-129`).
    expect(canOfferPromotion('waitlisted')).toBe(true);
    expect(promotionExceedsCapacity(summary({ registeredCount: 25 }))).toBe(true);
  });

  it('does not offer promotion on somebody already registered', () => {
    expect(canOfferPromotion('registered')).toBe(false);
    expect(canOfferPromotion('cancelled')).toBe(false);
  });

  it('counts without pronouncing', () => {
    expect(describeCapacity(summary())).toBe('20 of 25 registered, 3 waitlisted, 1 cancelled.');
    expect(describeCapacity(summary())).not.toMatch(/healthy|good|poor|low/i);
  });
});

/* ── Nobody becomes a no-show by the calendar ─────────────────────────────── */

describe('attendance', () => {
  it('reports the unmarked separately from the no-shows', () => {
    const half = summary({ registeredCount: 20, attendedCount: 8, noShowCount: 0 });

    // "8 attended, 0 no-shows, 12 not yet marked" is a different statement
    // from "8 attended, 12 no-shows", and only one is true mid-afternoon.
    expect(describeAttendance(half)).toBe('8 attended, 0 no-shows, 12 not yet marked.');
  });

  it('withholds a rate until attendance is final', () => {
    const half = summary({ registeredCount: 20, attendedCount: 8 });

    expect(attendanceRateOf(half, false)).toBeNull();
    expect(attendanceRateOf(half, true)).toBeCloseTo(0.4);
  });

  it('reports no rate at all when nobody registered', () => {
    expect(attendanceRateOf(summary({ registeredCount: 0 }), true)).toBeNull();
  });

  it('says on the badge that unmarked is not the same as absent', () => {
    expect(ATTENDANCE_CATALOG['not-checked-in'].description).toContain('not the same');
    expect(ATTENDANCE_CATALOG['no-show'].description).toContain('recorded by hand');
  });
});

/* ── Cancelling an event is one-way; cancelling a place is not ────────────── */

describe('the event lifecycle', () => {
  it('never lets a cancelled event go back', () => {
    expect(EVENT_STATUS_TRANSITIONS.cancelled).toEqual(['archived']);
  });

  it('never reopens a completed event', () => {
    // Reopening is how a no-show gets added to somebody's name afterwards.
    expect(EVENT_STATUS_TRANSITIONS.completed).toEqual(['archived']);
  });

  it('says on the badge that a cancellation cannot be undone', () => {
    expect(EVENT_STATUS_CATALOG.cancelled.description).toContain('cannot be un-cancelled');
  });

  it('says on the badge that completing does not sweep the unmarked', () => {
    expect(EVENT_STATUS_CATALOG.completed.description).toContain('stays');
    expect(EVENT_STATUS_CATALOG.completed.description).toContain('unmarked');
  });

  it('lets one registration be cancelled and put back', () => {
    // The asymmetry is deliberate: one person's place is not a public act.
    expect(REGISTRATION_STATUS_TRANSITIONS.cancelled).toContain('registered');
  });
});

describe('past is not completed', () => {
  it('treats a published event whose date has passed as finished', () => {
    expect(hasFinished(event({ startsAt: EARLIER, endsAt: EARLIER }), NOW)).toBe(true);
  });

  it('does not make it completed', () => {
    // The gap between the two is where attendance is marked (`DL-131`).
    const held = event({ startsAt: EARLIER, endsAt: EARLIER });

    expect(hasFinished(held, NOW)).toBe(true);
    expect(held.status).toBe('published');
  });

  it('lists a past event under Past and still under Published', () => {
    const held = event({ startsAt: EARLIER, endsAt: EARLIER });

    expect(matchesEventView(held, 'past', NOW)).toBe(true);
    expect(matchesEventView(held, 'published', NOW)).toBe(true);
    expect(matchesEventView(held, 'upcoming', NOW)).toBe(false);
  });

  it('keeps a cancelled event out of Past', () => {
    // It did not happen, and listing it among the ones that did misreports
    // the office's year.
    const called0ff = event({ status: 'cancelled', startsAt: EARLIER, endsAt: EARLIER });

    expect(matchesEventView(called0ff, 'past', NOW)).toBe(false);
    expect(matchesEventView(called0ff, 'cancelled', NOW)).toBe(true);
  });

  it('counts every view from the same set the list renders', () => {
    const events = [
      event({ id: asId<LguEventId>('a'), status: 'draft' }),
      event({ id: asId<LguEventId>('b') }),
      event({ id: asId<LguEventId>('c'), status: 'cancelled' }),
    ];
    const counts = countsByEventView(events, NOW);

    expect(counts.drafts).toBe(1);
    expect(counts.upcoming).toBe(1);
    expect(counts.cancelled).toBe(1);
  });
});

describe('what residents can see', () => {
  it('shows published and cancelled events, so nobody turns up to a cancelled one', () => {
    expect(isVisibleToResidents(event())).toBe(true);
    expect(isVisibleToResidents(event({ status: 'cancelled' }))).toBe(true);
  });

  it('shows nothing of a draft or an archived event', () => {
    expect(isVisibleToResidents(event({ status: 'draft' }))).toBe(false);
    expect(isVisibleToResidents(event({ status: 'archived' }))).toBe(false);
  });
});

/* ── What stops an event going out ────────────────────────────────────────── */

describe('publishing rules', () => {
  it('accepts a complete event', () => {
    expect(eventProblems(draft(), NOW, 'publish')).toEqual([]);
  });

  it('refuses a published event with no venue, address or contact', () => {
    const bare = draft({
      venue: { name: '', address: '', mapUrl: null, barangayId: null },
      contact: { name: '', office: '', phone: null },
    });
    const problems = eventProblems(bare, NOW, 'publish');

    expect(problems).toContain('venue-required');
    expect(problems).toContain('address-required');
    expect(problems).toContain('contact-required');
  });

  it('lets all of that be missing while still a draft', () => {
    const bare = draft({
      summary: '',
      venue: { name: '', address: '', mapUrl: null, barangayId: null },
      contact: { name: '', office: '', phone: null },
    });

    expect(eventProblems(bare, NOW, 'save')).toEqual([]);
  });

  it('refuses an end before its start, draft or not', () => {
    // Not an incomplete form — a wrong one, which no amount of filling in
    // will fix.
    const backwards = draft({ startsAt: LATER, endsAt: EARLIER });

    expect(eventProblems(backwards, NOW, 'save')).toContain('ends-before-start');
    expect(eventProblems(backwards, NOW, 'publish')).toContain('ends-before-start');
  });

  it('refuses a registration window that closes before it opens', () => {
    const backwards = draft({
      registration: { ...draft().registration, opensAt: LATER, closesAt: EARLIER },
    });

    expect(eventProblems(backwards, NOW, 'save')).toContain('registration-opens-after-it-closes');
  });

  it('refuses a waitlist with no capacity, because nobody would ever join it', () => {
    const unbounded = draft({
      registration: { ...draft().registration, capacity: null, waitlistEnabled: true },
    });

    expect(eventProblems(unbounded, NOW, 'save')).toContain('waitlist-without-capacity');
  });

  it('refuses a fractional or negative capacity', () => {
    for (const capacity of [0, -5, 12.5]) {
      const odd = draft({ registration: { ...draft().registration, capacity } });
      expect(eventProblems(odd, NOW, 'save')).toContain('capacity-not-a-number');
    }
  });

  it('refuses an undescribed cover image at publication only', () => {
    const poster = draft({ image: { url: '/poster.png', altText: '  ' } });

    expect(eventProblems(poster, NOW, 'publish')).toContain('image-without-alt-text');
    expect(eventProblems(poster, NOW, 'save')).not.toContain('image-without-alt-text');
  });

  it('accepts an event in the past, because a correction is not a mistake', () => {
    const held = draft({ startsAt: EARLIER, endsAt: NOW });

    expect(eventProblems(held, NOW, 'publish')).toEqual([]);
  });

  it('states the timezone once, in the domain', () => {
    expect(EVENT_TIMEZONE).toBe('Asia/Manila');
  });
});

/* ── Moving one registration ──────────────────────────────────────────────── */

describe('acting on a registration', () => {
  it('requires a reason for every move', () => {
    expect(registrationProblems(registration(), 'cancel', '  ')).toContain('reason-required');
  });

  it('accepts a reasoned move', () => {
    expect(registrationProblems(registration(), 'cancel', 'Resident rang to withdraw.')).toEqual(
      [],
    );
  });

  it('refuses a move the registration cannot make', () => {
    const cancelled = registration({ status: 'cancelled' });

    expect(registrationProblems(cancelled, 'cancel', 'Again.')).toContain('not-a-permitted-move');
  });

  it('maps each action to exactly one target status', () => {
    expect(targetStatusOf('promote')).toBe('registered');
    expect(targetStatusOf('waitlist')).toBe('waitlisted');
    expect(targetStatusOf('cancel')).toBe('cancelled');
    expect(targetStatusOf('restore')).toBe('registered');
  });
});

/* ── Duplicating ─────────────────────────────────────────────────────────── */

describe('duplicating an event', () => {
  it('carries the wording and the venue but never the dates', () => {
    const copy = duplicateOf(event());

    expect(copy.title).toContain('(copy)');
    expect(copy.venue).toEqual(event().venue);
    expect(copy.startsAt).toBeNull();
    expect(copy.endsAt).toBeNull();
  });

  it('carries no registrations, and nothing that could hold one', () => {
    // A duplicate arriving with last month's registrants would tell people
    // they are signed up for something they have never heard of.
    const copy = duplicateOf(event()) as unknown as Record<string, unknown>;

    expect(copy).not.toHaveProperty('id');
    expect(copy).not.toHaveProperty('registrations');
    expect(copy).not.toHaveProperty('status');
  });

  it('clears the registration window, which belonged to the old date', () => {
    const original = event({
      registration: { ...event().registration, opensAt: EARLIER, closesAt: NOW },
    });
    const copy = duplicateOf(original);

    expect(copy.registration.opensAt).toBeNull();
    expect(copy.registration.closesAt).toBeNull();
    expect(copy.registration.capacity).toBe(200);
  });
});
