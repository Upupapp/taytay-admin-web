import {
  REGISTRANT_EXPORT_NOTICE,
  attendanceRateOf,
  toAuditRow,
  type AttendanceStatus,
  type AuditAction,
  type AuditEntryId,
  type AuditRow,
  type EventCapacitySummary,
  type EventCategory,
  type EventCover,
  type EventDraft,
  type EventMetrics,
  type EventRegistrationId,
  type EventStatus,
  type IsoDateTime,
  type LguEvent,
  type LguEventId,
  type MediaId,
  type RegistrantExport,
  type RegistrantView,
  type RegistrationStatus,
  type StaffUserId,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { dateTime, field, flag, id, int, oneOf, str } from './wire';

/**
 * Events, read off the Node API (`DL-192`).
 *
 * **The counts are the server's, and so is the moment.** An event carries `registered_count` and
 * `waitlisted_count` as the read that produced it counted them; a capacity summary carries the
 * server's own `as_of`. Nothing here adds, subtracts or decides whether a place is left (`DL-129`).
 *
 * **A registrant is the closed set and nothing else** (`DL-130`). The wire row has no account id to
 * leak, and this mapper refuses a row that carries one rather than dropping the field quietly — a
 * wider row is a server that changed what it discloses, and the screen should not be the place that
 * finds out. The API keeps no office notes on a registration, so `notes` is always null.
 *
 * **What the API does not keep is not invented.** `replacesEventId` is null: nothing in the console
 * or the API records that one event replaces another yet.
 *
 * **A cover is a stored image, never an address** (`DL-193`). The mapper reads `image_media_id` and
 * the description, and never `image_url`: that is the residents' public route, which answers only
 * once an event is published, and a template bound to it would load from the API's host instead of
 * through the data layer.
 */

const STATUSES: readonly EventStatus[] = [
  'draft',
  'published',
  'cancelled',
  'completed',
  'archived',
];
const CATEGORIES: readonly EventCategory[] = [
  'medical-mission',
  'feeding-programme',
  'livelihood-training',
  'payout',
  'assembly',
  'relief-distribution',
  'seminar',
];
const REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  'registered',
  'waitlisted',
  'cancelled',
];
const ATTENDANCE: readonly AttendanceStatus[] = ['not-checked-in', 'attended', 'no-show'];
const HISTORY_ACTIONS: readonly AuditAction[] = [
  'created',
  'updated',
  'published',
  'cancelled',
  'status-changed',
  'archived',
  'exported',
  'registration-changed',
  'attendance-changed',
];

