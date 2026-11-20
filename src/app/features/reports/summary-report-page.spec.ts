import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { defer, firstValueFrom, of, Subject, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import SUMMARY from '@data/http/fixtures/office-report-summary.json';
import { toSummaryReport } from '@data/http/mappers/summary-report.mapper';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  PROGRAM_REPOSITORY,
  REPORT_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type SignInOutcome,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SummaryReport,
  type SummaryReportExport,
} from '@domain/index';
import { UNSERVED_PORTS } from '@domain/ports/data-ports';
import type { AppEnvironment } from '@env/environment.model';

import { SummaryReportPage } from './summary-report-page';
import { SUMMARY_REPORT_COPY } from './summary-report.copy';

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

function readFixture(): SummaryReport {
  const report = toSummaryReport(SUMMARY.data);
  if (report === null) throw new Error('The summary fixture no longer maps.');
  return report;
}

const REPORT = readFixture();

const EMPTY_REPORT: SummaryReport = {
  ...REPORT,
  executiveSummary: {
    ...REPORT.executiveSummary,
    figures: {
      ...REPORT.executiveSummary.figures,
      received: 0,
      served: 0,
      rejected: 0,
      openNow: 0,
    },
  },
};

const FILE: SummaryReportExport = {
  format: 'csv',
  filename: 'summary-report-2026-01-01-to-2026-11-20.csv',
  content: 'Period covered,"…"',
};

