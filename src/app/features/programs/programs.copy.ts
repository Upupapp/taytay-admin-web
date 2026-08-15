/** Every user-facing string for the programme catalog screens (`DL-23`). */
export const PROGRAMS_COPY = {
  list: {
    title: 'Programmes and services',
    subtitle: 'What the office offers, who runs each one, and how much it is used.',
    caption: 'Social welfare programmes in the catalog',
    /**
     * The correction the catalog exists to make, said above the table. Staff
     * routinely describe AICS as a municipal programme; it is not, and an
     * applicant told otherwise expects a decision the office cannot make
     * (`DL-65`).
     */
    banner:
      'Not everything the office hands out is the office’s to decide. A programme run by a national agency is marked as theirs, and the catalog says what the municipality’s part in it actually is.',
    search: 'Search',
    searchPlaceholder: 'Programme name or code',
    category: 'Category',
    allCategories: 'Any category',
    status: 'Status',
    allStatuses: 'Any status',
    clear: 'Clear filters',

    columnName: 'Programme',
    columnRun: 'Run by',
    columnStatus: 'Status',
    columnUsage: 'Filed',
    columnReleased: 'Handed over',

    emptyHeading: 'No programmes yet',
    emptyMessage:
      'The catalog is empty. Add a programme to start recording what the office offers.',
    noResultsHeading: 'No programmes match those filters',
    noResultsMessage: 'Try a different category, or clear the filters.',
  },

  detail: {
    subtitle: 'Programme',
    notFoundHeading: 'That programme is not in the catalog',
    notFoundMessage: 'It may have been given a different code, or never added.',
    back: 'Back to programmes',

    factsHeading: 'Programme',
    code: 'Code',
    category: 'Category',
    status: 'Status',
    legalBasis: 'Legal basis',
    fundingSource: 'Funding',
    maximumGrant: 'Maximum grant',
    effectiveFrom: 'In effect from',
    effectiveTo: 'Until',
    description: 'What it is',
    none: '—',

    documentsHeading: 'Documents asked for',
    documentsNote:
      'A shared template plus anything this programme adds. Correcting the template corrects every programme using it.',
    fromTemplate: 'From template',
    programmeOwn: 'This programme',
    mandatory: 'Required',
    optional: 'Optional',
    appliesWhen: 'Needed when:',
    templateLabel: 'Document template',
    noTemplate: 'No template — this programme lists its own',

    edit: 'Edit this programme',
    cancel: 'Cancel',
    save: 'Save the programme',
    saved: 'The programme has been saved.',
    failed: 'That could not be saved.',

    editHeading: 'Edit programme',
    editName: 'Name',
    editDescription: 'What it is',
    editStatus: 'Status',
    editFunding: 'Funding source',
    editLegalBasis: 'Legal basis',
    editMaximum: 'Maximum grant (₱)',

    responsibilityHeading: 'Who runs it',
    administeredBy: 'Administered by',
    fundsHeldBy: 'Funds held by',
    lguRole: 'The municipality’s part',
    statement: 'What staff may tell an applicant',
    /**
     * Shown beside the role picker. The combination is refused by the domain
     * and by the adapter as well; saying why beforehand is kinder than a
     * refusal after typing.
     */
    ownerWarning:
      'A programme administered by a national agency cannot be recorded as one the municipality runs. Choose referrer, augmenter or facilitator.',
  },

  problem: {
    'national-programme-claimed-as-owned':
      'This is another agency’s programme, so the municipality cannot be recorded as running it.',
    'lgu-role-without-statement':
      'Write the sentence staff may tell an applicant about who decides.',
    'claim-without-source':
      'A claim about another agency’s programme needs a source recorded against it.',
    'funds-claimed-without-holding':
      'The municipality cannot be recorded as adding funds it does not hold.',
    'no-guidance-recorded': 'Record at least one guideline, even if it is only context.',
    'statement-too-short': 'A guideline needs enough words to be acted on.',
    'statute-without-source': 'A guideline claiming statutory force needs a link to the statute.',
    'non-positive-window': 'A review window has to be a positive number of days or months.',
    'confirmed-without-basis': 'Say what settled the window before marking it confirmed.',
    'confirmed-without-date': 'Record when the window was confirmed.',
  } as Readonly<Record<string, string>>,
} as const;
