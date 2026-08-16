/**
 * Screen wording for the newsfeed console.
 *
 * Two sentences are load-bearing. **Archiving** never reads as "unpublish" —
 * anybody who already read a post still read it, and the office should not be
 * told otherwise. And **removing a comment** never reads as "delete" alone: the
 * words go and the record of the act stays, which is a different promise from
 * the one "delete" makes.
 */
export const NEWSFEED_COPY = {
  list: {
    title: 'Newsfeed',
    subtitle: 'What the office has published, and what residents said back.',
    compose: 'Write a post',

    search: 'Search',
    searchPlaceholder: 'Headline or wording',
    category: 'Category',
    allCategories: 'Any category',
    clear: 'Clear filters',

    pinned: 'Pinned',
    commentsOff: 'Comments off',
    noHeadline: 'Untitled post',
    scheduledFor: 'Goes out',
    publishedOn: 'Published',
    reactions: 'reactions',
    comments: 'comments',
    open: 'Open',

    emptyHeading: 'Nothing here yet',
    emptyMessage: 'Posts you write appear here as drafts until they are published.',
    noResultsHeading: 'No posts match those filters',
    noResultsMessage: 'Try a wider category, or clear the filters.',
  },

  composer: {
    title: 'Write a post',
    editTitle: 'Edit post',
    back: 'Back to the newsfeed',

    headline: 'Headline',
    headlineHint: 'Optional. A short line residents see first.',
    body: 'What you want to say',
    bodyHint: 'Write it as the office would say it out loud.',
    category: 'Category',

    imageHeading: 'Cover image',
    imageUrl: 'Image',
    altText: 'Describe the image',
    altTextHint:
      'Required before publishing. A resident using a screen reader gets nothing from a poster ' +
      'with no description — and an advisory is exactly what needs reading aloud.',

    link: 'Link',
    linkHint: 'Optional. Must start with http:// or https://.',

    audienceHeading: 'Who sees this',
    audienceAll: 'Everyone in Taytay',
    audienceBarangays: 'Selected barangays',
    audienceHint:
      'Targeting is about relevance, not privacy. A post sent to one barangay is still public to ' +
      'that barangay.',

    commentsHeading: 'Comments',
    commentsEnabled: 'Let residents comment on this post',

    saveDraft: 'Save draft',
    saved: 'Draft saved.',
    saveFailed: 'That could not be saved.',
    problemsHeading: 'Before this can go out',
  },

  detail: {
    back: 'Back to the newsfeed',
    notFoundHeading: 'That post is not available',
    notFoundMessage: 'It may not exist, or your account may not cover the newsfeed.',

    previewHeading: 'What residents see',
    metaHeading: 'Publication',
    publishedBy: 'Published by',
    lastUpdated: 'Last updated',
    audience: 'Audience',
    engagementHeading: 'Reach',
    engagementHint:
      'Counts only. The office does not see which residents reacted, and does not need to.',

    actionsHeading: 'Actions',
    reason: 'Why',
    reasonHint: 'Recorded in the trail against your name. Required.',
    publish: 'Publish now',
    publishWarning:
      'Publishing sends this to residents. It cannot be unsent — archiving later removes it from ' +
      'the feed going forward, and does not reach anybody who already read it.',
    schedule: 'Schedule',
    scheduleAt: 'When',
    archive: 'Archive',
    pin: 'Pin to the top',
    unpin: 'Unpin',
    enableComments: 'Turn comments on',
    disableComments: 'Turn comments off',
    saved: 'Saved.',
    failed: 'That could not be saved.',

    commentsHeading: 'Comments',
    commentsDisabled: 'Comments are turned off for this post.',
    order: 'Order',
    newest: 'Newest first',
    oldest: 'Oldest first',
    commentSearch: 'Search comments',
    moderationReason: 'Reason recorded',
    officialReply: 'The office replied',
    replyPlaceholder: 'Reply as the office',
    reply: 'Reply',
    hide: 'Hide',
    restore: 'Restore',
    remove: 'Remove permanently',
    removeConfirmHeading: 'Remove this comment permanently?',
    removeConfirmBody:
      'The words are deleted and cannot be brought back. Who removed it, when and why stays on ' +
      'file. Hide it instead if it might need to go back up.',
    removeConfirm: 'Remove permanently',
    cancel: 'Cancel',
    removedBody: 'This comment was removed.',
    noComments: 'No comments yet.',

    historyHeading: 'What the office did',
    noHistory: 'Nothing recorded for this post in this session.',
  },
} as const;
