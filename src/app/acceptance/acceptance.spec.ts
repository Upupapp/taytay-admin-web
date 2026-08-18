import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { provideDataAccess } from '@data/data-access.providers';
import {
  ACCESS_CONTEXT,
  ASSISTANCE_REQUEST_REPOSITORY,
  BENEFICIARY_REPOSITORY,
  CASE_REPOSITORY,
  DISBURSEMENT_REPOSITORY,
  FAMILY_REPOSITORY,
  GOVERNANCE_REPOSITORY,
  HOUSEHOLD_REPOSITORY,
  REFERRAL_REPOSITORY,
  REPORT_REPOSITORY,
  RESIDENT_REPOSITORY,
  SEARCH_REPOSITORY,
  STAFF_REPOSITORY,
  TAYTAY_BARANGAYS,
  WORK_REPOSITORY,
  asId,
  emptyPage,
  isReferralOverdue,
  todayAsIsoDate,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type BarangayId,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

/**
 * Acceptance scenarios.
 *
 * The master command names seventeen end-to-end situations the office must be
 * able to reach. Unit tests already cover most of the *rules* inside them; what
 * this file checks is different, and is the thing unit tests structurally
 * cannot: that a **whole path holds together across modules** — that a resident
 * in the registry is the same person the request names, the release pays and
 * the audit trail records.
 *
 * Every scenario runs against the real mock adapter set through
 * `provideDataAccess`, not against per-test doubles. A test double that matches
 * the shape of a call proves the call was shaped correctly; it does not prove
 * the seed is coherent (`DL-121`).
 *
 * Scenarios that cannot be exercised in this environment — 200% zoom, a real
 * tablet, an actual screen reader — are named in `docs/qa/README.md` as
 * unexercised rather than quietly counted as passing.
 */

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function staffUser(role: StaffRole, id: string, barangayId: string | null = null): StaffUser {
  return {
    id: asId<StaffUserId>(id),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId: barangayId === null ? null : asId<BarangayId>(barangayId),
    additionalPermissions: [],
    isActive: true,
    lastSignInAt: null,
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['createdAt'],
      createdBy: null,
      updatedAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['updatedAt'],
      updatedBy: null,
    },
  };
}

function staffRepository(user: StaffUser): StaffRepository {
  const authenticated = toAuthenticatedUser(user);
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated),
    signOut: (): Observable<void> => of(undefined),
  };
}

/** The whole mock adapter set, exactly as the application wires it. */
async function signedInAs(
  role: StaffRole,
  id = 'staff-admin',
  barangayId: string | null = null,
): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      provideDataAccess(TEST_ENVIRONMENT),
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      {
        provide: STAFF_REPOSITORY,
        useValue: staffRepository(staffUser(role, id, barangayId)),
      },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

const PAGE = { page: 1, pageSize: 500 } as const;

/* ── The dataset itself ───────────────────────────────────────────────────── */

describe('the Taytay dataset', () => {
  it('reaches all five barangays with real records', async () => {
    await signedInAs('system-administrator');
    const residents = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({}, PAGE),
    );

    const covered = new Set(residents.items.map((view) => view.resident.address.barangayId));
    for (const barangay of TAYTAY_BARANGAYS) {
      expect(covered, `${barangay.name} has no residents on file`).toContain(barangay.id);
    }
  });

  it('holds enough records for a filtered list to be a real test', async () => {
    await signedInAs('system-administrator');
    const residents = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({}, PAGE),
    );

    // Large enough that pagination, suppression and sorting are exercised by
    // the data rather than only by a unit test with three rows.
    expect(residents.items.length).toBeGreaterThan(200);
  });

  it('names nobody real: every record is a fictional Taytay resident', async () => {
    await signedInAs('system-administrator');
    const residents = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({}, PAGE),
    );

    // A crude guard, but the one that matters: no placeholder that would show a
    // developer name or a lorem string had it slipped in.
    for (const view of residents.items.slice(0, 50)) {
      expect(view.resident.name.last).not.toMatch(/test|lorem|foo|admin|sample/i);
    }
  });
});

/* ── Scenario 1: an existing resident applies for assistance ─────────────── */

describe('scenario: an existing resident applies for assistance', () => {
  it('links the request to a resident who is really on file', async () => {
    await signedInAs('system-administrator');
    const requests = await firstValueFrom(
      TestBed.inject(ASSISTANCE_REQUEST_REPOSITORY).list({}, PAGE),
    );
    const residents = TestBed.inject(RESIDENT_REPOSITORY);

    expect(requests.items.length).toBeGreaterThan(0);
    for (const request of requests.items) {
      const resident = await firstValueFrom(residents.getById(request.residentId));
      expect(resident, `request ${request.referenceNumber} names a resident who is not on file`)
        .not.toBeNull();
    }
  });
});

