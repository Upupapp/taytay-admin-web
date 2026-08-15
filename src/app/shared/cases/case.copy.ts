import type {
  CaseCategory,
  CaseEventKind,
  CaseNoteSensitivity,
  CaseQueueId,
  CaseStatus,
  CaseTaskKind,
  CaseTimelineSource,
} from '@domain/index';

/**
 * Every user-facing string for casework that more than one screen says (`DL-23`).
 *
 * Kept beside the shared components rather than inside the feature, because the
 * status transition control and the timeline are used by the workspace, will be
 * used by the assistance-request screen, and must not say the same thing two
 * different ways.
 */
export const CASE_COPY = {
  statusLabel: {
    intake: 'Intake',
    assessment: 'Assessment',
    intervention: 'Intervention',
    monitoring: 'Monitoring',
    'on-hold': 'On hold',
    'referred-out': 'Referred out',
    closed: 'Closed',
  } satisfies Record<CaseStatus, string>,

  categoryLabel: {
    'crisis-intervention': 'Crisis intervention',
    'child-protection': 'Child protection',
    'family-welfare': 'Family welfare',
    'older-persons': 'Older persons',
    'disability-support': 'Disability support',
    'gender-based-violence': 'Gender-based violence',
    livelihood: 'Livelihood',
  } satisfies Record<CaseCategory, string>,

  queueLabel: {
    mine: 'My cases',
    unassigned: 'Unassigned',
    overdue: 'Overdue',
    'due-soon': 'Due this week',
    stalled: 'No activity in a month',
    all: 'All cases',
  } satisfies Record<CaseQueueId, string>,

  queueDescription: {
    mine: 'Cases assigned to you and still open.',
    unassigned: 'Open cases nobody owns yet. Assign one to pick it up.',
    overdue: 'The next action was due before today.',
    'due-soon': 'The next action falls due within seven days.',
    stalled: 'Nothing has been recorded for thirty days or more.',
    all: 'Every case you may see, open or closed.',
  } satisfies Record<CaseQueueId, string>,

  taskKindLabel: {
    'home-visit': 'Home visit',
    document: 'Document',
    assessment: 'Assessment',
    'follow-up': 'Follow-up',
    referral: 'Referral',
    review: 'Review',
  } satisfies Record<CaseTaskKind, string>,

  sensitivityLabel: {
    routine: 'Routine note',
    protected: 'Protected note',
  } satisfies Record<CaseNoteSensitivity, string>,

  sensitivityHint: {
    routine: 'Readable by anyone who may open this case.',
    protected:
      'Safety planning, anything identifying a child in conflict with the law, or a confidence. Readable only by staff cleared for the protected tier.',
  } satisfies Record<CaseNoteSensitivity, string>,

  eventLabel: {
    'case-opened': 'Case opened',
    'status-changed': 'Status changed',
    assigned: 'Assigned',
    unassigned: 'Returned to the unassigned pool',
    'note-added': 'Note added',
    'task-added': 'Task added',
    'task-completed': 'Task completed',
    'request-status-changed': 'Assistance request moved',
  } satisfies Record<CaseEventKind, string>,

  sourceLabel: {
    case: 'Case',
    note: 'Running record',
    task: 'Task',
    'assistance-request': 'Assistance',
  } satisfies Record<CaseTimelineSource, string>,

  transition: {
    heading: 'Move this case on',
    current: 'Currently',
    destination: 'Move to',
    noMoves: 'There is nowhere to move this case from here.',
    noPermission: 'Your role cannot make any of the moves available from this status.',
    reason: 'Why is it moving?',
    reasonPlaceholder: 'e.g. Home visit on 12 August confirmed the household has re-employed',
    reasonHint: 'Required, and recorded permanently against your name.',
    reasonTooShort:
      'Say a little more — a colleague reading this in two years has only these words.',
    confirm: 'Record the move',
    cancel: 'Cancel',
    describes: 'What this status means',
  },

  timeline: {
    heading: 'What has happened',
    summary:
      'Every recorded act on this case, newest first, including the assistance requests attached to it. Nothing here can be edited or removed.',
    empty: 'Nothing has been recorded on this case yet.',
    withheld: 'Restricted. Your role cannot read this entry.',
    withheldHint:
      'The entry exists and is counted here so that nobody reads the file as complete when it is not.',
    by: 'by',
    reasonGiven: 'Reason given',
    noReason: 'No reason was recorded.',
    movedFrom: 'from',
    movedTo: 'to',
  },
} as const;
