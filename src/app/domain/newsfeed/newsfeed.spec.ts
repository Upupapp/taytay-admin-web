import { asId, type CommentId, type IsoDateTime, type PostId } from '../shared/ids';
import {
  COMMENT_STATE_CATALOG,
  describeModeration,
  moderationProblems,
  orderComments,
  visibleComments,
  type Comment,
} from './comment';
import {
  ALL_RESIDENTS,
  POST_STATUS_CATALOG,
  POST_STATUS_TRANSITIONS,
  POST_PROBLEM_MESSAGES,
  countsByView,
  isLiveToResidents,
  matchesView,
  postProblems,
  type Post,
  type PostDraft,
} from './post';

const NOW = '2026-08-16T02:00:00.000Z' as IsoDateTime;

function draft(overrides: Partial<PostDraft> = {}): PostDraft {
  return {
    headline: 'Payout schedule',
    body: 'Releases at the municipal hall on the tenth.',
    category: 'announcement',
    image: null,
    linkUrl: null,
    audience: ALL_RESIDENTS,
    commentsEnabled: true,
    scheduledFor: null,
    ...overrides,
  };
}

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: asId<PostId>('post-1'),
    headline: 'Payout schedule',
    body: 'Releases at the municipal hall.',
    category: 'announcement',
    status: 'published',
    image: null,
    linkUrl: null,
    audience: ALL_RESIDENTS,
    commentsEnabled: true,
    isPinned: false,
    scheduledFor: null,
    publishedAt: NOW,
    publishedBy: null,
    reactionCount: 12,
    commentCount: 3,
    audit: {
      createdAt: NOW,
      createdBy: null,
      updatedAt: NOW,
      updatedBy: null,
    },
    ...overrides,
  };
}

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: asId<CommentId>('cmt-1'),
    postId: asId<PostId>('post-1'),
    authorResidentId: null,
    authorName: 'Reynaldo B.',
    body: 'Is the lobby open at 8?',
    state: 'visible',
    postedAt: NOW,
    moderationReason: null,
    moderatedBy: null,
    moderatedAt: null,
    officialReply: null,
    audit: { createdAt: NOW, createdBy: null, updatedAt: NOW, updatedBy: null },
    ...overrides,
  };
}

/* ── Alt text is a publication rule ───────────────────────────────────────── */

describe('an image needs a description before it goes out', () => {
  it('refuses to publish a post whose image has no alt text', () => {
    const withImage = draft({ image: { url: '/poster.png', altText: '   ' } });

    expect(postProblems(withImage, NOW, 'publish')).toContain('image-without-alt-text');
  });

  it('lets a draft be saved while the description is still missing', () => {
    // Somebody working is not an accessibility failure. The rule bites where it
    // means something (`DL-125`).
    const withImage = draft({ image: { url: '/poster.png', altText: '' } });

    expect(postProblems(withImage, NOW, 'save')).not.toContain('image-without-alt-text');
  });

  it('accepts a described image', () => {
    const described = draft({
      image: { url: '/poster.png', altText: 'A notice board showing the payout date.' },
    });

    expect(postProblems(described, NOW, 'publish')).toEqual([]);
  });

  it('says why, in words an officer can act on', () => {
    expect(POST_PROBLEM_MESSAGES['image-without-alt-text']).toContain('screen reader');
    expect(POST_PROBLEM_MESSAGES['image-without-alt-text']).toContain('advisory');
  });
});

/* ── The other publication rules ──────────────────────────────────────────── */

