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
    columnUsage: 'Releases',
    columnReleased: 'Handed over',

    emptyHeading: 'No programmes yet',
    // Said to every reader, and only some may record one: the sentence names who can (DL-177).
    emptyMessage:
      'The catalog is empty. Staff who may manage the catalog record a programme here, with “New programme”.',
    newProgramme: 'New programme',
    templates: 'Requirement templates',
    noResultsHeading: 'No programmes match those filters',
    noResultsMessage: 'Try a different category, or clear the filters.',
    shown: (count: number) => `${count} shown.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every programme matching these filters.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed:
      'The next programmes could not be loaded. The ones above are still correct; try again.',
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
    templateRetired:
      'That template is retired: no new programme may adopt it, and this one keeps asking for its documents until it is changed.',
    noTemplate: 'No template — this programme lists its own',

    edit: 'Edit this programme',
    cancel: 'Cancel',
    save: 'Save the programme',
    saved: 'The programme has been saved.',
    failed: 'That could not be saved.',
    refusedHeading: 'The office record refused this change',
    missingHeading: 'Before this can be saved',
    /** Said before the button, not after it (`DL-124`). */
    consequencesHeading: 'What saving does',
    keptForever:
      'This version of the programme and your reason are kept together, and neither can be removed or rewritten afterwards.',
    closing:
      'Closing the programme dates its end today. It stays in the catalog, offered to nobody, so that the requests filed under it still make sense.',
    reopening: 'Moving the programme away from closed clears its end date.',

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

  /** Every write to the catalog says why (`DL-177`). */
  reason: {
    label: 'Why — kept with this version',
    hint: 'One or two sentences a colleague could read in a year’s time. Up to 500 characters.',
    missing: 'Say why, in words. The reason is kept beside the version it explains.',
    tooLong: 'The reason is longer than the 500 characters the office record keeps.',
  },

  form: {
    title: 'New programme',
    subtitle: 'Recorded in the office catalog, with whose programme it is and what it asks for.',
    back: 'Back to programmes',
    basicsHeading: 'The programme',
    name: 'Name',
    category: 'Category',
    status: 'Status',
    statusHint: 'A draft is offered to nobody. Only an active programme accepts applications.',
    description: 'What it is',
    legalBasis: 'Legal basis',
    legalBasisHint: 'The statute, ordinance or issuance, if there is one.',
    funding: 'Funding source',
    fundingHint: 'A label the office was given. It posts to nothing.',
    maximum: 'Maximum grant (₱)',
    maximumHint: 'Leave empty if the programme states none.',

    eligibilityHeading: 'Eligibility parameters',
    eligibilityHint:
      'Kept beside the worded guidance for reports. Nothing in this console reads them to decide anything.',
    minAge: 'Minimum age',
    maxAge: 'Maximum age',
    sectors: 'Sectors the programme is for',
    income: 'Monthly household income ceiling (₱)',
    residency: 'Months of residency',
    eligibilityNotes: 'Notes',

    responsibilityHeading: 'Whose programme it is',
    responsibilityHint:
      'Recorded, not assumed: a national programme is the national agency’s, whatever the office’s part in it.',
    statementHint:
      'What staff may honestly tell an applicant about who decides, in one sentence of twenty characters or more.',
    sourcesHeading: 'Sources for that claim',
    sourcesHint:
      'A claim about a national agency’s programme needs at least one. Leave “checked on” empty if nobody has read the source.',
    sourceTitle: 'Title',
    sourceUrl: 'Link',
    sourceVerified: 'Checked on',
    addSource: 'Add a source',
    removeSource: 'Remove this source',
    preview: 'How the record will read',

    guidanceHeading: 'What the office looks for',
    guidanceHint:
      'Guidance a worker reads, never a gate the software closes. None of the three weights refuses anybody.',
    guidelineCode: 'About',
    guidelineWeight: 'Weight',
    guidelineStatement: 'What the office looks for',
    guidelineProvenance: 'Where it comes from',
    guidelineBasis: 'The issuance, ordinance or convention',
    guidelineSource: 'Link to the source',
    guidelineVerified: 'Checked on',
    addGuideline: 'Add a guideline',
    removeGuideline: 'Remove this guideline',
    guidelineGroup: (index: number) => `Guideline ${index}`,
    sourceGroup: (index: number) => `Source ${index}`,

    documentsHeading: 'Documents asked for',
    template: 'Start from a requirement template',
    noTemplate: 'No template — this programme lists its own',
    templateHint:
      'A retired template is not offered: no new programme may adopt one. The programme’s own documents below are added on top.',
    templateDocuments: (count: number) =>
      count === 1
        ? 'The template asks for 1 document.'
        : `The template asks for ${count} documents.`,

    windowHeading: 'Review window',
    ownWindow: 'This programme has its own review window',
    ownWindowHint: 'Otherwise the office default applies, and says it is not yet confirmed.',
    lookback: 'Months of history shown',
    sameProgramme: 'Days within which a repeat grant is worth a second look',
    windowProvenance: 'Settled by',
    windowBasis: 'What settled it',
    windowConfirmed: 'Confirmed on',

    save: 'Record the programme',
    saving: 'Recording…',
    saved: 'The programme has been recorded.',
    failed: 'The programme could not be recorded.',
    templateChosen: (name: string) =>
      `From the moment it is recorded, this programme asks for the documents in “${name}” — and a later change to that template reaches it too.`,
    notDeleted:
      'A recorded programme is never deleted. A programme that is over is closed, because requests filed under it still have to make sense.',
    templatesUnread:
      'The requirement templates could not be read, so none is offered. The programme can still list its own documents.',
  },

  documentsEditor: {
    code: 'Code',
    codeHint: 'Lower-case words and hyphens, such as brgy-indigency. One code per document.',
    label: 'Document',
    obligation: 'Asked for as',
    appliesWhen: 'Needed when',
    appliesWhenHint: 'In words a person rules on. Nothing in this console evaluates the condition.',
    notes: 'Notes',
    add: 'Add a document',
    remove: 'Remove this document',
    group: (index: number) => `Document ${index}`,
    none: 'No documents listed.',
  },

  templates: {
    title: 'Requirement templates',
    subtitle: 'Shared document sets. A programme names one and adds its own documents on top.',
    back: 'Back to programmes',
    caption: 'Requirement templates, retired ones included',
    columnName: 'Template',
    columnStatus: 'Status',
    columnDocuments: 'Documents',
    columnProgrammes: 'Programmes naming it',
    columnActions: 'Actions',
    programmes: (count: number) =>
      count === 1 ? '1 programme not closed' : `${count} programmes not closed`,
    retiredOn: 'Retired',
    loadFailed:
      'The requirement templates could not be read. Nothing is shown rather than a partial list.',
    emptyHeading: 'No requirement templates yet',
    emptyMessage: 'Every programme lists its own documents until a template is recorded.',

    create: 'New template',
    change: 'Change',
    retire: 'Retire',
    cancel: 'Cancel',
    createHeading: 'New requirement template',
    changeHeading: (name: string) => `Change “${name}”`,
    retireHeading: (name: string) => `Retire “${name}”`,
    code: 'Code',
    codeHint:
      'How programmes name it: lower-case words and hyphens. It never changes and is never reused, even after the template is retired.',
    name: 'Name',
    description: 'What it is for',
    documentsHeading: 'Documents in the template',

    saveCreate: 'Record the template',
    saveChange: 'Save the change',
    confirmRetire: 'Retire the template',
    working: 'Saving…',
    created: 'The requirement template has been recorded.',
    changed: 'The requirement template has been changed.',
    retired: 'The requirement template has been retired.',
    failed: 'That could not be saved.',

    keptForever:
      'Every version of this template and the reason given for it are kept, and cannot be removed or rewritten.',
    codeForever: (code: string) =>
      `Programmes will name it “${code}”. That code can never be changed or given to another template.`,
    reaches: (count: number) =>
      count === 0
        ? 'No programme that is not closed names this template now, so the change reaches none yet.'
        : count === 1
          ? 'From the moment it is saved, this change reaches the 1 programme that names this template: it asks applicants for these documents instead.'
          : `From the moment it is saved, this change reaches the ${count} programmes that name this template: each asks applicants for these documents instead.`,
    retireOneWay: 'Retiring is one way. Nothing brings a template back.',
    retireNoAdoption: 'No new programme may adopt it afterwards.',
    retireKeeps: (count: number) =>
      count === 0
        ? 'No programme that is not closed names it now.'
        : count === 1
          ? 'The 1 programme that already names it keeps asking for its documents until that programme is changed.'
          : `The ${count} programmes that already name it keep asking for its documents until each one is changed.`,
    retiredNotChanged: 'A retired template is not changed.',
    nameProblem: 'A template’s name is 3 to 120 characters.',
    codeProblem: 'A template’s code is lower-case words and hyphens, 2 to 60 characters.',
    descriptionProblem: 'A template’s description is at most 1,000 characters.',
    tooManyProblem: 'A template names at most 40 documents.',
    documentCodeProblem:
      'Every document needs a code of lower-case words and hyphens, two characters or more.',
    noTemplateProblems: 'Nothing in the template stands in the way.',
  },

  fieldProblem: {
    'name-missing': 'Give the programme a name.',
    'funding-missing': 'Say where the funding comes from, as the office was told it.',
    'grant-unreadable': 'The maximum grant is not an amount in pesos and centavos.',
    'age-unreadable': 'An age is a whole number of years, up to 130.',
    'ages-reversed': 'The minimum age is above the maximum.',
    'income-unreadable': 'The income ceiling is not an amount in pesos and centavos.',
    'residency-unreadable': 'Months of residency is a whole number.',
    'window-unreadable':
      'A programme’s own review window needs both of its numbers, as whole numbers.',
    'source-incomplete': 'Every source needs a title and a link.',
    'document-code-unreadable':
      'Every document needs a code of lower-case words and hyphens, two characters or more.',
  } as Readonly<Record<string, string>>,

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
    'empty-template': 'A requirement template names at least one document.',
    'duplicate-code': 'Two documents share a code. Each document has one code.',
    'label-too-short': 'Every document needs a name of three characters or more.',
    'condition-without-circumstances':
      'A conditional document must say, in words, when it is needed.',
    'circumstances-without-condition': 'Only a conditional document says when it is needed.',
  } as Readonly<Record<string, string>>,
} as const;
