import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { defer, firstValueFrom, of, Subject, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import CITIZENS from '@data/http/fixtures/office-report-citizens.json';
import { toCitizenReport } from '@data/http/mappers/summary-report.mapper';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  REPORT_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type CitizenReport,
  type CitizenReportFilter,
  type Page,
  type SignInOutcome,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SummaryReportExport,
} from '@domain/index';
import { UNSERVED_PORTS } from '@domain/ports/data-ports';
import type { AppEnvironment } from '@env/environment.model';

import { CitizenReportPage } from './citizen-report-page';
import { CITIZEN_REPORT_COPY } from './citizen-report.copy';

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

function readFixture(): CitizenReport {
  const report = toCitizenReport(CITIZENS.data);
  if (report === null) throw new Error('The citizen report fixture no longer maps.');
  return report;
}

const REPORT = readFixture();

const EMPTY_REPORT: CitizenReport = {
  ...REPORT,
  executiveSummary: {
    ...REPORT.executiveSummary,
    figures: { ...REPORT.executiveSummary.figures, residents: 0 },
  },
};

const FILE: SummaryReportExport = {
  format: 'csv',
  filename: 'citizen-registry-report-2026-11-21.csv',
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

/** The page at `url`, routed with its query parameters bound, over answers the test decides. */
async function open(
  answer: (filter: CitizenReportFilter) => Observable<CitizenReport>,
  role: StaffRole = 'mswdo-head',
  url = '/reports/citizens',
): Promise<{
  harness: RouterTestingHarness;
  element: HTMLElement;
  citizens: ReturnType<typeof vi.fn>;
  exportCitizens: ReturnType<typeof vi.fn>;
}> {
  const citizens = vi.fn(answer);
  const exportCitizens = vi.fn(() => of(FILE));
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'reports/citizens', component: CitizenReportPage },
          { path: '**', component: StubPage },
        ],
        withComponentInputBinding(),
      ),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
      { provide: UNSERVED_PORTS, useValue: [] },
      { provide: REPORT_REPOSITORY, useValue: { citizens, exportCitizens } },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, CitizenReportPage);
  await harness.fixture.whenStable();
  return {
    harness,
    element: harness.routeNativeElement ?? document.createElement('div'),
    citizens,
    exportCitizens,
  };
}

const copy = CITIZEN_REPORT_COPY;

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

