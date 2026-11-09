import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, Injectable, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, map, of, type Observable } from 'rxjs';
import { afterEach, beforeEach, vi } from 'vitest';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { httpErrorInterceptor } from '@core/http/api.interceptors';
import { NotificationStore } from '@core/notifications/notification.store';
import { HttpReportRepository } from '@data/http/http-repositories';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockReportRepository } from '@data/mock/mock-report.repository';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  REPORT_REPOSITORY,
  STAFF_REPOSITORY,
  SMALL_CELL_THRESHOLD,
  WITHHELD_DISPLAY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { ReportHubPage } from './report-hub-page';
import { ReportViewPage } from './report-view-page';
import { REPORTS_COPY } from './reports.copy';

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

function staffUser(role: StaffRole, id = 'staff-head'): StaffUser {
  return {
    id: asId<StaffUserId>(id),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId: null,
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

@Component({ template: 'stub' })
class StubPage {}

async function configure(
  role: StaffRole,
  id = 'staff-head',
  reports: Type<unknown> = MockReportRepository,
): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'reports', component: ReportHubPage },
        { path: 'reports/:id', component: ReportViewPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, id)) },
      { provide: REPORT_REPOSITORY, useClass: reports },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openHub(role: StaffRole = 'mswdo-head'): Promise<ComponentFixture<ReportHubPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl('/reports');
  const fixture = TestBed.createComponent(ReportHubPage);
  await fixture.whenStable();
  return fixture;
}

