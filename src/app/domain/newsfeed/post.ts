import type { AuditStamp } from '../shared/audit';
import type { BarangayId, IsoDateTime, PostId, StaffUserId } from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * A post the municipality publishes to residents.
 *
 * One thing about this module is unlike every other in the application, and it
 * shapes the whole design: **a published post leaves the building and cannot be
 * recalled.** Everything else here is read inside the office, or handed to one
 * other organisation with a disclosure plan (`DL-82`, `DL-92`). A post goes to
 * every resident's phone, and it goes in the MSWDO's name.
 *
 * So publishing is a separate permission from editing, archiving is honest
 * about what it does and does not undo (`DL-124`), and a post carrying an image
 * cannot be published without alt text (`DL-125`).
 */

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export const POST_STATUS_CATALOG: StatusCatalog<PostStatus> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    tone: 'neutral',
    description: 'Being written. No resident can see it.',
  },
  scheduled: {
    value: 'scheduled',
    label: 'Scheduled',
    tone: 'info',
    description: 'Finished and waiting for its time. Still not visible to anybody outside.',
  },
  published: {
    value: 'published',
    label: 'Published',
    tone: 'success',
    description: 'Out. Residents can see it, and it cannot be unsent.',
  },
  archived: {
    value: 'archived',
    label: 'Archived',
    tone: 'neutral',
    // Said in the catalog, not only in a doc comment: an officer reading this
    // badge is the person who needs to know it (`DL-124`).
    description:
      'Removed from the feed going forward. Anybody who already read it still read it, and ' +
      'anybody who shared it still shared it.',
  },
};

/**
 * What the office can actually do.
 *
 * A published post can be archived but **never returned to draft**. Editing a
 * published post is editing it in place, with the change recorded; pretending
 * it can go back to being unwritten would be a second kind of lie about what
 * publishing did.
 *
 * An archived post can be republished, because taking something down by mistake
 * is an ordinary thing to do and the office should be able to correct it.
 */
export const POST_STATUS_TRANSITIONS: StatusTransitions<PostStatus> = {
  draft: ['scheduled', 'published', 'archived'],
  scheduled: ['draft', 'published', 'archived'],
  published: ['archived'],
  archived: ['published'],
};

export type PostCategory =
  | 'announcement'
  | 'public-advisory'
  | 'community-update'
  | 'program-update'
  | 'general-news';

export const POST_CATEGORY_LABELS: Readonly<Record<PostCategory, string>> = {
  announcement: 'Announcement',
  'public-advisory': 'Public advisory',
  'community-update': 'Community update',
  'program-update': 'Programme or service update',
  'general-news': 'General news',
};

/**
 * A cover image, and the description that goes with it.
 *
 * `altText` is **not optional** (`DL-125`). WCAG 2.2 AA is this application's
 * target (`DL-20`), and a municipal advisory whose only content is a poster
 * image is unreadable to a resident using a screen reader — which, for a public
 * advisory, means unreachable by the people most likely to need it read aloud.
 *
 * The field is required by the type and re-checked by `postProblems`, because a
 * required field on a draft is a prompt and a required field at publication is
 * a rule.
 */
export interface PostImage {
  readonly url: string;
  /** What the image shows, for somebody who cannot see it. Never the file name. */
  readonly altText: string;
}

/**
 * Who a post is for.
 *
 * Defaults to everyone. Barangay targeting exists because the data model
 * already carries `BarangayId` everywhere, so it costs nothing — but a post
 * narrowed to one barangay is still **public** to that barangay, not private.
 * Targeting is about relevance, never confidentiality.
 */
export interface PostAudience {
  readonly scope: 'all-residents' | 'selected-barangays';
  readonly barangayIds: readonly BarangayId[];
}

export const ALL_RESIDENTS: PostAudience = { scope: 'all-residents', barangayIds: [] };

export interface Post {
  readonly id: PostId;
  readonly headline: string | null;
  readonly body: string;
  readonly category: PostCategory;
  readonly status: PostStatus;
  readonly image: PostImage | null;
  readonly linkUrl: string | null;
  readonly audience: PostAudience;
  readonly commentsEnabled: boolean;
  readonly isPinned: boolean;
  /** Set while `scheduled`. Cleared once the post goes out. */
  readonly scheduledFor: IsoDateTime | null;
  readonly publishedAt: IsoDateTime | null;
  readonly publishedBy: StaffUserId | null;
  /**
   * Counts, never who.
   *
   * An officer needs to know a post reached people; they do not need to know
   * which residents reacted to an advisory about food assistance (`DL-126`).
   */
  readonly reactionCount: number;
  readonly commentCount: number;
  readonly audit: AuditStamp;
}

