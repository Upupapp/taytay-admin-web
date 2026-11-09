import { Component, Injectable } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, map, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockDashboardRepository } from '@data/mock/mock-dashboard.repository';
import {
  ACCESS_CONTEXT,
  asId,
  DASHBOARD_REPOSITORY,
  emptyPage,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  sortAttention,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AttentionSignal,
  type AuthenticatedUser,
  type BarangayId,
  type DashboardFilter,
  type DashboardSummary,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { DASHBOARD_COPY } from './dashboard.copy';
import {
  attentionDrillDown,
  RECORD_REQUEST,
  SCHEDULE_PAYOUTS,
  statusDrillDown,
} from './dashboard-drill-down';
// The figures and the lists they open are checked against each other: a spec is where the two meet.
import { readRequestQuery } from '@features/requests/request-list-page';
import { readReleaseQuery } from '@features/releases/release-list-page';
import { DashboardPage, readFilter } from './dashboard-page';

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

function staffUser(role: StaffRole, barangayId: BarangayId | null = null): StaffUser {
  return {
    id: asId<StaffUserId>('staff-test'),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId,
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

function repository(user: StaffUser | null): StaffRepository {
  const authenticated = user ? toAuthenticatedUser(user) : null;
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated as AuthenticatedUser }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated as AuthenticatedUser),
    signOut: (): Observable<void> => of(undefined),
  };
}

@Component({ template: 'stub' })
class StubPage {}

/**
 * The dry run's payouts (2026-11-09): ₱3,000.50 to one person and a release of goods to another,
 * both under one programme type.
 */
@Injectable()
class CentavoDashboardRepository extends MockDashboardRepository {
  override summary(filter: DashboardFilter): Observable<DashboardSummary> {
    return super.summary(filter).pipe(
      map((summary) => ({
        ...summary,
        payouts:
          summary.payouts === null
            ? null
            : {
                ...summary.payouts,
                residentsServedInPeriod: 2,
                disbursedInPeriod: { centavos: 300_050, currency: 'PHP' as const },
                goodsReleasedInPeriod: 1,
                disbursedByCategory: [
                  {
                    category: 'medical-assistance' as const,
                    amount: { centavos: 300_050, currency: 'PHP' as const },
                    count: 1,
                    goodsCount: 1,
                  },
                ],
              },
      })),
    );
  }
}

async function setUp(
  role: StaffRole | null = 'mswdo-head',
  barangayId: BarangayId | null = null,
  url = '/dashboard',
  dashboard: typeof MockDashboardRepository = MockDashboardRepository,
): Promise<ComponentFixture<DashboardPage>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'dashboard', component: DashboardPage },
        { path: 'assistance-requests', component: StubPage },
        { path: 'releases', component: StubPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      {
        provide: STAFF_REPOSITORY,
        useValue: repository(role ? staffUser(role, barangayId) : null),
      },
      { provide: DASHBOARD_REPOSITORY, useClass: dashboard },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(DashboardPage);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<DashboardPage>) => fixture.nativeElement as HTMLElement;

/* ── "what needs attention now?" ──────────────────────────────────────────── */

describe('the dashboard answers "what needs attention now?" first', () => {
  it('puts the attention list before the analytics', async () => {
    const element = html(await setUp('mswdo-head'));
    const body = element.innerHTML;
    const attentionAt = body.indexOf('attention-heading');
    const panelsAt = body.indexOf('class="panels"');
    expect(attentionAt).toBeGreaterThan(-1);
    expect(panelsAt).toBeGreaterThan(-1);
    expect(attentionAt).toBeLessThan(panelsAt);
  });

  it('names an action rather than a status code', async () => {
    // "3 requests waiting for approval", not "3 endorsed".
    const element = html(await setUp('mswdo-head'));
    expect(element.querySelector('.attention__list')?.textContent).toContain(
      'waiting for approval',
    );
  });

  it('gives every signal a drill-down into the records it counted', async () => {
    const element = html(await setUp('mswdo-head'));
    const actions = Array.from(element.querySelectorAll<HTMLAnchorElement>('.attention__action'));
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) {
      expect(action.getAttribute('href')).toBeTruthy();
    }
  });

  it('states severity in words, not by colour alone', async () => {
    const element = html(await setUp('mswdo-head'));
    const severities = Array.from(element.querySelectorAll('.attention__severity')).map((n) =>
      n.textContent?.trim(),
    );
    expect(severities.length).toBeGreaterThan(0);
    for (const label of severities) {
      expect(Object.values(DASHBOARD_COPY.severityLabel)).toContain(label);
    }
  });

  it('shows a signal only to someone who can act on it', async () => {
    // An intake officer cannot approve or release, so those signals are not
    // their to-do list.
    const intake = html(await setUp('intake-officer'));
    const text = intake.querySelector('.attention')?.textContent ?? '';
    expect(text).not.toContain('waiting for approval');
    expect(text).not.toContain('not yet released');
  });

  it('explains an empty list caused by role rather than by calm', async () => {
    // The auditor is read-only: nothing is theirs to action, but work exists.
    const element = html(await setUp('auditor'));
    expect(element.querySelector('.attention__clear-body')?.textContent).toContain(
      DASHBOARD_COPY.attentionNothingForRole,
    );
  });
});