function staffUser(role: StaffRole): StaffUser {
  return {
    id: asId<StaffUserId>('staff-1'),
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

/** The page with a report repository whose answers the test decides. */
async function open(
  answer: () => Observable<SummaryReport>,
  role: StaffRole = 'mswdo-head',
): Promise<{
  fixture: ComponentFixture<SummaryReportPage>;
  summary: ReturnType<typeof vi.fn>;
  exportSummary: ReturnType<typeof vi.fn>;
}> {
  const summary = vi.fn(answer);
  const exportSummary = vi.fn(() => of(FILE));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'reports/summary', component: SummaryReportPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
      { provide: UNSERVED_PORTS, useValue: [] },
      { provide: PROGRAM_REPOSITORY, useValue: { listActive: () => of([]) } },
      { provide: REPORT_REPOSITORY, useValue: { summary, exportSummary } },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  await TestBed.inject(Router).navigateByUrl('/reports/summary');
  const fixture = TestBed.createComponent(SummaryReportPage);
  await fixture.whenStable();
  return { fixture, summary, exportSummary };
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const copy = SUMMARY_REPORT_COPY;

beforeEach(() => {
  // jsdom has no object URLs; these stand in for the saved file's address.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:test/1'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('the summary report page (DL-228)', () => {
  it('shows no sheet while the report is being read', async () => {
    const pending = new Subject<SummaryReport>();
    const { fixture } = await open(() => pending);

    expect(html(fixture).querySelector('.report-sheet')).toBeNull();
    expect(html(fixture).querySelector('app-async-content')).not.toBeNull();
  });

  it('draws the A4 sheet: letterhead, period, summary, sections A to I, signatures, footer', async () => {
    const { fixture } = await open(() => of(REPORT));
    const element = html(fixture);
    const sheet = element.querySelector('.report-sheet');

    expect(sheet?.querySelector('app-municipal-seal')).not.toBeNull();
    expect(sheet?.querySelector('.report-sheet__letterhead')?.textContent).toContain(
      'Municipal Social Welfare and Development Office',
    );
    expect(sheet?.textContent).toContain(copy.periodCovered);
    expect(sheet?.textContent).toContain('1 January 2026 to 20 November 2026');
    expect(sheet?.querySelector('.report-sheet__narrowed')?.textContent).toContain(
      copy.narrowedToNothing,
    );
    expect(sheet?.querySelectorAll('app-summary-section')).toHaveLength(9);
    expect(sheet?.querySelectorAll('.signatures__block')).toHaveLength(3);
    expect(sheet?.querySelector('.report-sheet__footer')?.textContent).toContain(
      'Generated from the Taytay Social Welfare console on',
    );
    expect(sheet?.querySelector('.report-sheet__footer')?.textContent).toContain('RA 10173');
  });

  it('says a withheld cell is withheld, with why, and charts it as no bar', async () => {
    const { fixture } = await open(() => of(REPORT));
    const sex = html(fixture).querySelector('#summary-section-by-sex')?.closest('section');

    expect(sex?.querySelector('.sheet-withheld')?.textContent).toContain(copy.withheld);
    expect(sex?.querySelector('.sheet-withheld__reason')?.textContent).toContain(
      'small enough to identify somebody',
    );
    expect(sex?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(sex?.querySelectorAll('rect.bar-chart__bar')).toHaveLength(1);
    expect(sex?.querySelector('tfoot')?.textContent).toContain('before anything was withheld');
  });

  it('says section I is not counted for this reader, and overdue is not counted at all', async () => {
    const { fixture } = await open(() => of(REPORT));
    const element = html(fixture);

    expect(element.querySelector('.sheet-section__unavailable')?.textContent).toContain(
      copy.notCounted,
    );
    expect(element.querySelector('.report-sheet__overdue')?.textContent).toContain(
      'no service standard',
    );
  });

  it('starts the signatures from the server and keeps what is typed, sending nothing', async () => {
    const { fixture, summary } = await open(() => of(REPORT));
    const element = html(fixture);
    const names = [...element.querySelectorAll<HTMLInputElement>('.signatures__name')];

    expect(names.map((input) => input.value)).toEqual(['Teodoro Lim', 'Rosario Dizon', '']);

    const mayor = names[2];
    if (mayor === undefined) throw new Error('no mayor line');
    mayor.value = 'Juan Dela Cruz';
    mayor.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(element.querySelectorAll<HTMLInputElement>('.signatures__name')[2]?.value).toBe(
      'Juan Dela Cruz',
    );
    expect(summary).toHaveBeenCalledTimes(1);
  });

  it('shows the empty notice above a sheet that still prints when nothing was counted', async () => {
    const { fixture } = await open(() => of(EMPTY_REPORT));
    const element = html(fixture);

    expect(element.querySelector('.summary__empty')?.textContent).toContain(copy.emptyHeading);
    expect(element.querySelector('.report-sheet')).not.toBeNull();
  });

  it('says the report could not be read, and Try again asks again', async () => {
    // Asked again means subscribed again: over HTTP, that is the request sent again.
    let asked = 0;
    const { fixture } = await open(() =>
      defer(() => {
        asked += 1;
        return asked === 1 ? throwError(() => new Error('down')) : of(REPORT);
      }),
    );
    const element = html(fixture);

    expect(element.textContent).toContain(copy.errorHeading);
    const retry = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Try again'),
    );
    retry?.click();
    await fixture.whenStable();

    expect(asked).toBe(2);
    expect(element.querySelector('.report-sheet')).not.toBeNull();
  });

  it('re-reads the report with the same filters before it prints', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { fixture, summary } = await open(() => of(REPORT));
    const element = html(fixture);

    expect(element.querySelector('.summary__print-hint')?.textContent).toContain('Save as PDF');
    element.querySelector<HTMLButtonElement>('.summary__print')?.click();
    await fixture.whenStable();

    expect(summary).toHaveBeenCalledTimes(2);
    expect(summary.mock.calls[1]).toEqual(summary.mock.calls[0]);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('prints nothing when the re-read fails', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    let calls = 0;
    const { fixture } = await open(() => {
      calls += 1;
      return calls === 1 ? of(REPORT) : throwError(() => new Error('down'));
    });

    html(fixture).querySelector<HTMLButtonElement>('.summary__print')?.click();
    await fixture.whenStable();

    expect(print).not.toHaveBeenCalled();
  });

  it('offers the Excel file, said before its button, to a holder of the export key', async () => {
    const { fixture, exportSummary } = await open(() => of(REPORT), 'mswdo-head');
    const element = html(fixture);

    expect(element.querySelector('.summary__excel-hint')?.textContent).toContain('opens in Excel');
    element.querySelector<HTMLButtonElement>('.summary__excel')?.click();
    await fixture.whenStable();

    expect(exportSummary).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.summary__ready a')?.getAttribute('download')).toBe(
      FILE.filename,
    );
  });

  it('does not offer the Excel file to a reader without the export key', async () => {
    const { fixture } = await open(() => of(REPORT), 'release-officer');
    const element = html(fixture);

    expect(element.querySelector('.report-sheet')).not.toBeNull();
    expect(element.querySelector('.summary__excel')).toBeNull();
    expect(element.querySelector('.summary__excel-hint')).toBeNull();
  });
});
