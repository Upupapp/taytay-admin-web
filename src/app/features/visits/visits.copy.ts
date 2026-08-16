/**
 * Screen wording for field visits.
 *
 * A note on tone. These screens describe families to workers, and words carry
 * judgements even when nobody meant them to. "Nobody home" says the household
 * did nothing; "non-compliant" would say they failed. The first is what
 * happened; the second is a label the office would then act on.
 */
export const VISITS_COPY = {
  list: {
    title: 'Field visits',
    subtitle: 'Home and field visits, what was found, and what is owed next.',

    mine: 'My visits',
    all: 'All visits',

    search: 'Search',
    searchPlaceholder: 'Reference, address or outcome',
    status: 'Status',
    allStatuses: 'Any status',
    purpose: 'Purpose',
    allPurposes: 'Any purpose',
    overdueOnly: 'Only visits past their date',
    clear: 'Clear filters',

    dueToday: 'Due today',
    overdue: 'Past its date',
    overdueHint:
      'Still scheduled after the day it was set for. The office owes this visit, not the family.',
    upcoming: 'Upcoming',

    caption: 'Field visits with their date, purpose and status',
    columnReference: 'Reference',
    columnScheduled: 'Scheduled',
    columnPurpose: 'Purpose',
    columnStatus: 'Status',
    columnAddress: 'Address',

    emptyHeading: 'No visits scheduled',
    emptyMessage: 'Visits scheduled from a case or a household appear here.',
    noResultsHeading: 'No visits match those filters',
    noResultsMessage: 'Try a wider status, or clear the filters.',
  },

  detail: {
    back: 'Back to visits',
    notFoundHeading: 'That visit is not available',
    notFoundMessage:
      'It may not exist, or it may be about somebody outside the barangays your account covers.',

    aboutHeading: 'The visit',
    purpose: 'Purpose',
    scheduled: 'Scheduled',
    window: 'Time',
    address: 'Address visited',
    completedAt: 'Closed',

    checklistHeading: 'What to check',
    checklistHint: 'Prompts for the visit. Ticking them records nothing about eligibility.',
    checklistNone: 'No checklist on this visit.',
    saveChecklist: 'Save ticks',
    checklistSaved: 'Checklist saved.',

    observationsHeading: 'What was found',
    observationsHint:
      'Each entry says whose claim it is. What a worker saw, what the household said, and the worker’s own assessment are three different things.',
    observationsNone: 'Nothing recorded yet.',
    allJudgementWarning:
      'Every entry here is the worker’s assessment. Nothing was recorded as seen, and nothing as said by the household.',
    attributedTo: 'Said by',

    addObservationHeading: 'Record what you found',
    kind: 'What kind of entry is this?',
    body: 'What happened',
    bodyPlaceholder: 'Write it as you would say it to a colleague.',
    attribution: 'Who said it',
    attributionHint: 'Name the person or role. An unattributed account cannot be checked.',
    addObservation: 'Add entry',
    observationSaved: 'Entry recorded.',

    outcomeHeading: 'Close the visit',
    outcomeHint: 'Closing is final. A second attempt is a second visit.',
    outcomeStatus: 'What happened',
    outcomeText: 'Outcome',
    outcomePlaceholder: 'What was done, and what the office will do next.',
    serviceNeeds: 'What the household needs',
    declinedReason: 'What the household said',
    declinedReasonHint:
      'Their words, if they gave a reason. Recorded only for a visit the household declined.',
    close: 'Close visit',
    closed: 'Visit closed.',
    alreadyClosed: 'This visit is closed. Its record cannot be changed.',

    failed: 'That could not be saved.',
  },
} as const;