describe('sortAttention', () => {
  const signal = (
    kind: AttentionSignal['kind'],
    severity: AttentionSignal['severity'],
    count: number,
  ): AttentionSignal => ({ kind, severity, count, permission: 'request.view', basis: 'A test.' });

  it('puts critical before warning before info', async () => {
    const sorted = sortAttention([
      signal('referral-unanswered', 'info', 99),
      signal('returned-to-applicant', 'warning', 1),
      signal('awaiting-approval', 'critical', 1),
    ]);
    expect(sorted.map((s) => s.severity)).toEqual(['critical', 'warning', 'info']);
  });

  it('breaks ties by size, so the biggest pile is first', async () => {
    const sorted = sortAttention([
      signal('returned-to-applicant', 'warning', 2),
      signal('unclaimed-payout', 'warning', 9),
    ]);
    expect(sorted.map((s) => s.count)).toEqual([9, 2]);
  });
});

/* ── metrics trace to records ─────────────────────────────────────────────── */

describe('every metric traces back to filtered records', () => {
  it('makes each headline figure a link', async () => {
    const element = html(await setUp('mswdo-head'));
    const metrics = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.metric'));
    expect(metrics).toHaveLength(4);
    for (const metric of metrics) {
      expect(metric.getAttribute('href')).toBeTruthy();
    }
  });

  it('carries the dashboard filter into the drill-down', async () => {
    // This is the property that stops a number and its records disagreeing.
    const element = html(await setUp('mswdo-head', null, '/dashboard?barangay=brgy-dolores'));
    const metric = element.querySelector<HTMLAnchorElement>('a.metric');
    expect(metric?.getAttribute('href')).toContain('barangay=brgy-dolores');
  });

  it('sends the awaiting-approval figure to exactly the endorsed requests', async () => {
    const drill = statusDrillDown({ barangayId: SAN_JUAN }, 'endorsed');
    expect(drill.route).toBe('/assistance-requests');
    expect(drill.queryParams).toEqual({ barangay: SAN_JUAN, status: 'endorsed' });
  });

  it('routes each attention kind to the records it counted', async () => {
    expect(attentionDrillDown('awaiting-approval', {}).queryParams).toEqual({ status: 'endorsed' });
    expect(attentionDrillDown('returned-to-applicant', {}).queryParams).toEqual({
      status: 'returned',
    });
    expect(attentionDrillDown('payout-due', {}).route).toBe('/releases');
    expect(attentionDrillDown('unclaimed-payout', {}).queryParams).toEqual({
      status: 'unclaimed',
    });
    expect(attentionDrillDown('referral-unanswered', {}).route).toBe('/referrals');
  });

  it('opens each figure with the keys its list reads (DL-185)', async () => {
    const reader = (params: Readonly<Record<string, string>>) => ({
      get: (name: string) => params[name] ?? null,
    });
    const element = html(await setUp('mswdo-head', null, '/dashboard?barangay=brgy-dolores'));
    const open = element.querySelector<HTMLAnchorElement>('a.metric[href^="/assistance-requests"]');
    const href = new URL(open?.getAttribute('href') ?? '', 'http://console.test');
    const query = readRequestQuery({ get: (name) => href.searchParams.get(name) });
    // `open`, the list's own key — the figure used to send `openOnly`, which nothing read.
    expect(query.filter).toEqual({ openOnly: true, barangayId: 'brgy-dolores' });

    // Applied now, not merely named: the API reads both (`DL-186`).
    const missing = attentionDrillDown('missing-requirements', {});
    expect(readRequestQuery(reader(missing.queryParams)).filter).toEqual({
      openOnly: true,
      owingDocument: true,
    });

    const due = attentionDrillDown('payout-due', { barangayId: SAN_JUAN });
    expect(readReleaseQuery(reader(due.queryParams)).filter).toEqual({
      status: 'scheduled',
      barangayId: SAN_JUAN,
    });
  });

  it('opens the released figure as everything handed over in the period, not only "released" (DL-186)', async () => {
    const element = html(
      await setUp('mswdo-head', null, '/dashboard?period=last-90-days&category=medical-assistance'),
    );
    const disbursed = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('a.metric[href^="/releases"]'),
    ).find((link) => link.textContent?.includes(DASHBOARD_COPY.disbursed));
    const href = new URL(disbursed?.getAttribute('href') ?? '', 'http://console.test');
    expect(readReleaseQuery({ get: (name) => href.searchParams.get(name) }).filter).toEqual({
      statusGroup: 'handed-over',
      period: 'last-90-days',
      category: 'medical-assistance',
    });
  });

  it('states the rule each signal counted by, as the counter gave it (DL-98)', async () => {
    const element = html(await setUp('mswdo-head'));
    const bases = Array.from(element.querySelectorAll('.attention__basis')).map(
      (node) => node.textContent?.trim() ?? '',
    );
    expect(bases.length).toBeGreaterThan(0);
    for (const basis of bases) {
      expect(basis.startsWith(DASHBOARD_COPY.attentionBasis)).toBe(true);
      expect(basis.length).toBeGreaterThan(DASHBOARD_COPY.attentionBasis.length + 10);
    }
  });

  it('makes every breakdown row a drill-down too', async () => {
    const element = html(await setUp('mswdo-head'));
    const rows = element.querySelectorAll('.chart__link');
    expect(rows.length).toBeGreaterThan(0);
  });
});

