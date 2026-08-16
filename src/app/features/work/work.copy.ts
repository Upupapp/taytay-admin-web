/**
 * Screen wording for work queues, alerts and the notification centre.
 *
 * Two words are load-bearing throughout. **Late** is never "overdue" in red
 * alone — every late item also says how late, in words, because colour fails a
 * colour-blind officer, a monochrome printout and a screen reader alike.
 * **Waiting** is never "late": nothing can miss a target the office never set.
 */
export const WORK_COPY = {
  queue: {
    title: 'My work',
    subtitle: 'What you owe today, drawn from cases, requests, visits, referrals and releases.',
    team: 'The team’s work',
    centre: 'Notifications',

    asOf: 'As of',
    summaryLabel: 'What is owed',

    overdue: 'Late',
    overdueHint: 'Somebody set a date and it has passed. These come first.',
    dueToday: 'Due today',
    dueSoon: 'Due this week',
    later: 'Later',
    undated: 'No date set',
    undatedHint:
      'These have no deadline because the office has not adopted a service standard for them. They are ordered by who has waited longest.',

    assignedTo: 'With',
    unassigned: 'Nobody yet',
    open: 'Open',
    taskOnly: 'Only a task can be handed over or rescheduled. Everything else is the state of a record — act on the record.',

    reassign: 'Hand over',
    reassignTo: 'Hand to',
    reschedule: 'Move the date',
    newDate: 'New date',
    complete: 'Mark done',
    outcome: 'What happened',
    outcomeHint: 'Recorded against your name as the outcome. Required.',
    reason: 'Why',
    save: 'Save',
    cancel: 'Cancel',

    reassigned: 'Handed over.',
    rescheduled: 'The date was moved, and the reason recorded.',
    completed: 'Recorded as done.',
    failed: 'That could not be saved.',

    emptyHeading: 'Nothing owed',
    emptyMessage: 'When a case task, request, visit, referral or release needs you, it appears here.',
  },

  team: {
    title: 'The team’s work',
    subtitle: 'Who is carrying what, and where it is late.',
    back: 'Back to my work',
    mine: 'My work',

    lateCount: 'late',
    totalCount: 'in hand',
    unassignedHeading: 'Nobody has picked these up',
    unassignedHint:
      'Work with no name against it. This is the office’s most common failure, so it is a column rather than an omission.',

    emptyHeading: 'The office has nothing outstanding',
    emptyMessage: 'Nothing is owed by anybody right now.',
  },

  alerts: {
    heading: 'Things worth a look',
    hint: 'Conditions of the records, not jobs. Nobody ticks these off — fix the record and they go.',
    basis: 'How this was worked out',
    empty: 'Nothing flagged.',
  },

  centre: {
    title: 'Notifications',
    subtitle: 'What has happened. Nothing here is a job — what you owe is on your work list.',
    work: 'My work',
    markAllRead: 'Mark all as read',
    unread: 'unread',
    unreadBadge: 'Unread',
    fyiNotice:
      'These are records of events. If something needs doing it appears on your work list, with a date and your name against it.',

    emptyHeading: 'Nothing to catch up on',
    emptyMessage: 'Events that concern you appear here as they happen.',
  },
} as const;
