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
    versionLabel: (version: number): string => `Version ${version}`,
  },

  checklist: {
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
