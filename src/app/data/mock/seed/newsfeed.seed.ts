import {
  ALL_RESIDENTS,
  asId,
  type Comment,
  type CommentId,
  type Post,
  type PostId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { daysBeforeAnchor, stamp } from './seed-utils';

const head = asId<StaffUserId>('staff-head');

/**
 * Posts the office has published, is writing, or has taken down.
 *
 * Between them these exercise every state and both moderation outcomes,
 * including the two the office most needs told apart: a **hidden** comment,
 * whose words are kept and can be put back, and a **removed** one, whose words
 * are gone while the record of the removal stays (`DL-127`).
 *
 * Every image carries alt text, because a post that could not be published
 * without it should not be seeded without it either (`DL-125`).
 */
export const MOCK_POSTS: readonly Post[] = [
  {
    id: asId<PostId>('post-0001'),
    headline: 'AICS payout — second week of August',
    body:
      'Approved medical and burial assistance for the second week of August will be released at ' +
      'the Municipal Hall lobby on 10 August, from 8am. Bring the voucher and a valid ID. If ' +
      'somebody else is collecting on your behalf, they need a letter of authority and a copy of ' +
      'your ID.',
    category: 'announcement',
    status: 'published',
    image: {
      url: '/assets/newsfeed/payout-notice.svg',
      altText:
        'A notice board at the Municipal Hall lobby showing the payout date and time in large ' +
        'lettering.',
    },
    linkUrl: null,
    audience: ALL_RESIDENTS,
    commentsEnabled: true,
    isPinned: true,
    scheduledFor: null,
    publishedAt: daysBeforeAnchor(6, 9),
    publishedBy: head,
    reactionCount: 47,
    commentCount: 3,
    audit: stamp(7, 6),
  },
  {
    id: asId<PostId>('post-0002'),
    headline: 'Heavy rain: what to do if your barangay floods',
    body:
      'The municipal disaster office has raised a yellow warning for the next two days. If water ' +
      'reaches your doorstep, move to the nearest evacuation centre and tell your barangay ' +
      'focal person. The MSWDO will be at the covered court in San Juan and the barangay hall ' +
      'in Dolores from 6am.',
    category: 'public-advisory',
    status: 'published',
    image: null,
    linkUrl: null,
    audience: ALL_RESIDENTS,
    commentsEnabled: true,
    isPinned: false,
    scheduledFor: null,
    publishedAt: daysBeforeAnchor(3, 6),
    publishedBy: head,
    reactionCount: 132,
    commentCount: 2,
    audit: stamp(3, 3),
  },
  {
    id: asId<PostId>('post-0003'),
    headline: 'Livelihood Starter Kit: applications paused',
    body:
      'Applications for the Livelihood Starter Kit are paused until the next tranche of funds ' +
      'reaches the office. Anybody who already applied keeps their place; nothing needs to be ' +
      'done again. We will post here the day applications reopen.',
    category: 'program-update',
    status: 'published',
    image: null,
    linkUrl: null,
    audience: ALL_RESIDENTS,
    // Turned off deliberately: the office could not answer the volume of
    // individual case questions this drew, and said so rather than leaving
    // people unanswered.
    commentsEnabled: false,
    isPinned: false,
    scheduledFor: null,
    publishedAt: daysBeforeAnchor(9, 14),
    publishedBy: head,
    reactionCount: 18,
    commentCount: 0,
    audit: stamp(10, 8),
  },
  {
    id: asId<PostId>('post-0004'),
    headline: 'Senior citizens: quarterly stipend schedule',
    body:
      'The next quarterly stipend for senior citizens will be released by barangay. San Juan and ' +
      'Dolores on the 18th, Muzon and Santa Ana on the 19th, San Isidro on the 20th. Times to ' +
      'follow.',
    category: 'community-update',
    status: 'scheduled',
    image: null,
    linkUrl: null,
    audience: ALL_RESIDENTS,
    commentsEnabled: true,
    isPinned: false,
    // Ahead of the seed anchor, so it is genuinely still waiting.
    scheduledFor: '2026-08-17T01:00:00.000Z' as Post['scheduledFor'],
    publishedAt: null,
    publishedBy: null,
    reactionCount: 0,
    commentCount: 0,
    audit: stamp(2, 1),
  },
  {
    id: asId<PostId>('post-0005'),
    headline: null,
    body:
      'Draft: reminder about the requirements for educational assistance before the school year ' +
      'starts. Needs the list of documents checked against the programme record before this goes ' +
      'anywhere.',
    category: 'general-news',
    status: 'draft',
    image: null,
    linkUrl: null,
    audience: { scope: 'selected-barangays', barangayIds: [] },
    commentsEnabled: true,
    isPinned: false,
    scheduledFor: null,
    publishedAt: null,
    publishedBy: null,
    reactionCount: 0,
    commentCount: 0,
    audit: stamp(1, 1),
  },
  {
    id: asId<PostId>('post-0006'),
    headline: 'Feeding programme sign-up — closed',
    body:
      'Sign-up for the supplementary feeding programme has closed for this cycle. Households ' +
      'already on the list will be contacted by their barangay focal person.',
    category: 'program-update',
    // Taken down because the cycle ended. Anybody who read it still read it.
    status: 'archived',
    image: null,
    linkUrl: null,
    audience: ALL_RESIDENTS,
    commentsEnabled: false,
    isPinned: false,
    scheduledFor: null,
    publishedAt: daysBeforeAnchor(40, 10),
    publishedBy: head,
    reactionCount: 64,
    commentCount: 0,
    audit: stamp(41, 20),
  },
];

/**
 * Comments residents left, and what the office did about them.
 *
 * `cmt-0003` is the case the whole moderation design exists for: a comment that
 * named somebody else's child. Its words are gone; the record of who removed
 * it, when and why is not.
 */
export const MOCK_COMMENTS: readonly Comment[] = [
  {
    id: asId<CommentId>('cmt-0001'),
    postId: asId<PostId>('post-0001'),
    authorResidentId: asId<ResidentId>('res-0002'),
    authorName: 'Reynaldo B.',
    body: 'Is the lobby open at 8 or do we queue outside from earlier?',
    state: 'visible',
    postedAt: daysBeforeAnchor(6, 11),
    moderationReason: null,
    moderatedBy: null,
    moderatedAt: null,
    officialReply: {
      body:
        'The lobby opens at 8am and the queue forms inside. Please do not queue overnight — ' +
        'nobody is served earlier for arriving first.',
      repliedAt: daysBeforeAnchor(6, 13),
      repliedBy: head,
    },
    audit: stamp(6, 6),
  },
  {
    id: asId<CommentId>('cmt-0002'),
    postId: asId<PostId>('post-0001'),
    authorResidentId: asId<ResidentId>('res-0005'),
    authorName: 'Marilou S.',
    body: 'Thank you po. Very clear.',
    state: 'visible',
    postedAt: daysBeforeAnchor(6, 12),
    moderationReason: null,
    moderatedBy: null,
    moderatedAt: null,
    officialReply: null,
    audit: stamp(6, 6),
  },
  {
    id: asId<CommentId>('cmt-0003'),
    postId: asId<PostId>('post-0001'),
    authorResidentId: asId<ResidentId>('res-0007'),
    authorName: 'Anonymous',
    // Removed: the words are gone, and that is the point of removal.
    body: null,
    state: 'removed',
    postedAt: daysBeforeAnchor(5, 20),
    moderationReason:
      'Named a child and the school they attend, in a public thread about assistance. Removed ' +
      'rather than hidden because the text should not exist on the system.',
    moderatedBy: head,
    moderatedAt: daysBeforeAnchor(5, 21),
    officialReply: null,
    audit: stamp(5, 5),
  },
  {
    id: asId<CommentId>('cmt-0004'),
    postId: asId<PostId>('post-0002'),
    authorResidentId: asId<ResidentId>('res-0003'),
    authorName: 'Michelle C.',
    body: 'Is the covered court in San Juan already open? Water is at the gate here.',
    state: 'visible',
    postedAt: daysBeforeAnchor(3, 7),
    moderationReason: null,
    moderatedBy: null,
    moderatedAt: null,
    officialReply: {
      body: 'Yes, open since 6am. Come now and ask for the MSWDO desk.',
      repliedAt: daysBeforeAnchor(3, 7),
      repliedBy: head,
    },
    audit: stamp(3, 3),
  },
  {
    id: asId<CommentId>('cmt-0005'),
    postId: asId<PostId>('post-0002'),
    authorResidentId: asId<ResidentId>('res-0009'),
    authorName: 'Concerned resident',
    // Hidden, not removed: the words are kept and the office can put them back.
    body:
      'This is useless, the barangay never does anything and the officials only help their own ' +
      'relatives.',
    state: 'hidden',
    postedAt: daysBeforeAnchor(3, 8),
    moderationReason:
      'Hidden during the flood advisory because it was drawing replies away from the evacuation ' +
      'information. To be reviewed and likely restored once the advisory closes — criticism of ' +
      'the office is not a reason to remove anything.',
    moderatedBy: head,
    moderatedAt: daysBeforeAnchor(3, 9),
    officialReply: null,
    audit: stamp(3, 3),
  },
];
