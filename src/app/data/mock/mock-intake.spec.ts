import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  EMPTY_INTAKE_DRAFT,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  asId,
  asIsoDateTime,
  cautions,
  needsAcknowledgement,
  pesos,
  type AccessContext,
  type AdvisoryAcknowledgement,
  type AssistanceRequestId,
  type AuthenticatedUser,
  type BarangayId,
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
  mockLatencyMs: 0,
  enableDevTools: false,
};

/** Aurora Mercado: has req-0001 endorsed under the medical programme. */
const AURORA = asId<ResidentId>('res-0001');
/** Michelle Cordero: req-0003 scheduled, with a payout on dsb-0001. */
const MICHELLE = asId<ResidentId>('res-0003');
/** Joselito, at the same address as Aurora. */
const JOSELITO = asId<ResidentId>('res-0006');
const MEDICAL = asId<ProgramId>('prog-aics-medical');
const BURIAL = asId<ProgramId>('prog-aics-burial');
const SAN_JUAN = asId<BarangayId>('brgy-san-juan');

function authenticated(role: StaffRole, barangayId: BarangayId | null = null): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id: asId<StaffUserId>('staff-intake'),
    displayName: 'Liezl Padilla',
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
      MockAssistanceRequestRepository,
    ],
  });
}

const repo = () => TestBed.inject(MockAssistanceRequestRepository);

const draftFor = (residentId: ResidentId, programId: ProgramId | null): IntakeDraft => ({
  ...EMPTY_INTAKE_DRAFT,
  residentId,
  programId,
  reasonForRequest: 'Maintenance medicines after a hypertension confinement',
});

/* ── The advisory ─────────────────────────────────────────────────────────── */

