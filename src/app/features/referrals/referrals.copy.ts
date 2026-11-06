/**
 * Screen wording for referrals.
 *
 * A note on tone. Two audiences read these words: staff working a queue, and —
 * on the summary sheet — an office that does not work here. The sheet says
 * "Municipal Social Welfare and Development Office" rather than "MSWDO", asks
 * rather than instructs, and never implies that this office can set another
 * one's priorities.
 */
export const REFERRALS_COPY = {
  list: {
    composeHeading: 'Refer somebody out',
    composeHint:
      'This creates a DRAFT. Nothing leaves the office until the lawful basis is recorded and the referral is sent from its own page.',
    clientLabel: 'Who is being referred?',
    linkLabel: 'Is it about one of their cases or requests?',
    linkLabelCaseload: 'Which of your cases or requests is it about?',
    linkNone: 'Not linked to a case or request',
    linkChoose: 'Choose one of your cases or requests',
    linkCase: 'Case',
    linkRequest: 'Request',
    linkHint: 'Open cases and filed requests about this person. A link lets whoever holds the case read the referral.',
    linkHintCaseload:
      'Only your assigned cases and requests are listed. The referral is about the person the one you choose is about.',
    linksLoading: 'Reading the cases and requests it could be about…',
    linksFailed: 'The cases and requests could not be read, so none can be linked. Reload the page to try again.',
    linksNoneOfYours:
      'You hold no open case and no request to refer from. A referral from your caseload names one of them; ask whoever assigns the work.',
    linksMore: 'Only the most recent are listed; more exist. Open the case or request to find an older one.',
    providerLabel: 'Choose from the directory',
    providerHint: 'Choosing one fills the name and contact from the directory record.',
    providerNone: 'Not in the directory',
    destinationLabel: 'What kind of organisation?',
    destinationNameLabel: 'Which organisation?',
    destinationContactLabel: 'Contact, if the office has one',
    urgencyLabel: 'How urgent?',
    serviceLabel: 'What are they being referred for?',
    reasonLabel: 'Why?',
    createAction: 'Create the draft',
    creating: 'Creating…',
    draftCreated: 'The draft was created. Nothing has been sent.',
    draftNotCreated: 'That draft was NOT created. Nothing was saved.',
    title: 'Referrals',
    subtitle: 'People routed to offices that can do what this one cannot.',
    shown: (count: number) => `${count} shown, newest drafted first.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every referral matching these filters.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next referrals could not be loaded. The ones above are still correct; try again.',
    directory: 'Service providers',

    search: 'Search',
    searchPlaceholder: 'Reference, office or reason',
    searchHint: 'Searches the reference number, the receiving office, the service and the reason.',
    status: 'Status',
    allStatuses: 'Any status',
    destination: 'Receiving office',
    allDestinations: 'All offices',
    urgency: 'Urgency',
    allUrgencies: 'Any urgency',
    overdueOnly: 'Only ones we said we would chase by now',
    openOnly: 'Only open referrals',
    clear: 'Clear filters',

    caption: 'Referrals, with their status and follow-up date',
    columnReference: 'Reference',
    columnClient: 'Client',
    columnDestination: 'Receiving office',
    columnStatus: 'Status',
    columnUrgency: 'Urgency',
    columnFollowUp: 'Follow up',

    overdue: 'Overdue',
    overdueHint: 'Past the date this office said it would chase, with no response recorded.',
    noFollowUp: 'Not scheduled',
    awaitingSend: 'Not sent yet',

    emptyHeading: 'No referrals yet',
    emptyMessage: 'Referrals made from a case or a request appear here.',
    noResultsHeading: 'No referrals match those filters',
    noResultsMessage: 'Try a wider status, or clear the filters.',
  },

  detail: {
    withheld: 'Withheld from your account',
    wordsWithheldNotice:
      'This referral is about a person under a protected sector. What it asks for, why, what was recorded about it and what it shares are withheld from your account, and nothing can be added to it from here. Where it went, its status and its dates are shown.',
    sendHeading: 'Send this referral',
    sendWarning:
      'Once this is sent it has left the office. Nothing here can recall it, and the receiving organisation keeps whatever it was given.',
    basisLabel: 'On what lawful basis?',
    basisNoteLabel: 'What makes that true here?',
    basisNoteHint: 'Recorded against your name with the basis. A reader six months from now sees this sentence, not the checkbox.',
    recordBasisAction: 'Record this lawful basis',
    basisSaved: 'The lawful basis was recorded.',
    shareHeading: 'What may be shared beyond the minimum',
    shareMinimum:
      'The name, the reference and the reason always travel. Everything else is chosen one field at a time, with the need that justifies it.',
    shareFieldLabel: 'Which field?',
    shareFieldAction: 'Add this field to the summary',
    shareBecauseLabel: 'Why does the receiving organisation need it?',
    shareCare: 'This one needs particular thought before it leaves the office.',
    fieldShared: 'That field was added to the summary.',
    sendAction: 'Send referral',
    sent: 'The referral was sent. It cannot be recalled.',
    back: 'Back to referrals',
    notFoundHeading: 'That referral is not available',
    notFoundMessage:
      'It may not exist, or it may be about somebody outside the barangays your account covers.',

    aboutHeading: 'The referral',
    service: 'Service requested',
    reason: 'Why',
    destination: 'Receiving office',
    contact: 'Contact there',
    referredOn: 'Referred',
    followUp: 'Follow up on',
    responded: 'They responded',
    noResponse: 'No response recorded yet',

    disclosureHeading: 'What was shared',
    disclosureNone:
      'Nothing has been shared. This referral is still a draft — recording a lawful basis is part of sending it.',
    basis: 'Basis for sharing',
    basisNote: 'What was recorded',
    sharedFields: 'Details shared beyond the client’s name',
    sharedNothingExtra: 'Nothing beyond the client’s name and the reason.',
    because: 'Because',
    attachments: 'Documents attached',

    summaryHeading: 'The summary sheet',
    summaryHint: 'This is what the receiving office sees. Nothing else is sent.',
    summaryUnavailable: 'There is no sheet until the referral is sent.',
    print: 'Print',

    outcomeHeading: 'Outcome',
    outcomeNone: 'Nothing recorded yet.',
    recordOutcome: 'Record what they did',
    outcomeLabel: 'What the receiving office did',
    outcomePlaceholder: 'What was provided, refused or arranged, and any next step for the client.',
    outcomeStatus: 'Set the referral to',
    outcomeStatusChoose: 'Choose where this leaves the referral',
    saveOutcome: 'Record outcome',
    outcomeSaved: 'Outcome recorded.',

    notesHeading: 'Inter-office notes',
    notesNone: 'No notes yet.',
    addNote: 'Add a note',
    notePlaceholder: 'What was said, and by whom.',
    saveNote: 'Add note',
    noteSaved: 'Note added.',

    rescheduleHeading: 'Move the follow-up',
    rescheduleDate: 'New date',
    rescheduleReason: 'Why',
    rescheduleReasonHint:
      'Recorded as a note. Moving a chase date quietly is how an overdue referral stops being overdue without anybody acting on it.',
    saveReschedule: 'Move follow-up',
    rescheduleSaved: 'Follow-up moved.',

    failed: 'That could not be saved.',
  },

  directory: {
    title: 'Service providers',
    subtitle: 'The offices, hospitals and partners this office refers people to.',
    back: 'Back to referrals',

    search: 'Search',
    searchPlaceholder: 'Office name, address or service',
    status: 'Status',
    allStatuses: 'All entries',

    services: 'What they do',
    channels: 'How to send',
    respondsIn: 'Usually responds in',
    days: 'days',
    contact: 'Contact',
    notes: 'Notes',
    noContact: 'No contact recorded.',

    notAccepting: 'Not accepting referrals at the moment.',
    retired: 'No longer used. Kept so past referrals still make sense.',

    emptyHeading: 'No providers on file',
    emptyMessage: 'Offices this one refers to would be listed here.',
  },
} as const;
