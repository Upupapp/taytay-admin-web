/**
 * What the saved-views bar says about putting a view away and bringing it back (`DL-225`). The
 * bar's other words are its label inputs, which a list may reword.
 */
export const SAVED_VIEWS_COPY = {
  archiveLabel: (name: string) => `Archive the saved view ${name}`,
  archiveHint: 'Archive this view. It can be restored from Archived views.',
  archivedTitle: (name: string) => `“${name}” was archived.`,
  archivedBody: 'It is kept under Archived views beside this bar, and can be restored there.',
  archivedViews: 'Archived views',
  archivedLead:
    'Views of this list that were archived. Restoring one puts it back in the bar as it was.',
  archivedOn: (date: string) => `Archived ${date}`,
  shared: 'Shared with the office',
  restore: 'Restore',
  restoreLabel: (name: string) => `Restore the saved view ${name}`,
  restoring: 'Restoring…',
  restoredTitle: (name: string) => `“${name}” is back in the bar.`,
  noArchived: 'No archived views',
  noArchivedMessage: 'A view you archive from this bar is kept here, and can be restored.',
  archivedFailed: 'The archived views could not be read',
  close: 'Close',
  saveFailed: 'That view could not be saved. Please try again.',
  archiveFailed: 'That view could not be archived. Please try again.',
  restoreFailed: 'That view could not be restored. Please try again.',
  noun: 'saved view',
} as const;
