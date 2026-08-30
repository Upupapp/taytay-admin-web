import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  DEFAULT_PAGE_REQUEST,
  isResolutionInvalid,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type BarangayId,
  type DuplicatePairId,
  type IdentityResolutionDraft,
  type Permission,
  type ResidentId,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockBeneficiaryRepository } from './mock-beneficiary.repository';

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

/** Aurora Mercado, San Juan — senior, enrolled, with assistance history. */
const AURORA = asId<ResidentId>('res-0001');
/** The deliberate second registration of the same person (see the seed). */
const AURORA_AGAIN = asId<ResidentId>('res-0011');
/** Fernando Gonzales — left a programme and came back. */
const RETURNER = asId<ResidentId>('res-0008');

function authenticated(role: StaffRole, barangayId: BarangayId | null = null): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id: asId<StaffUserId>('staff-x'),
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

function signedInAs(user: AuthenticatedUser | null): MockBeneficiaryRepository {
  const context: AccessContext = { currentUser: () => user };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockBeneficiaryRepository,
    ],
  });
  return TestBed.inject(MockBeneficiaryRepository);
}

function resolution(overrides: Partial<IdentityResolutionDraft> = {}): IdentityResolutionDraft {
  return {
    pairId: asId<DuplicatePairId>([AURORA, AURORA_AGAIN].slice().sort().join('~')),
    verdict: 'same-person',
    pair: [AURORA, AURORA_AGAIN],
    canonicalResidentId: AURORA,
    reason: 'Same birth date and PhilSys digits; confirmed with her at the counter.',
    ...overrides,
  };
}

