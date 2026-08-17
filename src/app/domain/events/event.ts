import type { AuditStamp } from '../shared/audit';
import type { BarangayId, IsoDateTime, LguEventId, StaffUserId } from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * An official event the municipality runs.
 *
 * Residents see it and register in a **separate mobile app**; this module is
 * the office's side of that. Two things follow, and both shape the model:
 *
 *   1. A published event has been read by people who then made plans around
 *      it. Cancelling reaches them; un-cancelling does not (`DL-131`).
 *   2. The registration count on this screen is a **snapshot of somebody
 *      else's writes**. Residents register on their phones, continuously, and
 *      nothing here holds a lock. The office is told what was true when it
 *      asked, and the backend remains the final word (`DL-129`).
 *
 * Deliberately absent, per the command: paid ticketing, seat maps, ticket
 * tiers, promo codes, payment, recurring events, event chat and event
 * comments. `npm run check:events` fails the build if any appears.
 */

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed' | 'archived';

export const EVENT_STATUS_CATALOG: StatusCatalog<EventStatus> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    tone: 'neutral',
    description: 'Being prepared. Nobody outside the office can see it, and nobody can register.',
  },
  published: {
    value: 'published',
    label: 'Published',
    tone: 'success',
    description: 'Visible in the resident app. People are making plans around this date.',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    tone: 'danger',
    // Said on the badge, because the officer reading it is the one deciding.
    description:
      'Called off, and everybody registered has been told. It cannot be un-cancelled — an event ' +
      'that is back on is a new event.',
  },
  completed: {
    value: 'completed',
    label: 'Completed',
    tone: 'info',
    description:
      'Held, and attendance is final. Anybody still unmarked when this was recorded stays ' +
      'unmarked rather than becoming a no-show.',
  },
  archived: {
    value: 'archived',
    label: 'Archived',
    tone: 'neutral',
    description: 'Filed away. Out of the resident app going forward; the record stays here.',
  },
};

/**
 * What the office can do to an event.
 *
 * `cancelled` leads only to `archived`. An event that was called off and then
 * put back on is a **new event** naming the old one through `replacesEventId`,
 * on the same reasoning as a closed case (`DL-53`) and a published post
 * (`DL-124`): every resident who read the cancellation made other plans, and a
 * status flipping back does not reach them.
 *
 * `completed` is likewise terminal but for a different reason — attendance has
 * been declared final, and a record that can be reopened is one where a
 * no-show can be added to somebody's name after the fact.
 */
export const EVENT_STATUS_TRANSITIONS: StatusTransitions<EventStatus> = {
  draft: ['published', 'archived'],
  published: ['cancelled', 'completed', 'archived'],
  cancelled: ['archived'],
  completed: ['archived'],
  archived: [],
};

export type EventCategory =
  | 'medical-mission'
  | 'feeding-programme'
  | 'livelihood-training'
  | 'payout'
  | 'assembly'
  | 'relief-distribution'
  | 'seminar';

export const EVENT_CATEGORY_LABELS: Readonly<Record<EventCategory, string>> = {
  'medical-mission': 'Medical mission',
  'feeding-programme': 'Feeding programme',
  'livelihood-training': 'Livelihood training',
  payout: 'Payout',
  assembly: 'Assembly',
  'relief-distribution': 'Relief distribution',
  seminar: 'Seminar',
};

/** The municipality runs on Philippine Standard Time and says so on the form. */
export const EVENT_TIMEZONE = 'Asia/Manila';
export const EVENT_TIMEZONE_LABEL = 'Philippine Standard Time (Asia/Manila)';

export interface EventImage {
  readonly url: string;
  /** What the image shows, for somebody who cannot see it. Never the file name. */
  readonly altText: string;
}

export interface EventVenue {
  readonly name: string;
  readonly address: string;
  /** A link to a map, if the office has one. Never a coordinate pair (`DL-86`). */
  readonly mapUrl: string | null;
  readonly barangayId: BarangayId | null;
}