describe('the duplicate check reads the office’s own records', () => {
  it('finds the applicant’s unfinished request under the same programme', async () => {
    signedInAs(authenticated('intake-officer'));
    const advisory = await firstValueFrom(repo().advisoryFor(AURORA, MEDICAL));
    expect(advisory.signals.map((signal) => signal.code)).toContain('open-request-same-programme');
    expect(advisory.recordsRead).toBeGreaterThan(0);
  });

  it('reads that same history as a note when the programme differs', async () => {
    signedInAs(authenticated('intake-officer'));
    const advisory = await firstValueFrom(repo().advisoryFor(AURORA, BURIAL));
    expect(advisory.signals.map((signal) => signal.code)).toContain('open-request-other-programme');
  });

  it('answers before a programme is chosen', async () => {
    signedInAs(authenticated('intake-officer'));
    const advisory = await firstValueFrom(repo().advisoryFor(AURORA, null));
    expect(advisory.recordsRead).toBeGreaterThan(0);
  });

  it('mentions the open case the office already has on this person', async () => {
    signedInAs(authenticated('intake-officer'));
    const advisory = await firstValueFrom(repo().advisoryFor(AURORA, MEDICAL));
    const openCase = advisory.signals.find((signal) => signal.code === 'open-case');
    expect(openCase?.references.some((reference) => reference.startsWith('CASE-'))).toBe(true);
  });

  it('carries the rule and the records for every signal it raises', async () => {
    signedInAs(authenticated('intake-officer'));
    const advisory = await firstValueFrom(repo().advisoryFor(MICHELLE, MEDICAL));
    for (const signal of advisory.signals) {
      expect(signal.rule.length).toBeGreaterThan(10);
      expect(signal.references.length).toBeGreaterThan(0);
    }
  });

  it('is refused to a role that cannot file a request at all', async () => {
    // Sharper than browsing the list: this is one named person's whole history
    // plus their household's, so it is held behind `request.create`.
    signedInAs(authenticated('auditor'));
    await expect(firstValueFrom(repo().advisoryFor(AURORA, MEDICAL))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('is refused for a person outside the caller’s barangay', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(firstValueFrom(repo().advisoryFor(MICHELLE, MEDICAL))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('never returns anything that looks like a decision', async () => {
    signedInAs(authenticated('intake-officer'));
    const advisory = await firstValueFrom(repo().advisoryFor(AURORA, MEDICAL));
    const serialised = JSON.stringify(advisory);
    for (const word of ['"score"', '"eligible"', '"approved"', '"decision"', '"verdict"']) {
      expect(serialised).not.toContain(word);
    }
  });
});

/* ── Drafts ───────────────────────────────────────────────────────────────── */

describe('a draft is saved, resumed and never duplicated', () => {
  it('refuses to save a draft that names nobody', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(firstValueFrom(repo().saveDraft(EMPTY_INTAKE_DRAFT, null))).rejects.toThrow(
      /name the person/,
    );
  });

  it('creates a draft with no control number, because nothing has been filed', async () => {
    signedInAs(authenticated('intake-officer'));
    const saved = await firstValueFrom(repo().saveDraft(draftFor(AURORA, MEDICAL), null));
    expect(saved.status).toBe('draft');
    expect(saved.referenceNumber).toBe('');
    expect(saved.submittedAt).toBeNull();
  });

  it('updates the same row on a second save rather than leaving two', async () => {
    // Two taps on a slow connection are the ordinary case (DL-63).
    signedInAs(authenticated('intake-officer'));
    const first = await firstValueFrom(repo().saveDraft(draftFor(AURORA, MEDICAL), null));
    const second = await firstValueFrom(
      repo().saveDraft({ ...draftFor(AURORA, MEDICAL), requestedAmount: pesos(4000) }, first.id),
    );

    expect(second.id).toBe(first.id);
    expect(second.requestedAmount?.centavos).toBe(400_000);

    const drafts = await firstValueFrom(
      repo().list({ status: 'draft' }, { page: 1, pageSize: 50 }),
    );
    expect(drafts.items.filter((request) => request.id === first.id).length).toBe(1);
  });

  it('carries the counter’s document answers onto the request', async () => {
    signedInAs(authenticated('intake-officer'));
    const saved = await firstValueFrom(
      repo().saveDraft(
        {
          ...draftFor(AURORA, MEDICAL),
          requirements: [
            {
              code: 'valid-id',
              label: 'Valid ID',
              obligation: 'required',
    appliesWhen: null,
    applicability: 'undecided',
              presented: true,
              waivedReason: null,
            },
            {
              code: 'brgy-indigency',
              label: 'Indigency certificate',
              obligation: 'required',
    appliesWhen: null,
    applicability: 'undecided',
              presented: false,
              waivedReason: 'Barangay office closed for the holiday',
            },
          ],
        },
        null,
      ),
    );
    expect(saved.requirements.map((requirement) => requirement.status).sort()).toEqual([
      'submitted',
      'waived',
    ]);
  });

  it('refuses to save over a request that has already been filed', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(
        repo().saveDraft(draftFor(AURORA, MEDICAL), asId<AssistanceRequestId>('req-0001')),
      ),
    ).rejects.toThrow(/already been filed/);
  });

  it('is refused to a role that cannot create a request', async () => {
    signedInAs(authenticated('auditor'));
    await expect(firstValueFrom(repo().saveDraft(draftFor(AURORA, MEDICAL), null))).rejects.toThrow(
      PermissionDeniedError,
    );
  });
});

/* ── Filing ───────────────────────────────────────────────────────────────── */

describe('filing a request', () => {
  it('issues the control number at filing, not before', async () => {
    signedInAs(authenticated('intake-officer'));
    // Joselito has no history, so nothing is flagged.
    const draft = await firstValueFrom(repo().saveDraft(draftFor(JOSELITO, BURIAL), null));
    expect(draft.referenceNumber).toBe('');

    const filed = await firstValueFrom(repo().submitIntake(draft.id, null));
    expect(filed.status).toBe('submitted');
    expect(filed.referenceNumber).toMatch(/^TAY-\d{4}-\d+$/);
    expect(filed.submittedAt).not.toBeNull();
    expect(filed.statusHistory.at(-1)?.to).toBe('submitted');
  });

  it('demands a note when the check raised a caution — and files once it has one', async () => {
    signedInAs(authenticated('intake-officer'));
    const advisory = await firstValueFrom(repo().advisoryFor(AURORA, MEDICAL));
    expect(needsAcknowledgement(advisory)).toBe(true);

    const draft = await firstValueFrom(repo().saveDraft(draftFor(AURORA, MEDICAL), null));
    await expect(firstValueFrom(repo().submitIntake(draft.id, null))).rejects.toThrow(
      /duplicate check/,
    );

    const acknowledgement: AdvisoryAcknowledgement = {
      codes: cautions(advisory).map((signal) => signal.code),
      reason: 'Second admission for the same condition; the earlier grant covered the first bill',
      actorId: asId<StaffUserId>('staff-intake'),
      actorName: 'Liezl Padilla',
      acknowledgedAt: asIsoDateTime(new Date()),
    };
    const filed = await firstValueFrom(repo().submitIntake(draft.id, acknowledgement));

    // Filed, not refused. The only thing the caution changed is that a reason
    // is now on the record (DL-60).
    expect(filed.status).toBe('submitted');
    expect(filed.statusHistory.at(-1)?.reason).toContain('Second admission');
  });

  it('rejects a token acknowledgement', async () => {
    signedInAs(authenticated('intake-officer'));
    const draft = await firstValueFrom(repo().saveDraft(draftFor(AURORA, MEDICAL), null));
    await expect(
      firstValueFrom(
        repo().submitIntake(draft.id, {
          codes: [],
          reason: 'ok',
          actorId: null,
          actorName: 'Liezl Padilla',
          acknowledgedAt: asIsoDateTime(new Date()),
        }),
      ),
    ).rejects.toThrow(/Say a little more/);
  });

  it('refuses an acknowledgement for a request nothing was flagged on', async () => {
    // A stored "reason for proceeding" against a clean request would make the
    // record say something untrue.
    signedInAs(authenticated('intake-officer'));
    const draft = await firstValueFrom(repo().saveDraft(draftFor(JOSELITO, BURIAL), null));
    await expect(
      firstValueFrom(
        repo().submitIntake(draft.id, {
          codes: [],
          reason: 'Nothing was actually flagged here',
          actorId: null,
          actorName: 'Liezl Padilla',
          acknowledgedAt: asIsoDateTime(new Date()),
        }),
      ),
    ).rejects.toThrow(/nothing to acknowledge/);
  });

  it('absorbs a retried submit rather than filing twice', async () => {
    signedInAs(authenticated('intake-officer'));
    const draft = await firstValueFrom(repo().saveDraft(draftFor(JOSELITO, BURIAL), null));
    const first = await firstValueFrom(repo().submitIntake(draft.id, null));
    const second = await firstValueFrom(repo().submitIntake(draft.id, null));

    expect(second.referenceNumber).toBe(first.referenceNumber);
    expect(second.statusHistory.length).toBe(first.statusHistory.length);
  });
});

/* ── Assessment ───────────────────────────────────────────────────────────── */

describe('the case study', () => {
  const REQ = asId<AssistanceRequestId>('req-0001');

  it('records findings, a home visit and a recommendation', async () => {
    signedInAs(authenticated('social-worker'));
    const updated = await firstValueFrom(
      repo().recordAssessment(REQ, {
        findings:
          'Home visit on 12 August. Household of two; pension does not cover the medicines.',
        recommendedAmount: pesos(6000),
        homeVisitConducted: true,
      }),
    );
    expect(updated.assessment?.homeVisitConducted).toBe(true);
    expect(updated.assessment?.recommendedAmount?.centavos).toBe(600_000);
    // A recommendation is not an approval: the money field is untouched.
    expect(updated.approvedAmount).toBeNull();
    expect(updated.status).toBe('endorsed');
  });

  it('refuses findings too short to stand as a case study', async () => {
    signedInAs(authenticated('social-worker'));
    await expect(
      firstValueFrom(
        repo().recordAssessment(REQ, {
          findings: 'OK',
          recommendedAmount: null,
          homeVisitConducted: false,
        }),
      ),
    ).rejects.toThrow(/findings/);
  });

  it('is refused to a role that cannot assess', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(
        repo().recordAssessment(REQ, {
          findings: 'Home visit on 12 August. Household of two.',
          recommendedAmount: null,
          homeVisitConducted: true,
        }),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });
});

/* ── Documents ────────────────────────────────────────────────────────────── */

describe('verifying documents', () => {
  const REQ = asId<AssistanceRequestId>('req-0002');

  it('marks a presented document verified', async () => {
    signedInAs(authenticated('intake-officer'));
    const request = await firstValueFrom(repo().getById(REQ));
    const target = request?.requirements[1];
    expect(target).toBeDefined();

    const updated = await firstValueFrom(
      repo().reviewRequirement(REQ, target?.id ?? asId('rq-x'), 'verified', 'Original sighted'),
    );
    expect(updated.requirements.find((r) => r.id === target?.id)?.status).toBe('verified');
    expect(updated.requirements.find((r) => r.id === target?.id)?.remarks).toBe('Original sighted');
  });

  it('will not waive a document without a reason', async () => {
    signedInAs(authenticated('intake-officer'));
    const request = await firstValueFrom(repo().getById(REQ));
    await expect(
      firstValueFrom(
        repo().reviewRequirement(REQ, request?.requirements[0]?.id ?? asId('rq-x'), 'waived', null),
      ),
    ).rejects.toThrow(/why/);
  });

  it('is refused to a role without intake rights', async () => {
    signedInAs(authenticated('auditor'));
    await expect(
      firstValueFrom(repo().reviewRequirement(REQ, asId('rq-0004'), 'verified', null)),
    ).rejects.toThrow(PermissionDeniedError);
  });
});