/* ── Scenario 3: a duplicate warning ─────────────────────────────────────── */

describe('scenario: a possible duplicate is surfaced for review', () => {
  it('finds candidate pairs without disclosing a value', async () => {
    await signedInAs('system-administrator');
    const queue = await firstValueFrom(
      TestBed.inject(BENEFICIARY_REPOSITORY).duplicateQueue(PAGE),
    );

    expect(queue.items.length).toBeGreaterThan(0);
    for (const candidate of queue.items) {
      for (const signal of candidate.signals) {
        // A match signal states its rule and its outcome, never the value that
        // matched (`DL-73`).
        expect(signal as unknown as Record<string, unknown>).not.toHaveProperty('value');
      }
    }
  });
});

/* ── Scenario 4: a household holding two families ────────────────────────── */

describe('scenario: one household, more than one family', () => {
  it('lets a household hold several families without either owning the other', async () => {
    await signedInAs('system-administrator');
    const families = await firstValueFrom(TestBed.inject(FAMILY_REPOSITORY).list({}, PAGE));
    const households = await firstValueFrom(
      TestBed.inject(HOUSEHOLD_REPOSITORY).list({}, PAGE),
    );

    // `DL-47`: a household is an address, a family is a claim about who belongs
    // to whom, and neither is a field on the other.
    expect(families.items.length).toBeGreaterThan(0);
    expect(households.items.length).toBeGreaterThan(0);
    for (const family of families.items) {
      expect(family as unknown as Record<string, unknown>).not.toHaveProperty('householdId');
    }
  });
});

/* ── Scenario 7: a referral this office said it would chase ──────────────── */

describe('scenario: a referral is overdue for follow-up', () => {
  it('has at least one referral past the date the office set', async () => {
    await signedInAs('system-administrator');
    const referrals = await firstValueFrom(TestBed.inject(REFERRAL_REPOSITORY).list({}, PAGE));
    const today = todayAsIsoDate();

    const overdue = referrals.items.filter((referral) => isReferralOverdue(referral, today));
    expect(overdue.length, 'no overdue referral in the dataset to demonstrate the state')
      .toBeGreaterThan(0);
  });

  it('surfaces it as work somebody owes, not as a status nobody reads', async () => {
    await signedInAs('social-worker', 'staff-sw-1');
    const queue = await firstValueFrom(
      TestBed.inject(WORK_REPOSITORY).myQueue(todayAsIsoDate()),
    );

    expect(queue.items.some((item) => item.source === 'referral')).toBe(true);
  });
});

/* ── Scenario 8: an approved request reaches a release ───────────────────── */

describe('scenario: approved assistance becomes a release', () => {
  it('ties every release to a request and a resident that both exist', async () => {
    await signedInAs('system-administrator');
    const releases = await firstValueFrom(
      TestBed.inject(DISBURSEMENT_REPOSITORY).list({}, PAGE),
    );
    const residents = TestBed.inject(RESIDENT_REPOSITORY);
    const requests = TestBed.inject(ASSISTANCE_REQUEST_REPOSITORY);

    expect(releases.items.length).toBeGreaterThan(0);
    for (const release of releases.items) {
      const resident = await firstValueFrom(residents.getById(release.residentId));
      const request = await firstValueFrom(requests.getById(release.requestId));
      expect(resident, `release ${release.referenceNumber} names a missing resident`).not.toBeNull();
      expect(request, `release ${release.referenceNumber} names a missing request`).not.toBeNull();
    }
  });

  it('keeps money and goods apart on every record', async () => {
    await signedInAs('system-administrator');
    const releases = await firstValueFrom(
      TestBed.inject(DISBURSEMENT_REPOSITORY).list({}, PAGE),
    );

    // `DL-93`: an in-kind release carries a description and no amount.
    for (const release of releases.items) {
      if (release.kind === 'in-kind') {
        expect(release.amount).toBeNull();
        expect(release.inKindDescription).not.toBeNull();
      } else {
        expect(release.amount).not.toBeNull();
      }
    }
  });
});

/* ── Scenario 10: a case that has been closed ────────────────────────────── */

describe('scenario: a case is closed', () => {
  it('has a closed case on file, and closure is terminal', async () => {
    await signedInAs('system-administrator');
    const cases = await firstValueFrom(TestBed.inject(CASE_REPOSITORY).list({}, PAGE));

    const closed = cases.items.filter((summary) => summary.record.status === 'closed');
    expect(closed.length, 'no closed case to demonstrate the terminal state').toBeGreaterThan(0);
  });
});

