import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  asId,
  asIsoDate,
  todayAsIsoDate,
  type AccessContext,
  type AssistanceRequestId,
  type AuthenticatedUser,
  type BarangayId,
  type CaseId,
  type CaseTaskId,
  type Permission,
  type ResidentId,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAssistanceRequestStore } from './mock-assistance-request.store';
import { MockCaseRepository } from './mock-case.repository';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  firebaseWebApiKey: null,
  mockLatencyMs: 0,
  enableDevTools: false,
};

const SAN_JUAN = asId<BarangayId>('brgy-san-juan');
const DOLORES = asId<BarangayId>('brgy-dolores');

/** Assigned to staff-sw-1, in San Juan. */
const MERCADO = asId<CaseId>('case-0001');
/** Assigned to staff-sw-1, in Dolores, with an overdue task. */
const BAUTISTA = asId<CaseId>('case-0002');
/** The protected file: a VAWC survivor, two of whose notes are `protected`. */
const SURVIVOR = asId<CaseId>('case-0003');
/** Closed, and kept. */
const CLOSED = asId<CaseId>('case-0005');
/** Nobody owns it yet. */
const UNASSIGNED = asId<CaseId>('case-0006');

const SW_1 = asId<StaffUserId>('staff-sw-1');
const SW_2 = asId<StaffUserId>('staff-sw-2');

const REASON = 'Home visit on 12 August confirmed the arrangement';

function authenticated(
  role: StaffRole,
  id: StaffUserId = asId<StaffUserId>('staff-x'),
  barangayId: BarangayId | null = null,
): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id,
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
}

function signedInAs(user: AuthenticatedUser | null): void {
  const context: AccessContext = { currentUser: () => user };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockCaseRepository,
    ],
  });
}

const repo = () => TestBed.inject(MockCaseRepository);
const workspace = (id: CaseId) => firstValueFrom(repo().getById(id));
const FIRST_PAGE = { limit: 50, cursor: null } as const;

/** A filed request about the Mercado household that no case names yet. */
function fileUnlinkedRequest(): AssistanceRequestId {
  const store = TestBed.inject(MockAssistanceRequestStore);
  const template = store.requests.find((request) => request.id === 'req-0001');
  if (template === undefined) {
    throw new Error('The seed no longer holds req-0001.');
  }
  const id = asId<AssistanceRequestId>('req-unlinked');
  store.requests = [...store.requests, { ...template, id, referenceNumber: 'TAY-2026-009999' }];
  return id;
}

/* ── A case is not an assistance request ──────────────────────────────────── */

describe('a case ties a person to interventions over time', () => {
  it('carries the assistance requests attached to it, not every request the person ever made', () => {
    signedInAs(authenticated('mswdo-head'));
    return workspace(MERCADO).then((view) => {
      expect(view?.requests.map((request) => request.id)).toEqual(['req-0001']);
    });
  });

  it('brings the person, the address and the family in one read', async () => {
    // The first acceptance criterion is a property of this object: a caseworker
    // should not have to open three modules to know who this is about.
    signedInAs(authenticated('mswdo-head'));
    const view = await workspace(MERCADO);
    expect(view?.subject.listedName).toContain('Mercado');
    expect(view?.household?.household.referenceNumber).toBeTruthy();
    expect(view?.families.map((family) => family.family.name).join(' ')).toContain('Mercado');
    expect(view?.vulnerability).not.toBeNull();
    expect(view?.householdContextUnread).toBe(false);
  });

  it('records a case whose subject has no household without treating it as broken', async () => {
    signedInAs(authenticated('mswdo-head'));
    const view = await workspace(UNASSIGNED);
    expect(view).not.toBeNull();
    expect(view?.household).toBeNull();
    expect(view?.record.withheld).toEqual([]);
  });

  it('keeps a closed case readable in full', async () => {
    signedInAs(authenticated('mswdo-head'));
    const view = await workspace(CLOSED);
    expect(view?.record.status).toBe('closed');
    expect(view?.record.closedOn).not.toBeNull();
    expect(view?.timeline.length).toBeGreaterThan(0);
  });
});

