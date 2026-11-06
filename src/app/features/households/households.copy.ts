import type { FactorState, HouseholdProblemCode } from '@domain/index';

/** Every user-facing string for the household registry (`DL-23`). */
export const HOUSEHOLDS_COPY = {
  list: {
    title: 'Households',
    subtitle: 'Families as the office assesses them, with the indicators behind each one.',
    caption: 'Households registered with the MSWDO',
    search: 'Search',
    searchPlaceholder: 'Household number, head’s surname or street',
    searchHint:
      'Type at least two characters. Every word must match the household number, the head’s surname or the street.',
    order: 'In order of household number.',
    barangay: 'Barangay',
    allBarangays: 'All barangays',
    band: 'Indicators',
    anyBand: 'Any',
    indigentOnly: 'Classified indigent only',
    clear: 'Clear filters',
    columnReference: 'Household',
    columnHead: 'Head',
    columnBarangay: 'Barangay',
    columnSize: 'Members',
    columnBand: 'Indicators',
    emptyHeading: 'No households yet',
    emptyMessage: 'Households appear here once a family has been registered.',
    noResultsHeading: 'No households match those filters',
    noResultsMessage: 'Try a different spelling, or clear the filters to see every household.',
    advisoryBanner:
      'The indicator column is advisory. It orders a list; it does not decide who is helped.',
    create: 'Register a household',
    protected: 'Restricted',
    shown: (count: number) => `${count} shown.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every household matching these filters.',
    showMore: 'Show more',
    tryAgain: 'Try again',
    loadingMore: 'Loading more…',
    moreFailed:
      'The next households could not be loaded. The ones above are still correct; try again.',
  },

  create: {
    title: 'Register a household',
    subtitle: 'An address, and the person who heads the household there.',
    back: 'Back to households',
    addressHeading: 'Address',
    meansHeading: 'Income and classification',
    barangay: 'Barangay',
    chooseBarangay: 'Choose a barangay',
    purok: 'Purok or sitio',
    purokHint: 'Optional.',
    street: 'Street address',
    streetHint: 'House number and street, as the family gives it.',
    head: 'Head of the household',
    headHint:
      'Search the registry. A person not yet registered is registered first, as a resident.',
    headChosen: 'Head:',
    changeHead: 'Choose someone else',
    income: 'Monthly household income (pesos)',
    incomeHint: 'Optional. In pesos, for example 8,500 or 8,500.50.',
    incomeInvalid: 'Type an amount in pesos, with at most two decimal places.',
    incomeNotYours:
      'Recording a household’s income needs permission to see residents’ identity and means, which your role does not have.',
    indigent: 'Classified indigent',
    indigentHint:
      'A classification a person records. It is never set from the vulnerability indicators.',
    membership:
      'The head becomes this household’s one member. Everyone else joins from the household record, one change at a time with a reason, once it is registered.',
    submit: 'Register household',
    submitting: 'Registering…',
    missingStreet: 'Give the street address.',
    missingBarangay: 'Choose the barangay.',
    missingHead: 'Choose the head of the household.',
    saved: 'Household registered.',
    failed: 'The household could not be registered.',
  },

  detail: {
    subtitle: 'Household record',
    notFoundHeading: 'That household is not available',
    notFoundMessage:
      'The household does not exist, or it is outside the part of the municipality you cover.',
    back: 'Back to households',

    detailsHeading: 'Household',
    membersHeading: 'Members',
    auditHeading: 'What has been done to this record',

    reference: 'Household number',
    barangay: 'Barangay',
    purok: 'Purok or sitio',
    street: 'Street address',
    income: 'Recorded monthly income',
    indigent: 'Classified indigent',
    size: 'Members',
    updated: 'Last updated',
    yes: 'Yes',
    no: 'No',
    none: '—',

    classifiedNote:
      'The indigency classification is recorded by a person. It is never set from the indicators below.',
    addressWithheld: 'Withheld from your role',
    incomeWithheld: 'Withheld from your role',
    protectedNote:
      'Someone in this household is under a protected sector. Handle this record with care; its exact address is shown only to staff cleared for protected cases.',

    noAudit: 'Nothing has been changed on this record yet.',
    auditReason: 'Reason',
  },

  members: {
    heading: 'Members',
    editHeading: 'Edit who lives here',
    edit: 'Edit members',
    stopEditing: 'Stop editing',
    addHeading: 'Add someone to this household',
    role: 'Role',
    makeHead: 'Make head',
    remove: 'Remove',
    pending: 'Not saved yet',
    pendingHeading: 'Changes waiting to be saved',
    discard: 'Discard changes',
    save: 'Save changes',
    saving: 'Saving…',
    reason: 'Why is this changing?',
    reasonPlaceholder: 'e.g. Home visit on 12 August: son has moved out',
    reasonHint: 'Recorded against your name in the household’s history.',
    saved: 'Household members updated.',
    noPending: 'Nothing has changed yet.',
    problemsHeading: 'This cannot be saved yet',
    alreadyMember: 'That person is already in this household.',
  },

  correction: {
    heading: 'Correct this indicator',
    description:
      'Set what you know to be true. The computed value is kept beside your correction so both can be read.',
    stateLabel: 'What is actually the case?',
    reason: 'Why?',
    reasonPlaceholder: 'e.g. Home visit 12 August: eldest son now works full time',
    reasonHint: 'Required. Recorded against your name and the time.',
    confirm: 'Save correction',
    clearHeading: 'Use the computed value again',
    clearDescription:
      'This withdraws your correction and lets the records speak for themselves again.',
    clearConfirm: 'Withdraw correction',
    cancel: 'Cancel',
    saved: 'Indicator corrected.',
    cleared: 'Correction withdrawn.',
  },

  /** Only the states a person may choose. `withheld` is never a choice. */
  correctableStates: ['present', 'absent', 'unknown'] as readonly FactorState[],

  problem: {
    'no-members': 'A household needs at least one member.',
    'no-head': 'A household needs a head.',
    'several-heads': 'A household can only have one head.',
    'head-not-a-member': 'The head has to be one of the members.',
    'duplicate-member': 'Someone is listed twice.',
    'member-not-found': 'One of those people is not on the registry.',
    'already-a-member': 'That person is already in this household.',
    'member-in-another-household': 'That person already belongs to another household.',
    'head-cannot-be-removed': 'Choose a new head before removing this one.',
    'outside-your-barangay': 'That household is outside the area you cover.',
  } satisfies Record<HouseholdProblemCode, string>,
} as const;
