import type { AuditStamp } from '../shared/audit';
import type { CommentId, IsoDateTime, PostId, ResidentId, StaffUserId } from '../shared/ids';
import type { StatusCatalog } from '../shared/status';

/**
 * A comment a resident left on a post, and what the office may do about it.
 *
 * Moderation is the sharpest thing in this module. Hiding or removing a
 * comment is a decision about **somebody's own words**, taken by the
 * municipality, about a person who has far less power than the municipality.
 * The office should be able to do it — a comment naming a child, or abusing a
 * neighbour, has to come down — and it should never be able to do it silently.
 *
 * So every moderation act carries a reason and appends to the audit trail
 * (`DL-54`, restated for this module in `DL-127`), and the two acts differ in
 * exactly one respect:
 *
 *  - **Hidden** is reversible. The words are kept, the resident's comment stops
 *    being visible, and the office can put it back.
 *  - **Removed** is not. The words are gone, because keeping an abusive comment
 *    forever to satisfy an append-only rule would preserve the harm it did.
 *    **The act stays on file even though the words do not** — who removed it,
 *    when, and why.
 *
 * That asymmetry is the whole design. An append-only trail of *acts* is what
 * accountability needs; an append-only trail of *abuse* is not.
 */

export type CommentState = 'visible' | 'hidden' | 'removed';

export const COMMENT_STATE_CATALOG: StatusCatalog<CommentState> = {
  visible: {
    value: 'visible',
    label: 'Visible',
    tone: 'neutral',
    description: 'Residents can see it.',
  },
  hidden: {
    value: 'hidden',
    label: 'Hidden',
    tone: 'warning',
    description: 'Withheld from residents. The words are kept, and it can be put back.',
  },
  removed: {
    value: 'removed',
    label: 'Removed',
    tone: 'danger',
    description:
      'The words are gone and cannot be restored. Who removed it, when and why stays on file.',
  },
};

export interface Comment {
  readonly id: CommentId;
  readonly postId: PostId;
  /** Who wrote it. Held so the office can act, never shown beside the words. */
  readonly authorResidentId: ResidentId | null;
  /** The display name the resident chose in the mobile app. */
  readonly authorName: string;
  /**
   * What they wrote. **`null` once removed**, which is what makes removal
   * removal rather than a flag on a row that still holds the text.
   */
  readonly body: string | null;
  readonly state: CommentState;
  readonly postedAt: IsoDateTime;
  /** Why the office hid or removed it. Required for either. */
  readonly moderationReason: string | null;
  readonly moderatedBy: StaffUserId | null;
  readonly moderatedAt: IsoDateTime | null;
  /** An official reply, written as the office rather than as a named officer. */
  readonly officialReply: OfficialReply | null;
  readonly audit: AuditStamp;
}

/**
 * The office answering a resident in public.
 *
 * Attributed to the **office**, not to the member of staff who typed it — the
 * same rule as `ResidentPostView` (`DL-123`). A caseworker replying to a
 * comment about their own case load should not have their name published
 * beside it, and the audit trail already records who acted.
 */
export interface OfficialReply {
  readonly body: string;
  readonly repliedAt: IsoDateTime;
  /** Recorded for the trail. Never rendered to residents. */
  readonly repliedBy: StaffUserId | null;
}

export type ModerationAction = 'hide' | 'restore' | 'remove' | 'reply';

export const MODERATION_LABELS: Readonly<Record<ModerationAction, string>> = {
  hide: 'Hide',
  restore: 'Restore',
  remove: 'Remove permanently',
  reply: 'Reply as the office',
};

export type CommentProblem =
  | 'reason-required'
  | 'not-a-permitted-move'
  | 'reply-required'
  | 'already-removed';

/**
 * Whether a moderation act may proceed.
 *
 * A removed comment is terminal: there is nothing left to restore, and offering
 * the control would promise something the data cannot deliver.
 */
export function moderationProblems(
  comment: Comment,
  action: ModerationAction,
  text: string,
): readonly CommentProblem[] {
  const problems: CommentProblem[] = [];

  if (comment.state === 'removed') {
    problems.push('already-removed');
    return problems;
  }

  if (action === 'reply') {
    if (text.trim().length === 0) {
      problems.push('reply-required');
    }
    return problems;
  }

  // Hiding, restoring and removing are all decisions about a resident's words,
  // and none of them may be taken without saying why.
  if (text.trim().length === 0) {
    problems.push('reason-required');
  }
  if (action === 'hide' && comment.state !== 'visible') {
    problems.push('not-a-permitted-move');
  }
  if (action === 'restore' && comment.state !== 'hidden') {
    problems.push('not-a-permitted-move');
  }

  return problems;
}

export const COMMENT_PROBLEM_MESSAGES: Readonly<Record<CommentProblem, string>> = {
  'reason-required':
    'Say why. Hiding or removing somebody’s words is a decision the office has to be able to ' +
    'explain later.',
  'not-a-permitted-move': 'That is not something this comment can do from where it is.',
  'reply-required': 'Write the reply first.',
  'already-removed': 'This comment was removed. Its words are gone and cannot be brought back.',
};

/** What residents can see, for the count shown beside a post. */
export function visibleComments(comments: readonly Comment[]): readonly Comment[] {
  return comments.filter((comment) => comment.state === 'visible');
}

export type CommentOrder = 'newest' | 'oldest';

export function orderComments(
  comments: readonly Comment[],
  order: CommentOrder,
): readonly Comment[] {
  return [...comments].sort((a, b) =>
    order === 'newest'
      ? b.postedAt.localeCompare(a.postedAt)
      : a.postedAt.localeCompare(b.postedAt),
  );
}

export interface CommentFilter {
  readonly search?: string;
  readonly state?: CommentState;
}

/**
 * What the moderation queue amounts to, in counts.
 *
 * Counts rather than a verdict, as everywhere else in this application
 * (`DL-90`). "2 hidden, 1 removed" is something a supervisor can check;
 * "moderation: active" is not.
 */
export function describeModeration(comments: readonly Comment[]): string {
  const hidden = comments.filter((comment) => comment.state === 'hidden').length;
  const removed = comments.filter((comment) => comment.state === 'removed').length;
  const visible = comments.filter((comment) => comment.state === 'visible').length;

  const parts = [`${visible} visible`];
  if (hidden > 0) parts.push(`${hidden} hidden`);
  if (removed > 0) parts.push(`${removed} removed`);
  return `${parts.join(', ')}.`;
}