export interface EventContact {
  readonly name: string;
  readonly office: string;
  readonly phone: string | null;
}

/**
 * How registration is meant to work, as the office set it up.
 *
 * This is the **plan**, not the state. Whether registration is open right now
 * is derived from these fields, the clock and the count (`DL-128`).
 */
export interface EventRegistrationPolicy {
  readonly isRequired: boolean;
  readonly opensAt: IsoDateTime | null;
  readonly closesAt: IsoDateTime | null;
  readonly capacity: number | null;
  readonly waitlistEnabled: boolean;
  /** Who the event is for, in words. Guidance, never a gate (`DL-42`, `DL-60`). */
  readonly participationNote: string | null;
}

export interface LguEvent {
  readonly id: LguEventId;
  readonly title: string;
  readonly summary: string;
  readonly details: string;
  readonly category: EventCategory;
  readonly status: EventStatus;
  readonly image: EventImage | null;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime;
  readonly venue: EventVenue;
  readonly contact: EventContact;
  readonly registration: EventRegistrationPolicy;
  /** What participants should bring, and anything else they need told. */
  readonly reminders: string | null;
  readonly publishedAt: IsoDateTime | null;
  readonly publishedBy: StaffUserId | null;
  readonly cancelledAt: IsoDateTime | null;
  readonly cancellationReason: string | null;
  /** Set when this event replaces one that was cancelled (`DL-131`). */
  readonly replacesEventId: LguEventId | null;
  /**
   * How many places are taken, **as of the read that produced this record**.
   *
   * Denormalised deliberately, and for the same reason `Post` carries its
   * reaction count: the list has to show "registered / capacity" on every row,
   * and one query per row to find out would be worse in every way.
   *
   * It is a snapshot and nothing more. Residents are registering in the app
   * while this list is on screen, and the office is told what was true when it
   * asked (`DL-129`).
   */
  readonly registeredCount: number;
  readonly waitlistedCount: number;
  readonly audit: AuditStamp;
}

/** Everything the composer collects. No id, no status, no counts. */
export interface EventDraft {
  readonly title: string;
  readonly summary: string;
  readonly details: string;
  readonly category: EventCategory;
  readonly image: EventImage | null;
  readonly startsAt: IsoDateTime | null;
  readonly endsAt: IsoDateTime | null;
  readonly venue: EventVenue;
  readonly contact: EventContact;
  readonly registration: EventRegistrationPolicy;
  readonly reminders: string | null;
}

/* ── What stops an event going out ────────────────────────────────────────── */

export type EventProblem =
  | 'title-required'
  | 'summary-required'
  | 'starts-required'
  | 'ends-required'
  | 'ends-before-start'
  | 'venue-required'
  | 'address-required'
  | 'contact-required'
  | 'image-without-alt-text'
  | 'registration-opens-after-it-closes'
  | 'registration-closes-after-the-event'
  | 'capacity-not-a-number'
  | 'waitlist-without-capacity'
  | 'map-link-not-a-url';

export type EventIntent = 'save' | 'publish';

/**
 * What is still missing, said as a list rather than a boolean.
 *
 * Lenient on `save` and strict on `publish`, for the reason given in `DL-125`:
 * a half-filled form is somebody working. The rules that are checked on
 * **both** are the ones where the draft itself would be wrong — an end before
 * a start, a registration window that closes before it opens — because saving
 * those means saving something that can never become correct by adding to it.
 */