describe('what stops a post going out', () => {
  it('refuses an empty post', () => {
    expect(postProblems(draft({ body: '  ' }), NOW, 'publish')).toContain('body-required');
  });

  it('refuses a schedule with no time', () => {
    expect(postProblems(draft(), NOW, 'schedule')).toContain('scheduled-without-a-time');
  });

  it('refuses a time that has already passed', () => {
    const past = draft({ scheduledFor: '2026-08-01T02:00:00.000Z' as IsoDateTime });

    // Either it should have gone out or somebody mistyped, and the office
    // should be told which it meant.
    expect(postProblems(past, NOW, 'schedule')).toContain('scheduled-in-the-past');
  });

  it('refuses barangay targeting with no barangay chosen', () => {
    const targeted = draft({ audience: { scope: 'selected-barangays', barangayIds: [] } });

    expect(postProblems(targeted, NOW, 'publish')).toContain('audience-without-a-barangay');
  });

  it('refuses a link that is not one', () => {
    expect(postProblems(draft({ linkUrl: 'taytay.gov.ph' }), NOW, 'publish')).toContain(
      'link-not-a-url',
    );
    expect(postProblems(draft({ linkUrl: 'https://taytay.gov.ph' }), NOW, 'publish')).toEqual([]);
  });
});

/* ── Publishing cannot be undone ──────────────────────────────────────────── */

describe('the post lifecycle', () => {
  it('never lets a published post go back to draft', () => {
    // Editing a published post edits it in place. Pretending it can become
    // unwritten would be a second lie about what publishing did (`DL-124`).
    expect(POST_STATUS_TRANSITIONS.published).toEqual(['archived']);
  });

  it('makes archiving terminal, because a resurrected post lies about its date', () => {
    /*
     * `DL-134`, superseding `DL-124`'s republish clause. This console used to allow
     * `archived → published` on the grounds that taking a post down by mistake is ordinary.
     * That is an argument about the office; the API's is about the reader, and it wins:
     * resurfacing a post puts it back at the top of the feed with its **original date**, which
     * reads as the municipality announcing something old as though it were new.
     *
     * It was also a control that could not work — `PostStatus::Archived` has no outgoing
     * transition on the API, so the button would have produced a refusal nobody could act on.
     */
    expect(POST_STATUS_TRANSITIONS.archived).toEqual([]);
  });

  it('says on the badge that archiving does not reach anybody who already read it', () => {
    expect(POST_STATUS_CATALOG.archived.description).toContain('already read it');
  });

  it('says on the badge that a published post cannot be unsent', () => {
    expect(POST_STATUS_CATALOG.published.description).toContain('cannot be unsent');
  });
});

describe('what residents can actually see', () => {
  it('treats a scheduled post whose time has arrived as live', () => {
    // Derived from the clock, not from a job having run.
    const due = post({
      status: 'scheduled',
      scheduledFor: '2026-08-15T02:00:00.000Z' as IsoDateTime,
    });

    expect(isLiveToResidents(due, NOW)).toBe(true);
  });

  it('keeps a scheduled post private until its time', () => {
    const later = post({
      status: 'scheduled',
      scheduledFor: '2026-09-01T02:00:00.000Z' as IsoDateTime,
    });

    expect(isLiveToResidents(later, NOW)).toBe(false);
  });

  it('shows nothing of a draft', () => {
    expect(isLiveToResidents(post({ status: 'draft' }), NOW)).toBe(false);
  });
});

describe('the console views', () => {
  const posts = [
    post({ id: asId<PostId>('a'), status: 'draft' }),
    post({ id: asId<PostId>('b'), status: 'published', isPinned: true }),
    post({ id: asId<PostId>('c'), status: 'archived' }),
  ];

  it('counts each view from the same set the list renders', () => {
    const counts = countsByView(posts);

    expect(counts.all).toBe(3);
    expect(counts.drafts).toBe(1);
    expect(counts.published).toBe(1);
    expect(counts.archived).toBe(1);
    expect(counts.pinned).toBe(1);
  });

  it('does not count a pinned draft as pinned', () => {
    // A pinned draft is not pinned to anybody yet.
    const pinnedDraft = post({ status: 'draft', isPinned: true });

    expect(matchesView(pinnedDraft, 'pinned')).toBe(false);
  });
});

/* ── Moderation: hidden is reversible, removed is not ─────────────────────── */

