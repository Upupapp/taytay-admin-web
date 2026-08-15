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
    queuesHeading: 'Work queues',
    queuesNote: 'Counts are computed under the same filters as the list below.',
    search: 'Search',
    searchPlaceholder: 'Case number, subject, worker or summary',
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

    emptyHeading: 'No cases yet',
    emptyMessage: 'Cases appear here once the office opens a file on a household.',
    noResultsHeading: 'No cases match those filters',
    noResultsMessage: 'Try a different queue, or clear the filters.',
  },

  workspace: {
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
      'Everything on this screen is read in one call, so the person, the address, the family and the money cannot disagree with each other.',
    subjectLink: 'Open the resident record',

    householdHeading: 'Where they live',
    noHousehold: 'Not linked to a household',
    noHouseholdNote:
      'Between addresses, or split across two. A recordable state, not missing data.',
    householdLink: 'Open the household',
    membersHeading: 'Who else lives there',

    familyHeading: 'Who they belong to',
    noFamily: 'No family recorded',
    noFamilyNote:
      'A household is an address; a family is a claim about people. Neither implies the other.',
    familyLink: 'Open the family',

    requestsHeading: 'Assistance on this case',
    requestsNote: 'The interventions attached to this file. A case usually outlives several.',
    noRequests: 'No assistance request has been attached to this case.',
    requestReference: 'Reference',
    requestProgramme: 'Programme',
    requestStatus: 'Status',
    requestRequested: 'Requested',
    requestApproved: 'Approved',
    notSet: '—',

    factsHeading: 'Case',
    reference: 'Case number',
    category: 'Category',
    status: 'Status',
    opened: 'Opened',
    closed: 'Closed',
    assigned: 'Assigned to',
    barangay: 'Barangay',
    summary: 'Presenting problem',

    tasksHeading: 'Tasks',
    tasksNote: 'What the office undertook to do, by when, and who owes it.',
    noTasks: 'No task has been recorded on this case.',
    taskDue: 'Due',
    taskDone: 'Completed',
    taskOutcome: 'Outcome',
    addTask: 'Add a task',
    completeTask: 'Mark as done',

    notesHeading: 'Running record',
    notesNote: 'The case notes, newest first. Restricted entries are listed but not readable.',
    noNotes: 'Nothing has been written on this case yet.',
    withheldSummary: (count: number) =>
      `${count} note${count === 1 ? ' is' : 's are'} restricted and cannot be read by your role.`,
    addNote: 'Add a note',

    assignHeading: 'Assign this case',
    assignNote:
      'Assigning is a recorded act with a reason, like everything else here. Leave the worker empty to return the case to the unassigned pool.',
    assignWorker: 'Worker',
    assignNobody: 'Nobody — return it to the pool',
    assign: 'Record the assignment',

    closedNotice:
      'This case is closed. The file is kept in full, and a situation that recurs is opened as a new case rather than reviving this one.',
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
    reason: 'Why is this needed?',
    reasonPlaceholder: 'e.g. Household reported moving; the plan assumes the old address',
    confirm: 'Add the task',
    cancel: 'Cancel',
    saved: 'The task has been added.',
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

  moved: 'The case has been moved, and the change is on the timeline.',
  assigned: 'The assignment has been recorded.',
  failed: 'That change could not be recorded.',
} as const;
