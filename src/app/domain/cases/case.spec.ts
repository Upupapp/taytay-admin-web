import {
  CASE_STATUS_CATALOG,
  PROTECTED_CASE_WITHHELD,
  UNNAMED_STAFF,
  assignsCases,
  caseOpenProblems,
  caseQueueFacts,
  caseTimeline,
  isAllowedTaskAssignee,
  isCaseWritable,
  taskAssigneeChoices,
  unreadLinkedRequestCount,
  CASE_STATUS_TRANSITIONS,
  CASE_TRANSITION_PERMISSIONS,
  ROLE_DEFINITIONS,
  asId,
  asIsoDate,
  asIsoDateTime,
  canTransition,
  daysUntil,
  discloseCaseNote,
  isCaseFilterActive,
  isCaseOpen,
  isInQueue,
  isOverdue,
  isValidCaseReason,
  isValidNoteBody,
  nextAction,
  nextStatuses,
  openTaskCount,
  permissionForCaseTransition,
  todayAsIsoDate,
  withheldNoteCount,
  type AssistanceRequestId,
  type CaseEvent,
  type CaseEventId,
  type CaseId,
  type CaseNote,
  type CaseNoteId,
  type CaseNoteView,
  type CaseQueueFacts,
  type CaseStatus,
  type CaseTask,
  type CaseTaskId,
  type CaseTimelineSources,
  type IsoDate,
  type Permission,
  type StaffUserId,
} from '@domain/index';

const ME = asId<StaffUserId>('staff-sw-1');
const SOMEONE_ELSE = asId<StaffUserId>('staff-sw-2');
const CASE = asId<CaseId>('case-0001');
const TODAY = asIsoDate('2026-08-01');

function task(overrides: Partial<CaseTask> = {}): CaseTask {
  return {
    id: asId<CaseTaskId>('task-x'),
    caseId: CASE,
    title: 'Home visit',
    kind: 'home-visit',
    status: 'open',
    dueOn: asIsoDate('2026-08-10'),
    assignedTo: ME,
    assignedToName: 'Grace Ocampo',
    completedAt: null,
    completedBy: null,
    completedByName: null,
    outcome: null,
    audit: {
      createdAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      createdBy: ME,
      updatedAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      updatedBy: ME,
    },
    ...overrides,
  };
}

function note(overrides: Partial<CaseNote> = {}): CaseNote {
  return {
    id: asId<CaseNoteId>('cnote-x'),
    caseId: CASE,
    authorId: ME,
    authorName: 'Grace Ocampo',
    body: 'Visited the household and confirmed the arrangement.',
    sensitivity: 'routine',
    createdAt: asIsoDateTime('2026-07-20T02:00:00.000Z'),
    ...overrides,
  };
}

const holding =
  (...permissions: readonly Permission[]) =>
  (permission: Permission): boolean =>
    permissions.includes(permission);

/* ── A case is not a request ──────────────────────────────────────────────── */

describe('the case lifecycle', () => {
  it('describes every status it can reach', () => {
    for (const status of Object.keys(CASE_STATUS_CATALOG) as CaseStatus[]) {
      expect(CASE_STATUS_CATALOG[status].label.length).toBeGreaterThan(0);
      expect(CASE_STATUS_CATALOG[status].description.length).toBeGreaterThan(0);
    }
  });

  it('keeps closure terminal, so a recurrence is a new case and not a revived one', () => {
    // DL-53. Reopening would give "when did this case end?" several answers.
    expect(nextStatuses(CASE_STATUS_TRANSITIONS, 'closed')).toEqual([]);
    expect(canTransition(CASE_STATUS_TRANSITIONS, 'closed', 'assessment')).toBe(false);
    expect(isCaseOpen('closed')).toBe(false);
  });

  it('lets a stalled case come back to where it was, without inventing a path', () => {
    expect(canTransition(CASE_STATUS_TRANSITIONS, 'on-hold', 'intervention')).toBe(true);
    expect(canTransition(CASE_STATUS_TRANSITIONS, 'intake', 'monitoring')).toBe(false);
  });

  it('names a permission for every move, and holds closure apart from ordinary case work', () => {
    for (const status of Object.keys(CASE_STATUS_TRANSITIONS) as CaseStatus[]) {
      expect(CASE_TRANSITION_PERMISSIONS[status]).toBeDefined();
    }
    expect(permissionForCaseTransition('assessment')).toBe('case.manage');
    expect(permissionForCaseTransition('closed')).toBe('case.close');
  });

  it('does not let the roles that run casework close a case on their own', () => {
    // Ending the office's involvement is a decision, not a step (DL-53).
    for (const role of ['social-worker', 'intake-officer'] as const) {
      const permissions = ROLE_DEFINITIONS[role].permissions;
      expect(permissions).toContain('case.manage');
      expect(permissions).not.toContain('case.close');
    }
    expect(ROLE_DEFINITIONS['mswdo-head'].permissions).toContain('case.close');
  });

  it('gives no case permission at all to the roles that do not do casework', () => {
    for (const role of ['barangay-link', 'release-officer'] as const) {
      for (const permission of ROLE_DEFINITIONS[role].permissions) {
        expect(permission.startsWith('case.')).toBe(false);
      }
    }
  });

  it('lets an auditor read a case but never the protected tier', () => {
    const auditor = ROLE_DEFINITIONS.auditor.permissions;
    expect(auditor).toContain('case.view');
    expect(auditor).not.toContain('case-note.view-protected');
    expect(auditor).not.toContain('case.note');
  });
});