/* ── filter state ─────────────────────────────────────────────────────────── */

describe('drill-down filter state lives in the URL', () => {
  it('reads a valid filter from query params', () => {
    const params = new Map([
      ['barangay', 'brgy-san-juan'],
      ['category', 'medical-assistance'],
      ['period', 'last-30-days'],
    ]);
    expect(readFilter({ get: (n) => params.get(n) ?? null })).toEqual({
      barangayId: 'brgy-san-juan',
      category: 'medical-assistance',
      period: 'last-30-days',
    });
  });

  it('degrades junk to no filter rather than throwing or guessing', async () => {
    const params = new Map([
      ['barangay', 'brgy-nowhere'],
      ['category', 'not-a-category'],
      ['period', 'yesterday'],
    ]);
    expect(readFilter({ get: (n) => params.get(n) ?? null })).toEqual({});
  });

  it('treats absent params as no filter', () => {
    expect(readFilter({ get: () => null })).toEqual({});
  });

  it('offers a clear control only when something is filtered', async () => {
    const plain = html(await setUp('mswdo-head'));
    expect(plain.textContent).not.toContain(DASHBOARD_COPY.clearFilter);

    const filtered = html(await setUp('mswdo-head', null, '/dashboard?barangay=brgy-dolores'));
    expect(filtered.textContent).toContain(DASHBOARD_COPY.clearFilter);
    expect(filtered.textContent).toContain(DASHBOARD_COPY.filterAppliedNotice);
  });

  it('recomputes the figures when the filter changes', async () => {
    const all = html(await setUp('mswdo-head'));
    const allOpen = all.querySelector('.metric__value')?.textContent?.trim();

    const dolores = html(await setUp('mswdo-head', null, '/dashboard?barangay=brgy-dolores'));
    const doloresOpen = dolores.querySelector('.metric__value')?.textContent?.trim();

    expect(allOpen).not.toEqual(doloresOpen);
  });
});

/* ── quick actions and access ─────────────────────────────────────────────── */

describe('quick actions respect permission', () => {
  it('offers recording a request to an intake officer', async () => {
    const element = html(await setUp('intake-officer'));
    expect(element.querySelector('.quick__actions')?.textContent).toContain(
      DASHBOARD_COPY.recordRequest,
    );
  });

  it('does not offer payout scheduling to someone who cannot schedule', async () => {
    const element = html(await setUp('intake-officer'));
    expect(element.querySelector('.quick__actions')?.textContent).not.toContain(
      DASHBOARD_COPY.schedulePayouts,
    );
  });

  it('sends "Record a request" to the intake form and "Schedule payouts" to what awaits a session (DL-185)', () => {
    expect(RECORD_REQUEST).toEqual({ route: '/assistance-requests/new', queryParams: {} });
    // `pending` was renamed `for-release` in TAB 17; the old word filtered nothing.
    expect(SCHEDULE_PAYOUTS.route).toBe('/releases');
    expect(readReleaseQuery({ get: (name) => SCHEDULE_PAYOUTS.queryParams[name] ?? null }).filter).toEqual({
      status: 'for-release',
    });
  });

  it('offers payout scheduling to the disbursing officer', async () => {
    const element = html(await setUp('release-officer'));
    expect(element.querySelector('.quick__actions')?.textContent).toContain(
      DASHBOARD_COPY.schedulePayouts,
    );
  });
});

