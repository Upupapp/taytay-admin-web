import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  EMPTY_INTAKE_DRAFT,
  ROLE_DEFINITIONS,
  REQUEST_WITHHELD_FIELDS,
  STATUS_MOVE_NEEDS_REASON,
  WITHHELD_DRAFT_REFUSAL,
  isTerminalAssistanceStatus,
  type AccessContext,
  type AssistanceRequest,
  type AssistanceRequestId,
  type AuthenticatedUser,
  type CursorPage,
  type IntakeDraft,
  type Permission,
  type ProgramId,
  type ResidentId,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAssistanceRequestRepository } from './mock-assistance-request.repository';

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

function userFor(role: StaffRole): AuthenticatedUser {
  return {
    id: asId<StaffUserId>(`staff-${role}`),
    displayName: role,
    email: `${role}@example.gov.ph`,
    role,
    roleLabel: ROLE_DEFINITIONS[role].label,
    position: 'Tester',
    barangayId: null,
    scope: ROLE_DEFINITIONS[role].scope,
    permissions: new Set<Permission>(ROLE_DEFINITIONS[role].permissions),
  };
}

/*
 * These tests exercise lifecycle mechanics, so they run as an administrator —
 * the one role that holds every permission — unless a test says otherwise. Who
 * *may* make each transition is covered separately in access-enforcement.spec.ts.
 */
let signedIn: AuthenticatedUser = userFor('system-administrator');

function repository(): MockAssistanceRequestRepository {
  signedIn = userFor('system-administrator');
  const context: AccessContext = { currentUser: () => signedIn };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockAssistanceRequestRepository,
    ],
  });
  return TestBed.inject(MockAssistanceRequestRepository);
}

const FIRST = { limit: 50, cursor: null } as const;
/** A VAWC survivor's request (`res-0005`): protected because its person is, today. */
const PROTECTED = asId<AssistanceRequestId>('req-0006');

/** Follows the cursor to the end, refusing a cursor that never ends rather than spinning. */
async function everyPage(
  read: (cursor: string | null) => Promise<CursorPage<AssistanceRequest>>,
): Promise<AssistanceRequest[]> {
  const rows: AssistanceRequest[] = [];
  let cursor: string | null = null;
  for (let guard = 0; guard < 20; guard += 1) {
    const page = await read(cursor);
    rows.push(...page.items);
    if (!page.hasMore || page.nextCursor === null) {
      return rows;
    }
    cursor = page.nextCursor;
  }
  throw new Error('the cursor never ended');
}

const draftFor = (residentId: string, programId: string | null): IntakeDraft => ({
  ...EMPTY_INTAKE_DRAFT,
  residentId: asId<ResidentId>(residentId),
  programId: programId === null ? null : asId<ProgramId>(programId),
  channel: 'barangay-referral',
  referredBy: 'Brgy. San Juan — Kagawad Santos',
  reasonForRequest: 'Maintenance medicines after a hypertension confinement',
});