/* ── Reasons ──────────────────────────────────────────────────────────────── */

describe('a reason has to say something', () => {
  it('refuses a token acknowledgement', () => {
    expect(isValidCaseReason('ok')).toBe(false);
    expect(isValidCaseReason('   ')).toBe(false);
  });

  it('accepts a sentence a colleague could act on', () => {
    expect(isValidCaseReason('Household re-employed from July')).toBe(true);
  });

  it('applies the same floor to a note', () => {
    expect(isValidNoteBody('visited')).toBe(false);
    expect(isValidNoteBody('Visited the household on 12 August.')).toBe(true);
  });
});

/* ── Tasks are what "next" means ──────────────────────────────────────────── */

describe('the next action is a record, not an inference', () => {
  it('is the open task falling due soonest', () => {
    const soon = task({ id: asId<CaseTaskId>('task-a'), dueOn: asIsoDate('2026-08-04') });
    const later = task({ id: asId<CaseTaskId>('task-b'), dueOn: asIsoDate('2026-09-01') });
    expect(nextAction([later, soon])?.id).toBe(soon.id);
  });

  it('ignores work that is already done', () => {
    const done = task({ id: asId<CaseTaskId>('task-a'), status: 'done', dueOn: TODAY });
    const open = task({ id: asId<CaseTaskId>('task-b'), dueOn: asIsoDate('2026-12-01') });
    expect(nextAction([done, open])?.id).toBe(open.id);
    expect(openTaskCount([done, open])).toBe(1);
  });

  it('says there is nothing owed rather than guessing from the status', () => {
    expect(nextAction([task({ status: 'done' })])).toBeNull();
  });

  it('breaks a tie the same way for everyone looking at once', () => {
    const a = task({ id: asId<CaseTaskId>('task-a') });
    const b = task({ id: asId<CaseTaskId>('task-b') });
    expect(nextAction([b, a])?.id).toBe(a.id);
  });

  it('counts overdue in whole days, negative once the date has passed', () => {
    expect(daysUntil(asIsoDate('2026-08-10'), TODAY)).toBe(9);
    expect(daysUntil(asIsoDate('2026-07-23'), TODAY)).toBe(-9);
    expect(isOverdue(task({ dueOn: asIsoDate('2026-07-23') }), TODAY)).toBe(true);
    expect(isOverdue(task({ dueOn: asIsoDate('2026-07-23'), status: 'done' }), TODAY)).toBe(false);
  });

  it('reads today from a supplied clock, so a test is not a hostage to the calendar', () => {
    expect(todayAsIsoDate(new Date('2026-08-01T23:00:00.000Z'))).toBe('2026-08-01');
  });
});

/* ── Queues ───────────────────────────────────────────────────────────────── */