export interface PostDraft {
  readonly headline: string | null;
  readonly body: string;
  readonly category: PostCategory;
  readonly image: PostImage | null;
  readonly linkUrl: string | null;
  readonly audience: PostAudience;
  readonly commentsEnabled: boolean;
  readonly scheduledFor: IsoDateTime | null;
}

export type PostProblem =
  | 'body-required'
  | 'image-without-alt-text'
  | 'scheduled-without-a-time'
  | 'scheduled-in-the-past'
  | 'audience-without-a-barangay'
  | 'link-not-a-url';

/**
 * What stops a post going out.
 *
 * Checked in the domain so the composer, the adapter and the API contract all
 * refuse the same things. A screen that merely disables a button is a screen
 * somebody can get past.
 */
export function postProblems(
  draft: PostDraft,
  now: IsoDateTime,
  intent: 'save' | 'publish' | 'schedule' = 'publish',
): readonly PostProblem[] {
  const problems: PostProblem[] = [];

  if (draft.body.trim().length === 0) {
    problems.push('body-required');
  }
  // Enforced on the way out rather than on every keystroke: a half-written
  // draft with an image and no description yet is somebody working, not an
  // accessibility failure.
  if (intent !== 'save' && draft.image !== null && draft.image.altText.trim().length === 0) {
    problems.push('image-without-alt-text');
  }
  if (intent === 'schedule') {
    if (draft.scheduledFor === null) {
      problems.push('scheduled-without-a-time');
    } else if (draft.scheduledFor <= now) {
      // A post scheduled for a moment that has passed is either published or a
      // mistake, and the office should be told which it meant.
      problems.push('scheduled-in-the-past');
    }
  }
  if (draft.audience.scope === 'selected-barangays' && draft.audience.barangayIds.length === 0) {
    problems.push('audience-without-a-barangay');
  }
  if (draft.linkUrl !== null && !/^https?:\/\/\S+$/.test(draft.linkUrl.trim())) {
    problems.push('link-not-a-url');
  }

  return problems;
}

export const POST_PROBLEM_MESSAGES: Readonly<Record<PostProblem, string>> = {
  'body-required': 'A post needs something to say.',
  'image-without-alt-text':
    'Describe the image before publishing. A resident using a screen reader gets nothing from a ' +
    'poster with no description, and an advisory is exactly what they need read aloud.',
  'scheduled-without-a-time': 'Choose when this should go out.',
  'scheduled-in-the-past': 'That time has passed. Publish it now, or pick a later time.',
  'audience-without-a-barangay': 'Choose at least one barangay, or send it to everyone.',
  'link-not-a-url': 'A link needs to start with http:// or https://.',
};

/* ── The list views the console offers ────────────────────────────────────── */

export type PostView = 'all' | 'drafts' | 'scheduled' | 'published' | 'archived' | 'pinned';

export const POST_VIEW_LABELS: Readonly<Record<PostView, string>> = {
  all: 'All',
  drafts: 'Drafts',
  scheduled: 'Scheduled',
  published: 'Published',
  archived: 'Archived',
  pinned: 'Pinned',
};

export function matchesView(post: Post, view: PostView): boolean {
  switch (view) {
    case 'all':
      return true;
    case 'drafts':
      return post.status === 'draft';
    case 'scheduled':
      return post.status === 'scheduled';
    case 'published':
      return post.status === 'published';
    case 'archived':
      return post.status === 'archived';
    case 'pinned':
      // A pinned draft is not pinned to anybody yet.
      return post.isPinned && post.status === 'published';
  }
}

export interface PostFilter {
  readonly search?: string;
  readonly category?: PostCategory;
  readonly from?: IsoDateTime;
  readonly to?: IsoDateTime;
}

/**
 * Whether a post is visible to residents **right now**.
 *
 * Derived, never stored: a scheduled post becomes visible because its time
 * arrives, not because a job ran (`DL-83`, `DL-88` restated).
 */
export function isLiveToResidents(post: Post, now: IsoDateTime): boolean {
  if (post.status === 'published') {
    return true;
  }
  return post.status === 'scheduled' && post.scheduledFor !== null && post.scheduledFor <= now;
}

/** Counts for the view tabs, so a heading never disagrees with its list. */
export function countsByView(posts: readonly Post[]): Readonly<Record<PostView, number>> {
  const views = Object.keys(POST_VIEW_LABELS) as PostView[];
  const counts = {} as Record<PostView, number>;
  for (const view of views) {
    counts[view] = posts.filter((post) => matchesView(post, view)).length;
  }
  return counts;
}
