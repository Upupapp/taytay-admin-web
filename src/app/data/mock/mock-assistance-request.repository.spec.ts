import { TestBed } from '@angular/core/testing';
import { firstValueFrom, lastValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  ASSIGNMENT_NEEDS_REASON,
  PROTECTED_WRITE_REFUSAL,
  asId,
  EMPTY_INTAKE_DRAFT,
  ROLE_DEFINITIONS,
  REQUEST_WITHHELD_FIELDS,
  APPROVAL_IS_ITS_OWN_ACT,
  APPROVAL_NEEDS_WHAT,
  STATUS_MOVE_NEEDS_REASON,
  WITHHELD_DRAFT_REFUSAL,
  centavos,
  type Release,
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
import { MockAssistanceRequestStore } from './mock-assistance-request.store';

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
      const updated = await firstValueFrom(
        repo.approve(id, { kind: 'money', amount: centavos(900_000) }, 'Within ceiling.'),
      );

      expect(updated.status).toBe('approved');
      expect(updated.approvedAmount).toEqual(centavos(900_000));
      expect(updated.approvedInKindDescription).toBeNull();
      const latest = updated.statusHistory.at(-1);
      expect(latest?.from).toBe('endorsed');
      expect(latest?.to).toBe('approved');
      expect(latest?.reason).toBe('Within ceiling.');
      expect(latest?.actorId).toBe(signedIn.id);
    });

    it('persists the change for subsequent reads', async () => {
      const repo = repository();
      const id = asId<AssistanceRequestId>('req-0001');
      await firstValueFrom(
        repo.approve(id, { kind: 'money', amount: centavos(500_000) }, 'Within ceiling.'),
      );
      const reread = await firstValueFrom(repo.getById(id));
      expect(reread?.status).toBe('approved');
      expect(reread?.approvedAmount).toEqual(centavos(500_000));
    });

    it('refuses a move without words, as the API does', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(repo.changeStatus(asId<AssistanceRequestId>('req-0001'), 'returned', '  ')),
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
          repo.changeStatus(asId<AssistanceRequestId>('req-0005'), 'cancelled', 'Again.'),
        ),
      ).rejects.toThrow();
    });

    it('reports a missing request rather than failing silently', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(
          repo.changeStatus(asId<AssistanceRequestId>('req-nope'), 'returned', 'Within ceiling.'),
        ),
      ).rejects.toThrow(/was not found/);
    });
  });

  describe('approval says what was approved (DL-183)', () => {
    it('refuses a bare move to approved: approving is its own act', async () => {
      const repo = repository();
      await expect(
        firstValueFrom(
          repo.changeStatus(asId<AssistanceRequestId>('req-0001'), 'approved', 'Within ceiling.'),
        ),
      ).rejects.toThrow(APPROVAL_IS_ITS_OWN_ACT);
    });

    it('refuses an approval that says neither an amount nor the goods', async () => {
      const repo = repository();
      const id = asId<AssistanceRequestId>('req-0001');
      await expect(
        firstValueFrom(repo.approve(id, { kind: 'money', amount: centavos(0) }, 'Within ceiling.')),
      ).rejects.toThrow(APPROVAL_NEEDS_WHAT);
      await expect(
        firstValueFrom(repo.approve(id, { kind: 'in-kind', description: '  ' }, 'Within ceiling.')),
      ).rejects.toThrow(APPROVAL_NEEDS_WHAT);
      expect((await firstValueFrom(repo.getById(id)))?.status).toBe('endorsed');
    });

    it('records goods described and no amount', async () => {
      const repo = repository();
      const approved = await firstValueFrom(
        repo.approve(
          asId<AssistanceRequestId>('req-0001'),
          { kind: 'in-kind', description: ' Two sacks of rice ' },
          'Goods, as the programme gives.',
        ),
      );
      expect(approved.approvedAmount).toBeNull();
      expect(approved.approvedInKindDescription).toBe('Two sacks of rice');
    });

    it('is refused to a role without request.approve', async () => {
      const repo = repository();
      signedIn = userFor('intake-officer');
      await expect(
        firstValueFrom(
          repo.approve(
            asId<AssistanceRequestId>('req-0001'),
            { kind: 'money', amount: centavos(100_000) },
            'Within ceiling.',
          ),
        ),
      ).rejects.toThrow();
    });
  });

  describe('a request with an open release is not ended (DL-183)', () => {
    it('refuses cancelling or expiring while the payout stands, and allows it once voided', async () => {
      const repo = repository();
      const store = TestBed.inject(MockAssistanceRequestStore);
      const id = asId<AssistanceRequestId>('req-0003');
      const open = store.releases.find(
        (release) => release.requestId === id && release.status !== 'voided',
      );
      expect(open).toBeDefined();
      if (open === undefined) {
        return;
      }
      await expect(
        firstValueFrom(repo.changeStatus(id, 'cancelled', 'The family withdrew.')),
      ).rejects.toThrow(/Void the release first/);
      await expect(
        firstValueFrom(repo.changeStatus(id, 'expired', 'Not claimed in time.')),
      ).rejects.toThrow(/Void the release first/);

      const voided: Release = { ...open, status: 'voided' };
      store.releases = store.releases.map((release) => (release.id === open.id ? voided : release));
      const ended = await firstValueFrom(repo.changeStatus(id, 'cancelled', 'The family withdrew.'));
      expect(ended.status).toBe('cancelled');
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

/* ── Phase 2b, held to the server's rules (DL-178) ─────────────────────────── */

describe('the mock holds phase 2b to the server’s rules (DL-178)', () => {
  const ENDORSED = asId<AssistanceRequestId>('req-0001');
  const IN_INTAKE = asId<AssistanceRequestId>('req-0002');
  const OTHERS = asId<AssistanceRequestId>('req-0003');
  const SW_1 = asId<StaffUserId>('staff-sw-1');
  const SW_2 = asId<StaffUserId>('staff-sw-2');

  /** A social worker signed in as the seed's own, so the seeded assignments are theirs. */
  const caseload = (): void => {
    signedIn = { ...userFor('social-worker'), id: SW_1 };
  };

  const requirementOf = async (
    repo: MockAssistanceRequestRepository,
    id: AssistanceRequestId,
    index = 0,
  ) => {
    const request = await firstValueFrom(repo.getById(id));
    const requirement = request?.requirements[index];
    if (requirement === undefined) {
      throw new Error('the seed changed');
    }
    return requirement;
  };

  describe('a caseload', () => {
    it('lists only the filed requests assigned to it, whatever assignee it asks for', async () => {
      const repo = repository();
      caseload();
      const rows = await everyPage((cursor) =>
        firstValueFrom(repo.list({ assignedTo: SW_2 }, { limit: 50, cursor })),
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((request) => request.assignedTo === SW_1)).toBe(true);
      expect(rows.every((request) => request.referenceNumber !== '')).toBe(true);
    });

    it('reads a request assigned to somebody else as not found', async () => {
      const repo = repository();
      caseload();
      expect(await firstValueFrom(repo.getById(OTHERS))).toBeNull();
      await expect(firstValueFrom(repo.listNotes(OTHERS))).rejects.toThrow(/not found/);
    });

    it('is refused what reads beyond it: drafts, the check before filing and the list of social workers', async () => {
      const repo = repository();
      caseload();
      await expect(
        firstValueFrom(repo.saveDraft(draftFor('res-0001', 'prog-aics-medical'), null)),
      ).rejects.toThrow(/assigned to your account/);
      await expect(
        firstValueFrom(repo.advisoryFor(asId<ResidentId>('res-0001'), null)),
      ).rejects.toThrow(/assigned to your account/);
      await expect(firstValueFrom(repo.listSocialWorkers())).rejects.toThrow(/whole list/);
      await expect(
        firstValueFrom(repo.assignForAssessment(ENDORSED, SW_1, 'Mine.')),
      ).rejects.toThrow(/whole list/);
    });

    it('reads the previous-assistance check on its own request, and on nobody else’s (DL-183)', async () => {
      const repo = repository();
      caseload();
      const mine = await firstValueFrom(repo.advisoryForCase(ENDORSED));
      expect(mine.signals).toBeDefined();
      // req-0003 is assigned to sw-2.
      await expect(
        firstValueFrom(repo.advisoryForCase(asId<AssistanceRequestId>('req-0003'))),
      ).rejects.toThrow(/was not found/);
    });
  });

  describe('assigning for assessment', () => {
    it('appends an assignment with who, when and why, and follows it with assignedTo', async () => {
      const repo = repository();
      signedIn = userFor('mswdo-head');
      const saved = await firstValueFrom(
        repo.assignForAssessment(IN_INTAKE, SW_2, ' Home visit needed. '),
      );
      expect(saved.assignedTo).toBe(SW_2);
      expect(saved.assignments.at(-1)).toMatchObject({
        assigneeId: SW_2,
        assigneeName: 'Jomar Villanueva',
        reason: 'Home visit needed.',
        actorName: 'mswdo-head',
      });
    });

    it('answers the same assignee as it stands, appending nothing', async () => {
      const repo = repository();
      signedIn = userFor('mswdo-head');
      const before = await firstValueFrom(repo.getById(ENDORSED));
      const saved = await firstValueFrom(repo.assignForAssessment(ENDORSED, SW_1, 'Again.'));
      expect(saved.assignments.length).toBe(before?.assignments.length);
    });

    it('refuses no reason, an account that is not a social worker, and a request that is over', async () => {
      const repo = repository();
      signedIn = userFor('mswdo-head');
      await expect(
        firstValueFrom(repo.assignForAssessment(IN_INTAKE, SW_2, '  ')),
      ).rejects.toThrow(ASSIGNMENT_NEEDS_REASON);
      await expect(
        firstValueFrom(
          repo.assignForAssessment(IN_INTAKE, asId<StaffUserId>('staff-intake'), 'Why not.'),
        ),
      ).rejects.toThrow(/Not the open account of a social worker/);
      await expect(
        firstValueFrom(repo.assignForAssessment(asId('req-0005'), SW_2, 'Late.')),
      ).rejects.toThrow(/kept as it ended/);
    });

    it('lists the open social workers by name', async () => {
      const repo = repository();
      signedIn = userFor('mswdo-head');
      const workers = await firstValueFrom(repo.listSocialWorkers());
      expect(workers.map((worker) => worker.name)).toEqual(['Grace Ocampo', 'Jomar Villanueva']);
    });
  });

  describe('the assessment', () => {
    it('is opened, answered and completed only while the request is in assessment', async () => {
      const repo = repository();
      await expect(firstValueFrom(repo.openAssessment(ENDORSED, 'aics-general'))).rejects.toThrow(
        /while the request is in assessment, and this one is endorsed/,
      );
    });

    it('completes with the form it was opened from, and moves the request nowhere', async () => {
      const repo = repository();
      const opened = await firstValueFrom(repo.openAssessment(PROTECTED, 'aics-general'));
      // A second open answers with the one already open, whichever form was asked for.
      const again = await firstValueFrom(repo.openAssessment(PROTECTED, 'medical-assistance'));
      expect(again.templateCode).toBe('aics-general');

      const templates = await firstValueFrom(repo.listAssessmentTemplates());
      const form = templates.find((template) => template.code === opened.templateCode);
      const answers: Record<string, string | null> = {};
      for (const question of form?.questions ?? []) {
        answers[question.code] = question.kind === 'choice' ? (question.choices[0] ?? null) : '2';
      }
      await firstValueFrom(repo.answerAssessment(PROTECTED, answers));
      const saved = await firstValueFrom(
        repo.recordAssessment(PROTECTED, {
          findings: 'Household of five in one rented room; sole earner out of work.',
          recommendedAmount: null,
          homeVisitConducted: true,
          recommendation: 'recommend-refer',
          reason: null,
        }),
      );
      expect(saved.status).toBe('assessment');
      expect(saved.assessment).toMatchObject({
        templateCode: 'aics-general',
        templateVersion: opened.templateVersion,
        recommendation: 'recommend-refer',
      });
    });

    it('withholds the study’s words from a reader without case access', async () => {
      const repo = repository();
      signedIn = userFor('release-officer');
      const request = await firstValueFrom(repo.getById(ENDORSED));
      expect(request?.withheld).toEqual(['assessment']);
      expect(request?.assessment?.findings).toBeNull();
      expect(request?.assessment?.recommendation).toBe('recommend-approve');
    });
  });

  describe('reviewing and recording documents', () => {
    it('asks for words where the applicant must be told why, and checks only what was presented', async () => {
      const repo = repository();
      const presented = await requirementOf(repo, IN_INTAKE);
      await expect(
        firstValueFrom(repo.reviewRequirement(IN_INTAKE, presented.id, 'rejected', ' ')),
      ).rejects.toThrow(/not accepted/);
      await expect(
        firstValueFrom(repo.reviewRequirement(IN_INTAKE, presented.id, 'pending', null)),
      ).rejects.toThrow(/verdict/);

      // req-0001's billing statement was excused and never presented.
      const neverPresented = await requirementOf(repo, ENDORSED, 3);
      expect(neverPresented.submittedAt).toBeNull();
      await expect(
        firstValueFrom(repo.reviewRequirement(ENDORSED, neverPresented.id, 'verified', null)),
      ).rejects.toThrow(/Only a document that was presented/);

      const needs = await firstValueFrom(
        repo.reviewRequirement(IN_INTAKE, presented.id, 'needs-replacement', 'Torn in half.'),
      );
      expect(needs.requirements[0]).toMatchObject({
        status: 'needs-replacement',
        remarks: 'Torn in half.',
      });
      expect(needs.requirements[0]?.reviewedAt).not.toBeNull();
    });

    it('reads a requirement submitted again when a new version is recorded, even after it was verified', async () => {
      const repo = repository();
      // req-0002's first document was verified.
      const verified = await requirementOf(repo, IN_INTAKE);
      expect(verified.status).toBe('verified');
      const upload = await lastValueFrom(
        repo.recordDocument(IN_INTAKE, verified.id, {
          file: new File(['%PDF-1.4'], 'cruz-id.pdf', { type: 'application/pdf' }),
          source: 'uploaded',
          documentNumber: 'PN-2020-123456',
          issuedOn: null,
          expiresOn: null,
          replacesBecause: verified.document === null ? null : 'A clearer copy.',
        }),
      );
      expect(upload.kind).toBe('done');
      const after = upload.kind === 'done' ? upload.result.requirements[0] : undefined;
      expect(after?.status).toBe('submitted');
      const current = after?.document?.versions.at(-1);
      // Named as the server names it, never by the uploader's own file name.
      expect(current?.file?.fileName).toBe(`${verified.code}-v${current?.version ?? 0}.pdf`);
    });

    it('answers the open requests for a document when it is recorded', async () => {
      const repo = repository();
      const requests = await firstValueFrom(repo.listDocumentRequests(OTHERS));
      const open = requests.find((entry) => entry.state === 'open');
      if (open === undefined) {
        throw new Error('the seed changed');
      }
      await lastValueFrom(
        repo.recordDocument(OTHERS, open.requirementId, {
          file: null,
          source: 'encoded',
          documentNumber: null,
          issuedOn: null,
          expiresOn: null,
          replacesBecause: 'Seen at the counter.',
        }),
      );
      const after = await firstValueFrom(repo.listDocumentRequests(OTHERS));
      expect(after.find((entry) => entry.id === open.id)).toMatchObject({
        state: 'answered',
        closedBy: signedIn.id,
      });
    });

    it('refuses every addition to a protected request from a writer it is withheld from', async () => {
      const repo = repository();
      signedIn = userFor('intake-officer');
      const requirement = await requirementOf(repo, PROTECTED);
      await expect(
        firstValueFrom(repo.reviewRequirement(PROTECTED, requirement.id, 'waived', 'Excused.')),
      ).rejects.toThrow(PROTECTED_WRITE_REFUSAL);
      await expect(
        firstValueFrom(repo.addNote(PROTECTED, { sensitivity: 'routine', body: 'Called.' })),
      ).rejects.toThrow(/withheld from your account/);
      const asked = await firstValueFrom(repo.listDocumentRequests(PROTECTED));
      expect(asked.every((entry) => entry.isWithheld && entry.message === null)).toBe(true);
    });

    it('says every document number as its last four, the only part held, to every reader (DL-183)', async () => {
      const repo = repository();
      signedIn = userFor('intake-officer');
      const intake = await requirementOf(repo, ENDORSED);
      expect(intake.document?.versions[0]).toMatchObject({
        documentNumber: '••••8271',
        documentNumberMasked: true,
      });
      signedIn = userFor('social-worker');
      signedIn = { ...signedIn, id: SW_1 };
      const worker = await requirementOf(repo, ENDORSED);
      expect(worker.document?.versions[0]?.documentNumber).toBe('••••8271');
    });
  });

  describe('opening a file', () => {
    it('grants with the server’s warning, and exchanges the grant once for the bytes it holds', async () => {
      const repo = repository();
      const verified = await requirementOf(repo, IN_INTAKE);
      const upload = await lastValueFrom(
        repo.recordDocument(IN_INTAKE, verified.id, {
          file: new File(['%PDF-1.4'], 'scan.pdf', { type: 'application/pdf' }),
          source: 'uploaded',
          documentNumber: null,
          issuedOn: null,
          expiresOn: null,
          replacesBecause: verified.document === null ? null : 'A clearer copy.',
        }),
      );
      const version =
        upload.kind === 'done' ? upload.result.requirements[0]?.document?.versions.at(-1) : undefined;
      if (version === undefined) {
        throw new Error('nothing was recorded');
      }
      const grant = await firstValueFrom(repo.openDocument(IN_INTAKE, verified.id, version.id));
      expect(grant.redactedForSharing).toBe(false);
      expect(grant.warning).toContain('Opening it is recorded against your account');

      expect(await firstValueFrom(repo.readDocumentFile(grant))).toBeInstanceOf(Blob);
      await expect(firstValueFrom(repo.readDocumentFile(grant))).rejects.toThrow(/used once/);
    });

    it('says a seeded file holds no bytes, rather than hand over a stand-in', async () => {
      const repo = repository();
      const requirement = await requirementOf(repo, ENDORSED);
      const version = requirement.document?.versions[0];
      if (version === undefined) {
        throw new Error('the seed changed');
      }
      const grant = await firstValueFrom(repo.openDocument(ENDORSED, requirement.id, version.id));
      await expect(firstValueFrom(repo.readDocumentFile(grant))).rejects.toThrow(/none of its bytes/);
    });

    it('refuses a protected request’s file to a reader not cleared for it', async () => {
      const repo = repository();
      signedIn = {
        ...userFor('release-officer'),
        permissions: new Set<Permission>(['request.view', 'document.download']),
      };
      const requirement = await requirementOf(repo, PROTECTED, 1);
      await expect(
        firstValueFrom(repo.openDocument(PROTECTED, requirement.id, asId('dv-0000'))),
      ).rejects.toThrow(/protected sector/);
    });
  });

  describe('notes', () => {
    it('appends a note and answers with the list, newest first', async () => {
      const repo = repository();
      signedIn = userFor('intake-officer');
      const notes = await firstValueFrom(
        repo.addNote(ENDORSED, { sensitivity: 'routine', body: ' Applicant called. ' }),
      );
      expect(notes[0]).toMatchObject({ body: 'Applicant called.', sensitivity: 'routine' });
    });

    it('refuses the protected tier to an account not cleared for it', async () => {
      const repo = repository();
      signedIn = userFor('intake-officer');
      await expect(
        firstValueFrom(repo.addNote(ENDORSED, { sensitivity: 'protected', body: 'Safety plan.' })),
      ).rejects.toThrow();
    });
  });
});