async function openReport(
  id: string,
  role: StaffRole = 'mswdo-head',
  reports: Type<unknown> = MockReportRepository,
): Promise<ComponentFixture<ReportViewPage>> {
  await configure(role, 'staff-head', reports);
  await TestBed.inject(Router).navigateByUrl(`/reports/${id}`);
  const fixture = TestBed.createComponent(ReportViewPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── Criterion: aggregate analytics without exposing names by default ─────── */

describe('the reports hub', () => {
  it('says up front that figures are counts, and small ones are withheld', async () => {
    const element = html(await openHub());

    expect(element.querySelector('.hub__notice')?.textContent).toContain(
      'withheld rather than shown',
    );
  });

  it('flags the one report that names people, before it is opened', async () => {
    const element = html(await openHub());
    const flags = [...element.querySelectorAll('.report-card__names')];

    expect(flags).toHaveLength(1);
    expect(flags[0]?.textContent).toContain('Names people');
  });

  it('states the question each report answers, not only its title', async () => {
    const element = html(await openHub());
    const questions = [...element.querySelectorAll('.report-card__question')];

    expect(questions.length).toBeGreaterThan(10);
    for (const question of questions) {
      expect((question.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('hides a report the account cannot open', async () => {
    // An intake officer holds no `report.view`, so the catalogue is refused
    // outright rather than shown empty.
    const element = html(await openHub('intake-officer'));

    expect(element.querySelectorAll('.report-card')).toHaveLength(0);
  });

  it('keeps staff workload out of a caseworker’s hub', async () => {
    const element = html(await openHub('social-worker'));

    // The hub is populated — this is a filter, not an empty screen passing by
    // accident. Staff workload sits behind `staff.view`, which a caseworker
    // does not hold.
    expect(element.querySelectorAll('.report-card').length).toBeGreaterThan(5);
    expect(element.textContent).not.toContain('Staff workload');
  });
});

/* ── Criterion: chart claims are verifiable from tabular data ─────────────── */

describe('how a report renders', () => {
  it('renders every series as a real table, not a picture', async () => {
    const element = html(await openReport('caseload'));
    const table = element.querySelector('table.chart');

    expect(table).not.toBeNull();
    expect(table?.querySelector('caption')).not.toBeNull();
    expect(table?.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('gives every table a summary sentence a screen reader can read', async () => {
    const element = html(await openReport('caseload'));
    const summary = element.querySelector('.chart__summary');

    expect((summary?.textContent ?? '').length).toBeGreaterThan(0);
    expect(summary?.textContent).toContain('in total');
  });

  it('makes the bar decorative, so nothing is carried by colour alone', async () => {
    const element = html(await openReport('caseload'));
    const bar = element.querySelector('.chart__bar');

    expect(bar?.getAttribute('aria-hidden')).toBe('true');
  });

  it('states what the report covers, and when it was generated', async () => {
    const element = html(await openReport('caseload'));

    expect(element.querySelector('.report__coverage')?.textContent).toContain('All time');
    expect(element.textContent).toContain('Generated');
  });
});

/* ── Criterion: a caution sits above the numbers, not under them ──────────── */

describe('reports that invite a wrong reading', () => {
  it('warns on staff workload that it is not a productivity measure', async () => {
    const fixture = await openReport('staff-workload', 'mswdo-head');
    const caution = html(fixture).querySelector('.report__caution');

    expect(caution?.textContent).toContain('not a productivity measure');
  });

  it('orders staff workload alphabetically, not by volume', async () => {
    const fixture = await openReport('staff-workload', 'mswdo-head');
    const labels = [...html(fixture).querySelectorAll('.chart__label, .chart__link')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    // Sorting by count is what turns a workload table into a league table,
    // whatever the heading says.
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  it('says case aging is waiting time rather than lateness', async () => {
    const element = html(await openReport('case-aging'));

    expect(element.querySelector('.report__caution')?.textContent).toContain(
      'no service standard',
    );
  });
});

/* ── Criterion: small cells are withheld, and said to be withheld ─────────── */

describe('withheld figures', () => {
  it('labels a withheld cell rather than showing a zero or a blank', async () => {
    const fixture = await openReport('service-reach');
    const page = fixture.componentInstance as unknown as {
      result: () => {
        readonly series: readonly {
          readonly rows: readonly { readonly isWithheld?: boolean; readonly display?: string }[];
        }[];
      } | null;
    };
    const rows = page.result()?.series.flatMap((series) => series.rows) ?? [];
    const withheld = rows.filter((row) => row.isWithheld === true);

    expect(withheld.length).toBeGreaterThan(0);
    for (const row of withheld) {
      expect(row.display).toBe(WITHHELD_DISPLAY);
    }
  });

  it('never withholds a zero, because an absence of service is the finding', async () => {
    const fixture = await openReport('service-reach');
    const page = fixture.componentInstance as unknown as {
      result: () => {
        readonly series: readonly {
          readonly rows: readonly { readonly value: number; readonly isWithheld?: boolean }[];
        }[];
      } | null;
    };
    const rows = page.result()?.series.flatMap((series) => series.rows) ?? [];

    for (const row of rows) {
      if (row.isWithheld === true) {
        continue;
      }
      expect(row.value === 0 || row.value >= SMALL_CELL_THRESHOLD).toBe(true);
    }
  });

  it('says on screen that the column will not add up', async () => {
    const element = html(await openReport('service-reach'));
    const notice = element.querySelector('.series__withheld');

    expect(notice?.textContent).toContain('withheld');
    expect(notice?.textContent).toContain('does not add up');
  });

  it('reports the true total, and says it was counted before suppression', async () => {
    const element = html(await openReport('service-reach'));

    expect(element.querySelector('.series__total-hint')?.textContent).toContain(
      'before anything was withheld',
    );
  });

  it('states why figures are withheld, and admits the threshold is unconfirmed', async () => {
    const element = html(await openReport('service-reach'));

    expect(element.querySelector('.disclosure__basis')?.textContent).toContain(
      'has not yet confirmed',
    );
  });
});

/* ── Criterion: exports are permission-aware and warn before naming people ── */

describe('exporting', () => {
  it('offers an export to somebody who may export', async () => {
    const element = html(await openReport('caseload', 'mswdo-head'));

    expect(element.querySelector('.export__denied')).toBeNull();
    expect(element.textContent).toContain('Download as CSV');
  });

  it('says plainly when an account may read but not export', async () => {
    const element = html(await openReport('caseload', 'social-worker'));

    expect(element.querySelector('.export__denied')?.textContent).toContain('cannot export it');
  });

  it('warns before exporting a report that names people, not after', async () => {
    const fixture = await openReport('data-completeness', 'mswdo-head');
    const page = fixture.componentInstance as unknown as {
      result: () => unknown;
      requestExport: (result: unknown) => void;
      awaitingConfirmation: () => boolean;
    };

    page.requestExport(page.result());
    fixture.detectChanges();

    expect(page.awaitingConfirmation()).toBe(true);
    expect(html(fixture).querySelector('.export__warning')?.textContent).toContain(
      'nothing can be recalled',
    );
  });

  it('does not warn for an aggregate report', async () => {
    const fixture = await openReport('caseload', 'mswdo-head');
    const page = fixture.componentInstance as unknown as {
      result: () => unknown;
      requestExport: (result: unknown) => void;
      awaitingConfirmation: () => boolean;
    };

    page.requestExport(page.result());
    fixture.detectChanges();

    expect(page.awaitingConfirmation()).toBe(false);
  });

  it('puts the filter and the generation details inside the file', async () => {
    await configure('mswdo-head');
    const file = await firstValueFrom(
      TestBed.inject(REPORT_REPOSITORY).export('caseload', { period: 'last-30-days' }, 'csv'),
    );

    // A spreadsheet on somebody's desktop in six months has no screen around it.
    expect(file.content).toContain('Social welfare caseload');
    expect(file.content).toContain('Last 30 days');
    expect(file.content).toContain('Generated by');
    expect(file.content).toContain('RA 10173');
    expect(file.filename).toContain('caseload');
  });

  it('marks a person-level export as naming individuals, in the file', async () => {
    await configure('mswdo-head');
    const file = await firstValueFrom(
      TestBed.inject(REPORT_REPOSITORY).export('data-completeness', {}, 'csv'),
    );

    expect(file.content).toContain('Names individuals,"Yes"');
    expect(file.manifest.includesPersonLevel).toBe(true);
  });

  it('refuses an export to an account without the permission', async () => {
    await configure('social-worker', 'staff-sw-1');

    await expect(
      firstValueFrom(TestBed.inject(REPORT_REPOSITORY).export('caseload', {}, 'csv')),
    ).rejects.toThrow();
  });
});

/* ── The person-level report is gated at the adapter, not only the screen ── */

describe('the report that names people', () => {
  it('is refused to an account that cannot export', async () => {
    await configure('social-worker', 'staff-sw-1');
    const result = await firstValueFrom(
      TestBed.inject(REPORT_REPOSITORY).run('data-completeness', {}),
    );

    // Not found and not yours read identically.
    expect(result).toBeNull();
  });

  it('names residents for an account that may see it', async () => {
    const fixture = await openReport('data-completeness', 'mswdo-head');
    const element = html(fixture);

    expect(element.querySelector('.report__names')?.textContent).toContain(
      'This report names people',
    );
    expect(element.querySelectorAll('.chart__link').length).toBeGreaterThan(0);
  });
});

/* ── What a report cannot count, and the file it hands over (DL-190) ─────── */

/** The mock's figures, with a sentence about what the records cannot give. */
@Injectable()
class LimitedReports extends MockReportRepository {
  override run(...args: Parameters<MockReportRepository['run']>) {
    return super
      .run(...args)
      .pipe(
        map((result) =>
          result === null ? null : { ...result, limits: ['Programme membership is not recorded.'] },
        ),
      );
  }
}

describe('what a report cannot count, and the file it hands over (DL-190)', () => {
  const made: string[] = [];
  const revoked: string[] = [];

  beforeEach(() => {
    made.length = 0;
    revoked.length = 0;
    // jsdom has no object URLs; these stand in and record what the screen makes and gives back.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => {
        const url = `blob:test/${made.length + 1}`;
        made.push(url);
        return url;
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((url: string) => revoked.push(url)),
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('says what the records cannot give, rather than showing it as a zero', async () => {
    const element = html(await openReport('program-utilisation', 'mswdo-head', LimitedReports));

    expect(element.querySelector('#limits-heading')?.textContent).toContain(
      'What this report cannot count',
    );
    expect(element.querySelector('.limits__list')?.textContent).toContain(
      'Programme membership is not recorded.',
    );
  });

  it('says nothing about limits when a report counts everything it asks about', async () => {
    expect(html(await openReport('caseload')).querySelector('.limits')).toBeNull();
  });

  it('offers the composed file to save, by its name, and gives the address back on leaving', async () => {
    const fixture = await openReport('caseload', 'mswdo-head');
    const page = fixture.componentInstance as unknown as {
      result: () => unknown;
      requestExport: (result: unknown) => void;
    };

    page.requestExport(page.result());
    await fixture.whenStable();
    fixture.detectChanges();

    const link = html(fixture).querySelector<HTMLAnchorElement>('.export__ready a');
    expect(link?.getAttribute('href')).toBe('blob:test/1');
    expect(link?.getAttribute('download')).toMatch(/^caseload-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(link?.textContent).toContain('Save caseload-');

    fixture.destroy();
    expect(revoked).toEqual(['blob:test/1']);
  });
});

/**
 * Dry run 2026-11-09, defect 4 (RPT-01): a social worker typing /reports/release-status was shown
 * "Could not load this section" and a "Request failed" notice. The API answers a report the reader
 * may not open as not found (`DL-31`), the interceptor rethrew its own failure, and the adapter
 * looked for the raw response it replaces — so the report never became the `null` this page turns
 * into its own message. Run through the real interceptor and the real adapter.
 */
describe('a report the API does not offer this reader (DL-196)', () => {
  it('says it is not available, with no notice and no navigation', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'reports/:id', component: ReportViewPage },
          { path: '**', component: StubPage },
        ]),
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
        { provide: ACCESS_CONTEXT, useExisting: SessionState },
        {
          provide: STAFF_REPOSITORY,
          useValue: staffRepository(staffUser('social-worker', 'staff-sw-1')),
        },
        { provide: REPORT_REPOSITORY, useClass: HttpReportRepository },
        { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
      ],
    });
    await firstValueFrom(TestBed.inject(SessionStore).load());
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const fixture = TestBed.createComponent(ReportViewPage);
    fixture.componentRef.setInput('id', 'release-status');
    TestBed.tick();

    http.expectOne({ method: 'GET', url: '/api/barangays' }).flush({
      data: [{ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01', code: 'dolores', name: 'Dolores' }],
      meta: {},
    });
    http
      .expectOne({ method: 'GET', url: '/api/office/reports/release-status' })
      .flush(
        { error: { code: 'NOT_FOUND', message: 'That report is not available.' } },
        { status: 404, statusText: 'Not Found' },
      );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    http.verify();

    const text = html(fixture).textContent ?? '';
    expect(text).toContain(REPORTS_COPY.view.notFoundHeading);
    expect(text).not.toContain('Could not load');
    expect(TestBed.inject(NotificationStore).toasts()).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });
});
