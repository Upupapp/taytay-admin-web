/**
 * Wording for the shared document surfaces.
 *
 * In `shared/` beside the components that use it, as the case and programme
 * copy already are. The domain owns the vocabulary (obligations, sources,
 * validity); this owns the sentences around it (`DL-23`).
 */
export const REQUIREMENTS_COPY = {
  document: {
    nothingPresented: 'Nothing has been presented for this yet.',
    noFileHeld: 'No copy held — the details were recorded from the paper document.',
    documentNumber: 'Document number',
    maskedNote: 'Shown in part. Ask a social worker if you need it in full.',
    issuedOn: 'Issued',
    expiresOn: 'Expires',
    received: 'Received',
    open: 'Open document',
    openReplaced: 'Open this version',
    replacedBecause: 'Replaced because:',

    replacedCount: (count: number): string =>
      count === 1 ? '1 earlier version, kept on file' : `${count} earlier versions, kept on file`,
    uploadLabel: 'Add a copy',
    uploadHint: 'PDF, JPEG or PNG, up to 10 MB. The office keeps every version.',
    uploadAction: 'Record this document',
    uploading: 'Recording…',
    replacesBecauseLabel: 'Why is this replacing the copy already held?',
    replacesBecauseHint:
      'The previous version is kept and marked superseded. This sentence is what explains it to whoever reads the file later.',
    /**
     * The figure the person can act on, in the unit they think in.
     *
     * "10485760 bytes" is the truth and tells a caseworker nothing. Megabytes to one decimal is
     * what a scanner's settings dialogue shows.
     */
    tooLarge: (maxBytes: number, actualBytes: number): string =>
      `That file is ${(actualBytes / 1048576).toFixed(1)} MB. The largest this office accepts is ` +
      `${(maxBytes / 1048576).toFixed(0)} MB — rescan it at a lower resolution, or split it.`,
    wrongType: (accepted: readonly string[]): string =>
      `That kind of file cannot be recorded. Accepted: ${accepted
        .map((type) => type.split('/')[1]?.toUpperCase() ?? type)
        .join(', ')}.`,
    versionLabel: (version: number): string => `Version ${version}`,
  },

  checklist: {
    recorded: 'That document was recorded. The previous version, if any, is kept and marked superseded.',
    notRecorded: 'That document was NOT recorded. Nothing was kept — try again, or record it from the paper.',
    heading: 'Documents',
    completionHint:
      'Counts what has been settled. It is not a decision — eligibility is assessed by a caseworker.',

    awaitingDecision: 'Needs a decision',
    awaitingDecisionHint: 'Say whether this applies to this applicant before chasing it.',
    appliesWhen: 'Needed when:',
    applies: 'It applies',
    doesNotApply: 'It does not apply',
    applicabilityReason: 'Why',
    applicabilityReasonHint: 'Recorded against your name.',
    decidedBy: 'Decided by',

    record: 'Record a document',
    replace: 'Replace',
    replaceHint: 'The current version is kept on file, with your reason for replacing it.',
    askApplicant: 'Ask the applicant',

    verify: 'Verify',
    reject: 'Reject',
    waive: 'Waive',
    markExpired: 'Mark expired',
  },

  access: {
    warningHeading: 'Before you open this',
    cancel: 'Cancel',
    proceed: 'Open it',
    redacted: 'A copy shared outside the office is redacted.',
    failed: 'That document could not be opened.',
    denied: 'Your account cannot open documents. Ask a social worker or the MSWDO head.',
  },

  requests: {
    heading: 'Documents asked for',
    none: 'Nothing has been asked for.',
    overdue: 'Overdue',
    askedOn: 'Asked',
    neededBy: 'Needed by',
    channel: 'How',
    withdrawn: 'Withdrawn:',
  },
} as const;
