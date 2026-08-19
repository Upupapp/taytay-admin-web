import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

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
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { DASHBOARD_COPY } from './dashboard.copy';
import { attentionDrillDown, statusDrillDown } from './dashboard-drill-down';
import { DashboardPage, readFilter } from './dashboard-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
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

async function setUp(
  role: StaffRole | null = 'mswdo-head',
  barangayId: BarangayId | null = null,
  url = '/dashboard',
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
      { provide: DASHBOARD_REPOSITORY, useClass: MockDashboardRepository },
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
  ): AttentionSignal => ({ kind, severity, count, permission: 'request.view' });

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