describe('the citizen registry report page (DL-234)', () => {
  it('shows no sheet while the report is being read', async () => {
    const pending = new Subject<CitizenReport>();
    const { element } = await open(() => pending);

    expect(element.querySelector('.report-sheet')).toBeNull();
    expect(element.querySelector('app-async-content')).not.toBeNull();
  });

  it('draws the A4 sheet: letterhead, period, summary, sections A to G, signatures, footer', async () => {
    const { element } = await open(() => of(REPORT));
    const sheet = element.querySelector('.report-sheet');

    expect(sheet?.querySelector('app-municipal-seal')).not.toBeNull();
    expect(sheet?.querySelector('.report-sheet__title')?.textContent).toContain(
      'Citizen Registry Report',
    );
    expect(sheet?.textContent).toContain(REPORT.period.label);
    expect(sheet?.querySelector('.report-sheet__narrowed')?.textContent).toContain(
      copy.narrowedToNothing,
    );
    expect(sheet?.querySelector('.report-sheet__summary')?.textContent).toContain(
      'the registry holds 27 active records',
    );
    expect(sheet?.querySelectorAll('app-summary-section')).toHaveLength(7);
    expect(sheet?.querySelectorAll('.signatures__block')).toHaveLength(3);
    expect(sheet?.querySelector('.report-sheet__footer')?.textContent).toContain('RA 10173');
  });

  it('draws the months as a line, age and sex as a pyramid and the way to an ID as a funnel', async () => {
    const { element } = await open(() => of(REPORT));
    const section = (key: string) =>
      element.querySelector(`#summary-section-${key}`)?.closest('section') ?? null;

    const months = section('registry-by-month');
    expect(months?.querySelector('polyline.sheet-chart__line')).not.toBeNull();
    expect(months?.querySelectorAll('text.sheet-chart__figure')).toHaveLength(12);
    const pyramid = section('by-age-sex');
    expect(pyramid?.querySelectorAll('rect.sheet-chart__bar--left').length).toBeGreaterThan(0);
    expect(pyramid?.querySelectorAll('rect.sheet-chart__bar--right').length).toBeGreaterThan(0);
    const funnel = section('registry-to-id');
    expect(funnel?.querySelector('svg.sheet-chart')?.getAttribute('aria-hidden')).toBe('true');
    expect(funnel?.textContent).toContain('Holding a Digital ID in force');
    // Bars, and every value printed, for the rest.
    expect(section('by-barangay')?.querySelector('app-bar-chart')).not.toBeNull();
    expect(section('this-month')?.textContent).toContain('RA 11982');
  });

  it('says a withheld cell is withheld, with why, never as a zero', async () => {
    const { element } = await open(() => of(REPORT));
    const sectors = element.querySelector('#summary-section-by-sector')?.closest('section');

    expect(sectors?.querySelector('.sheet-withheld')?.textContent).toContain('Withheld');
    expect(sectors?.querySelector('.sheet-withheld__reason')?.textContent).toContain(
      'small enough to identify somebody',
    );
  });

  it('starts the signatures from the server and keeps what is typed, sending nothing', async () => {
    const { harness, element, citizens } = await open(() => of(REPORT));
    const names = [...element.querySelectorAll<HTMLInputElement>('.signatures__name')];

    expect(names.map((input) => input.value)).toEqual(['Teodoro Lim', 'Rosario Dizon', '']);
    const mayor = names[2];
    if (mayor === undefined) throw new Error('no mayor line');
    mayor.value = 'Juan Dela Cruz';
    mayor.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    expect(element.querySelectorAll<HTMLInputElement>('.signatures__name')[2]?.value).toBe(
      'Juan Dela Cruz',
    );
    expect(citizens).toHaveBeenCalledTimes(1);
  });

  it('reads the filters from the address, by the Citizen overview’s names', async () => {
    const { citizens, element } = await open(
      () => of(REPORT),
      'mswdo-head',
      '/reports/citizens?barangay=brgy-dolores&sex=female&ageGroup=senior&period=quarter&x=1',
    );

    expect(citizens).toHaveBeenLastCalledWith({
      barangayId: 'brgy-dolores',
      ageGroup: 'senior',
      sex: 'female',
      period: 'quarter',
    });
    expect(element.textContent).toContain(copy.clear);
  });

  it('shows the empty notice above a sheet that still prints when nobody is counted', async () => {
    const { element } = await open(() => of(EMPTY_REPORT));

    expect(element.querySelector('.summary__empty')?.textContent).toContain(copy.emptyHeading);
    expect(element.querySelector('.report-sheet')).not.toBeNull();
  });

  it('says the report could not be read, and Try again asks again', async () => {
    let asked = 0;
    const { harness, element } = await open(() =>
      defer(() => {
        asked += 1;
        return asked === 1 ? throwError(() => new Error('down')) : of(REPORT);
      }),
    );

    expect(element.textContent).toContain(copy.errorHeading);
    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Try again'))
      ?.click();
    await harness.fixture.whenStable();

    expect(asked).toBe(2);
    expect(element.querySelector('.report-sheet')).not.toBeNull();
  });

  it('Download PDF re-reads with the same filters, names the file, and opens the print window', async () => {
    const titles: string[] = [];
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      titles.push(document.title);
    });
    const { harness, element, citizens } = await open(() => of(REPORT));
    const button = element.querySelector<HTMLButtonElement>('.summary__print');

    expect(button?.textContent).toContain('Download PDF');
    expect(element.querySelector('.summary__print-hint')?.textContent).toContain('Save as PDF');
    button?.click();
    await harness.fixture.whenStable();

    expect(citizens).toHaveBeenCalledTimes(2);
    expect(citizens.mock.calls[1]).toEqual(citizens.mock.calls[0]);
    expect(print).toHaveBeenCalledTimes(1);
    expect(titles).toEqual([`Citizen registry report ${REPORT.period.to}`]);
  });

  it('prints nothing when the re-read fails', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    let calls = 0;
    const { harness, element } = await open(() => {
      calls += 1;
      return calls === 1 ? of(REPORT) : throwError(() => new Error('down'));
    });

    element.querySelector<HTMLButtonElement>('.summary__print')?.click();
    await harness.fixture.whenStable();

    expect(print).not.toHaveBeenCalled();
  });

  it('offers the CSV, said before its button, to a holder of the export key', async () => {
    const { harness, element, exportCitizens } = await open(() => of(REPORT), 'mswdo-head');

    expect(element.querySelector('.summary__excel-hint')?.textContent).toContain('opens in Excel');
    element.querySelector<HTMLButtonElement>('.summary__excel')?.click();
    await harness.fixture.whenStable();

    expect(exportCitizens).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.summary__ready a')?.getAttribute('download')).toBe(
      FILE.filename,
    );
  });

  it('does not offer the CSV to a reader without the export key', async () => {
    const { element } = await open(() => of(REPORT), 'release-officer');

    expect(element.querySelector('.report-sheet')).not.toBeNull();
    expect(element.querySelector('.summary__excel')).toBeNull();
    expect(element.querySelector('.summary__excel-hint')).toBeNull();
  });
});