describe('MockAssistanceRequestRepository', () => {
  describe('the list, in the server’s order (DL-177)', () => {
    it('reads one cursor page at a time, newest filing first, and the cursor reaches the end', async () => {
      const repo = repository();
      const first = await firstValueFrom(repo.list({}, { limit: 3, cursor: null }));
      expect(first.items).toHaveLength(3);
      expect(first.hasMore).toBe(true);

      const all = await everyPage((cursor) => firstValueFrom(repo.list({}, { limit: 3, cursor })));
      const filed = all.map((request) => request.submittedAt ?? '');
      expect([...filed].sort().reverse()).toEqual(filed);
      expect(new Set(all.map((request) => request.id)).size).toBe(all.length);
    });

    it('lists filed requests only, unless drafts are asked for — and then drafts only', async () => {
      const repo = repository();
      const draft = await firstValueFrom(repo.saveDraft(draftFor('res-0006', null), null));

      const filed = await firstValueFrom(repo.list({}, FIRST));
      expect(filed.items.some((request) => request.id === draft.id)).toBe(false);
      expect(filed.items.every((request) => request.referenceNumber !== '')).toBe(true);

      const drafts = await firstValueFrom(repo.list({ status: 'draft' }, FIRST));
      expect(drafts.items.map((request) => request.id)).toContain(draft.id);
      expect(drafts.items.every((request) => request.status === 'draft')).toBe(true);
    });

    it('filters to open requests only', async () => {
      const page = await firstValueFrom(repository().list({ openOnly: true }, FIRST));
      for (const request of page.items) {
        expect(isTerminalAssistanceStatus(request.status)).toBe(false);
      }
    });

    it('searches part of a control number', async () => {
      const page = await firstValueFrom(repository().list({ search: '000841' }, FIRST));
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.referenceNumber).toBe('TAY-2026-000841');
    });

    it('never matches the reason — a match on it says what is in somebody’s file (DL-109)', async () => {
      const page = await firstValueFrom(repository().list({ search: 'flooding' }, FIRST));
      expect(page.items).toHaveLength(0);
    });
  });

  it('returns null for an id that does not exist', async () => {
    const found = await firstValueFrom(repository().getById(asId<AssistanceRequestId>('req-nope')));
    expect(found).toBeNull();
  });

  describe('a protected request’s words (DL-38, DL-177)', () => {
    it('are withheld from a reader without request.view-sensitive, and say so', async () => {
      const repo = repository();
      signedIn = userFor('intake-officer');
      const request = await firstValueFrom(repo.getById(PROTECTED));

      expect(request?.isProtected).toBe(true);
      expect(request?.withheld).toEqual(REQUEST_WITHHELD_FIELDS);
      expect(request?.reasonForRequest).toBe('');
      expect(request?.referredBy).toBeNull();
      expect(request?.statusHistory.every((change) => change.reason === null)).toBe(true);
      expect(request?.requirements.every((requirement) => requirement.remarks === null)).toBe(true);
    });

    it('are read whole by a reader cleared for them', async () => {
      const request = await firstValueFrom(repository().getById(PROTECTED));
      expect(request?.isProtected).toBe(true);
      expect(request?.withheld).toEqual([]);
      expect(request?.reasonForRequest).toContain('solo parent');
      expect(request?.referredBy).toBe('Barangay San Isidro VAW desk');
    });

    it('withhold every note on the request, routine ones included', async () => {
      const repo = repository();
      signedIn = userFor('intake-officer');
      const notes = await firstValueFrom(repo.listNotes(PROTECTED));
      expect(notes.every((note) => note.body === null && note.isWithheld)).toBe(true);
    });

    it('cannot be saved over by a writer from whom they are withheld', async () => {
      const repo = repository();
      const draft = await firstValueFrom(repo.saveDraft(draftFor('res-0005', null), null));
      signedIn = userFor('intake-officer');

      const seen = await firstValueFrom(repo.getById(draft.id));
      expect(seen?.withheld).toEqual(REQUEST_WITHHELD_FIELDS);
      await expect(
        firstValueFrom(repo.saveDraft(draftFor('res-0005', null), draft.id)),
      ).rejects.toThrow(WITHHELD_DRAFT_REFUSAL);
    });
  });

  it('keeps how the request reached the office, and who referred it', async () => {
    const repo = repository();
    const saved = await firstValueFrom(repo.saveDraft(draftFor('res-0006', null), null));
    const reread = await firstValueFrom(repo.getById(saved.id));
    expect(reread?.channel).toBe('barangay-referral');
    expect(reread?.referredBy).toBe('Brgy. San Juan — Kagawad Santos');
  });

  describe('moving a request on', () => {
    it('records a legal status change in the history, with its reason', async () => {
      const repo = repository();
      const id = asId<AssistanceRequestId>('req-0001');
      const updated = await firstValueFrom(repo.changeStatus(id, 'approved', 'Within ceiling.'));

      expect(updated.status).toBe('approved');
      const latest = updated.statusHistory.at(-1);
      expect(latest?.from).toBe('endorsed');
      expect(latest?.to).toBe('approved');
      expect(latest?.reason).toBe('Within ceiling.');
      expect(latest?.actorId).toBe(signedIn.id);
    });

    it('persists the change for subsequent reads', async () => {
      const repo = repository();
      const id = asId<AssistanceRequestId>('req-0001');
      await firstValueFrom(repo.changeStatus(id, 'approved', 'Within ceiling.'));
      const reread = await firstValueFrom(repo.getById(id));
      expect(reread?.status).toBe('approved');
    });

    it('refuses a move without words, as the API does', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(repo.changeStatus(asId<AssistanceRequestId>('req-0001'), 'approved', '  ')),
      ).rejects.toThrow(STATUS_MOVE_NEEDS_REASON);
    });

    it('refuses a bare move to submitted — filing is its own act', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(
          repo.changeStatus(asId<AssistanceRequestId>('req-0001'), 'submitted', 'By hand.'),
        ),
      ).rejects.toThrow(/File the draft instead/);
    });

    it('rejects a transition the lifecycle does not allow', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(
          repo.changeStatus(asId<AssistanceRequestId>('req-0001'), 'released', 'Paid out.'),
        ),
      ).rejects.toThrow(/cannot move from Endorsed to Released/);
    });

    it('rejects any change to a terminal request', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(
          repo.changeStatus(asId<AssistanceRequestId>('req-0005'), 'approved', 'Again.'),
        ),
      ).rejects.toThrow();
    });

    it('reports a missing request rather than failing silently', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(
          repo.changeStatus(asId<AssistanceRequestId>('req-nope'), 'approved', 'Within ceiling.'),
        ),
      ).rejects.toThrow(/was not found/);
    });
  });

  it('returns case notes newest first', async () => {
    const notes = await firstValueFrom(
      repository().listNotes(asId<AssistanceRequestId>('req-0001')),
    );
    expect(notes.length).toBeGreaterThan(1);
    const timestamps = notes.map((note) => note.createdAt);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });

  describe('filing refuses an incomplete record in the API’s words (DL-177)', () => {
    it('refuses a reason too short to act on', async () => {
      const repo = repository();
      const draft = await firstValueFrom(
        repo.saveDraft({ ...draftFor('res-0006', 'prog-aics-burial'), reasonForRequest: 'Burial' }, null),
      );
      await expect(firstValueFrom(repo.submitIntake(draft.id, null))).rejects.toThrow(
        /12 characters or more/,
      );
    });

    it('refuses a required document neither presented nor excused', async () => {
      const repo = repository();
      const draft = await firstValueFrom(
        repo.saveDraft(
          {
            ...draftFor('res-0006', 'prog-aics-burial'),
            requirements: [
              {
                code: 'death-certificate',
                label: 'Death certificate',
                obligation: 'required',
                appliesWhen: null,
                applicability: 'undecided',
                presented: false,
                waivedReason: null,
              },
            ],
          },
          null,
        ),
      );
      await expect(firstValueFrom(repo.submitIntake(draft.id, null))).rejects.toThrow(
        /Record each owed document.*Death certificate/,
      );
    });

    it('refuses a draft with no programme', async () => {
      const repo = repository();
      const draft = await firstValueFrom(repo.saveDraft(draftFor('res-0006', null), null));
      await expect(firstValueFrom(repo.submitIntake(draft.id, null))).rejects.toThrow(
        /Choose the programme/,
      );
    });
  });
});
