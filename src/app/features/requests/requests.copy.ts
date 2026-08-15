/** Every user-facing string for the assistance-request screens (`DL-23`). */
export const REQUESTS_COPY = {
  list: {
    title: 'Assistance requests',
    subtitle: 'Intake, assessment, endorsement and approval of one intervention at a time.',
    caption: 'Assistance requests recorded by the MSWDO',
    startIntake: 'Start an intake',
    draftsHeading: 'Your unfinished intakes',
    draftsNote:
      'A draft is not a request. Nothing has been filed, nobody has been given a control number, and the applicant is not waiting on an answer yet.',
    noDrafts: 'No unfinished intakes.',
    resume: 'Resume',
    search: 'Search',
    searchPlaceholder: 'Control number, applicant or reason',
    status: 'Status',
    allStatuses: 'Any status',
    openOnly: 'Open requests only',
    clear: 'Clear filters',
    columnReference: 'Control number',
    columnApplicant: 'Applicant',
    columnProgramme: 'Programme',
    columnStatus: 'Status',
    columnRequested: 'Requested',
    unnamedDraft: 'Not yet filed',
    emptyHeading: 'No requests yet',
    emptyMessage: 'Requests appear here once an intake has been filed.',
    noResultsHeading: 'No requests match those filters',
    noResultsMessage: 'Try a different status, or clear the filters.',
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
    notSet: '—',

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
