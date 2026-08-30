import type { AuditStamp } from '../shared/audit';
import type {
  BarangayId,
  EventRegistrationId,
  IsoDateTime,
  LguEventId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * Somebody who signed up, and what happened on the day.
 *
 * Every registration in this application was created **somewhere else** — by a
 * resident, on their own phone, in an app this repository does not build. The
 * office manages what arrives. Two consequences run through the file:
 *
 *   1. **The office is shown a composed view, not a resident record**
 *      (`DL-130`). A registrant list is a list of people who signed up for a
 *      feeding programme; it is not an occasion to hand every clerk a birth
 *      date and an income.
 *   2. **The count is a snapshot** (`DL-129`). Residents are registering while
 *      the office reads the screen, and nothing here holds a lock.
 */

export type RegistrationStatus = 'registered' | 'waitlisted' | 'cancelled';

export const REGISTRATION_STATUS_CATALOG: StatusCatalog<RegistrationStatus> = {
  registered: {
    value: 'registered',
    label: 'Registered',
    tone: 'success',
    description: 'Holding a place.',
  },
  waitlisted: {
    value: 'waitlisted',
    label: 'Waitlisted',
    tone: 'warning',
    description: 'Waiting for a place. Moved up by the office, never automatically.',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    tone: 'neutral',
    description: 'Withdrawn, by the resident or by the office. Can be restored.',
  },
};

/**
 * A cancelled registration can be restored — unlike a cancelled event.
 *
 * The asymmetry is deliberate. Cancelling an event is a public act read by
 * everybody registered (`DL-131`); cancelling one registration is a change to
 * one person's place, and somebody who withdrew on Monday and can come after
 * all on Tuesday should not be made to sign up again from a phone they may not
 * have with them.
 */
export const REGISTRATION_STATUS_TRANSITIONS: StatusTransitions<RegistrationStatus> = {
  registered: ['cancelled', 'waitlisted'],
  waitlisted: ['registered', 'cancelled'],
  cancelled: ['registered', 'waitlisted'],
};

export type AttendanceStatus = 'not-checked-in' | 'attended' | 'no-show';

export const ATTENDANCE_CATALOG: StatusCatalog<AttendanceStatus> = {
  'not-checked-in': {
    value: 'not-checked-in',
    label: 'Not checked in',
    tone: 'neutral',
    // The distinction this application refuses to blur, and the reason
    // `completed` is an act rather than a clock reading (`DL-131`).
    description: 'Nothing recorded. This is not the same as saying they did not come.',
  },
  attended: {
    value: 'attended',
    label: 'Attended',
    tone: 'success',
    description: 'Came, and somebody marked it.',
  },
  'no-show': {
    value: 'no-show',
    label: 'No-show',
    tone: 'warning',
    description:
      'Registered and did not come. A claim about a person, so it is only ever recorded by hand.',
  },
};

/**
 * The full record, as the data layer holds it.
 *
 * Screens never receive this. They receive `RegistrantView` (`DL-130`).
 */
export interface EventRegistration {
  readonly id: EventRegistrationId;
  readonly eventId: LguEventId;
  readonly reference: string;
  readonly residentId: ResidentId;
  readonly registeredAt: IsoDateTime;
  readonly status: RegistrationStatus;
  readonly attendance: AttendanceStatus;
  /** Anything the office added. Withheld from anybody without the grant. */
  readonly notes: string | null;
  readonly statusReason: string | null;
  readonly updatedBy: StaffUserId | null;
  readonly audit: AuditStamp;
}

/**
 * What a screen is given.
 *
 * Composed in the data layer, like a referral summary (`DL-82`) and a payout
 * manifest (`DL-92`), so a template cannot render a field it was never handed.
 * The closed set is: the reference, a display name, the barangay, when they
 * signed up, their status, their attendance, and notes **only** where the
 * reader holds the grant.
 *
 * Everything else a resident record contains — address, birth date, PhilSys
 * digits, income, sector, household — is absent by construction. An events
 * clerk marking attendance at a feeding programme has no need of any of it,
 * and RA 10173 minimisation is not satisfied by a screen choosing not to
 * display what it was sent.
 */
export interface RegistrantView {
  readonly id: EventRegistrationId;
  readonly reference: string;
  readonly displayName: string;
  readonly barangayId: BarangayId | null;
  readonly registeredAt: IsoDateTime;
  readonly status: RegistrationStatus;
  readonly attendance: AttendanceStatus;
  /** `null` where the reader lacks `events.manage-registrations`. */
  readonly notes: string | null;
}

export interface RegistrantFilter {
  readonly search?: string;
  readonly status?: RegistrationStatus;
  readonly attendance?: AttendanceStatus;
}

/* ── Capacity, honestly ───────────────────────────────────────────────────── */

/**
 * How full the event was **when the office asked**.
 *
 * `asOf` is required rather than optional, and the screen prints it. The
 * command is explicit that the client must not invent backend concurrency
 * guarantees, and the failure it prevents is concrete: two clerks each read
 * "1 place left", each promote a different person from the waitlist, and one
 * family is turned away at the door by a number this application showed them
 * (`DL-129`).
 *
 * So this type carries no `hasRoom`, no `canRegister` and no `isAvailable`. It
 * reports counts and the moment they were taken. Whether a place exists is a
 * question only the backend can answer, and it answers it by accepting or
 * refusing the write.
 */
export interface EventCapacitySummary {
  readonly capacity: number | null;
  readonly registeredCount: number;
  readonly waitlistedCount: number;
  readonly cancelledCount: number;
  readonly attendedCount: number;
  readonly noShowCount: number;
  readonly asOf: IsoDateTime;
}

/**
 * Places left, or `null` where no capacity was set.
 *
 * Never negative: a backend that accepted more than capacity has told the
 * office something true, and rendering "-3 remaining" turns that into an
 * apparent bug in the display rather than a fact about the day.
 */
export function placesRemaining(summary: EventCapacitySummary): number | null {
  if (summary.capacity === null) {
    return null;
  }
  return Math.max(0, summary.capacity - summary.registeredCount);
}

/** Counts in words, with no verdict attached. */
export function describeCapacity(summary: EventCapacitySummary): string {
  const parts = [
    summary.capacity === null
      ? `${summary.registeredCount} registered, no capacity set`
      : `${summary.registeredCount} of ${summary.capacity} registered`,
  ];
  if (summary.waitlistedCount > 0) {
    parts.push(`${summary.waitlistedCount} waitlisted`);
  }
  if (summary.cancelledCount > 0) {
    parts.push(`${summary.cancelledCount} cancelled`);
  }
  return `${parts.join(', ')}.`;
}

/**
 * What attendance adds up to, and what it does not yet.
 *
 * Reports the unmarked count in its own right rather than folding it into
 * no-shows. "41 attended, 3 no-shows, 12 not yet marked" is a different
 * statement from "41 attended, 15 no-shows", and only one of them is true
 * before somebody has finished going down the list.
 */
export function describeAttendance(summary: EventCapacitySummary): string {
  const marked = summary.attendedCount + summary.noShowCount;
  const unmarked = Math.max(0, summary.registeredCount - marked);
  const parts = [`${summary.attendedCount} attended`, `${summary.noShowCount} no-shows`];
  if (unmarked > 0) {
    parts.push(`${unmarked} not yet marked`);
  }
  return `${parts.join(', ')}.`;
}

/* ── Acting on a registration ─────────────────────────────────────────────── */

export type RegistrationAction = 'cancel' | 'restore' | 'promote' | 'waitlist';

export const REGISTRATION_ACTION_LABELS: Readonly<Record<RegistrationAction, string>> = {
  cancel: 'Cancel registration',
  restore: 'Restore registration',
  promote: 'Move to registered',
  waitlist: 'Move to waitlist',
};

const ACTION_TARGET: Readonly<Record<RegistrationAction, RegistrationStatus>> = {
  cancel: 'cancelled',
  restore: 'registered',
  promote: 'registered',
  waitlist: 'waitlisted',
};

export function targetStatusOf(action: RegistrationAction): RegistrationStatus {
  return ACTION_TARGET[action];
}

export type RegistrationProblem = 'reason-required' | 'not-a-permitted-move';

export function registrationProblems(
  registration: EventRegistration,
  action: RegistrationAction,
  reason: string,
): readonly RegistrationProblem[] {
  const problems: RegistrationProblem[] = [];
  const target = targetStatusOf(action);

  if (reason.trim().length === 0) {
    // Somebody's place at a payout or a feeding programme, changed by an
    // officer rather than by them. The office has to be able to say why.
    problems.push('reason-required');
  }
  if (!REGISTRATION_STATUS_TRANSITIONS[registration.status].includes(target)) {
    problems.push('not-a-permitted-move');
  }
  return problems;
}

export const REGISTRATION_PROBLEM_MESSAGES: Readonly<Record<RegistrationProblem, string>> = {
  'reason-required': 'Say why. It is recorded against your name and the resident can ask.',
  'not-a-permitted-move': 'That is not a move this registration can make from where it is.',
};

/**
 * Whether promotion should be **offered** — never whether it will succeed.
 *
 * Takes the status rather than the record, because the screen holds a
 * `RegistrantView` and casting one shape into another to satisfy a signature
 * is how a view and a record quietly become the same thing.
 *
 * Offered on any waitlisted registration, including one the office's own
 * numbers call full: those numbers are a snapshot, somebody may have cancelled
 * a second ago, and the backend is the only thing that knows. The screen warns
 * where the snapshot says full, and lets the office try (`DL-129`).
 */
export function canOfferPromotion(status: RegistrationStatus): boolean {
  return status === 'waitlisted';
}

/**
 * Whether the office is about to exceed its own stated capacity.
 *
 * A **warning**, not a gate — the same treatment as a self-release (`DL-91`).
 * A social worker who knows a family travelled two hours should not be stopped
 * by a client-side count, and the backend refuses if it must.
 */
export function promotionExceedsCapacity(summary: EventCapacitySummary): boolean {
  return summary.capacity !== null && summary.registeredCount >= summary.capacity;
}

/* ── Metrics ──────────────────────────────────────────────────────────────── */

/**
 * What the office learns about an event.
 *
 * Counts and rates over its own registrations, and nothing about which
 * residents did what — the same boundary as a post's reach (`DL-126`).
 * `attendanceRate` is `null` until attendance is final, because a rate
 * computed while half the list is unmarked reads as a poor turnout and is
 * really an unfinished afternoon.
 */
export interface EventMetrics {
  readonly eventId: LguEventId;
  readonly registeredCount: number;
  readonly waitlistedCount: number;
  /**
   * Cancellations, or `null` where the office record does not report them.
   *
   * Nullable rather than zero. `registration-summary` publishes registered, waitlisted and the
   * three attendance states, and nothing about cancellations — and a `0` there is a claim that
   * nobody withdrew, which is precisely the kind of positive statement `DL-146` refuses to make
   * from data nobody sent. A screen shows the absence; it does not report a quiet nought.
   */
  readonly cancelledCount: number | null;
  readonly attendedCount: number;
  readonly noShowCount: number;
  readonly unmarkedCount: number;
  readonly attendanceRate: number | null;
  /**
   * When this console **read** the counts — not when the office record computed them.
   *
   * `DL-129` requires the moment to travel with the numbers, because "38 registered" without a
   * timestamp is a claim about now that was true at some point. The server does not stamp its own
   * summary, so the closest true statement this console can make is when it asked, and every
   * screen must word it that way: *read at*, never *as of*. The difference is small and it is the
   * whole difference between reporting a fact and inheriting one.
   *
   * The gap is recorded rather than closed here: only the server can say when it counted.
   */
  readonly asOf: IsoDateTime;
}

export function attendanceRateOf(
  summary: EventCapacitySummary,
  isFinal: boolean,
): number | null {
  if (!isFinal || summary.registeredCount === 0) {
    return null;
  }
  return summary.attendedCount / summary.registeredCount;
}

/* ── The list as a file ───────────────────────────────────────────────────── */

/**
 * What travels with an exported registrant list.
 *
 * The same doctrine as a report export (`DL-106`): the conditions live **in**
 * the file, not beside it, because a spreadsheet found on a laptop in eight
 * months has no context except what it carries.
 *
 * This one names people by definition — that is what a registrant list is — so
 * there is no aggregate alternative to offer and no suppression to apply. What
 * there is instead is the narrower closed set (`DL-130`): the export holds
 * exactly the columns the screen showed, which is why `events.export-
 * registrations` is classified read-only rather than as a wider read.
 */
export interface RegistrantExportManifest {
  readonly eventId: LguEventId;
  readonly eventTitle: string;
  readonly eventStartsAt: IsoDateTime;
  readonly appliedFilterDescription: string;
  readonly generatedAt: IsoDateTime;
  readonly generatedBy: string;
  readonly rowCount: number;
  readonly handlingNotice: string;
}

export interface RegistrantExport {
  readonly manifest: RegistrantExportManifest;
  /** Composed by the data layer, never assembled by a screen (`DL-92`). */
  readonly content: string;
  readonly filename: string;
}

export const REGISTRANT_EXPORT_NOTICE =
  'This file lists residents who registered for a municipal event. It is held by the MSWDO of ' +
  'Taytay, Rizal and protected under RA 10173. Take it to the venue if you need it there, keep ' +
  'it within the office otherwise, and delete it once attendance has been recorded.';