export function eventProblems(
  draft: EventDraft,
  now: IsoDateTime,
  intent: EventIntent,
): readonly EventProblem[] {
  const problems: EventProblem[] = [];

  if (draft.title.trim().length === 0) {
    problems.push('title-required');
  }
  if (intent === 'publish' && draft.summary.trim().length === 0) {
    problems.push('summary-required');
  }
  if (intent === 'publish' && draft.startsAt === null) {
    problems.push('starts-required');
  }
  if (intent === 'publish' && draft.endsAt === null) {
    problems.push('ends-required');
  }
  // Checked whenever both are present, draft or not: an end before its start is
  // not an incomplete form, it is a wrong one.
  if (draft.startsAt !== null && draft.endsAt !== null && draft.endsAt <= draft.startsAt) {
    problems.push('ends-before-start');
  }
  if (intent === 'publish' && draft.venue.name.trim().length === 0) {
    problems.push('venue-required');
  }
  if (intent === 'publish' && draft.venue.address.trim().length === 0) {
    problems.push('address-required');
  }
  if (intent === 'publish' && draft.contact.name.trim().length === 0) {
    problems.push('contact-required');
  }
  // The same rule as a post's cover image (`DL-125`), for the same reason: an
  // event poster with no description is unreadable to the residents most
  // likely to need it read aloud.
  if (intent === 'publish' && draft.image !== null && draft.image.altText.trim().length === 0) {
    problems.push('image-without-alt-text');
  }

  const { opensAt, closesAt, capacity, waitlistEnabled } = draft.registration;
  if (opensAt !== null && closesAt !== null && closesAt <= opensAt) {
    problems.push('registration-opens-after-it-closes');
  }
  if (closesAt !== null && draft.endsAt !== null && closesAt > draft.endsAt) {
    problems.push('registration-closes-after-the-event');
  }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
    problems.push('capacity-not-a-number');
  }
  // A waitlist with no capacity is a queue behind a door that is never full.
  if (waitlistEnabled && capacity === null) {
    problems.push('waitlist-without-capacity');
  }
  if (draft.venue.mapUrl !== null && !/^https?:\/\/\S+$/.test(draft.venue.mapUrl.trim())) {
    problems.push('map-link-not-a-url');
  }

  // `now` is taken so the caller cannot be surprised by a hidden clock, and is
  // deliberately unused: an event scheduled in the past is a **correction**
  // being recorded, not a mistake to refuse.
  void now;

  return problems;
}

export const EVENT_PROBLEM_MESSAGES: Readonly<Record<EventProblem, string>> = {
  'title-required': 'An event needs a name.',
  'summary-required': 'Write the one line residents see in the list.',
  'starts-required': 'Choose when it starts.',
  'ends-required': 'Choose when it ends.',
  'ends-before-start': 'It cannot end before it starts.',
  'venue-required': 'Name the venue.',
  'address-required': 'Give the full address. "Covered court" is not findable by somebody new.',
  'contact-required': 'Name somebody residents can ask.',
  'image-without-alt-text':
    'Describe the cover image before publishing. A resident using a screen reader gets nothing ' +
    'from a poster with no description.',
  'registration-opens-after-it-closes': 'Registration closes before it opens.',
  'registration-closes-after-the-event': 'Registration closes after the event has finished.',
  'capacity-not-a-number': 'Capacity has to be a whole number of people, or left blank.',
  'waitlist-without-capacity': 'A waitlist needs a capacity — otherwise nobody ever joins it.',
  'map-link-not-a-url': 'A map link needs to start with http:// or https://.',
};

/* ── When residents can see it, and when they can sign up ─────────────────── */

/**
 * Whether the resident app should be showing this event.
 *
 * Derived, like a post's visibility (`DL-126`), rather than stored: a flag
 * needs a job to stay true and is wrong from the moment the clock passes it.
 */
export function isVisibleToResidents(event: LguEvent): boolean {
  return event.status === 'published' || event.status === 'cancelled';
}

/**
 * Whether the event has already happened.
 *
 * **This is not `completed`.** Past is the clock's opinion; completed is the
 * office's, recorded when attendance is final. A published event whose date
 * has passed is past and *not yet* completed, and that gap is where attendance
 * is marked (`DL-131`).
 */
export function hasFinished(event: LguEvent, now: IsoDateTime): boolean {
  return event.endsAt < now;
}

