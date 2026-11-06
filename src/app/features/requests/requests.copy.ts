/** Every user-facing string for the assistance-request screens (`DL-23`). */
export const REQUESTS_COPY = {
  list: {
    title: 'Assistance requests',
    subtitle: 'Intake, assessment, endorsement and approval of one intervention at a time.',
    caption: 'Assistance requests recorded by the MSWDO',
    startIntake: 'Start an intake',
    // Not "your": the office record lists every unfinished intake the reader's scope covers,
    // whoever began it, so a colleague's half-done intake can be finished rather than retyped.
    draftsHeading: 'Unfinished intakes',
    draftsNote:
      'A draft is not a request. Nothing has been filed, nobody has been given a control number, and the applicant is not waiting on an answer yet.',
    noDrafts: 'No unfinished intakes.',
    loadingDrafts: 'Reading the unfinished intakes…',
    moreDrafts: (count: number) =>
      `The ${count} most recent are shown, and there are more. Finish or file these to see the rest.`,
    resume: 'Resume',
    search: 'Search',
    // A control number and nothing else: a match on the reason says what is in somebody's file (DL-109).
    searchPlaceholder: 'Part of a control number, e.g. TAY-2026',
    searchHint: 'Searches control numbers only, never what a request is for.',
    order: 'Newest filing first.',
    status: 'Status',
    allStatuses: 'Any status',
    openOnly: 'Open requests only',
    clear: 'Clear filters',
    columnReference: 'Control number',
    columnApplicant: 'Applicant',
    columnReason: 'What it is for',
    columnStatus: 'Status',
    columnRequested: 'Requested',
    unnamedDraft: 'Not yet filed',
    withheld: 'Withheld — protected record',
    notGiven: 'Not given yet',
    emptyHeading: 'No requests yet',
    emptyMessage: 'Requests appear here once an intake has been filed.',
    noResultsHeading: 'No requests match those filters',
    noResultsMessage: 'Try a different status, or clear the filters.',
    shown: (count: number) => `${count} shown.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every request matching these filters.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next requests could not be loaded. The ones above are still correct; try again.',
    tryAgain: 'Try again',
  },

  intake: {
    title: 'New assistance request',
    resumeTitle: 'Unfinished intake',
    subtitle: 'One page, four steps. Nothing is filed until the last one.',
    stepperLabel: 'Intake steps',
    stepOf: (index: number, total: number) => `Step ${index} of ${total}`,
    back: 'Back',
    next: 'Next',
    saveDraft: 'Save and finish later',
    saved: 'Saved. You can come back to this from the request list.',
    submit: 'File the request',
    filed: 'The request has been filed and given a control number.',
    cancel: 'Leave without saving',
    failed: 'That could not be saved.',

    personHeading: 'Who is this for?',
    personNote:
      'Everything the office already knows about this person appears below as soon as you choose them. There is nothing here to retype.',
    personMissing: 'Not on the registry yet?',
    personMissingLink: 'Register them first',
    contextHeading: 'What the office already knows',
    householdLabel: 'Household',
    noHousehold: 'No household recorded',
    membersLabel: 'Others at this address',
    historyLabel: 'Assistance history',
    noHistory: 'No assistance recorded for this person.',
    totalReleased: 'Total handed over',
    openCases: 'Open requests',
    lastActivity: 'Last activity',

    requestHeading: 'What is being asked for?',
    channel: 'How did this reach the office?',
    channelOnlineNote:
      'Online submissions arrive from the resident app and cannot be selected here — a request typed by staff is an encoded one.',
    referredBy: 'Referred by',
    referredByPlaceholder: 'e.g. Brgy. Dolores — Kagawad Santos',
    programme: 'Programme',
    programmePlaceholder: 'Choose a programme',
    reason: 'What is the assistance for?',
    reasonPlaceholder:
      'e.g. Maintenance medicines and follow-up laboratory work after a hypertension confinement',
    requestedAmount: 'Amount requested (₱)',
    requestedAmountHint: 'Optional. Leave blank where the programme grants goods rather than cash.',
    maximumGrant: 'Programme maximum',

    checksHeading: 'Checks',
    requirementsHeading: 'Documents',
    requirementsNote:
      'Tick what the applicant presented. A required document can be waived — say why, and the waiver is kept with the request.',
    presented: 'Presented',
    waive: 'Waive',
    waiveReason: 'Why is it being waived?',
    mandatory: 'Required',
    optional: 'Optional',
    noRequirements: 'This programme lists no documents.',

    reviewHeading: 'Review and file',
    reviewNote: 'Check this reads the way you would want it read back to you.',
    outstandingHeading: 'Still to do',
    readyToFile: 'Everything needed is here.',

    advisoryFailed:
      'The duplicate and previous-assistance check could not be read, so nothing is shown here — which is not a finding that nothing was found. The office record reads it again when the request is filed.',
    refused: 'The office record did not accept this:',
    withheldHeading: 'This intake is a protected record',
    withheldDraft:
      'Part of this unfinished intake is withheld from your account, because the person it is for is under a protected sector. It cannot be continued from a copy you are not shown in full — saving it would erase what was withheld. A colleague cleared for protected records can finish it.',
    resumeFailedHeading: 'This intake could not be opened',
    backToList: 'Back to requests',
  },

  assessment: {
    subtitle: 'Assessment',
    notFoundHeading: 'That request is not available',
    notFoundMessage:
      'The request does not exist, or it is outside the part of the municipality you cover.',
    back: 'Back to requests',

    applicantHeading: 'Applicant',
    applicantNote:
      'The same picture the encoder saw, read fresh. Nothing here was retyped into this request.',

    requestHeading: 'The request',
    programme: 'Programme',
    channel: 'Channel',
    requested: 'Requested',
    approved: 'Approved',
    recommended: 'Recommended',
    filedOn: 'Filed',
    reason: 'What it is for',
    referredBy: 'Referred by',
    notSet: '—',
    withheld: 'Withheld — protected record',
    remarksWithheld: 'Remarks withheld — protected record',
    protectedNote:
      'The person this request is for is under a protected sector, so its words — why they came, who referred them, the reasons for each move and any remarks — are withheld from your account. They are recorded; a colleague cleared for protected records can read them.',
    advisoryNotRead:
      'The duplicate and previous-assistance check reads this person’s whole assistance history, so it is read by the staff who file requests, not by every account that can open one.',
    advisoryFailed:
      'The duplicate and previous-assistance check could not be read, so nothing is shown here — which is not a finding that nothing was found.',
    historyHeading: 'History',
    noHistory: 'No move has been recorded yet.',
    noReasonGiven: 'No reason was recorded with this move.',

    documentsHeading: 'Documents',
    documentsNote: 'Verify what was presented, or waive it with a reason.',
    verify: 'Verify',
    reject: 'Reject',
    waive: 'Waive',
    remarks: 'Remarks',

    studyHeading: 'Case study',
    studyNote:
      'The findings are what an audit reads when it asks why public money moved. A recommendation is not an approval — that is a separate act by a different role.',
    findings: 'Findings',
    findingsPlaceholder:
      'e.g. Home visit on 12 August. Household of five in a rented room; sole earner out of work since June; two children in public school.',
    homeVisit: 'A home visit was conducted',
    recommendedAmount: 'Recommended amount (₱)',
    notRecordedHeading: 'These two are not saved to the office record',
    notRecorded:
      'The system of record holds one amount anywhere \u2014 money actually released \u2014 and no field for a recommended amount or for whether a home visit was made. Both stay on this screen while the case is open and neither reaches the record an approver or an auditor reads. Write anything an approver must see into the findings.',
    recommendation: 'What you recommend',
    formHeading: 'The assessment form',
    formIntro:
      'An assessment is opened from a published form and pins that form\u2019s version, so the answers stay attached to the questions that were actually asked.',
    formProvisional:
      'This form has not been adopted by the MSWDO. It is a plausible AICS-style instrument awaiting the office\u2019s own, and it is recorded as provisional until somebody confirms it.',
    chooseTemplate: 'Assessment form',
    openForm: 'Open the assessment',
    saveAnswers: 'Save the answers',
    answersSaved: 'The answers have been recorded.',
    notOpened:
      'No assessment is open on this case yet. Open one above \u2014 the findings below cannot be filed until the form exists.',
    stillNeeded: 'Still needed before this can be filed:',
    recommendationReason: 'Why you recommend this',
    recommendationReasonPlaceholder:
      'Required when recommending refusal. The applicant will be told a decision followed from this.',
    recommendationNote:
      'A recommendation advises the decision; it does not make it. Approving, refusing and referring are each a separate act by somebody holding that authority.',
    saveStudy: 'Save the case study',
    studySaved: 'The case study has been saved.',

    readinessHeading: 'Before endorsing',
    readinessNote:
      'These are things the office would normally have. None of them stops you — a home visit is impossible for a household that has moved, and a document can be waived. Your reason is what carries the decision.',
    readinessClear: 'Nothing outstanding.',

    moveHeading: 'Move this request on',
    moved: 'The request has been moved.',
    failed: 'That change could not be recorded.',
  },
} as const;
