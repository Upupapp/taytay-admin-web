import type { IsoDateTime } from '../shared/ids';

/**
 * What the **separate** resident mobile app may do with Events.
 *
 * This file is a **contract, not an implementation** (`DL-123`). The late-phase
 * command is explicit on both halves: the admin portal may define typed
 * interfaces describing the data the resident app consumes, and it must not
 * implement that app. There is no resident component, no resident route and no
 * resident-facing screen anywhere in this repository, and
 * `npm run check:community` fails the build if one appears.
 *
 * Writing the contract down here is still worth doing. The resident app is
 * built by another team against the same backend, and the boundary is easiest
 * to state while the admin side is being designed — not afterwards, when the
 * two have each assumed something different about who may post.
 *
 * ## The boundary
 *
 * A resident may **read and respond**. A resident may never **publish**:
 *
 * | Resident may | Resident may never |
 * | --- | --- |
 * | View a published event | Create, edit, publish, cancel or archive an event |
 * | Register to attend | See a registration list, or export one |
 * | | Mark anybody's attendance |
 * | | Write, publish or pin Balita |
 *
 * That asymmetry is the whole contract. The municipality speaks in its own
 * name; residents answer. A resident capability that could publish would let
 * somebody post under the MSWDO's masthead, which is a different kind of harm
 * from any this application otherwise guards against.
 *
 * The console's newsfeed, and with it the post and comment shapes this file
 * described, was retired in favour of Balita (`DL-194`). Residents read Balita
 * in the app through the API's own `GET /news`; that contract is the API's,
 * not one this repository writes down. Comments and reactions on Balita are a
 * future Balita feature for the owner, and would be added here when built.
 */

/** What a resident may do. Deliberately a closed list of *reads and responses*. */
export type ResidentCapability = 'events.read' | 'events.register';

export const RESIDENT_CAPABILITIES: readonly ResidentCapability[] = [
  'events.read',
  'events.register',
];

/**
 * Capabilities a resident must never hold, stated explicitly.
 *
 * An allow-list already excludes these; naming them as well is what makes the
 * intent checkable and reviewable. A future edit that adds `event.publish`
 * to the capability union has to delete a line here that says why not.
 *
 * `news.write` is Balita's key — writing, publishing and pinning the news every
 * resident reads (`DL-171`) — and stands here for the `newsfeed.*` keys retired
 * with the newsfeed (`DL-194`): the one news channel is the one a resident must
 * never be able to publish to.
 */
export const RESIDENT_MUST_NEVER: readonly string[] = [
  'news.write',
  'event.create',
  'event.edit',
  'event.publish',
  'event.cancel',
  'event.archive',
  'event.manage-registrations',
  'event.export-registrants',
  'event.mark-attendance',
  'event.view-insights',
];

export function isResidentCapability(value: string): value is ResidentCapability {
  return (RESIDENT_CAPABILITIES as readonly string[]).includes(value);
}

/* ── The shapes the resident app consumes ─────────────────────────────────── */

/**
 * Where registration stands for the resident reading an event — a state, never a number.
 *
 * As the Node API serves it (`GET events`, `DL-192`): derived on every read from the plan, the clock
 * and the count, with the office's sentence beside it. A full event that keeps a waitlist is `open`.
 */
export type ResidentRegistrationState =
  | 'not_required'
  | 'not_open'
  | 'open'
  | 'full'
  | 'closed'
  | 'registered'
  | 'waitlisted';

/**
 * An event as a resident sees it.
 *
 * `registrationCount` is deliberately absent: a resident deciding whether to
 * attend does not need to know how many neighbours already have, and in a
 * municipality this size a low count on a sensitive service is disclosive.
 * So is a places-left number (`DL-192`, superseding the `capacityRemaining`
 * this type carried): capacity minus a count is the same count, and a remaining
 * figure read off a stale page sends somebody to a covered court for a place
 * that went an hour ago. The published total is a fact about the event; where
 * registration stands is a state the server words.
 */
export interface ResidentEventView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime | null;
  readonly venue: string;
  readonly barangayLabel: string | null;
  /** The published total, or `null` where the event is uncapped. Never what is left of it. */
  readonly capacity: number | null;
  readonly registrationState: ResidentRegistrationState;
  /** The office's sentence for that state. */
  readonly registrationWords: string;
  readonly isRegistered: boolean;
}

/**
 * What a resident submits to register.
 *
 * No free-text field beyond a note the resident chooses to write, and no place
 * to record why they are attending: an events module is not an intake form,
 * and a "reason for attending" on a livelihood seminar collects means
 * information the office did not ask for and has no basis to hold.
 */
export interface ResidentRegistrationRequest {
  readonly eventId: string;
  readonly attendeeCount: number;
  readonly note: string | null;
}

export type ResidentRegistrationOutcome =
  | 'registered'
  | 'waitlisted'
  | 'registration-closed'
  | 'already-registered'
  | 'event-cancelled';

export interface ResidentRegistrationResult {
  readonly outcome: ResidentRegistrationOutcome;
  /** What the resident is told, in words. Never a code for them to interpret. */
  readonly message: string;
}

/**
 * The read-and-respond surface, as an interface the resident app's own client
 * would implement.
 *
 * **Nothing here is implemented in this repository**, and nothing here creates
 * or publishes. It exists so the admin side and the resident side agree on the
 * boundary before either has to change to accommodate the other.
 */
export interface ResidentCommunityContract {
  listPublishedEvents(): Promise<readonly ResidentEventView[]>;
  register(request: ResidentRegistrationRequest): Promise<ResidentRegistrationResult>;
}