/* ── Access ───────────────────────────────────────────────────────────────── */

describe('cases are read under the same access rules as everything else', () => {
  it('refuses the list without case.view', async () => {
    signedInAs(null);
    await expect(firstValueFrom(repo().list({}, FIRST_PAGE))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('refuses a role that holds no case permission, however senior its other work', async () => {
    signedInAs(authenticated('release-officer'));
    await expect(firstValueFrom(repo().list({}, FIRST_PAGE))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('reports an out-of-scope case as absent, exactly like a missing one', async () => {
    signedInAs(authenticated('barangay-link', asId<StaffUserId>('staff-brgy'), SAN_JUAN));
    await expect(workspace(MERCADO)).resolves.toBeNull();
    await expect(workspace(asId<CaseId>('case-nope'))).resolves.toBeNull();
  });

  it('narrows an assigned-cases scope to the cases assigned to it — not the unassigned pool', async () => {
    // DL-179, superseding DL-57: a case reaches a social worker by being given to them.
    signedInAs(authenticated('social-worker', SW_1));
    const page = await firstValueFrom(repo().list({}, FIRST_PAGE));
    const ids = page.items.map((summary) => summary.record.id);

    expect(ids).toContain(MERCADO);
    expect(ids).not.toContain(UNASSIGNED);
    // case-0003 belongs to staff-sw-2.
    expect(ids).not.toContain(SURVIVOR);
    for (const summary of page.items) {
      expect(summary.record.assignedTo).toBe(SW_1);
    }
    await expect(workspace(UNASSIGNED)).resolves.toBeNull();
  });

  it('reads its own caseload whatever assignee it asks for', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const page = await firstValueFrom(repo().list({ assignedTo: SW_2 }, FIRST_PAGE));
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((summary) => summary.record.assignedTo === SW_1)).toBe(true);
  });

  it('does not name the household or family to a caseload, and says so', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const view = await workspace(MERCADO);
    expect(view?.record.withheld).toEqual(['householdContext']);
    expect(view?.record.householdId).toBeNull();
    expect(view?.household).toBeNull();
    expect(view?.families).toEqual([]);
    expect(view?.householdMembers).toEqual([]);
  });

  it('does not narrow a head, who carries the whole office', async () => {
    signedInAs(authenticated('mswdo-head'));
    const page = await firstValueFrom(repo().list({}, FIRST_PAGE));
    expect(page.items.length).toBeGreaterThan(4);
  });

  it('confines a barangay filter to that barangay', async () => {
    signedInAs(authenticated('auditor'));
    const all = await firstValueFrom(repo().list({ barangayId: DOLORES }, FIRST_PAGE));
    for (const summary of all.items) {
      expect(summary.record.barangayId).toBe(DOLORES);
    }
  });

  it('searches part of a case reference and nothing else', async () => {
    signedInAs(authenticated('mswdo-head'));
    const byReference = await firstValueFrom(repo().list({ search: '0117' }, FIRST_PAGE));
    expect(byReference.items.map((summary) => summary.record.id)).toEqual([MERCADO]);
    // The presenting problem is free text, and matching on it would disclose it (DL-109).
    const bySummary = await firstValueFrom(repo().list({ search: 'hypertension' }, FIRST_PAGE));
    expect(bySummary.items).toEqual([]);
    await expect(firstValueFrom(repo().list({ search: 'x' }, FIRST_PAGE))).rejects.toThrow(
      /between 2 and 40/,
    );
  });

  it('pages by cursor in the server’s order, newest opened first', async () => {
    signedInAs(authenticated('mswdo-head'));
    const first = await firstValueFrom(repo().list({}, { limit: 3, cursor: null }));
    expect(first.items).toHaveLength(3);
    expect(first.hasMore).toBe(true);
    const next = await firstValueFrom(repo().list({}, { limit: 3, cursor: first.nextCursor }));
    const opened = [...first.items, ...next.items].map((summary) => summary.record.openedOn);
    expect([...opened].sort().reverse()).toEqual(opened);
    const ids = new Set([...first.items, ...next.items].map((summary) => summary.record.id));
    expect(ids.size).toBe(first.items.length + next.items.length);
  });
});

/* ── Withheld words ───────────────────────────────────────────────────────── */

describe('protected words never leave the data layer', () => {
  it('sends no protected note body to a role without the clearance', async () => {
    signedInAs(authenticated('mswdo-head'));
    const head = await workspace(SURVIVOR);
    expect(JSON.stringify(head)).toContain('Safety plan agreed');

    signedInAs(authenticated('intake-officer'));
    const view = await workspace(SURVIVOR);
    const protectedNotes = view?.notes.filter((note) => note.sensitivity === 'protected') ?? [];
    expect(protectedNotes.length).toBeGreaterThan(0);
    for (const note of protectedNotes) {
      expect(note.body).toBeNull();
      expect(note.isWithheld).toBe(true);
    }
    // And the words themselves are nowhere in the payload.
    expect(JSON.stringify(view)).not.toContain('Safety plan agreed');
  });

  it('withholds every word of a protected subject’s case from a reader without request.view-sensitive', async () => {
    // DL-179: the rule and the key of a protected request.
    signedInAs(authenticated('intake-officer'));
    const view = await workspace(SURVIVOR);
    expect(view?.record.isProtected).toBe(true);
    expect(view?.record.withheld).toEqual(['summary', 'reasons', 'taskWords', 'notes']);
    expect(view?.record.summary).toBeNull();
    expect(view?.notes.every((note) => note.isWithheld && note.body === null)).toBe(true);
    expect(view?.tasks.every((task) => task.title === null)).toBe(true);
    // Still listed, with the status, who holds it and when things happened.
    expect(view?.notes.length).toBe(3);
    expect(view?.assignedToName).toBeTruthy();
    const opened = view?.timeline.find((entry) => entry.kind === 'case-opened');
    expect(opened?.reason).toBeNull();
    expect(opened?.reasonWithheld).toBe(true);
    expect(JSON.stringify(view)).not.toContain('Relocation completed');
  });

  it('lets that reader add nothing to the case', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(repo().addNote(SURVIVOR, 'Called the household today.', 'routine', REASON)),
    ).rejects.toThrow(/withheld from your account/);
  });

  it('opens them to the worker who holds the case and the clearance', async () => {
    signedInAs(authenticated('social-worker', SW_2));
    const view = await workspace(SURVIVOR);
    expect(view?.notes.every((note) => note.body !== null)).toBe(true);
    expect(JSON.stringify(view)).toContain('Safety plan agreed');
  });

  it('refuses to write into the tier a role cannot read', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(
        repo().addNote(MERCADO, 'A confidence given in session.', 'protected', REASON),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('masks a protected subject in the case list, as everywhere else', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(repo().list({}, FIRST_PAGE));
    const survivor = page.items.find((summary) => summary.record.id === SURVIVOR);
    expect(survivor?.subject.isProtected).toBe(true);
    expect(survivor?.subject.listedName).toBe('Manalo, C.');
    expect(survivor?.record.summary).toBeNull();
    expect(survivor?.nextAction?.title).toBeNull();
  });
});

/* ── The audit-event seam ─────────────────────────────────────────────────── */

describe('every material change produces an audit event', () => {
  it('writes the move, the actor and the reason on the timeline', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const before = (await workspace(BAUTISTA))?.timeline.length ?? 0;

    const after = await firstValueFrom(
      repo().changeStatus(
        BAUTISTA,
        'intervention',
        'Assessment complete; plan agreed with the household',
      ),
    );

    expect(after.record.status).toBe('intervention');
    expect(after.timeline.length).toBe(before + 1);
    const [newest] = after.timeline;
    expect(newest?.fromCaseStatus).toBe('assessment');
    expect(newest?.toCaseStatus).toBe('intervention');
    expect(newest?.reason).toContain('plan agreed');
    expect(newest?.actorName).toBe('Test User');
  });

  it('refuses a change with no reason worth reading', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    await expect(firstValueFrom(repo().changeStatus(MERCADO, 'monitoring', 'ok'))).rejects.toThrow(
      /Say why/,
    );
  });

  it('refuses an illegal move even when the permission is held', async () => {
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(repo().changeStatus(UNASSIGNED, 'monitoring', REASON)),
    ).rejects.toThrow(/cannot move from Intake to Monitoring/);
  });

  it('refuses closure to a role that may run the case but not end it', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    await expect(
      firstValueFrom(repo().changeStatus(MERCADO, 'closed', 'Household reports no further need')),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses closure while a task is open, then records the date once each is done', async () => {
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(
        repo().changeStatus(MERCADO, 'closed', 'Household re-employed and reports no further need'),
      ),
    ).rejects.toThrow(/1 open task/);

    const before = await workspace(MERCADO);
    for (const task of before?.tasks.filter((entry) => entry.status === 'open') ?? []) {
      await firstValueFrom(
        repo().completeTask(MERCADO, task.id, 'Pharmacy confirmed the purchase order on 3 August'),
      );
    }
    const after = await firstValueFrom(
      repo().changeStatus(MERCADO, 'closed', 'Household re-employed and reports no further need'),
    );
    expect(after.record.status).toBe('closed');
    expect(after.record.closedOn).toBe(todayAsIsoDate());
  });

  it('refuses every write on a closed case', async () => {
    // DL-53: a recurrence is a new case naming the old one, never a write on it.
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(
        repo().addNote(CLOSED, 'The household called again today.', 'routine', REASON),
      ),
    ).rejects.toThrow(/This case is closed/);
    await expect(firstValueFrom(repo().assign(CLOSED, SW_2, REASON))).rejects.toThrow(
      /This case is closed/,
    );
  });

  it('absorbs a retried move instead of failing it', async () => {
    // DL-51 carried forward. A dropped response is the ordinary case.
    signedInAs(authenticated('social-worker', SW_1));
    const first = await firstValueFrom(
      repo().changeStatus(BAUTISTA, 'intervention', 'Assessment complete; plan agreed'),
    );
    const second = await firstValueFrom(
      repo().changeStatus(BAUTISTA, 'intervention', 'Assessment complete; plan agreed'),
    );
    expect(second.record.status).toBe('intervention');
    expect(second.timeline.length).toBe(first.timeline.length);
  });

  it('records giving a case to a social worker, and taking it off them, as acts with reasons', async () => {
    signedInAs(authenticated('intake-officer'));
    const given = await firstValueFrom(
      repo().assign(UNASSIGNED, SW_1, 'Santa Ana caseload has room after the case conference'),
    );
    expect(given.record.assignedTo).toBe(SW_1);
    expect(given.timeline[0]?.kind).toBe('assigned');

    const returned = await firstValueFrom(
      repo().assign(UNASSIGNED, null, 'Reassigning: this belongs to another caseload'),
    );
    expect(returned.record.assignedTo).toBeNull();
    expect(returned.timeline[0]?.kind).toBe('unassigned');
    expect(returned.timeline[0]?.reason).toContain('another caseload');
  });

  it('gives a case only to an active social worker', async () => {
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(repo().assign(UNASSIGNED, asId<StaffUserId>('staff-intake'), REASON)),
    ).rejects.toThrow(/active social worker/);
    const assignees = await firstValueFrom(repo().listAssignees());
    expect(assignees.map((worker) => worker.id)).toEqual([SW_1, SW_2]);
  });

  it('refuses a caseload the act of assigning, and the list it would assign from', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    await expect(firstValueFrom(repo().assign(MERCADO, SW_2, REASON))).rejects.toThrow(
      /intake and the head/,
    );
    await expect(firstValueFrom(repo().listAssignees())).rejects.toThrow(/intake and the head/);
  });

  it('appends a note without ever replacing one', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const before = await workspace(MERCADO);
    const after = await firstValueFrom(
      repo().addNote(
        MERCADO,
        'Second monitoring call. Medicines collected from the accredited pharmacy.',
        'routine',
        'Monitoring visit under the intervention plan',
      ),
    );
    expect(after.notes.length).toBe((before?.notes.length ?? 0) + 1);
    for (const note of before?.notes ?? []) {
      expect(after.notes.some((candidate) => candidate.id === note.id)).toBe(true);
    }
    // Told once: the note's line carries its words and the reason it was recorded.
    const line = after.timeline.find((entry) => entry.detail?.startsWith('Second monitoring'));
    expect(line?.reason).toBe('Monitoring visit under the intervention plan');
    expect(
      after.timeline.filter((entry) => entry.detail?.startsWith('Second monitoring')),
    ).toHaveLength(1);
  });

  it('keeps a completed task in the record, with its outcome', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const before = await workspace(BAUTISTA);
    const open = before?.tasks.find((task) => task.status === 'open');
    expect(open).toBeDefined();

    const after = await firstValueFrom(
      repo().completeTask(
        BAUTISTA,
        open?.id ?? asId<CaseTaskId>('missing'),
        'Certificate collected from the rural health unit on 14 August',
      ),
    );
    const completed = after.tasks.find((task) => task.id === open?.id);
    expect(after.tasks.length).toBe(before?.tasks.length);
    expect(completed?.status).toBe('done');
    expect(completed?.outcome).toContain('rural health unit');
    expect(after.timeline.some((entry) => entry.kind === 'task-completed')).toBe(true);

    // Kept as it ended.
    await expect(
      firstValueFrom(repo().completeTask(BAUTISTA, completed?.id ?? asId<CaseTaskId>('x'), REASON)),
    ).rejects.toThrow(/kept as it ended/);
  });

  it('gives a case with nothing scheduled a next action', async () => {
    signedInAs(authenticated('mswdo-head', asId<StaffUserId>('staff-head')));
    const before = await workspace(UNASSIGNED);
    expect(before?.nextAction).toBeNull();

    const after = await firstValueFrom(
      repo().addTask(
        UNASSIGNED,
        {
          title: 'Ring the barangay',
          kind: 'follow-up',
          dueOn: todayAsIsoDate(),
          assignedTo: asId<StaffUserId>('staff-head'),
        },
        'Endorsement received but no contact number was given',
      ),
    );
    expect(after.nextAction?.title).toBe('Ring the barangay');
    expect(after.nextAction?.assignedToName).toBe('Teodoro Lim');
    expect(after.timeline.some((entry) => entry.kind === 'task-added')).toBe(true);
  });

  it('owes a task only to the writer, whoever holds the case, or nobody', async () => {
    signedInAs(authenticated('mswdo-head', asId<StaffUserId>('staff-head')));
    const draft = {
      title: 'Home visit',
      kind: 'home-visit',
      dueOn: todayAsIsoDate(),
      assignedTo: SW_2,
    } as const;
    // case-0001 is held by staff-sw-1; staff-sw-2 could not open it.
    await expect(firstValueFrom(repo().addTask(MERCADO, draft, REASON))).rejects.toThrow(
      /somebody who can see the case/,
    );
    const toHolder = await firstValueFrom(
      repo().addTask(MERCADO, { ...draft, assignedTo: SW_1 }, REASON),
    );
    const added = toHolder.tasks.find((task) => task.title === 'Home visit');
    expect(added?.assignedTo).toBe(SW_1);

    const handed = await firstValueFrom(
      repo().assignTask(MERCADO, added?.id ?? asId<CaseTaskId>('x'), null, REASON),
    );
    expect(handed.tasks.find((task) => task.id === added?.id)?.assignedTo).toBeNull();
    expect(handed.timeline[0]?.kind).toBe('task-reassigned');
  });

  it('leaves the earlier deadline as the next action when a later one is added', async () => {
    // What is owed soonest, not what was typed most recently.
    signedInAs(authenticated('social-worker', SW_1));
    const after = await firstValueFrom(
      repo().addTask(
        MERCADO,
        {
          title: 'Review in six months',
          kind: 'review',
          dueOn: asIsoDate('2027-02-01'),
          assignedTo: SW_1,
        },
        'Annual review scheduled at the case conference',
      ),
    );
    expect(after.tasks.some((task) => task.title === 'Review in six months')).toBe(true);
    expect(after.nextAction?.title).toBe('Confirm the pharmacy accepts the purchase order');
  });

  it('refuses a mutation on a case outside the caller’s scope, without saying it exists', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    await expect(
      firstValueFrom(repo().changeStatus(SURVIVOR, 'monitoring', REASON)),
    ).rejects.toThrow(PermissionDeniedError);
  });
});

