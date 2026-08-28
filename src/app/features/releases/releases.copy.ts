/**
 * Screen wording for releases and distribution.
 *
 * Two words are chosen carefully throughout. **Deferred** never appears as
 * "failed" — the family did nothing wrong and the office did. **Unclaimed**
 * never appears as "refused" — nobody knows why they did not come, and the
 * screen should not guess.
 */
export const RELEASES_COPY = {
  list: {
    title: 'Releases',
    subtitle: 'Approved assistance on its way to the people it was approved for.',
    batches: 'Payout sessions',

    search: 'Search',
    searchPlaceholder: 'Voucher, reference or remarks',
    status: 'Status',
    allStatuses: 'Any status',
    kind: 'What is released',
    allKinds: 'Money and goods',
    openOnly: 'Only what is still to settle',
    clear: 'Clear filters',

    needsOffice: 'The office must act on these',
    needsOfficeHint:
      'Something here is the office’s to fix — a wrong voucher, or a payout it could not make.',
    waiting: 'Waiting to be released',
    settled: 'Settled',

    caption: 'Releases with their status, amount and schedule',
    columnReference: 'Voucher',
    columnBeneficiary: 'For',
    columnWhat: 'What',
    columnStatus: 'Status',
    columnScheduled: 'Scheduled',

    goods: 'Goods',
    notScheduled: 'Not scheduled',

    emptyHeading: 'Nothing to release',
    emptyMessage: 'Approved requests appear here once they are ready to be paid out.',
    noResultsHeading: 'No releases match those filters',
    noResultsMessage: 'Try a wider status, or clear the filters.',
  },

  detail: {
    back: 'Back to releases',
    notFoundHeading: 'That release is not available',
    notFoundMessage:
      'It may not exist, or it may be for somebody outside the barangays your account covers.',

    aboutHeading: 'The release',
    what: 'What is being released',
    amount: 'Amount',
    goodsDescription: 'Goods',
    method: 'How',
    fundingSource: 'Funding source',
    fundingSourceHint: 'The label the office was given. Nothing here posts to an account.',
    approvingReference: 'Approval reference',
    scheduled: 'Scheduled for',
    releasedAt: 'Released',
    releasedBy: 'Released by',
    remarks: 'Remarks',

    boundaryNotice:
      'This screen records what the office handed over. It is not the accounting system and posts nothing to it.',

    selfReleaseHeading: 'Check before you release',

    releaseHeading: 'Record the release',
    instrument: 'Cheque, e-wallet or receipt number',
    releaseRemarks: 'Remarks',
    release: 'Record as released',
    released: 'Release recorded.',

    acknowledgeHeading: 'Record the receipt',
    acknowledgeKind: 'How it was acknowledged',
    collectedBy: 'Who collected it',
    authority: 'What authority they presented',
    authorityHint: 'Required when somebody collects on the beneficiary’s behalf.',
    acknowledge: 'Record receipt',
    acknowledged: 'Receipt recorded.',

    deferHeading: 'They came and we could not pay',
    deferHint: 'Every reason here is the office’s. If they did not come, mark it unclaimed instead.',
    deferReason: 'Why',
    deferRemarks: 'What happened',
    defer: 'Record deferral',
    deferred: 'Deferral recorded.',

    failed: 'That could not be saved.',
  },

  batches: {
    title: 'Payout sessions',
    subtitle: 'A date, a place, and the releases planned for it.',
    back: 'Back to releases',

    venue: 'Where',
    officer: 'Releasing officer',
    scheduledFor: 'When',
    progress: 'Progress',
    manifest: 'Open the payout list',
    print: 'Print',

    openHeading: 'Open a payout session',
    openHint:
      'A date, a place and an officer. Releases are added to it afterwards, one at a time, so each family\u2019s scheduling is its own recorded act.',
    nameLabel: 'What is this session called?',
    nameHint: 'How the office will refer to it — "San Juan, second Saturday" rather than a code.',
    venueLabel: 'Where is it being held?',
    whenLabel: 'When',
    membersLabel: 'Which releases are scheduled into it?',
    membersHint:
      'Only releases that are ready. A session opens whether or not any are chosen; you can add them later.',
    openAction: 'Open the session',
    opening: 'Opening…',
    opened: 'The session is open.',
    /**
     * Named, not counted.
     *
     * "3 releases could not be added" tells a disbursing officer to check all of them. Naming which
     * ones tells them who is not on the list — and on a payout day that is the difference between
     * a family being expected and a family being turned away.
     */
    partiallyOpened: (added: number, total: number): string =>
      `The session is open with ${added} of ${total} releases. The rest were not added — check the ` +
      `list before the payout, because anybody missing from it will not be expected at the table.`,
    notOpened: 'That session was NOT opened. Nothing was saved.',

    manifestHeading: 'Payout list',
    manifestHint: 'Take this to the table. Names and vouchers only — nothing else about anybody.',
    columnRow: '#',
    columnName: 'Name',
    columnVoucher: 'Voucher',
    columnWhat: 'What',
    columnSignature: 'Signature or thumbmark',
    totalMoney: 'Money total',
    goodsCount: 'Goods to hand out',

    emptyHeading: 'No payout sessions',
    emptyMessage: 'Scheduling approved releases into a session groups them for a payout day.',
  },
} as const;
