import type {
  AssistanceRequestStatus,
  CaseNoteSensitivity,
  RequirementStatus,
} from '@domain/index';

/** Every user-facing string for the assistance-request screens (`DL-23`). */
export const REQUESTS_COPY = {
  list: {
    title: 'Assistance requests',
    subtitle: 'Intake, assessment, endorsement and approval of one intervention at a time.',
    caption: 'Assistance requests recorded by the MSWDO',
    startIntake: 'Start an intake',
    importPast: 'Import past assistance',
    downloadReport: 'Download report',
    // Not "your": the office record lists every unfinished intake the reader's scope covers,
    // whoever began it, so a colleague's half-done intake can be finished rather than retyped.
    assignedTo: 'Assigned to',
    anyone: 'Anyone',
    workersFailed:
      'The list of social workers could not be read, so the list cannot be narrowed by one.',
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
    searchPlaceholder: 'A control number, e.g. TAY-2026',
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
    columnChannel: 'Came in',
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
    moreFailed:
      'The next requests could not be loaded. The ones above are still correct; try again.',
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
    requestedAmountUnreadable:
      'Type the amount in pesos, like 3200 or 3200.50. A centavo cannot be split.',
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
    /**
     * The header says what this record is and where it stands now. A fixed page name ("Assessment")
     * read as the request's stage, beside a badge that said Released (UI audit F029).
     */
    headerSubtitle: (programme: string, status: string) => `${programme} · ${status}`,
    notFoundHeading: 'That request is not available',
    notFoundMessage:
      'The request does not exist, or it is outside the part of the municipality you cover.',
    back: 'Back to requests',

    applicantHeading: 'Applicant',
    applicantNote:
      'The same picture the encoder saw, read fresh. Nothing here was retyped into this request.',
    // A filed request keeps the barangay at filing; the card above is the person today (DL-260).
    filedInBarangay: (barangay: string): string =>
      'Filed while the applicant lived in ' +
      barangay +
      '. The request keeps that barangay for its lists and reports; the card above shows where they live now.',

    requestHeading: 'The request',
    programme: 'Programme',
    channel: 'Channel',
    // Where the request came from (`DL-228`).
    importedHeading: 'Imported from past records',
    importedLead:
      'A record of assistance the office gave before this system, brought in from an old Tulong ' +
      'report. Nothing in this system moved it, so it has no history of steps and is never worked: ' +
      'it is read here, and counted in the dashboard, the reports and the twelve-month look-back.',
    importedSource: 'Source reference',
    importedSourceNone: 'The report gave none',
    importedDecided: 'Decided on',
    importedWithdrawn: (on: string): string =>
      `Its import was withdrawn on ${on}. The request is kept, and no longer counted anywhere.`,
    onlineHeading: 'Applied in the app',
    onlineLead:
      'The resident applied for this from the app, with the documents shown below as received ' +
      'from her account. Intake reviews it as any other request.',
    onlineChecked: (on: string, records: number): string =>
      `When she applied (${on}), the duplicate and previous-assistance check read ${records} ` +
      `record${records === 1 ? '' : 's'} and found:`,
    onlineNothing: 'Nothing to note.',
    onlineAdvice:
      'Advice, never a decision: nobody was there to answer a caution, so it waits for you. The ' +
      'check below is read again as the records stand now.',
    signalUnknown: (code: string): string => `A check this console has no words for (${code})`,
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
    // DL-265: a barangay link's applicant who moved away since filing. Words, never an error.
    movedAway:
      'This person now lives outside your barangay; the MSWDO office holds their current record.',
    advisoryMovedAway:
      'The check of this person’s other requests is not shown: this person now lives outside your ' +
      'barangay; the MSWDO office holds their current record.',

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
    // DL-226: an approval by the request's own endorser is recorded on its history entry.
    selfApprovedLine:
      'Approved by the person who endorsed it, so no second person checked the recommendation. Recorded, not refused.',

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
    remarksHint: 'Required to reject, to ask for a fresh copy, or to waive. Kept in the office.',
    // DL-237: the one field on this panel the applicant reads, said before any button.
    noteForApplicant: 'Note for the applicant (optional)',
    noteForApplicantHint:
      'The applicant will see this in the app, under the document’s name. Say what is wrong and what to send instead. It goes with Reject, Needs a fresh copy or Expired.',
    noteForApplicantOnlyWhenAsking:
      'A note for the applicant goes with Reject, Needs a fresh copy or Expired. Clear it to verify or waive.',
    noteForApplicantShown: 'The applicant was told:',
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
    amountUnreadable: 'Type the amount in pesos, like 3200 or 3200.50. A centavo cannot be split.',
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
    notesFailed:
      'The notes could not be read, so none is shown — which is not the same as there being none.',
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
    // One example per move: a returned request is not explained the way an endorsed one is.
    moveExamples: {
      'intake-review': 'e.g. All the papers came in on 14 November; ready for intake to check',
      assessment: 'e.g. Intake checked the papers; ready for a social worker to assess',
      endorsed:
        'e.g. Assessed on 14 November; the medical abstract and quotation support the amount',
      returned: 'e.g. The barangay certificate is out of date; asked the applicant for a new one',
      rejected: 'e.g. The same hospital bill was already paid in full by another office',
      cancelled: 'e.g. The applicant asked on 14 November to withdraw the request',
      expired: 'e.g. Nothing heard from the applicant since the papers were asked for in August',
      completed: 'e.g. Handed over and signed for; nothing more is owed on this request',
    } satisfies Partial<Record<AssistanceRequestStatus, string>>,
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
    // Each half said in words when it has no amount, never as a dash in a sentence.
    approveContext: (requested: string | null, recommended: string | null): string =>
      [
        requested === null ? 'No amount was asked for.' : `Asked for ${requested}.`,
        recommended === null
          ? 'The assessment did not recommend an amount.'
          : `The assessment recommended ${recommended}.`,
      ].join(' '),
    approveGoods: 'What goods are approved',
    approveGoodsHint: 'Goods are described, never priced.',
    // DL-270: above the programme's maximum grant is warned before the button, never refused.
    approveAboveMaximum: (maximum: string): string =>
      `This is more than the programme’s maximum grant of ${maximum}. You may still approve it: the amount is recorded as you give it. Say in the reason why this request needs more.`,
    approveReason: 'Why it is approved',
    approveSubmit: 'Approve',
    approvedNotice: 'The request has been approved.',
    // DL-226, on the doctrine of a self-release (DL-91): warned before the button, never blocked.
    selfApproveHeading: 'Check before you approve',
    selfApproveWarning:
      'You endorsed this request yourself. Approving it means no second person checked your recommendation, which the office normally separates. It will be recorded, in its history and the audit trail, as approved by the person who endorsed it. You may still approve it; ask another approver to decide it if one is available.',
    approveProblems: {
      amountUnreadable:
        'Enter the approved amount in pesos, like 3,000 or 3,000.50. Nothing was sent.',
      'amount-not-positive': 'The approved amount has to be more than nothing. Nothing was sent.',
      'amount-too-large':
        'That amount is beyond what the office record can hold. Nothing was sent.',
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