export type RegistrationAvailability = 'not-required' | 'not-open' | 'open' | 'closed' | 'full';

export const REGISTRATION_AVAILABILITY_LABELS: Readonly<
  Record<RegistrationAvailability, string>
> = {
  'not-required': 'No registration needed',
  'not-open': 'Not open yet',
  open: 'Open',
  closed: 'Closed',
  full: 'Full',
};

/**
 * Whether somebody could register right now — **derived, never stored**.
 *
 * Four inputs: what the office set up, the clock, how many have registered,
 * and the event's own status. A stored `registrationState` column would need a
 * job to keep it true and would be wrong every morning until that job ran,
 * exactly as a stored "overdue" flag would (`DL-83`).
 *
 * `full` is computed from a **count the office was handed**, and this function
 * cannot know what the backend has accepted since. It answers "what should the
 * office be told", never "is there a place left" — that question belongs to
 * the backend and only the backend (`DL-129`).
 */
export function registrationAvailability(
  event: LguEvent,
  registeredCount: number,
  now: IsoDateTime,
): RegistrationAvailability {
  if (!event.registration.isRequired) {
    return 'not-required';
  }
  if (event.status !== 'published') {
    return 'closed';
  }
  const { opensAt, closesAt, capacity } = event.registration;
  if (opensAt !== null && now < opensAt) {
    return 'not-open';
  }
  if (closesAt !== null && now > closesAt) {
    return 'closed';
  }
  if (event.endsAt < now) {
    return 'closed';
  }
  if (capacity !== null && registeredCount >= capacity) {
    return 'full';
  }
  return 'open';
}

/* ── The console views ────────────────────────────────────────────────────── */

export type EventView = 'upcoming' | 'drafts' | 'published' | 'past' | 'cancelled' | 'archived';

export const EVENT_VIEW_LABELS: Readonly<Record<EventView, string>> = {
  upcoming: 'Upcoming',
  drafts: 'Drafts',
  published: 'Published',
  past: 'Past',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

export function matchesEventView(event: LguEvent, view: EventView, now: IsoDateTime): boolean {
  switch (view) {
    case 'upcoming':
      // What the office is actually working towards: live, and still to come.
      return event.status === 'published' && !hasFinished(event, now);
    case 'drafts':
      return event.status === 'draft';
    case 'published':
      return event.status === 'published';
    case 'past':
      // Held or missed, but not cancelled — a cancelled event did not happen,
      // and listing it among the ones that did misreports the office's year.
      return hasFinished(event, now) && event.status !== 'cancelled' && event.status !== 'draft';
    case 'cancelled':
      return event.status === 'cancelled';
    case 'archived':
      return event.status === 'archived';
  }
}

export function countsByEventView(
  events: readonly LguEvent[],
  now: IsoDateTime,
): Readonly<Record<EventView, number>> {
  const views = Object.keys(EVENT_VIEW_LABELS) as EventView[];
  const counts = {} as Record<EventView, number>;
  for (const view of views) {
    counts[view] = events.filter((event) => matchesEventView(event, view, now)).length;
  }
  return counts;
}

export interface EventFilter {
  readonly search?: string;
  readonly category?: EventCategory;
  readonly from?: IsoDateTime;
  readonly to?: IsoDateTime;
}

/**
 * What a duplicate carries over.
 *
 * The dates, the status, the publication stamps and — above all — the
 * registrations are **not** copied. A duplicated event arriving with last
 * month's registrants would tell 84 people they are signed up for something
 * they have never heard of.
 */
export function duplicateOf(event: LguEvent): EventDraft {
  return {
    title: `${event.title} (copy)`,
    summary: event.summary,
    details: event.details,
    category: event.category,
    image: event.image,
    startsAt: null,
    endsAt: null,
    venue: event.venue,
    contact: event.contact,
    registration: { ...event.registration, opensAt: null, closesAt: null },
    reminders: event.reminders,
  };
}
