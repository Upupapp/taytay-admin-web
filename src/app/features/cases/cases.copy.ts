/** Every user-facing string for the case screens (`DL-23`). */
export const CASES_COPY = {
  list: {
    title: 'Cases',
    subtitle: 'The office’s continuing file on a person, and what is owed on it next.',
    caption: 'Social welfare cases',
    /**
     * Said above the queues, because "case" and "assistance request" are the
     * two words most easily used for each other, and the distinction is the
     * whole reason this screen exists (`DL-52`).
     */
    banner:
      'A case is the office’s continuing involvement with a household. An assistance request is one intervention inside it — a case usually outlives several.',
    caseloadNote:
      'These are the cases assigned to you. A case reaches your caseload when intake or the head gives it to you; the unassigned ones are theirs to give out.',
    open: 'Open a case',
    queuesHeading: 'Work queues',
    queuesNote: 'Counts are computed under the same filters as the list below.',
    search: 'Case number',
    searchPlaceholder: 'Part of a case number, e.g. 2026-0001',
    status: 'Status',
    allStatuses: 'Any status',
    category: 'Category',
    allCategories: 'Any category',
    barangay: 'Barangay',
    allBarangays: 'All barangays',
    clear: 'Clear filters',

    columnReference: 'Case',
    columnSubject: 'Subject',
    columnStatus: 'Status',
    columnNextAction: 'Next action',
    columnAssigned: 'Worker',
    columnActivity: 'Last activity',

    unassigned: 'Nobody assigned',
    noNextAction: 'Nothing scheduled',
    overdueBy: (days: number) => `${days} day${days === 1 ? '' : 's'} overdue`,
    dueIn: (days: number) =>
      days === 0 ? 'Due today' : `Due in ${days} day${days === 1 ? '' : 's'}`,
    neverActive: 'No activity recorded',
    withheld: 'Withheld from your account',

    shown: (count: number) => `${count} shown, newest opened first.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every case matching these filters.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next cases could not be loaded. The ones above are still correct; try again.',

    emptyHeading: 'No cases yet',
    emptyMessage: 'Cases appear here once the office opens a file on a household.',
    noResultsHeading: 'No cases match those filters',
    noResultsMessage: 'Try a different queue, or clear the filters.',
  },

  workspace: {
    scheduleVisit: 'Schedule a home visit',
    subtitle: 'Case workspace',
    notFoundHeading: 'That case is not available',
    notFoundMessage:
      'The case does not exist, or it is outside the part of the caseload you cover.',
    back: 'Back to cases',

    nextActionHeading: 'What happens next',
    nextActionNone: 'Nothing is scheduled on this case. Add a task to say what is owed.',
    nextActionDue: 'Due',
    nextActionOverdue: 'Overdue',
    nextActionOwner: 'Owed by',

    contextHeading: 'Who this is about',
    contextNote:
      'Everything on this screen is read in one go, so the person, the address, the family and the money cannot disagree with each other.',
    subjectLink: 'Open the resident record',

    householdHeading: 'Where they live',
    noHousehold: 'Not linked to a household',
    noHouseholdNote:
      'Between addresses, or split across two. A recordable state, not missing data.',
    householdLink: 'Open the household',
    membersHeading: 'Who else lives there',
    contextFailed:
      'The household or the family could not be read, so neither is shown here — which is not the same as there being none.',

    familyHeading: 'Who they belong to',
    noFamily: 'No family recorded',
    noFamilyNote:
      'A household is an address; a family is a claim about people. Neither implies the other.',
    familyLink: 'Open the family',
    familyMembers: (count: number) => `${count} current member${count === 1 ? '' : 's'}`,

    requestsHeading: 'Assistance on this case',
    requestsNote: 'The interventions this case names. A case usually outlives several.',
    noRequests: 'No assistance request has been named in this case.',
    requestsUnread: (count: number) =>
      `${count} more request${count === 1 ? ' is' : 's are'} named in this case and outside what your account reads, so ${count === 1 ? 'it is' : 'they are'} not shown here.`,
    requestReference: 'Reference',
    requestProgramme: 'Programme',
    requestStatus: 'Status',
    requestRequested: 'Requested',
    requestApproved: 'Approved',
    notSet: '—',
    linkRequest: 'Name a request',

    factsHeading: 'Case',
    reference: 'Case number',
    category: 'Category',
    status: 'Status',
    opened: 'Opened',
    closed: 'Closed',
    continues: 'Continues',
    continuesLink: 'The closed case it continues',
    assigned: 'Assigned to',
    nobodyAssigned: 'Nobody assigned',
    barangay: 'Barangay',
    summary: 'Presenting problem',

    tasksHeading: 'Tasks',
    tasksNote: 'What the office undertook to do, by when, and who owes it.',
    noTasks: 'No task has been recorded on this case.',
    taskDue: 'Due',
    taskDone: 'Completed',
    taskCancelled: 'Cancelled',
    taskOutcome: 'Outcome',
    taskOwedBy: 'Owed by',
    taskOwedByNobody: 'Nobody yet',
    addTask: 'Add a task',
    completeTask: 'Mark as done',
    cancelTask: 'Cancel task',
    handOverTask: 'Hand over',
    rescheduleTask: 'Move the date',

    notesHeading: 'Running record',
    notesNote: 'The case notes, newest first. Restricted entries are listed but not readable.',
    noNotes: 'Nothing has been written on this case yet.',
    withheldSummary: (count: number) =>
      `${count} note${count === 1 ? ' is' : 's are'} restricted and cannot be read by your role.`,
    addNote: 'Add a note',

    /** Said where the words would be — never a blank that reads as "nobody wrote anything". */
    withheld: 'Withheld from your account',
    protectedNotice:
      'This case is about a person under a protected sector. What it says — the presenting problem, the reasons, the tasks and the notes — is withheld from your account, and nothing can be added to it from here. Its status, who holds it and when things happened are shown.',

    assignHeading: 'Assign this case',
    assignNote:
      'Assigning is a recorded act with a reason, like everything else here. The case goes to one social worker’s caseload; choose nobody to take it off theirs.',
    assignWorker: 'Social worker',
    assignNobody: 'Nobody — take it off any caseload',
    assign: 'Record the assignment',
    /** Said before the button: the previous holder's open tasks go with the case (`DL-183`). */
    assignMovesTasks: (count: number, holder: string, to: string | null) =>
      `${count === 1 ? 'The open task' : `The ${count} open tasks`} ${holder} owes on this case ${
        count === 1 ? 'goes' : 'go'
      } with it — ${to === null ? 'to nobody' : `to ${to}`} — each recorded with this reason. Tasks owed by anybody else, and finished ones, stay where they are.`,
    assigneesLoading: 'Reading the social workers…',
    assigneesFailed:
      'The list of social workers could not be read, so nobody is offered. Close this and try again.',

    closedNotice:
      'This case is closed. The file is kept in full, and a situation that recurs is opened as a new case rather than reviving this one.',
    continueClosed: 'Open a new case continuing this one',
    closeBlocked: (count: number) =>
      `Closing is not offered while ${count === 1 ? 'a task is' : `${count} tasks are`} open. Record what happened to each first — mark it done with its outcome, or cancel it with the reason it is no longer needed — because a task left open on a closed case would be owed by nobody.`,
    closeBlockedHeading: 'Open tasks to settle before closing',
    endLink: 'End link',
    endLinkLabel: (reference: string) => `End the link to ${reference}`,
  },

  noteForm: {
    heading: 'Add a note',
    description:
      'The running record is append-only. A note cannot be edited or deleted once it is saved, so write it the way you would want it read aloud.',
    body: 'What happened?',
    bodyPlaceholder:
      'e.g. Visited the household on 12 August. Two children present, both enrolled.',
    sensitivity: 'How closely is this held?',
    reason: 'Why is this being recorded?',
    reasonPlaceholder: 'e.g. Monitoring visit under the intervention plan',
    confirm: 'Save the note',
    cancel: 'Cancel',
    saved: 'The note has been added to the running record.',
  },

  taskForm: {
    heading: 'Add a task',
    description:
      'A task is what the office has undertaken to do. It is what the queues count, and what the workspace shows as the next action.',
    title: 'What has to be done?',
    titlePlaceholder: 'e.g. Home visit to confirm the new address',
    kind: 'Kind',
    dueOn: 'Due by',
    assignee: 'Owed by',
    assigneeHint:
      'Yourself, whoever holds the case, or nobody yet — a task is owed by somebody who can see the case.',
    nobody: 'Nobody yet',
    you: (name: string) => `${name} (you)`,
    holder: (name: string) => `${name} (holds the case)`,
    reason: 'Why is this needed?',
    reasonPlaceholder: 'e.g. Household reported moving; the plan assumes the old address',
    confirm: 'Add the task',
    cancel: 'Cancel',
    saved: 'The task has been added.',
  },

  handOverForm: {
    heading: 'Hand over a task',
    description:
      'Handing a task to somebody else is recorded with a reason. It can go to you, to whoever holds the case, or to nobody yet.',
    assignee: 'Owed by',
    reason: 'Why is it changing hands?',
    reasonPlaceholder: 'e.g. The home visit falls on a day the holder is in the field elsewhere',
    confirm: 'Record the hand-over',
    cancel: 'Cancel',
    saved: 'The task has changed hands.',
  },

  rescheduleForm: {
    heading: 'Move a task’s date',
    description:
      'A recorded change of date with a reason — never a quiet postponement. The queues read the new date.',
    dueOn: 'Due by',
    reason: 'Why is the date moving?',
    reasonPlaceholder: 'e.g. The household asked to meet after payday',
    confirm: 'Record the new date',
    cancel: 'Cancel',
    saved: 'The task’s date has been moved.',
  },

  completeForm: {
    heading: 'Complete a task',
    description: 'The outcome is kept against your name and cannot be edited afterwards.',
    outcome: 'What happened?',
    outcomePlaceholder: 'e.g. Visited 14 August. New address confirmed and recorded.',
    confirm: 'Record the outcome',
    cancel: 'Cancel',
    saved: 'The task has been completed.',
  },

  /** Ending a task that is no longer needed (`DL-183`). Kept, never deleted. */
  cancelTaskForm: {
    heading: 'Cancel a task',
    description:
      'A cancelled task is kept on the case, marked cancelled, with your name and the reason as its outcome. It cannot be reopened; if the work is needed after all, add a new task.',
    reason: 'Why is this task no longer needed?',
    reasonPlaceholder:
      'e.g. The family moved to Antipolo; the barangay visit is no longer ours to make',
    confirm: 'Cancel the task',
    cancel: 'Keep it open',
    saved: 'The task has been cancelled.',
  },

  /** Ending a request's link to the case (`DL-183`). Kept in the history, never removed. */
  endLinkForm: {
    heading: 'End this request’s link to the case',
    description:
      'The link is kept in the case’s history with your name and the reason, and the request no longer counts as part of this case. It may then be named again — by this case or another one.',
    reason: 'Why is this request no longer part of the case?',
    reasonPlaceholder:
      'e.g. Named here by mistake; it belongs to the fire case opened the same day',
    confirm: 'End the link',
    cancel: 'Keep it linked',
    saved: 'The request is no longer linked to this case.',
  },

  linkForm: {
    heading: 'Name a request in this case',
    description:
      'A case names the interventions it covers one at a time, with a reason. A request named here stays in the case’s history; if it was named by mistake, its link is ended with a reason, never erased.',
    request: 'Which request?',
    choose: 'Choose a filed request',
    loading: 'Reading this person’s filed requests…',
    failed:
      'This person’s requests could not be read, so none is offered. Close this and try again.',
    none: 'This person has no filed request that is not already named in this case.',
    more: 'Only the 50 most recent are offered. An older request can be named from its own record.',
    rules:
      'A request belongs to one case at most, and is about this person or somebody in their household. The office record refuses any other.',
    reason: 'Why does this request belong to the case?',
    reasonPlaceholder: 'e.g. The medical grant is part of the support plan agreed on 12 August',
    confirm: 'Name the request',
    cancel: 'Cancel',
    saved: 'The request is now named in this case, and the act is on the timeline.',
  },

  openForm: {
    title: 'Open a case',
    subtitle:
      'A case is the office’s continuing file on a person. It opens at intake, assigned to nobody, and is given to a social worker from its workspace.',
    back: 'Back to cases',
    caseloadRefused:
      'Cases are opened by intake and the head. An account that works its own caseload is given cases rather than opening them.',
    subjectHeading: 'Who is this case about?',
    subjectLabel: 'The person the file is about',
    subjectHint:
      'One person, even when the whole household is served — responsibility has to land on a name.',
    subjectLoading: 'Reading the person this case continues…',
    subjectFailed: 'The person could not be read. Choose them again below.',
    continuesHeading: 'Continues a closed case',
    continuesNote: (reference: string) =>
      `This case continues ${reference}, which is closed. The old file is kept as it ended; the new one names it.`,
    continuesUnknown: 'This case continues a closed case.',
    aboutHeading: 'What the case is about',
    category: 'What kind of case is this?',
    summary: 'The presenting problem',
    summaryHint: 'One or two sentences a colleague can act on, between 8 and 500 characters.',
    summaryPlaceholder:
      'e.g. Family displaced by the fire on 3 August; two school-age children; no income this month.',
    summaryTooShort: 'Say a little more — at least 8 characters.',
    summaryTooLong: 'Keep it to 500 characters; the running record holds the rest.',
    requestsHeading: 'Requests this case covers (optional)',
    requestsNote:
      'This person’s filed requests. Name the ones this case is about; more can be named later from the workspace, one at a time.',
    requestsLoading: 'Reading this person’s filed requests…',
    requestsFailed:
      'This person’s requests could not be read, so none is offered. The case can be opened without them.',
    requestsNone: 'This person has no filed request yet.',
    requestsMore:
      'Only the 50 most recent are offered; an older one can be named from the workspace.',
    reasonHeading: 'Why the office is opening it',
    reason: 'Why is the office opening this case?',
    reasonPlaceholder: 'e.g. Walk-in at the office with a prescription she could not fill',
    reasonHint: 'Required, and recorded permanently against your name.',
    confirm: 'Open the case',
    opening: 'Opening…',
    opened: 'The case is open, at intake and assigned to nobody.',
    failed: 'The case could not be opened. Nothing was recorded.',
  },

  moved: 'The case has been moved, and the change is on the timeline.',
  assigned: 'The assignment has been recorded.',
  failed: 'That change could not be recorded.',
} as const;
