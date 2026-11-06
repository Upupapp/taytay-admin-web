/**
 * Screen wording for field visits.
 *
 * A note on tone. These screens describe families to workers, and words carry
 * judgements even when nobody meant them to. "Nobody home" says the household
 * did nothing; "non-compliant" would say they failed. The first is what
 * happened; the second is a label the office would then act on.
 */
import { CAPTURE_STATE_DESCRIPTIONS, CAPTURE_STATE_LABELS } from '@domain/index';

export const VISITS_COPY = {
  list: {
    title: 'Field visits',
    subtitle: 'Home and field visits, what was found, and what is owed next.',

    mine: 'My visits',
    all: 'All visits',

    search: 'Search',
    // The reference only: the address and what a household said are never searched (DL-109).
    searchPlaceholder: 'Visit reference number',
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

    addressWithheld: 'Address withheld from your account',
    shown: (count: number) => `${count} shown, what is owed first.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every visit matching these filters.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next visits could not be loaded. The ones above are still correct; try again.',

    emptyHeading: 'No visits scheduled',
    emptyMessage: 'Visits scheduled from a case or a household appear here.',
    noResultsHeading: 'No visits match those filters',
    noResultsMessage: 'Try a wider status, or clear the filters.',
  },

  schedule: {
    title: 'Schedule a home visit',
    noCaseHeading: 'That case is not available',
    noCaseMessage: 'A visit is scheduled from the case it belongs to. Open the case and schedule it from there.',
    backToCases: 'Back to cases',
    backToCase: 'Back to the case',
    noLocation:
      'A visit records the address it is made to and what is found there. Nothing records where anybody is or was.',
    caseClosed: 'This case is closed. A closed case is kept as it ended, so no visit is scheduled on it.',
    purpose: 'What is the visit for?',
    date: 'On what day?',
    window: 'Roughly when',
    windowPlaceholder: 'Morning, after 2pm…',
    address: 'The address the visit is made to',
    addressHint:
      'Copied from the person’s record. Change it if the family is somewhere else; the visit keeps what is written here.',
    worker: 'Who goes?',
    workerHint:
      'The case’s own worker, or you. A worker who works only their assigned cases cannot be sent on a visit to somebody else’s case.',
    caseWorker: 'The case’s worker',
    you: (name: string) => `${name} (you)`,
    noWorker:
      'Nobody can be sent on this visit yet: the case has no worker. Assign the case to a social worker first.',
    checklistHeading: 'What to check',
    checklistHint: 'Prompts the worker sets out with. They feed what the worker writes; nothing is scored from them.',
    scheduleAction: 'Schedule the visit',
    scheduling: 'Scheduling…',
    scheduled: 'The visit is scheduled and saved to the office record.',
    notScheduled: 'The visit was NOT scheduled. Nothing was saved, and nothing is waiting to be sent.',
  },

  detail: {
    back: 'Back to visits',
    withheld: 'Withheld from your account',
    addressWithheld: 'Address withheld from your account',
    wordsWithheldNotice:
      'This visit is about a household under a protected sector. What was observed and said, the outcome and the address are withheld from your account, and nothing can be added to it from here. Its date, purpose, status and checklist are shown.',
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
    // The one state that means the office record has it (DL-87), worded as the domain words it.
    checklistSaved: `Checklist ${CAPTURE_STATE_LABELS.sent.toLowerCase()}.`,

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
    observationSaved: `${CAPTURE_STATE_LABELS.sent}.`,

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

    // Says that nothing was held back to send later: no queue, no background retry (DL-87).
    failed: `Not saved. ${CAPTURE_STATE_DESCRIPTIONS['send-failed']}`,
  },
} as const;