describe('work queues', () => {
  const facts = (overrides: Partial<CaseQueueFacts> = {}): CaseQueueFacts => ({
    status: 'assessment',
    assignedTo: ME,
    daysUntilNextAction: 3,
    daysSinceLastActivity: 2,
    ...overrides,
  });

  it('stops offering a case once it is closed — except in "all"', () => {
    const closed = facts({ status: 'closed' });
    expect(isInQueue('mine', closed, ME)).toBe(false);
    expect(isInQueue('overdue', { ...closed, daysUntilNextAction: -4 }, ME)).toBe(false);
    expect(isInQueue('all', closed, ME)).toBe(true);
  });

  it('does not put a colleague’s caseload in mine', () => {
    expect(isInQueue('mine', facts({ assignedTo: SOMEONE_ELSE }), ME)).toBe(false);
    expect(isInQueue('mine', facts(), ME)).toBe(true);
  });

  it('separates overdue from due soon at the boundary', () => {
    expect(isInQueue('overdue', facts({ daysUntilNextAction: -1 }), ME)).toBe(true);
    expect(isInQueue('overdue', facts({ daysUntilNextAction: 0 }), ME)).toBe(false);
    expect(isInQueue('due-soon', facts({ daysUntilNextAction: 0 }), ME)).toBe(true);
    expect(isInQueue('due-soon', facts({ daysUntilNextAction: 7 }), ME)).toBe(true);
    expect(isInQueue('due-soon', facts({ daysUntilNextAction: 8 }), ME)).toBe(false);
  });

  it('treats a case with nothing scheduled as neither overdue nor due', () => {
    const nothing = facts({ daysUntilNextAction: null });
    expect(isInQueue('overdue', nothing, ME)).toBe(false);
    expect(isInQueue('due-soon', nothing, ME)).toBe(false);
  });

  it('calls a case stalled after a month of silence', () => {
    expect(isInQueue('stalled', facts({ daysSinceLastActivity: 29 }), ME)).toBe(false);
    expect(isInQueue('stalled', facts({ daysSinceLastActivity: 30 }), ME)).toBe(true);
  });

  it('finds the unassigned pool by its emptiness, not by an owner', () => {
    expect(isInQueue('unassigned', facts({ assignedTo: null }), ME)).toBe(true);
    expect(isInQueue('unassigned', facts(), ME)).toBe(false);
  });

  it('does not treat "all" as a filter', () => {
    expect(isCaseFilterActive({ queue: 'all' })).toBe(false);
    expect(isCaseFilterActive({ queue: 'overdue' })).toBe(true);
    expect(isCaseFilterActive({})).toBe(false);
  });
});

/* ── Protected notes ──────────────────────────────────────────────────────── */

describe('a protected note is withheld by removing it, not by hiding it', () => {
  it('hands over a routine note to anyone who may open the case', () => {
    const view = discloseCaseNote(note(), holding('case.view'));
    expect(view.body).toBe(note().body);
    expect(view.isWithheld).toBe(false);
  });

  it('removes the body of a protected note rather than masking it', () => {
    const view = discloseCaseNote(note({ sensitivity: 'protected' }), holding('case.view'));
    // Not '••••' and not an empty string: there is no body on the object at all.
    expect(view.body).toBeNull();
    expect(view.isWithheld).toBe(true);
  });

  it('still says the entry exists, and who wrote it, and when', () => {
    // A caseworker who cannot see that three entries are restricted will read
    // the file as complete and act as though nothing happened.
    const view = discloseCaseNote(note({ sensitivity: 'protected' }), holding('case.view'));
    expect(view.authorName).toBe('Grace Ocampo');
    expect(view.createdAt).toBe(note().createdAt);
    expect(view.sensitivity).toBe('protected');
  });

  it('opens the protected tier to the clearance that owns it', () => {
    const view = discloseCaseNote(
      note({ sensitivity: 'protected' }),
      holding('case.view', 'case-note.view-protected'),
    );
    expect(view.body).toBe(note().body);
    expect(view.isWithheld).toBe(false);
  });

  it('counts what was withheld so a screen can say so in words', () => {
    const views = [
      discloseCaseNote(note(), holding('case.view')),
      discloseCaseNote(note({ sensitivity: 'protected' }), holding('case.view')),
      discloseCaseNote(note({ sensitivity: 'protected' }), holding('case.view')),
    ];
    expect(withheldNoteCount(views)).toBe(2);
  });
});

/* ── Dates ────────────────────────────────────────────────────────────────── */

describe('date arithmetic does not drift', () => {
  it('handles a month boundary', () => {
    const late: IsoDate = asIsoDate('2026-07-31');
    expect(daysUntil(late, asIsoDate('2026-08-01'))).toBe(-1);
  });
});

/* ── Casework phase 3: what the server decides, said by the domain (DL-179) ── */

function event(overrides: Partial<CaseEvent> = {}): CaseEvent {
  return {
    id: asId<CaseEventId>('cevt-x'),
    caseId: CASE,
    kind: 'status-changed',
    fromStatus: 'intake',
    toStatus: 'assessment',
    reason: 'Home visit booked for the household',
    actorId: ME,
    actorName: 'Grace Ocampo',
    occurredAt: asIsoDateTime('2026-07-25T02:00:00.000Z'),
    subject: { noteId: null, taskId: null, requestId: null, staffUserId: null },
    ...overrides,
  };
}