/* ── Opening a case, and naming its requests ──────────────────────────────── */

describe('a case is opened by an assigner, and names its requests one at a time', () => {
  it('opens at intake, assigned to nobody, with the opening on its timeline', async () => {
    signedInAs(authenticated('intake-officer', asId<StaffUserId>('staff-intake')));
    const requestId = fileUnlinkedRequest();
    const opened = await firstValueFrom(
      repo().open(
        {
          subjectResidentId: asId<ResidentId>('res-0001'),
          category: 'older-persons',
          summary: 'Maintenance medicines again unaffordable after the pension delay.',
          continuesCaseId: null,
          linkedRequestIds: [requestId],
        },
        'Walk-in at the office; the earlier file is still open',
      ),
    );
    expect(opened.record.status).toBe('intake');
    expect(opened.record.assignedTo).toBeNull();
    expect(opened.record.referenceNumber).toMatch(/^CASE-\d{4}-\d{6}$/);
    expect(opened.record.linkedRequestIds).toEqual([requestId]);
    expect(opened.timeline.map((entry) => entry.kind)).toEqual(
      expect.arrayContaining(['case-opened', 'request-linked']),
    );
  });

  it('continues only a closed case, never an open one', async () => {
    signedInAs(authenticated('mswdo-head'));
    const draft = {
      subjectResidentId: asId<ResidentId>('res-0004'),
      category: 'crisis-intervention',
      summary: 'Lost work again after the second closure this year.',
      linkedRequestIds: [],
    } as const;
    await expect(
      firstValueFrom(repo().open({ ...draft, continuesCaseId: MERCADO }, REASON)),
    ).rejects.toThrow(/still open/);
    const continued = await firstValueFrom(
      repo().open({ ...draft, continuesCaseId: CLOSED }, REASON),
    );
    expect(continued.record.continuesCaseId).toBe(CLOSED);
  });

  it('is refused to a caseload', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    await expect(
      firstValueFrom(
        repo().open(
          {
            subjectResidentId: asId<ResidentId>('res-0001'),
            category: 'older-persons',
            summary: 'Maintenance medicines unaffordable.',
            continuesCaseId: null,
            linkedRequestIds: [],
          },
          REASON,
        ),
      ),
    ).rejects.toThrow(/intake and the head/);
  });

  it('names a request once, and in one case only', async () => {
    signedInAs(authenticated('mswdo-head'));
    const requestId = fileUnlinkedRequest();
    const linked = await firstValueFrom(repo().linkRequest(MERCADO, requestId, REASON));
    expect(linked.record.linkedRequestIds).toContain(requestId);
    expect(linked.timeline[0]?.kind).toBe('request-linked');
    expect(linked.timeline[0]?.reference).toBe('TAY-2026-009999');

    // Already named here answers as it stands.
    const again = await firstValueFrom(repo().linkRequest(MERCADO, requestId, REASON));
    expect(again.timeline.length).toBe(linked.timeline.length);
  });

  it('refuses a request about somebody outside the subject’s household', async () => {
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(repo().linkRequest(MERCADO, asId<AssistanceRequestId>('req-0002'), REASON)),
    ).rejects.toThrow(/outside this person’s household/);
  });

  it('refuses a request already named in another case', async () => {
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(
        repo().open(
          {
            subjectResidentId: asId<ResidentId>('res-0001'),
            category: 'older-persons',
            summary: 'A second file on the same person.',
            continuesCaseId: null,
            linkedRequestIds: [asId<AssistanceRequestId>('req-0001')],
          },
          REASON,
        ),
      ),
    ).rejects.toThrow(/another case/);
  });

  it('shows a caseload only the linked requests it may read, and names the rest by id', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const own = await workspace(MERCADO);
    expect(own?.requests.map((request) => request.id)).toEqual(['req-0001']);
    // req-0002 is nobody's yet, so it is outside what this caseload reads: named, not shown.
    const view = await workspace(BAUTISTA);
    expect(view?.record.linkedRequestIds).toEqual(['req-0002']);
    expect(view?.requests).toEqual([]);
  });
});

