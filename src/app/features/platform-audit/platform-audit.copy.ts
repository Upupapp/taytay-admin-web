/** Every sentence the app audit trail screen says (`DL-171`). */
export const PLATFORM_AUDIT_COPY = {
  title: 'App audit trail',
  subtitle:
    'What staff, administrators and residents did through the Taytay app’s API, newest first. Read-only.',
  newest: 'Read from the newest',
  caption: 'Audit trail of the app’s API',
  columnWhen: 'When',
  columnAction: 'What was done',
  columnActor: 'By account',
  columnSubject: 'To record',
  noWords: 'No description in this console for',
  noActor: 'No account recorded',
  noSubject: '(no ID recorded)',
  shown: (count: number) => `Showing the newest ${count} ${count === 1 ? 'entry' : 'entries'}.`,
  moreAvailable: 'More are available.',
  noMore: 'There are no more.',
  showMore: 'Show older entries',
  loadingMore: 'Loading older entries…',
  moreFailed: 'Older entries could not be read. Try again.',
  emptyHeading: 'Nothing recorded yet',
  emptyMessage: 'The API has recorded no act.',
} as const;