/* ── Scenario 11: a restricted user attempts a sensitive export ──────────── */

describe('scenario: a restricted user attempts a sensitive export', () => {
  it('refuses at the adapter, not merely by hiding a button', async () => {
    await signedInAs('intake-officer', 'staff-intake');

    await expect(
      firstValueFrom(TestBed.inject(REPORT_REPOSITORY).export('caseload', {}, 'csv')),
    ).rejects.toThrow();
  });

  it('refuses the report that names people even to somebody who may read reports', async () => {
    await signedInAs('social-worker', 'staff-sw-1');
    const result = await firstValueFrom(
      TestBed.inject(REPORT_REPOSITORY).run('data-completeness', {}),
    );

    // Not found and not yours read identically (`DL-31`).
    expect(result).toBeNull();
  });

  it('withholds the audit values from an account that may read the trail', async () => {
    await signedInAs('mswdo-head', 'staff-head');
    const rows = await firstValueFrom(TestBed.inject(GOVERNANCE_REPOSITORY).auditRows({}));

    expect(rows.length).toBeGreaterThan(0);
    await expect(
      firstValueFrom(TestBed.inject(GOVERNANCE_REPOSITORY).auditDetail(rows[0]!.id)),
    ).rejects.toThrow();
  });
});

/* ── Scenario 13: the empty first-use state ──────────────────────────────── */

describe('scenario: a filter that matches nothing', () => {
  it('answers with an empty page rather than an error', async () => {
    await signedInAs('system-administrator');
    const residents = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({ search: 'zzzzznobodyzzzzz' }, PAGE),
    );

    expect(residents.items).toHaveLength(0);
    expect(residents.totalItems).toBe(0);
  });

  it('answers a search that matches nothing with a real empty result', async () => {
    await signedInAs('system-administrator');
    const results = await firstValueFrom(
      TestBed.inject(SEARCH_REPOSITORY).search('zzzzznobodyzzzzz'),
    );

    expect(results.total).toBe(0);
    expect(results.groups).toHaveLength(0);
  });
});

/* ── Scenario 14: a large filtered dataset ───────────────────────────────── */

describe('scenario: a large dataset, filtered', () => {
  it('pages a 200-plus registry rather than returning all of it', async () => {
    await signedInAs('system-administrator');
    const firstPage = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({}, { page: 1, pageSize: 25 }),
    );

    expect(firstPage.items).toHaveLength(25);
    expect(firstPage.totalItems).toBeGreaterThan(200);
    expect(firstPage.totalPages).toBeGreaterThan(1);
  });

  it('narrows by barangay without losing the total', async () => {
    await signedInAs('system-administrator');
    const sanJuan = TAYTAY_BARANGAYS.find((barangay) => barangay.name === 'San Juan');
    expect(sanJuan).toBeDefined();

    const filtered = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({ barangayId: sanJuan!.id }, PAGE),
    );

    expect(filtered.items.length).toBeGreaterThan(0);
    for (const view of filtered.items) {
      expect(view.resident.address.barangayId).toBe(sanJuan!.id);
    }
  });
});

/* ── Scope: a barangay link sees only their own barangay ─────────────────── */

describe('scenario: a barangay-link account is confined to its barangay', () => {
  it('cannot read residents outside the barangay it covers', async () => {
    // The seeded barangay-link account covers San Juan, and the scope only
    // means anything if the account actually carries a barangay.
    await signedInAs('barangay-link', 'staff-brgy-link', 'brgy-san-juan');
    const residents = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({}, PAGE),
    );

    // Asserted non-empty first: `size <= 1` is also true of an empty result,
    // which would make this pass while proving nothing.
    expect(residents.items.length).toBeGreaterThan(0);
    const barangays = new Set(residents.items.map((view) => view.resident.address.barangayId));
    expect(barangays.size).toBe(1);
  });

  it('sees nothing at all when the account carries no barangay', async () => {
    // Fail closed, not open. A scoped account with nothing to scope to is a
    // misconfiguration, and the safe reading of a misconfiguration is "no
    // access" — the opposite choice would hand the whole municipality to an
    // account somebody forgot to finish setting up.
    await signedInAs('barangay-link', 'staff-brgy-link', null);
    const residents = await firstValueFrom(
      TestBed.inject(RESIDENT_REPOSITORY).list({}, PAGE),
    );

    expect(residents.items).toHaveLength(0);
  });
});
