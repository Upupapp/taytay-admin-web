import type { IsoDateTime } from '../shared/ids';

/**
 * What the **separate** resident mobile app may do with Newsfeed and Events.
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
 * | View a published post | Create or edit a post |
 * | React to a post | Publish, schedule, pin or archive anything |
 * | Comment on a post | Hide or moderate another person's comment |
 * | Share a post | Create, edit or cancel an event |
 * | View a published event | See a registration list |
 * | Register to attend | Mark anybody's attendance |
 *
 * That asymmetry is the whole contract. The municipality speaks in its own
 * name; residents answer. A resident capability that could publish would let
 * somebody post under the MSWDO's masthead, which is a different kind of harm
 * from any this application otherwise guards against.
 */

/** What a resident may do. Deliberately a closed list of *reads and responses*. */
export type ResidentCapability =
  | 'newsfeed.read'
  | 'newsfeed.react'
  | 'newsfeed.comment'
  | 'newsfeed.share'
  | 'events.read'
  | 'events.register';

export const RESIDENT_CAPABILITIES: readonly ResidentCapability[] = [
  'newsfeed.read',
  'newsfeed.react',
  'newsfeed.comment',
  'newsfeed.share',
  'events.read',
  'events.register',
];

/**
 * Capabilities a resident must never hold, stated explicitly.
 *
 * An allow-list already excludes these; naming them as well is what makes the
 * intent checkable and reviewable. A future edit that adds `newsfeed.publish`
 * to the capability union has to delete a line here that says why not.
 */
export const RESIDENT_MUST_NEVER: readonly string[] = [
  'newsfeed.create',
  'newsfeed.edit',
  'newsfeed.publish',
  'newsfeed.schedule',
  'newsfeed.archive',
  'newsfeed.pin',
  'newsfeed.moderate-comments',
  'newsfeed.view-insights',
  'events.create',
  'events.edit',
  'events.publish',
  'events.cancel',
  'events.archive',
  'events.manage-registrations',
  'events.export-registrations',
  'events.mark-attendance',
  'events.view-insights',
];

export function isResidentCapability(value: string): value is ResidentCapability {
  return (RESIDENT_CAPABILITIES as readonly string[]).includes(value);
}

/* ── The shapes the resident app consumes ─────────────────────────────────── */

/**
 * A post as a **resident** sees it.
 *
 * Note what is absent, and compare it with the admin-side model that TAB 25
 * will build: no author account, no draft state, no scheduling time, no
 * moderation history, no insight counts. A resident sees a published thing and
 * who published it *as an office*, not which member of staff pressed the
 * button.
 */
export interface ResidentPostView {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** The office, never a named member of staff. */
  readonly publishedBy: string;
  readonly publishedAt: IsoDateTime;
  readonly isPinned: boolean;
  readonly reactionCount: number;
  readonly commentCount: number;
  /** Whether this resident has already reacted. Their own state, not others'. */
  readonly hasReacted: boolean;
}

/**
 * A comment as a resident sees it.
 *
 * A hidden comment is **absent** from this shape rather than present and
 * flagged: telling a resident that somebody's comment was hidden discloses a
 * moderation decision about another person, and telling them *whose* would be
 * worse.
 */
export interface ResidentCommentView {
  readonly id: string;
  readonly postId: string;
  /** The commenter's display name as they chose it. */
  readonly authorName: string;
  readonly body: string;
  readonly postedAt: IsoDateTime;
  readonly isOwn: boolean;
}

/**
 * An event as a resident sees it.
 *
 * `registrationCount` is deliberately absent: a resident deciding whether to
 * attend does not need to know how many neighbours already have, and in a
 * municipality this size a low count on a sensitive service is disclosive.
 * `capacityRemaining` answers the question they actually have.
 */
export interface ResidentEventView {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly startsAt: IsoDateTime;
  readonly endsAt: IsoDateTime | null;
  readonly venue: string;
  readonly barangayLabel: string | null;
  readonly isRegistrationOpen: boolean;
  /** `null` where the event is uncapped. Never a count of who has signed up. */
  readonly capacityRemaining: number | null;
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
  listPublishedPosts(): Promise<readonly ResidentPostView[]>;
  listComments(postId: string): Promise<readonly ResidentCommentView[]>;
  react(postId: string): Promise<void>;
  comment(postId: string, body: string): Promise<ResidentCommentView>;

  listPublishedEvents(): Promise<readonly ResidentEventView[]>;
  register(request: ResidentRegistrationRequest): Promise<ResidentRegistrationResult>;
}