function noteView(overrides: Partial<CaseNoteView> = {}): CaseNoteView {
  return {
    id: asId<CaseNoteId>('cnote-x'),
    caseId: CASE,
    authorName: 'Grace Ocampo',
    sensitivity: 'routine',
    createdAt: asIsoDateTime('2026-07-20T02:00:00.000Z'),
    body: 'Visited the household and confirmed the arrangement.',
    isWithheld: false,
    ...overrides,
  };
}

const REQUEST = asId<AssistanceRequestId>('req-x');

/** The four things the timeline reads off a linked request, and nothing else. */
function linked(
  overrides: Partial<CaseTimelineSources['requests'][number]> = {},
): CaseTimelineSources['requests'][number] {
  return {
    id: REQUEST,
    referenceNumber: 'TAY-2026-000841',
    statusHistory: [
      {
        from: 'endorsed',
        to: 'approved',
        reason: 'Within the programme ceiling',
        actorId: SOMEONE_ELSE,
        actorName: 'Teodoro Lim',
        occurredAt: asIsoDateTime('2026-07-22T02:00:00.000Z'),
      },
    ],
    withheld: [],
    ...overrides,
  };
}

describe('the timeline is one assembly for both adapters', () => {
  it('merges events, notes, completed tasks and the linked requests, newest first', () => {
    const entries = caseTimeline({
      events: [event()],
      notes: [noteView()],
      tasks: [
        task({
          status: 'done',
          completedAt: asIsoDateTime('2026-07-28T02:00:00.000Z'),
          completedBy: ME,
          completedByName: 'Grace Ocampo',
          outcome: 'Visited and confirmed',
        }),
      ],
      requests: [linked()],
      withheld: [],
    });
    expect(entries.map((entry) => entry.source)).toEqual([
      'task',
      'case',
      'assistance-request',
      'note',
    ]);
    expect(entries[2]?.toRequestStatus).toBe('approved');
    expect(entries[2]?.reference).toBe('TAY-2026-000841');
  });

  it('tells a note once, on the line of the event that recorded it', () => {
    const recorded = noteView({ id: asId<CaseNoteId>('cnote-1') });
    const entries = caseTimeline({
      events: [
        event({
          kind: 'note-added',
          fromStatus: null,
          toStatus: null,
          reason: 'Monitoring visit under the plan',
          subject: { noteId: recorded.id, taskId: null, requestId: null, staffUserId: null },
        }),
      ],
      notes: [recorded],
      tasks: [],
      requests: [],
      withheld: [],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.source).toBe('note');
    expect(entries[0]?.detail).toBe(recorded.body);
    expect(entries[0]?.reason).toBe('Monitoring visit under the plan');
  });

  it('names the request a link event is about, when the reader may read it', () => {
    const link = event({
      kind: 'request-linked',
      fromStatus: null,
      toStatus: null,
      subject: { noteId: null, taskId: null, requestId: REQUEST, staffUserId: null },
    });
    const readable = caseTimeline({
      events: [link],
      notes: [],
      tasks: [],
      requests: [linked({ statusHistory: [] })],
      withheld: [],
    });
    expect(readable[0]?.kind).toBe('request-linked');
    expect(readable[0]?.reference).toBe('TAY-2026-000841');

    const unread = caseTimeline({
      events: [link],
      notes: [],
      tasks: [],
      requests: [],
      withheld: [],
    });
    // The act is still on the timeline; the request is simply not named to this reader.
    expect(unread).toHaveLength(1);
    expect(unread[0]?.reference).toBeNull();
  });

  it('says a withheld reason is withheld, never that none was given', () => {
    const entries = caseTimeline({
      events: [event({ reason: null })],
      notes: [],
      tasks: [],
      requests: [],
      withheld: [...PROTECTED_CASE_WITHHELD],
    });
    expect(entries[0]?.reason).toBeNull();
    expect(entries[0]?.reasonWithheld).toBe(true);
  });

  it('says a request move’s withheld reason is withheld, by the request’s own rule', () => {
    const entries = caseTimeline({
      events: [],
      notes: [],
      tasks: [],
      requests: [
        linked({
          statusHistory: [
            {
              from: 'endorsed',
              to: 'approved',
              reason: null,
              actorId: SOMEONE_ELSE,
              actorName: 'Teodoro Lim',
              occurredAt: asIsoDateTime('2026-07-22T02:00:00.000Z'),
            },
          ],
          withheld: ['statusReasons'],
        }),
      ],
      withheld: [],
    });
    expect(entries[0]?.reasonWithheld).toBe(true);
  });

  it('withholds a task title as a restricted entry, not a blank', () => {
    const hidden = task({ id: asId<CaseTaskId>('task-h'), title: null });
    const entries = caseTimeline({
      events: [
        event({
          kind: 'task-added',
          fromStatus: null,
          toStatus: null,
          reason: null,
          subject: { noteId: null, taskId: hidden.id, requestId: null, staffUserId: null },
        }),
      ],
      notes: [],
      tasks: [hidden],
      requests: [],
      withheld: [...PROTECTED_CASE_WITHHELD],
    });
    expect(entries[0]?.reference).toBeNull();
    expect(entries[0]?.isWithheld).toBe(true);
  });

  it('names somebody when the record has no name for whoever completed a task', () => {
    const entries = caseTimeline({
      events: [],
      notes: [],
      tasks: [
        task({
          status: 'done',
          completedAt: asIsoDateTime('2026-07-28T02:00:00.000Z'),
          completedBy: null,
          outcome: 'Done',
        }),
      ],
      requests: [],
      withheld: [],
    });
    expect(entries[0]?.actorName).toBe(UNNAMED_STAFF);
  });
});

describe('the queue facts are derived on every read', () => {
  it('counts days to the next action and since the last activity', () => {
    const facts = caseQueueFacts(
      { status: 'assessment', assignedTo: ME },
      asIsoDate('2026-07-29'),
      asIsoDateTime('2026-07-01T05:00:00.000Z'),
      TODAY,
    );
    expect(facts.daysUntilNextAction).toBe(-3);
    expect(facts.daysSinceLastActivity).toBe(31);
    expect(isInQueue('overdue', facts, ME)).toBe(true);
    expect(isInQueue('stalled', facts, ME)).toBe(true);
  });

  it('says nothing is owed when there is no next action', () => {
    const facts = caseQueueFacts({ status: 'intake', assignedTo: null }, null, null, TODAY);
    expect(facts.daysUntilNextAction).toBeNull();
    expect(facts.daysSinceLastActivity).toBeNull();
  });
});

describe('who gives a case, and who may owe its tasks', () => {
  it('gives cases out from an assigner, never from a caseload', () => {
    expect(assignsCases('all-barangays', true)).toBe(true);
    expect(assignsCases('assigned-cases', true)).toBe(false);
    expect(assignsCases('all-barangays', false)).toBe(false);
    expect(assignsCases(null, true)).toBe(false);
  });

  it('lets a task be owed by the writer, whoever holds the case, or nobody', () => {
    expect(taskAssigneeChoices(ME, SOMEONE_ELSE)).toEqual([ME, SOMEONE_ELSE]);
    expect(taskAssigneeChoices(ME, ME)).toEqual([ME]);
    expect(taskAssigneeChoices(ME, null)).toEqual([ME]);
    expect(isAllowedTaskAssignee(null, ME, SOMEONE_ELSE)).toBe(true);
    expect(isAllowedTaskAssignee(SOMEONE_ELSE, ME, SOMEONE_ELSE)).toBe(true);
    // A third person does not hold the case and could not open it.
    expect(isAllowedTaskAssignee(asId<StaffUserId>('staff-third'), ME, SOMEONE_ELSE)).toBe(false);
  });
});

describe('opening a case, and writing on one', () => {
  it('asks for a presenting problem of 8 to 500 characters', () => {
    expect(caseOpenProblems({ summary: 'short' })).toEqual(['summary-too-short']);
    expect(caseOpenProblems({ summary: 'x'.repeat(501) })).toEqual(['summary-too-long']);
    expect(caseOpenProblems({ summary: 'Family displaced by the fire' })).toEqual([]);
  });

  it('offers no write on a closed case, nor on one whose words are withheld', () => {
    expect(isCaseWritable({ status: 'intervention', withheld: [] })).toBe(true);
    expect(isCaseWritable({ status: 'closed', withheld: [] })).toBe(false);
    expect(isCaseWritable({ status: 'intervention', withheld: [...PROTECTED_CASE_WITHHELD] })).toBe(
      false,
    );
  });

  it('withholds every note body on a protected case from a reader not cleared for it', () => {
    const view = discloseCaseNote(note(), holding('case.view'), true);
    expect(view.body).toBeNull();
    expect(view.isWithheld).toBe(true);
  });
});

describe('the workspace says what it does not show', () => {
  it('counts the linked requests outside what the reader reads', () => {
    expect(
      unreadLinkedRequestCount({
        record: { linkedRequestIds: [REQUEST, asId<AssistanceRequestId>('req-y')] },
        requests: [{ id: REQUEST }],
      }),
    ).toBe(1);
  });
});
