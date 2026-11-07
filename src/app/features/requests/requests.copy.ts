import type { CaseNoteSensitivity, RequirementStatus } from '@domain/index';

/** Every user-facing string for the assistance-request screens (`DL-23`). */
export const REQUESTS_COPY = {
  list: {
    title: 'Assistance requests',
    subtitle: 'Intake, assessment, endorsement and approval of one intervention at a time.',
    caption: 'Assistance requests recorded by the MSWDO',
    startIntake: 'Start an intake',
    // Not "your": the office record lists every unfinished intake the reader's scope covers,
    // whoever began it, so a colleague's half-done intake can be finished rather than retyped.
    assignedTo: 'Assigned to',
    anyone: 'Anyone',
    workersFailed: 'The list of social workers could not be read, so the list cannot be narrowed by one.',
    caseloadNote:
      'Your caseload: the filed requests assigned to you for assessment. Requests not assigned to you, and unfinished intakes, are worked by others.',
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
    barangay: 'Barangay',
    anyBarangay: 'Any barangay',
    category: 'Programme type',
    anyCategory: 'Any programme type',
    owingDocument: 'Still owing a document',
    owingDocumentHint:
      'Still owing a document: open, with a required document — or a conditional one ruled to apply — neither verified nor waived. A conditional document nobody has ruled on is not counted against the applicant.',
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
      'The person this request is for is under a protected sector, so its words — why they came, who referred them, the reasons for each move and assignment, any remarks, the case study and the notes — are withheld from your account. They are recorded; a colleague cleared for protected records can read them.',
    unknownProgramme: 'A programme this account cannot read',
    registryNotRead:
      'The resident registry is not read by this account, so the applicant’s record is not shown here.',
    profileFailed: 'The applicant’s record could not be read, so it is not shown here.',

    assignmentHeading: 'Assignment',
    assignedTo: 'Assigned for assessment to',
    assignedUnnamed: 'a staff account with no name on record',
    notAssigned: 'Not assigned to a social worker yet.',
    assignedLine: (name: string): string => `Assigned to ${name}`,
    assignTo: 'Assign to',
    assignReason: 'Why',
    assignReasonHint:
      'Kept with the assignment, against your name. The history says who handed this over and why.',
    assign: 'Assign for assessment',
    assigned: 'The request has been assigned.',
    assignChooseWorker: 'Choose the social worker this is being assigned to. Nothing was sent.',
    assignNotWorkable:
      'Only a filed request that is not over can be assigned. A draft is the counter’s, and a request that has ended is kept as it ended.',
    workersFailed: 'The list of social workers could not be read, so nobody is offered.',
    advisoryNotRead:
      'The duplicate and previous-assistance check reads this person’s whole assistance history, so it is read by the staff who file and assess requests, not by every account that can open one.',
    advisoryFailed:
      'The duplicate and previous-assistance check could not be read, so nothing is shown here — which is not a finding that nothing was found.',
    historyHeading: 'History',
    noHistory: 'No move has been recorded yet.',
    noReasonGiven: 'No reason was recorded with this move.',

    documentsHeading: 'Documents',
    documentsNote:
      'Check what was presented, or excuse it. Rejecting, asking for a fresh copy and excusing each need remarks — the applicant has to be told why.',
    documentsNotWorkable:
      'This request is a draft or has ended, so its documents are shown as they stand and nothing more is recorded against them.',
    verify: 'Verify',
    reject: 'Reject',
    waive: 'Waive',
    needsReplacement: 'Needs a fresh copy',
    remarks: 'Remarks',
    remarksHint: 'Required to reject, to ask for a fresh copy, or to waive.',
    onlyWaive:
      'Nothing has been presented for this yet, so it can only be excused. Record the document first to check it.',
    reviewed: 'The review has been recorded.',
    ruled: 'The ruling has been recorded.',
    /** Where the applicant must be told why, the words the server asks for, said before sending. */
    reviewNeedsWords: {
      pending: null,
      submitted: null,
      verified: null,
      expired: null,
      waived:
        'Say why the document is being excused. An excuse nobody gave a reason for reads as an oversight.',
      rejected:
        'Say why the document was not accepted. The applicant has to be told what to bring instead.',
      'needs-replacement': 'Say why a fresh copy is needed — damaged, illegible, or out of date.',
    } as Readonly<Record<RequirementStatus, string | null>>,

    studyHeading: 'Case study',
    studyNote:
      'The findings are what an audit reads when it asks why public money moved. A recommendation is not an approval — that is a separate act by a different role.',
    findings: 'Findings',
    findingsPlaceholder:
      'e.g. Home visit on 12 August. Household of five in a rented room; sole earner out of work since June; two children in public school.',
    homeVisit: 'A home visit was conducted',
    recommendedAmount: 'Recommended amount (₱)',
    recommendation: 'What you recommend',
    completedHeading: 'The completed case study',
    studyForm: 'Form',
    studyBy: 'Assessed by',
    homeVisitFact: 'Home visit',
    yes: 'Made',
    no: 'Not made',
    noRecommendation: 'None recorded',
    studyWithheld: 'Withheld — case records are not shown to your account',
    noStudyYet: 'No case study has been completed on this request.',
    notInAssessment:
      'An assessment is opened, answered and completed while the request is in assessment. Move it there first.',
    versionLabel: (version: string): string => `version ${version}`,
    alreadyOpen: (label: string): string =>
      `An assessment was already open on this request, from “${label}”. One is open at a time, so it is shown here instead.`,
    completeMovesNothing:
      'Saving the case study keeps it on the request and moves it nowhere. Endorsing it is a separate move, below.',
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

    notesHeading: 'Notes',
    noNotes: 'No note has been written on this request.',
    notesFailed: 'The notes could not be read, so none is shown — which is not the same as there being none.',
    notesLoading: 'Reading the notes…',
    noteWithheld: 'Withheld — this note is not shown to your account.',
    noteBody: 'Add a note',
    noteSensitivity: 'Who may read it',
    noteSensitivityLabels: {
      routine: 'Routine',
      protected: 'Protected — case-note clearance only',
    } as Readonly<Record<CaseNoteSensitivity, string>>,
    noteSensitivityHint: 'A note is kept for good: it is never edited or removed.',
    addNote: 'Add the note',
    noteAdded: 'The note has been added.',
    noteEmpty: 'Write the note before adding it. Nothing was sent.',
    noteTooLong: (max: number): string => `A note is at most ${max} characters. Nothing was sent.`,

    readinessHeading: 'Before endorsing',
    readinessNote:
      'These are things the office would normally have. None of them stops you — a home visit is impossible for a household that has moved, and a document can be waived. Your reason is what carries the decision.',
    readinessClear: 'Nothing outstanding.',

    moveHeading: 'Move this request on',
    payoutMoves:
      'Scheduled and released are recorded with the payout: the request moves when its release is scheduled into a payout session, and again when it is handed over.',
    prepareRelease: 'Prepare the release',
    approvedGoods: (goods: string): string => `Goods: ${goods}`,

    // DL-183: an approval says what was approved, and is the ceiling a money release is prepared under.
    approveHeading: 'Approve this request',
    approveNote:
      'Approving records what was approved: the amount, or for goods a description of them. A money release is prepared under this amount, never above it; the record keeps it with your reason.',
    approveKindLegend: 'What is approved',
    approveKindMoney: 'An amount of money',
    approveKindGoods: 'Goods',
    approveAmount: 'Approved amount (₱)',
    approveAmountHint: 'In pesos, as on the voucher — 3,000 or 3,000.50.',
    approveContext: (requested: string, recommended: string): string =>
      `Asked for: ${requested}. Recommended by the assessment: ${recommended}.`,
    approveGoods: 'What goods are approved',
    approveGoodsHint: 'Goods are described, never priced.',
    approveReason: 'Why it is approved',
    approveSubmit: 'Approve',
    approvedNotice: 'The request has been approved.',
    approveProblems: {
      amountUnreadable: 'Enter the approved amount in pesos, like 3,000 or 3,000.50. Nothing was sent.',
      'amount-not-positive': 'The approved amount has to be more than nothing. Nothing was sent.',
      'amount-too-large': 'That amount is beyond what the office record can hold. Nothing was sent.',
      'goods-missing': 'Say what goods are approved. Nothing was sent.',
      'goods-too-long': 'Describe the goods in 300 characters or fewer. Nothing was sent.',
      reasonShort: 'Say why it is approved, in 8 characters or more. Nothing was sent.',
    },

    // DL-183: a request is not cancelled or expired while its payout stands.
    releaseStands: (reference: string, status: string): string =>
      `Release ${reference} is ${status}. A request is not cancelled or expired while its release stands: void the release first, by its own act, and then this request can be ended.`,
    openReleaseLink: 'Open the release',
    releaseMayStand:
      'If a payout has been prepared for this request, it is voided first — by somebody who schedules payouts — and only then can the request be cancelled or expired.',
    moved: 'The request has been moved.',
    failed: 'That change could not be recorded.',
  },
} as const;