describe('moderating a comment', () => {
  it('refuses to hide without a reason', () => {
    // Hiding somebody's words is a decision the office has to explain later.
    expect(moderationProblems(comment(), 'hide', '  ')).toContain('reason-required');
  });

  it('refuses to remove without a reason', () => {
    expect(moderationProblems(comment(), 'remove', '')).toContain('reason-required');
  });

  it('accepts a reasoned hide', () => {
    expect(moderationProblems(comment(), 'hide', 'Named a child.')).toEqual([]);
  });

  it('will not hide something already hidden', () => {
    expect(moderationProblems(comment({ state: 'hidden' }), 'hide', 'Again.')).toContain(
      'not-a-permitted-move',
    );
  });

  it('will not restore something that was never hidden', () => {
    expect(moderationProblems(comment(), 'restore', 'Why.')).toContain('not-a-permitted-move');
  });

  it('offers nothing at all on a removed comment', () => {
    // The words are gone; offering a restore would promise something the data
    // cannot deliver (`DL-127`).
    for (const action of ['hide', 'restore', 'remove', 'reply'] as const) {
      expect(moderationProblems(comment({ state: 'removed', body: null }), action, 'x')).toContain(
        'already-removed',
      );
    }
  });

  it('requires words before replying, but not a reason', () => {
    expect(moderationProblems(comment(), 'reply', '  ')).toContain('reply-required');
    expect(moderationProblems(comment(), 'reply', 'The lobby opens at 8am.')).toEqual([]);
  });
});

describe('what the two moderation outcomes mean', () => {
  it('keeps the words when a comment is hidden', () => {
    const hidden = comment({ state: 'hidden', body: 'Still here.' });

    expect(hidden.body).not.toBeNull();
    expect(COMMENT_STATE_CATALOG.hidden.description).toContain('can be put back');
  });

  it('has no words left once a comment is removed', () => {
    const removed = comment({ state: 'removed', body: null, moderationReason: 'Named a child.' });

    // Keeping abusive words forever to satisfy an append-only rule would
    // preserve the harm they did. The *act* stays on file; the words do not.
    expect(removed.body).toBeNull();
    expect(removed.moderationReason).not.toBeNull();
    expect(COMMENT_STATE_CATALOG.removed.description).toContain('cannot be restored');
    expect(COMMENT_STATE_CATALOG.removed.description).toContain('stays on file');
  });

  it('shows residents only what is visible', () => {
    const all = [
      comment({ id: asId<CommentId>('a') }),
      comment({ id: asId<CommentId>('b'), state: 'hidden' }),
      comment({ id: asId<CommentId>('c'), state: 'removed', body: null }),
    ];

    expect(visibleComments(all)).toHaveLength(1);
  });

  it('counts the moderation queue rather than pronouncing on it', () => {
    const all = [
      comment({ id: asId<CommentId>('a') }),
      comment({ id: asId<CommentId>('b'), state: 'hidden' }),
      comment({ id: asId<CommentId>('c'), state: 'removed', body: null }),
    ];

    expect(describeModeration(all)).toBe('1 visible, 1 hidden, 1 removed.');
    expect(describeModeration(all)).not.toMatch(/active|healthy|clean/i);
  });
});

describe('an official reply', () => {
  it('is attributed to the office, never to the officer who typed it', () => {
    const replied = comment({
      officialReply: { body: 'The lobby opens at 8am.', repliedAt: NOW, repliedBy: null },
    });

    // The trail records who acted; the resident sees the MSWDO (`DL-123`).
    expect(replied.officialReply).not.toBeNull();
    expect(replied.officialReply as unknown as Record<string, unknown>).not.toHaveProperty(
      'repliedByName',
    );
  });
});

describe('ordering comments', () => {
  it('puts the newest first, or the oldest, as asked', () => {
    const older = comment({ id: asId<CommentId>('a'), postedAt: '2026-08-01T00:00:00.000Z' as IsoDateTime });
    const newer = comment({ id: asId<CommentId>('b'), postedAt: '2026-08-10T00:00:00.000Z' as IsoDateTime });

    expect(orderComments([older, newer], 'newest')[0]?.id).toBe('b');
    expect(orderComments([older, newer], 'oldest')[0]?.id).toBe('a');
  });
});