describe('MockBeneficiaryRepository — permission', () => {
  it('refuses the registry to a role without beneficiary.view', () => {
    const repository = signedInAs(authenticated('release-officer'));

    return expect(
      firstValueFrom(repository.list({}, DEFAULT_PAGE_REQUEST)),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('refuses the registry to an anonymous caller', () => {
    const repository = signedInAs(null);

    return expect(
      firstValueFrom(repository.list({}, DEFAULT_PAGE_REQUEST)),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('opens the registry to intake, who ask at the counter', async () => {
    const repository = signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(repository.list({}, DEFAULT_PAGE_REQUEST));

    expect(page.totalItems).toBeGreaterThan(0);
  });

  it('reports a record as absent rather than refused when it is out of reach', async () => {
    const repository = signedInAs(authenticated('barangay-link', DOLORES));

    // Aurora is in San Juan. A barangay-confined account is told the same thing
    // it would be told about a record that does not exist (`DL-31`).
    expect(await firstValueFrom(repository.getByResidentId(AURORA))).toBeNull();
  });
});

describe('MockBeneficiaryRepository — the duplicate queue discloses agreement, not values', () => {
  it('withholds candidates entirely from a reader who cannot review them', async () => {
    const repository = signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(repository.getByResidentId(AURORA));

    // Intake can read the registry but does not adjudicate identity, so the
    // candidates never reach the screen at all — rather than arriving and being
    // hidden by a template.
    expect(detail?.duplicateCandidates).toEqual([]);
  });

  it('refuses the queue to a role without the review permission', () => {
    const repository = signedInAs(authenticated('intake-officer'));

    return expect(
      firstValueFrom(repository.duplicateQueue(DEFAULT_PAGE_REQUEST)),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('finds the second registration of one person', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const candidates = await firstValueFrom(repository.duplicatesFor(AURORA));

    const match = candidates.find(
      (candidate) => candidate.otherResidentId === AURORA_AGAIN,
    );
    expect(match?.strength).toBe('strong');
  });

  it('emits no field values — only which fields agree', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const candidates = await firstValueFrom(repository.duplicatesFor(AURORA));
    const serialised = JSON.stringify(candidates);

    // The seeded birth date, PhilSys digits and mobile number of the pair. None
    // may appear anywhere in what the queue hands the client (`DL-73`).
    expect(serialised).not.toContain('1956-03-14');
    expect(serialised).not.toContain('4471');
    expect(serialised).not.toContain('0917-555-0101');
    // What it does carry: a masked name and the fields that matched.
    expect(serialised).toContain('Mercado');
  });

  it('asks about a pair once, not once from each side', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const queue = await firstValueFrom(repository.duplicateQueue(DEFAULT_PAGE_REQUEST));

    const keys = queue.items.map((candidate) =>
      [candidate.residentId, candidate.otherResidentId].sort().join('|'),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('MockBeneficiaryRepository — resolving an identity is a finding, not a merge', () => {
  it('records the finding with the reviewer who made it', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const recorded = await firstValueFrom(repository.resolveIdentity(resolution()));

    expect(recorded.verdict).toBe('same-person');
    expect(recorded.canonicalResidentId).toBe(AURORA);
    expect(recorded.supersededResidentId).toBe(AURORA_AGAIN);
    expect(recorded.decidedBy).toBe('staff-x');
    expect(recorded.reason.length).toBeGreaterThan(0);
  });

  it('keeps the superseded record readable, with its history intact', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    await firstValueFrom(repository.resolveIdentity(resolution()));

    // Nothing was deleted. This is the whole difference between a finding and a
    // merge: every request, payout and case attached to either record survives.
    const superseded = await firstValueFrom(repository.getByResidentId(AURORA_AGAIN));
    expect(superseded).not.toBeNull();
    expect(superseded?.residentId).toBe(AURORA_AGAIN);
  });

  it('stops listing the superseded record as a person of its own', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));

    const before = await firstValueFrom(repository.list({}, { page: 1, pageSize: 500 }));
    expect(before.items.some((row) => row.residentId === AURORA_AGAIN)).toBe(true);

    await firstValueFrom(repository.resolveIdentity(resolution()));

    const after = await firstValueFrom(repository.list({}, { page: 1, pageSize: 500 }));
    expect(after.items.some((row) => row.residentId === AURORA_AGAIN)).toBe(false);
    expect(after.items.some((row) => row.residentId === AURORA)).toBe(true);
  });

  it('takes the pair out of the queue once it has been answered', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    await firstValueFrom(
      repository.resolveIdentity(
        resolution({ verdict: 'distinct-people', canonicalResidentId: null, reason: 'Mother and daughter, same name.' }),
      ),
    );

    const candidates = await firstValueFrom(repository.duplicatesFor(AURORA));
    expect(candidates.some((candidate) => candidate.otherResidentId === AURORA_AGAIN)).toBe(false);
  });

  it('records one finding when a reviewer taps twice', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));

    const first = await firstValueFrom(repository.resolveIdentity(resolution()));
    const second = await firstValueFrom(repository.resolveIdentity(resolution()));

    expect(second.id).toBe(first.id);
    expect((await firstValueFrom(repository.resolutionsFor(AURORA))).length).toBe(1);
  });

  it('refuses to overwrite an answered pair with the opposite verdict', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    await firstValueFrom(repository.resolveIdentity(resolution()));

    await expect(
      firstValueFrom(
        repository.resolveIdentity(
          resolution({ verdict: 'distinct-people', canonicalResidentId: null }),
        ),
      ),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('refuses a finding nobody explained', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));

    const failure = await firstValueFrom(
      repository.resolveIdentity(resolution({ reason: '   ' })),
    ).catch((error: unknown) => error);

    expect(isResolutionInvalid(failure)).toBe(true);
  });

  it('refuses a finding from a role that may read but not adjudicate', async () => {
    const repository = signedInAs(authenticated('auditor'));

    await expect(
      firstValueFrom(repository.resolveIdentity(resolution())),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('previews what a finding would carry across without changing anything', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const preview = await firstValueFrom(
      repository.previewResolution(
        asId<DuplicatePairId>('pair-aurora'),
        AURORA,
        AURORA_AGAIN,
      ),
    );

    expect(preview.canonicalResidentId).toBe(AURORA);
    expect(preview.supersededResidentId).toBe(AURORA_AGAIN);

    // The preview is inert: the pair is still open afterwards.
    const candidates = await firstValueFrom(repository.duplicatesFor(AURORA));
    expect(candidates.some((candidate) => candidate.otherResidentId === AURORA_AGAIN)).toBe(true);
  });
});

describe('MockBeneficiaryRepository — the record it assembles', () => {
  it('derives standing from what the office actually did', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repository.getByResidentId(AURORA));

    expect(detail?.standing.roles).toContain('constituent');
    expect(detail?.standing.roles).toContain('enrollee');
    expect(detail?.enrollments.length).toBeGreaterThan(0);
  });

  it('keeps a past enrollment beside the current one for somebody who returned', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));

    /*
     * Read from the detail, which is where a screen gets it.
     *
     * `enrollmentsFor` was removed: `BeneficiaryDetail` already carries `enrollments`, and a second
     * way to ask the same question is a second answer that can disagree with the first (`DL-71`).
     * The rule this test asserts is unchanged — only the door it comes through.
     */
    const detail = await firstValueFrom(repository.getByResidentId(RETURNER));
    const enrollments = detail?.enrollments ?? [];

    expect(enrollments.length).toBe(2);
    expect(enrollments.some((enrollment) => enrollment.status === 'exited')).toBe(true);
    expect(enrollments.some((enrollment) => enrollment.status === 'active')).toBe(true);
    // The later record names the earlier one rather than replacing it.
    expect(
      enrollments.some((enrollment) => enrollment.continuesEnrollmentId !== null),
    ).toBe(true);
  });

  it('orders the timeline newest first and cites every source', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repository.getByResidentId(AURORA));
    const timeline = detail?.timeline ?? [];

    expect(timeline.length).toBeGreaterThan(0);
    for (let i = 1; i < timeline.length; i += 1) {
      expect(timeline[i - 1]!.occurredAt >= timeline[i]!.occurredAt).toBe(true);
    }
    for (const entry of timeline) {
      expect(entry.sourceId.length).toBeGreaterThan(0);
    }
  });

  it('does not hand a barangay encoder the longitudinal view at all', () => {
    const repository = signedInAs(authenticated('barangay-link', SAN_JUAN));

    // A barangay encoder keeps the registry current and files requests; the
    // whole assistance history of their neighbours is not theirs to read, and
    // proximity is the reason to be stricter rather than looser.
    return expect(
      firstValueFrom(repository.list({}, DEFAULT_PAGE_REQUEST)),
    ).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it('counts only what was handed over toward the total released', async () => {
    const repository = signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repository.getByResidentId(AURORA));

    const handedOver = (detail?.payouts ?? []).filter(
      (payout) => payout.status === 'released' || payout.status === 'claimed',
    );
    const expected = handedOver.reduce((total, payout) => total + (payout.amount?.centavos ?? 0), 0);

    expect(detail?.totalReleased.centavos).toBe(expected);
  });
});