/* ── The timeline ─────────────────────────────────────────────────────────── */

describe('the timeline answers without opening another module', () => {
  it('merges the assistance request’s own history into the case', async () => {
    signedInAs(authenticated('mswdo-head'));
    const view = await workspace(MERCADO);
    const fromRequest =
      view?.timeline.filter((entry) => entry.source === 'assistance-request') ?? [];
    expect(fromRequest.length).toBeGreaterThan(0);
    expect(fromRequest[0]?.reference).toBe('TAY-2026-000841');
    expect(fromRequest[0]?.toRequestStatus).toBeTruthy();
  });

  it('is newest first, whatever the entry came from', async () => {
    signedInAs(authenticated('mswdo-head'));
    const view = await workspace(MERCADO);
    const times = (view?.timeline ?? []).map((entry) => entry.occurredAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('carries the case opening, with why the office got involved', async () => {
    signedInAs(authenticated('mswdo-head'));
    const view = await workspace(MERCADO);
    const opened = view?.timeline.find((entry) => entry.kind === 'case-opened');
    expect(opened?.reason).toContain('prescription');
  });
});

/* ── Queues ───────────────────────────────────────────────────────────────── */

describe('queue counts and the list they open agree', () => {
  it('counts each queue under the same scope as the list', async () => {
    signedInAs(authenticated('mswdo-head'));
    const counts = await firstValueFrom(repo().queueCounts({}));

    for (const { queue, count } of counts) {
      const page = await firstValueFrom(repo().list({ queue }, FIRST_PAGE));
      expect(page.items.length).toBe(count);
    }
  });

  it('counts nothing unassigned for a caseload, which never reads the pool', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const counts = await firstValueFrom(repo().queueCounts({}));
    expect(counts.find((entry) => entry.queue === 'unassigned')?.count).toBe(0);
  });

  it('finds the overdue case by its overdue task', async () => {
    signedInAs(authenticated('mswdo-head'));
    const page = await firstValueFrom(repo().list({ queue: 'overdue' }, FIRST_PAGE));
    expect(page.items.map((summary) => summary.record.id)).toContain(BAUTISTA);
    for (const summary of page.items) {
      expect(summary.facts.daysUntilNextAction).toBeLessThan(0);
    }
  });

  it('keeps the closed case out of every queue but "all"', async () => {
    signedInAs(authenticated('mswdo-head'));
    const everything = await firstValueFrom(repo().list({ queue: 'all' }, FIRST_PAGE));
    expect(everything.items.map((summary) => summary.record.id)).toContain(CLOSED);

    for (const queue of ['mine', 'unassigned', 'overdue', 'due-soon', 'stalled'] as const) {
      const page = await firstValueFrom(repo().list({ queue }, FIRST_PAGE));
      expect(page.items.map((summary) => summary.record.id)).not.toContain(CLOSED);
    }
  });

  it('lists a resident’s cases for the registry to link to', async () => {
    signedInAs(authenticated('mswdo-head'));
    const cases = await firstValueFrom(repo().casesForResident(asId<ResidentId>('res-0001')));
    expect(cases.map((summary) => summary.record.id)).toEqual([MERCADO]);
  });
});
