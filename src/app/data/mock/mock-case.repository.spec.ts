import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  DEFAULT_PAGE_REQUEST,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  asId,
  asIsoDate,
  todayAsIsoDate,
  type AccessContext,
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

import { MockCaseRepository } from './mock-case.repository';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
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
    expect(view?.family?.family.name).toContain('Mercado');
    expect(view?.vulnerability).not.toBeNull();
  });

  it('records a case whose subject has no household without treating it as broken', async () => {
    signedInAs(authenticated('mswdo-head'));
    const view = await workspace(UNASSIGNED);
    expect(view).not.toBeNull();
    expect(view?.household).toBeNull();
    expect(view?.family?.family.householdId).toBeNull();
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
    await expect(firstValueFrom(repo().list({}, DEFAULT_PAGE_REQUEST))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('refuses a role that holds no case permission, however senior its other work', async () => {
    signedInAs(authenticated('release-officer'));
    await expect(firstValueFrom(repo().list({}, DEFAULT_PAGE_REQUEST))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('reports an out-of-scope case as absent, exactly like a missing one', async () => {
    signedInAs(authenticated('barangay-link', asId<StaffUserId>('staff-brgy'), SAN_JUAN));
    await expect(workspace(MERCADO)).resolves.toBeNull();
    await expect(workspace(asId<CaseId>('case-nope'))).resolves.toBeNull();
  });

  it('narrows an assigned-cases scope to the worker’s own caseload and the unowned pool', async () => {
    // DL-57. A colleague's caseload is what the scope withholds; the office's
    // unclaimed work is how anything gets picked up.
    signedInAs(authenticated('social-worker', SW_1));
    const page = await firstValueFrom(repo().list({}, { page: 1, pageSize: 50 }));
    const ids = page.items.map((summary) => summary.record.id);

    expect(ids).toContain(MERCADO);
    expect(ids).toContain(UNASSIGNED);
    // case-0003 belongs to staff-sw-2.
    expect(ids).not.toContain(SURVIVOR);
    for (const summary of page.items) {
      expect(summary.record.assignedTo === null || summary.record.assignedTo === SW_1).toBe(true);
    }
  });

  it('does not narrow a head, who carries the whole office', async () => {
    signedInAs(authenticated('mswdo-head'));
    const page = await firstValueFrom(repo().list({}, { page: 1, pageSize: 50 }));
    expect(page.items.length).toBeGreaterThan(4);
  });

  it('confines a barangay-scoped reader to its own barangay', async () => {
    signedInAs(authenticated('auditor'));
    const all = await firstValueFrom(repo().list({ barangayId: DOLORES }, DEFAULT_PAGE_REQUEST));
    for (const summary of all.items) {
      expect(summary.record.barangayId).toBe(DOLORES);
    }
  });
});

/* ── Protected notes ──────────────────────────────────────────────────────── */

describe('protected notes never leave the data layer', () => {
  it('sends no body at all to a role without the clearance', async () => {
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

  it('still tells that reader the entries exist', async () => {
    signedInAs(authenticated('intake-officer'));
    const view = await workspace(SURVIVOR);
    expect(view?.notes.filter((note) => note.isWithheld).length).toBe(2);
    expect(view?.notes.some((note) => note.body !== null)).toBe(true);
  });

  it('withholds them from the timeline too, without deleting the line', async () => {
    signedInAs(authenticated('intake-officer'));
    const view = await workspace(SURVIVOR);
    const withheld = view?.timeline.filter((entry) => entry.isWithheld) ?? [];
    expect(withheld.length).toBe(2);
    for (const entry of withheld) {
      expect(entry.detail).toBeNull();
      expect(entry.occurredAt).toBeTruthy();
    }
  });

  it('opens them to the clearance that owns the tier', async () => {
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
    const page = await firstValueFrom(repo().list({}, { page: 1, pageSize: 50 }));
    const survivor = page.items.find((summary) => summary.record.id === SURVIVOR);
    expect(survivor?.subject.isProtected).toBe(true);
    expect(survivor?.subject.listedName).toBe('Manalo, C.');
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

  it('records a closure date when the head closes it', async () => {
    signedInAs(authenticated('mswdo-head'));
    const after = await firstValueFrom(
      repo().changeStatus(MERCADO, 'closed', 'Household re-employed and reports no further need'),
    );
    expect(after.record.status).toBe('closed');
    expect(after.record.closedOn).toBe(todayAsIsoDate());
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

  it('records an assignment, and returning a case to the pool, as acts with reasons', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const taken = await firstValueFrom(
      repo().assign(UNASSIGNED, SW_1, 'Picking this up after the barangay endorsement'),
    );
    expect(taken.record.assignedTo).toBe(SW_1);
    expect(taken.timeline[0]?.kind).toBe('assigned');

    const returned = await firstValueFrom(
      repo().assign(UNASSIGNED, null, 'Reassigning: this belongs to the Santa Ana caseload'),
    );
    expect(returned.record.assignedTo).toBeNull();
    expect(returned.timeline[0]?.kind).toBe('unassigned');
    expect(returned.timeline[0]?.reason).toContain('Santa Ana');
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
  });

  it('gives a case with nothing scheduled a next action', async () => {
    signedInAs(authenticated('social-worker', SW_1));
    const before = await workspace(UNASSIGNED);
    expect(before?.nextAction).toBeNull();

    const after = await firstValueFrom(
      repo().addTask(
        UNASSIGNED,
        {
          title: 'Ring the barangay',
          kind: 'follow-up',
          dueOn: todayAsIsoDate(),
          assignedTo: SW_1,
        },
        'Endorsement received but no contact number was given',
      ),
    );
    expect(after.nextAction?.title).toBe('Ring the barangay');
    expect(after.timeline.some((entry) => entry.kind === 'task-added')).toBe(true);
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
      const page = await firstValueFrom(repo().list({ queue }, { page: 1, pageSize: 50 }));
      expect(page.totalItems).toBe(count);
    }
  });

  it('finds the overdue case by its overdue task', async () => {
    signedInAs(authenticated('mswdo-head'));
    const page = await firstValueFrom(repo().list({ queue: 'overdue' }, { page: 1, pageSize: 50 }));
    expect(page.items.map((summary) => summary.record.id)).toContain(BAUTISTA);
    for (const summary of page.items) {
      expect(summary.facts.daysUntilNextAction).toBeLessThan(0);
    }
  });

  it('keeps the closed case out of every queue but "all"', async () => {
    signedInAs(authenticated('mswdo-head'));
    const everything = await firstValueFrom(
      repo().list({ queue: 'all' }, { page: 1, pageSize: 50 }),
    );
    expect(everything.items.map((summary) => summary.record.id)).toContain(CLOSED);

    for (const queue of ['mine', 'unassigned', 'overdue', 'due-soon', 'stalled'] as const) {
      const page = await firstValueFrom(repo().list({ queue }, { page: 1, pageSize: 50 }));
      expect(page.items.map((summary) => summary.record.id)).not.toContain(CLOSED);
    }
  });

  it('sorts what is owed soonest to the top by default', async () => {
    signedInAs(authenticated('mswdo-head'));
    const page = await firstValueFrom(repo().list({ queue: 'all' }, { page: 1, pageSize: 50 }));
    const due = page.items.map((summary) => summary.nextAction?.dueOn ?? '9999-12-31');
    expect([...due].sort()).toEqual(due);
  });

  it('lists a resident’s cases for the registry to link to', async () => {
    signedInAs(authenticated('mswdo-head'));
    const cases = await firstValueFrom(repo().casesForResident(asId<ResidentId>('res-0001')));
    expect(cases.map((summary) => summary.record.id)).toEqual([MERCADO]);
  });
});