describe('dashboard data is access-controlled like every other repository', () => {
  function repo(user: AuthenticatedUser | null): MockDashboardRepository {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
        { provide: ACCESS_CONTEXT, useValue: { currentUser: () => user } },
        MockDashboardRepository,
      ],
    });
    return TestBed.inject(MockDashboardRepository);
  }

  function authenticated(role: StaffRole, barangayId: BarangayId | null = null): AuthenticatedUser {
    const definition = ROLE_DEFINITIONS[role];
    return {
      id: asId<StaffUserId>('staff-x'),
      displayName: 'Test',
      email: 'test@example.gov.ph',
      role,
      roleLabel: definition.label,
      position: 'Tester',
      barangayId,
      scope: definition.scope,
      permissions: new Set(definition.permissions),
    };
  }

  it('refuses an anonymous caller', async () => {
    // Aggregate counts are still information about residents. Before TAB 06
    // this repository had no check at all.
    await expect(firstValueFrom(repo(null).summary({}))).rejects.toThrow(PermissionDeniedError);
  });

  it('confines a barangay link to their own barangay figures', async () => {
    const scoped = await firstValueFrom(repo(authenticated('barangay-link', SAN_JUAN)).summary({}));
    const wide = await firstValueFrom(repo(authenticated('mswdo-head')).summary({}));

    expect(scoped.requestsByBarangay.every((row) => row.barangayId === SAN_JUAN)).toBe(true);
    expect(wide.requestsByBarangay.length).toBeGreaterThan(scoped.requestsByBarangay.length);
  });

  it('echoes the applied filter so the view can prove what produced the numbers', async () => {
    const summary = await firstValueFrom(
      repo(authenticated('mswdo-head')).summary({ barangayId: SAN_JUAN }),
    );
    expect(summary.appliedFilter).toEqual({ barangayId: SAN_JUAN });
    expect(summary.requestsByBarangay.every((row) => row.barangayId === SAN_JUAN)).toBe(true);
  });

  it('keeps the headline count and the status breakdown in agreement', async () => {
    // If these ever diverge, the dashboard is lying about its own data.
    const summary = await firstValueFrom(repo(authenticated('mswdo-head')).summary({}));
    const endorsed = summary.requestsByStatus.find((row) => row.status === 'endorsed')?.count ?? 0;
    expect(summary.awaitingApproval).toBe(endorsed);
  });

  it('omits zero-count signals instead of showing a wall of noughts', async () => {
    const summary = await firstValueFrom(repo(authenticated('mswdo-head')).summary({}));
    for (const signal of summary.attention) {
      expect(signal.count).toBeGreaterThan(0);
    }
  });
});

/* ── what a reader's lists would refuse is absent, not zero (DL-182) ─────── */