/** A string that may be empty — a draft's summary — or `null` for anything that is not a string. */
function words(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** `null` sent as `null`; a string as itself; anything else `undefined`, which refuses the record. */
function nullableWords(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

/** A stored image's id, `null` for none; anything else `undefined`, which refuses the record. */
function nullableMediaId(value: unknown): MediaId | null | undefined {
  if (value === null) {
    return null;
  }
  return id<MediaId>(value) ?? undefined;
}

function nullableTime(value: unknown): IsoDateTime | null | undefined {
  if (value === null) {
    return null;
  }
  return dateTime(value) ?? undefined;
}

function nullableStaffId(value: unknown): StaffUserId | null | undefined {
  if (value === null) {
    return null;
  }
  return id<StaffUserId>(value) ?? undefined;
}

/**
 * `GET office/events` and every answer that is one event.
 *
 * @consumes GET office/events
 * @consumes GET office/events/{id}
 * @consumes POST office/events
 * @consumes PATCH office/events/{id}
 * @consumes POST office/events/{id}/publish
 * @consumes POST office/events/{id}/cancel
 * @consumes POST office/events/{id}/complete
 * @consumes POST office/events/{id}/archive
 */
export function toLguEvent(wire: unknown, barangays: BarangayIndex): LguEvent | null {
  const eventId = id<LguEventId>(field(wire, 'id'));
  const title = str(field(wire, 'title'));
  const summary = words(field(wire, 'summary'));
  const details = words(field(wire, 'details'));
  const category = oneOf(field(wire, 'category'), CATEGORIES);
  const status = oneOf(field(wire, 'status'), STATUSES);
  const imageMediaId = nullableMediaId(field(wire, 'image_media_id'));
  const imageAltText = nullableWords(field(wire, 'image_alt_text'));
  const startsAt = dateTime(field(wire, 'starts_at'));
  const endsAt = dateTime(field(wire, 'ends_at'));
  const venueName = words(field(wire, 'venue_name'));
  const venueAddress = words(field(wire, 'venue_address'));
  const venueMapUrl = nullableWords(field(wire, 'venue_map_url'));
  const venueBarangay = nullableWords(field(wire, 'venue_barangay_id'));
  const contactName = words(field(wire, 'contact_name'));
  const contactOffice = words(field(wire, 'contact_office'));
  const contactPhone = nullableWords(field(wire, 'contact_phone'));
  const isRequired = flag(field(wire, 'registration_required'));
  const opensAt = nullableTime(field(wire, 'registration_opens_at'));
  const closesAt = nullableTime(field(wire, 'registration_closes_at'));
  const sentCapacity = field(wire, 'capacity');
  const capacity = sentCapacity === null ? null : int(sentCapacity);
  const waitlistEnabled = flag(field(wire, 'waitlist_enabled'));
  const participationNote = nullableWords(field(wire, 'participation_note'));
  const reminders = nullableWords(field(wire, 'reminders'));
  const publishedAt = nullableTime(field(wire, 'published_at'));
  const publishedBy = nullableStaffId(field(wire, 'published_by'));
  const cancelledAt = nullableTime(field(wire, 'cancelled_at'));
  const cancellationReason = nullableWords(field(wire, 'cancellation_reason'));
  const registeredCount = int(field(wire, 'registered_count'));
  const waitlistedCount = int(field(wire, 'waitlisted_count'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const createdBy = id<StaffUserId>(field(wire, 'created_by'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  const updatedBy = id<StaffUserId>(field(wire, 'updated_by'));
  if (
    eventId === null ||
    title === null ||
    summary === null ||
    details === null ||
    category === null ||
    status === null ||
    imageMediaId === undefined ||
    imageAltText === undefined ||
    startsAt === null ||
    endsAt === null ||
    venueName === null ||
    venueAddress === null ||
    venueMapUrl === undefined ||
    venueBarangay === undefined ||
    contactName === null ||
    contactOffice === null ||
    contactPhone === undefined ||
    isRequired === null ||
    opensAt === undefined ||
    closesAt === undefined ||
    (sentCapacity !== null && capacity === null) ||
    waitlistEnabled === null ||
    participationNote === undefined ||
    reminders === undefined ||
    publishedAt === undefined ||
    publishedBy === undefined ||
    cancelledAt === undefined ||
    cancellationReason === undefined ||
    registeredCount === null ||
    waitlistedCount === null ||
    createdAt === null ||
    createdBy === null ||
    updatedAt === null ||
    updatedBy === null
  ) {
    return null;
  }
  // A venue in a barangay this console cannot place is refused rather than placed somewhere else.
  const barangayId = venueBarangay === null ? null : barangays.toConsole(venueBarangay);
  if (venueBarangay !== null && barangayId === null) {
    return null;
  }
  return {
    id: eventId,
    title,
    summary,
    details,
    category,
    status,
    image: imageMediaId === null ? null : { mediaId: imageMediaId, altText: imageAltText ?? '' },
    startsAt,
    endsAt,
    venue: { name: venueName, address: venueAddress, mapUrl: venueMapUrl, barangayId },
    contact: { name: contactName, office: contactOffice, phone: contactPhone },
    registration: {
      isRequired,
      opensAt,
      closesAt,
      capacity,
      waitlistEnabled,
      participationNote,
    },
    reminders,
    publishedAt,
    publishedBy,
    cancelledAt,
    cancellationReason,
    replacesEventId: null,
    registeredCount,
    waitlistedCount,
    audit: { createdAt, createdBy, updatedAt, updatedBy },
  };
}

/** The body of `POST office/events` and `PATCH office/events/{id}`: the whole draft, flat. */
export interface EventDraftWire {
  readonly title: string;
  readonly summary: string;
  readonly details: string;
  readonly category: EventCategory;
  readonly image_media_id: MediaId | null;
  readonly image_alt_text: string | null;
  readonly starts_at: string;
  readonly ends_at: string;
  readonly venue_name: string;
  readonly venue_address: string;
  readonly venue_map_url: string | null;
  readonly venue_barangay_id: string | null;
  readonly contact_name: string;
  readonly contact_office: string;
  readonly contact_phone: string | null;
  readonly registration_required: boolean;
  readonly registration_opens_at: string | null;
  readonly registration_closes_at: string | null;
  readonly capacity: number | null;
  readonly waitlist_enabled: boolean;
  readonly participation_note: string | null;
  readonly reminders: string | null;
}

/**
 * A draft as the API takes it: every field, flat. The caller has already refused what cannot be
 * sent truthfully — a draft with no dates (the API holds none, `DL-192`) or a venue barangay the API
 * does not know by the same name — and hands over the dates, the API's barangay id, and the cover
 * as stored: a chosen image is uploaded before this body is made, so it names only what the API
 * already keeps (`DL-193`).
 */
export function toWireEventDraft(
  draft: EventDraft,
  dates: { readonly startsAt: IsoDateTime; readonly endsAt: IsoDateTime },
  venueBarangayId: string | null,
  cover: EventCover | null,
): EventDraftWire {
  const blankToNull = (value: string | null): string | null =>
    value === null || value.trim() === '' ? null : value.trim();
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    details: draft.details,
    category: draft.category,
    image_media_id: cover === null ? null : cover.mediaId,
    image_alt_text: cover === null ? null : cover.altText.trim(),
    starts_at: dates.startsAt,
    ends_at: dates.endsAt,
    venue_name: draft.venue.name.trim(),
    venue_address: draft.venue.address.trim(),
    venue_map_url: blankToNull(draft.venue.mapUrl),
    venue_barangay_id: venueBarangayId,
    contact_name: draft.contact.name.trim(),
    contact_office: draft.contact.office.trim(),
    contact_phone: blankToNull(draft.contact.phone),
    registration_required: draft.registration.isRequired,
    registration_opens_at: draft.registration.opensAt,
    registration_closes_at: draft.registration.closesAt,
    capacity: draft.registration.capacity,
    waitlist_enabled: draft.registration.waitlistEnabled,
    participation_note: blankToNull(draft.registration.participationNote),
    reminders: blankToNull(draft.reminders),
  };
}

/** The body of every act that says why: an event's moves and a registration's. */
export interface EventReasonWire {
  readonly reason: string;
}

export function toWireEventReason(reason: string): EventReasonWire {
  return { reason: reason.trim() };
}

/** The body of `…/registrations/{registrationId}/attendance`. */
export interface EventAttendanceWire {
  readonly attendance: AttendanceStatus;
}

export function toWireEventAttendance(attendance: AttendanceStatus): EventAttendanceWire {
  return { attendance };
}

/** The closed set a registrant row may carry (`DL-130`). Anything else refuses the row. */
const REGISTRANT_FIELDS = [
  'id',
  'reference',
  'display_name',
  'barangay_id',
  'registered_at',
  'status',
  'attendance',
] as const;

/**
 * One registrant, or `null` for a row this console cannot place or that carries more than the
 * closed set.
 *
 * @consumes GET office/events/{id}/registrants
 * @consumes POST office/events/{id}/registrations/{registrationId}/cancel
 * @consumes POST office/events/{id}/registrations/{registrationId}/restore
 * @consumes POST office/events/{id}/registrations/{registrationId}/promote
 * @consumes POST office/events/{id}/registrations/{registrationId}/waitlist
 * @consumes POST office/events/{id}/registrations/{registrationId}/attendance
 */
export function toRegistrantView(wire: unknown, barangays: BarangayIndex): RegistrantView | null {
  if (
    wire === null ||
    typeof wire !== 'object' ||
    Object.keys(wire).some((key) => !(REGISTRANT_FIELDS as readonly string[]).includes(key))
  ) {
    return null;
  }
  const registrationId = id<EventRegistrationId>(field(wire, 'id'));
  const reference = str(field(wire, 'reference'));
  const displayName = str(field(wire, 'display_name'));
  const sentBarangay = nullableWords(field(wire, 'barangay_id'));
  const registeredAt = dateTime(field(wire, 'registered_at'));
  const status = oneOf(field(wire, 'status'), REGISTRATION_STATUSES);
  const attendance = oneOf(field(wire, 'attendance'), ATTENDANCE);
  if (
    registrationId === null ||
    reference === null ||
    displayName === null ||
    sentBarangay === undefined ||
    registeredAt === null ||
    status === null ||
    attendance === null
  ) {
    return null;
  }
  // A registrant is still listed when their account names a barangay this console cannot place:
  // dropping them would understate the count somebody is catering for. The barangay is left blank.
  const barangayId = sentBarangay === null ? null : barangays.toConsole(sentBarangay);
  return {
    id: registrationId,
    reference,
    displayName,
    barangayId,
    registeredAt,
    status,
    attendance,
    // The API keeps no office notes on a registration: nothing writes one (`DL-192`).
    notes: null,
  };
}

/**
 * `GET office/events/{id}/capacity` → counts and the moment the server took them.
 *
 * @consumes GET office/events/{id}/capacity
 */
export function toEventCapacity(wire: unknown): EventCapacitySummary | null {
  const sentCapacity = field(wire, 'capacity');
  const capacity = sentCapacity === null ? null : int(sentCapacity);
  const registeredCount = int(field(wire, 'registered_count'));
  const waitlistedCount = int(field(wire, 'waitlisted_count'));
  const cancelledCount = int(field(wire, 'cancelled_count'));
  const attendedCount = int(field(wire, 'attended_count'));
  const noShowCount = int(field(wire, 'no_show_count'));
  const asOf = dateTime(field(wire, 'as_of'));
  if (
    (sentCapacity !== null && capacity === null) ||
    registeredCount === null ||
    waitlistedCount === null ||
    cancelledCount === null ||
    attendedCount === null ||
    noShowCount === null ||
    asOf === null
  ) {
    return null;
  }
  return {
    capacity,
    registeredCount,
    waitlistedCount,
    cancelledCount,
    attendedCount,
    noShowCount,
    asOf,
  };
}

/**
 * `GET office/events/{id}/metrics` → counts, and a rate only once the office says attendance is
 * final (`attendanceRateOf`).
 *
 * @consumes GET office/events/{id}/metrics
 */
export function toEventMetrics(wire: unknown): EventMetrics | null {
  const eventId = id<LguEventId>(field(wire, 'event_id'));
  const registeredCount = int(field(wire, 'registered_count'));
  const waitlistedCount = int(field(wire, 'waitlisted_count'));
  const cancelledCount = int(field(wire, 'cancelled_count'));
  const attendedCount = int(field(wire, 'attended_count'));
  const noShowCount = int(field(wire, 'no_show_count'));
  const unmarkedCount = int(field(wire, 'unmarked_count'));
  const attendanceFinal = flag(field(wire, 'attendance_final'));
  const asOf = dateTime(field(wire, 'as_of'));
  if (
    eventId === null ||
    registeredCount === null ||
    waitlistedCount === null ||
    cancelledCount === null ||
    attendedCount === null ||
    noShowCount === null ||
    unmarkedCount === null ||
    attendanceFinal === null ||
    asOf === null
  ) {
    return null;
  }
  const summary: EventCapacitySummary = {
    capacity: null,
    registeredCount,
    waitlistedCount,
    cancelledCount,
    attendedCount,
    noShowCount,
    asOf,
  };
  return {
    eventId,
    registeredCount,
    waitlistedCount,
    cancelledCount,
    attendedCount,
    noShowCount,
    unmarkedCount,
    attendanceRate: attendanceRateOf(summary, attendanceFinal),
    asOf,
  };
}

/** The lines a registrant file must carry, so its conditions travel inside it (`DL-106`). */
const CONDITIONS_IN_THE_FILE = [
  /^"Event",/m,
  /^"Generated at",/m,
  /^"Generated by",/m,
  /^"Handling",.*RA 10173/m,
];

/**
 * `GET office/events/{id}/registrants/export` → the file, or `null` — including one that does not
 * carry its own conditions, or whose notice is not the office's.
 *
 * @consumes GET office/events/{id}/registrants/export
 */
export function toRegistrantExport(wire: unknown): RegistrantExport | null {
  const manifestWire = field(wire, 'manifest');
  const eventId = id<LguEventId>(field(manifestWire, 'event_id'));
  const eventTitle = str(field(manifestWire, 'event_title'));
  const eventStartsAt = dateTime(field(manifestWire, 'event_starts_at'));
  const description = str(field(manifestWire, 'applied_filter_description'));
  const generatedAt = dateTime(field(manifestWire, 'generated_at'));
  const generatedBy = str(field(manifestWire, 'generated_by'));
  const rowCount = int(field(manifestWire, 'row_count'));
  const handlingNotice = str(field(manifestWire, 'handling_notice'));
  const filename = str(field(wire, 'filename'));
  const content = str(field(wire, 'content'));
  if (
    eventId === null ||
    eventTitle === null ||
    eventStartsAt === null ||
    description === null ||
    generatedAt === null ||
    generatedBy === null ||
    rowCount === null ||
    handlingNotice !== REGISTRANT_EXPORT_NOTICE ||
    filename === null ||
    content === null ||
    !content.includes(REGISTRANT_EXPORT_NOTICE) ||
    CONDITIONS_IN_THE_FILE.some((condition) => !condition.test(content))
  ) {
    return null;
  }
  return {
    manifest: {
      eventId,
      eventTitle,
      eventStartsAt,
      appliedFilterDescription: description,
      generatedAt,
      generatedBy,
      rowCount,
      handlingNotice: REGISTRANT_EXPORT_NOTICE,
    },
    content,
    filename,
  };
}

/**
 * `GET office/events/{id}/history` → one of the office's acts, with the reason it was given. The
 * trail records no field names, so a row says so (`fieldsRecorded: false`).
 *
 * @consumes GET office/events/{id}/history
 */
export function toEventHistoryRow(wire: unknown): AuditRow | null {
  const entryId = id<AuditEntryId>(field(wire, 'id'));
  const eventId = str(field(wire, 'event_id'));
  const action = oneOf(field(wire, 'category'), HISTORY_ACTIONS);
  const summary = str(field(wire, 'summary'));
  const reason = nullableWords(field(wire, 'reason'));
  const actorId = id<StaffUserId>(field(wire, 'actor_id'));
  const actorName = str(field(wire, 'actor_name'));
  const occurredAt = dateTime(field(wire, 'occurred_at'));
  if (
    entryId === null ||
    eventId === null ||
    action === null ||
    summary === null ||
    reason === undefined ||
    actorId === null ||
    actorName === null ||
    occurredAt === null
  ) {
    return null;
  }
  return toAuditRow(
    {
      id: entryId,
      entityType: 'lgu-event',
      entityId: eventId,
      action,
      summary,
      reason,
      actorId,
      actorName,
      occurredAt,
    },
    'Event',
    'api',
    null,
    false,
  );
}