describe('payouts and the residents’ app are absent for a reader who cannot open them', () => {
  function repo(role: StaffRole, barangayId: BarangayId | null = null): MockDashboardRepository {
    const definition = ROLE_DEFINITIONS[role];
    const user: AuthenticatedUser = {
      id: asId<StaffUserId>('staff-x'),
      displayName: 'Test',
      email: 'test@example.gov.ph',
      role,
      roleLabel: definition.label,
      position: 'Tester',
      barangayId,
      scope: definition.scope,
      permissions: new Set(definition.permissions),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
        { provide: ACCESS_CONTEXT, useValue: { currentUser: () => user } },
        MockDashboardRepository,
      ],
    });
    return TestBed.inject(MockDashboardRepository);
  }

  it('gives payout figures only to a reader of the release list', async () => {
    for (const role of ['intake-officer', 'social-worker', 'barangay-link'] as const) {
      const summary = await firstValueFrom(repo(role, SAN_JUAN).summary({}));
      expect(summary.payouts, role).toBeNull();
      expect(
        summary.attention.some((s) => s.kind === 'payout-due'),
        role,
      ).toBe(false);
    }
    for (const role of ['mswdo-head', 'release-officer', 'auditor'] as const) {
      expect((await firstValueFrom(repo(role).summary({}))).payouts, role).not.toBeNull();
    }
  });

  it('sums money only, and counts goods beside it (DL-93)', async () => {
    const payouts = (await firstValueFrom(repo('mswdo-head').summary({}))).payouts;
    expect(payouts?.goodsReleasedInPeriod).toBeGreaterThan(0);
    expect(Number.isInteger(payouts?.disbursedInPeriod.centavos)).toBe(true);
    const goodsRows = payouts?.disbursedByCategory.filter((row) => row.goodsCount > 0) ?? [];
    expect(goodsRows.length).toBeGreaterThan(0);
  });

  it('counts a caseload’s own requests and nothing else', async () => {
    const caseload = await firstValueFrom(repo('social-worker').summary({}));
    const office = await firstValueFrom(repo('mswdo-head').summary({}));
    expect(caseload.openRequests).toBeLessThan(office.openRequests);
  });

  it('gives the residents’ app only to whoever holds its keys', async () => {
    expect((await firstValueFrom(repo('mswdo-head').summary({}))).residentApp).toBeNull();
    const app = (await firstValueFrom(repo('system-administrator').summary({}))).residentApp;
    expect(app?.accounts?.registered).toBeGreaterThan(0);
    expect(app?.verificationsWaiting).toBeGreaterThan(0);
    expect(app?.digitalIdsActive).not.toBeNull();
    const accounts = app?.accounts;
    if (accounts) {
      const { unverified, pending, verified, rejected } = accounts.byVerification;
      expect(unverified + pending + verified + rejected).toBe(accounts.registered);
    }
  });

  it('says payout figures are not shown, rather than showing zeroes or a link that bounces', async () => {
    const element = html(await setUp('intake-officer'));
    expect(element.querySelector('.metrics')?.textContent).toContain(
      DASHBOARD_COPY.payoutsNotShown,
    );
    expect(element.textContent).not.toContain(DASHBOARD_COPY.scheduledPayouts);
    expect(element.querySelector('a.metric[href^="/releases"]')).toBeNull();
    expect(element.querySelector('.app-figures')).toBeNull();
  });

  it('shows the administrator the app, each figure a link to the list it counts', async () => {
    const element = html(await setUp('system-administrator'));
    const section = element.querySelector('.app-figures');
    expect(section?.textContent).toContain(DASHBOARD_COPY.residentAppNotice);
    const links = Array.from(section?.querySelectorAll<HTMLAnchorElement>('a.metric') ?? []).map(
      (link) => link.getAttribute('href'),
    );
    expect(links).toEqual(['/users', '/verification', '/digital-ids']);
    expect(section?.querySelector('table')).not.toBeNull();
  });

  it('opens each verification row as the accounts with that status, which it counted (DL-186)', async () => {
    const element = html(await setUp('system-administrator'));
    const rows = Array.from(element.querySelectorAll<HTMLAnchorElement>('.app-figures table a'));
    for (const status of ['unverified', 'pending', 'verified', 'rejected'] as const) {
      const row = rows.find((link) =>
        link.textContent?.includes(DASHBOARD_COPY.verificationStatus[status]),
      );
      expect(row?.getAttribute('href'), status).toBe(`/users?verification=${status}`);
    }
    // The review queue keeps its own figure, which counts reviews rather than accounts.
    expect(
      element.querySelector<HTMLAnchorElement>('.app-figures a.metric[href="/verification"]'),
    ).not.toBeNull();
  });
});

/* ── Money said as money, goods as a count (dry run 2026-11-09, defects 7 and 8) ── */

describe('the released figures', () => {
  it('says a programme type’s amount to the centavo, as the one peso formatter does', async () => {
    const element = html(await setUp('mswdo-head', null, '/dashboard', CentavoDashboardRepository));
    const text = element.textContent ?? '';

    // It used to read ₱3,001, from a formatter of its own that dropped the centavos (rule 6).
    expect(text).toContain('₱3,000.50 and 1 release of goods');
    expect(text).not.toContain('₱3,001');
  });

  it('does not count a goods recipient among the people the money went to (DL-93)', async () => {
    const element = html(await setUp('mswdo-head', null, '/dashboard', CentavoDashboardRepository));
    const released = [...element.querySelectorAll('a.metric')].find((link) =>
      link.textContent?.includes(DASHBOARD_COPY.disbursed),
    );

    expect(released?.textContent).toContain('₱3,000.50');
    expect(released?.textContent).toContain('Money or goods to 2 beneficiaries.');
    expect(released?.textContent).toContain(
      'The amount is money only; 1 release of goods is counted, not valued.',
    );
    expect(released?.textContent).not.toContain('Across 2 beneficiaries');
  });

  it('keeps the plain sentence when every release was money', () => {
    expect(DASHBOARD_COPY.disbursedHint(1, 0)).toBe('Across 1 beneficiary.');
    expect(DASHBOARD_COPY.disbursedHint(3, 0)).toBe('Across 3 beneficiaries.');
  });
});
