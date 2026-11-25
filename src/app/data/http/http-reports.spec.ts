import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  asId,
  asIsoDate,
  REPORT_CATALOGUE,
  WITHHELD_WITH_REASON,
  type BarangayId,
  type ReportFilter,
  type StaffUserId,
} from '@domain/index';

import OFFICE_REPORTS from './fixtures/office-reports.json';
import OFFICE_REPORT_COMPLETENESS from './fixtures/office-report-data-completeness.json';
import OFFICE_REPORT_EXPORT from './fixtures/office-report-export.json';
import OFFICE_REPORT_PROGRAMS from './fixtures/office-report-program-utilisation.json';
import OFFICE_REPORT_VULNERABILITY from './fixtures/office-report-vulnerability-indicators.json';
import OFFICE_REPORT_CITIZENS from './fixtures/office-report-citizens.json';
import OFFICE_REPORT_CITIZENS_EXPORT from './fixtures/office-report-citizens-export.json';
import OFFICE_REPORT_SUMMARY from './fixtures/office-report-summary.json';
import OFFICE_REPORT_SUMMARY_EXPORT from './fixtures/office-report-summary-export.json';
import { HttpReportRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const MUZON = asId<BarangayId>('brgy-muzon');
const MUZON_API = '0b1c2d3e-4f50-4a61-8b72-3c4d5e6f7a02';
/** `GET barangays`: the API knows each barangay by its own id, joined to the console’s by name. */
const BARANGAYS = {
  data: [
    { id: '0b1c2d3e-4f50-4a61-8b72-3c4d5e6f7a01', code: 'dolores', name: 'Dolores' },
    { id: MUZON_API, code: 'muzon', name: 'Muzon' },
    { id: '0b1c2d3e-4f50-4a61-8b72-3c4d5e6f7a04', code: 'san-juan', name: 'San Juan' },
  ],
  meta: {},
};

const providers = [
  provideHttpClient(withInterceptors([apiHeadersInterceptor])),
  provideHttpClientTesting(),
  {
    provide: APP_ENVIRONMENT,
    useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
  },
  HttpReportRepository,
];

/** A deep copy of a fixture, to plant one thing in. */
const copy = <T>(value: T): T => structuredClone(value);

/**
 * Reports over the API (`DL-190`). The server counts, suppresses and composes; the adapter asks with
 * the filter as named keys and nothing else, and the mapper refuses an answer that shows what it
 * should have withheld, a definition that breaks the catalogue's rules, or a file without its
 * conditions inside it.
 */
describe('reports over the API (DL-190)', () => {
  let http: HttpTestingController;
  let repository: HttpReportRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpReportRepository);
  });

  afterEach(() => http.verify());

  /** Answers the barangay list, read once per adapter, if it was asked for. */
  const barangays = () => {
    for (const pending of http.match(`${BASE}/barangays`)) {
      pending.flush(BARANGAYS);
    }
  };

  const run = async (body: object, filter: ReportFilter = {}, id = 'vulnerability-indicators') => {
    const read = firstValueFrom(repository.run(id as 'caseload', filter));
    barangays();
    const sent = http.expectOne((request) => request.url === `${BASE}/office/reports/${id}`);
    sent.flush(body);
    return { result: await read, params: sent.request.params };
  };

  const refused = async (body: object): Promise<unknown> => {
    const read = firstValueFrom(repository.run('vulnerability-indicators', {})).catch(
      (error: unknown) => error,
    );
    barangays();
    http.expectOne(`${BASE}/office/reports/vulnerability-indicators`).flush(body);
    return read;
  };

  it('reads the catalogue the server offers, in the console’s own words', async () => {
    const read = firstValueFrom(repository.catalogue());
    http.expectOne({ method: 'GET', url: `${BASE}/office/reports` }).flush(OFFICE_REPORTS);
    const catalogue = await read;

    // The server's catalogue is the console's: same reports, same grain, same keys, same filters.
    expect(catalogue.map((report) => report.id)).toEqual(
      REPORT_CATALOGUE.map((report) => report.id),
    );
    for (const report of catalogue) {
      const own = REPORT_CATALOGUE.find((entry) => entry.id === report.id);
      expect(report.grain).toBe(own?.grain);
      expect(report.permission).toBe(own?.permission);
      expect(report.filters).toEqual(own?.filters);
      expect(report.personLevelJustification).toBe(own?.personLevelJustification);
    }
  });

  it('refuses a catalogue with a person-level report that does not say why, or opens on report.view', async () => {
    for (const drift of [
      { person_level_justification: null },
      { person_level_justification: '  ' },
      { permission: 'report.view' },
    ]) {
      const body = copy(OFFICE_REPORTS);
      body.data = body.data.map((entry) =>
        entry.grain === 'person-level' ? { ...entry, ...drift } : entry,
      ) as typeof body.data;
      const read = firstValueFrom(repository.catalogue()).catch((error: unknown) => error);
      http.expectOne(`${BASE}/office/reports`).flush(body);
      expect(await read).toBeInstanceOf(Error);
    }
  });

  it('sends the filter as named keys, and nothing for one that is not set', async () => {
    const { params } = await run(OFFICE_REPORT_VULNERABILITY, {
      period: 'last-90-days',
      barangayId: MUZON,
    });
    expect(params.keys().sort()).toEqual(['barangay_id', 'period']);
    // Sent as the API knows the barangay, not as the console does.
    expect(params.get('barangay_id')).toBe(MUZON_API);
    const bare = await run(OFFICE_REPORT_VULNERABILITY);
    expect(bare.params.keys()).toEqual([]);
  });

  it('sends nothing for a barangay the API does not know by the same name', async () => {
    const read = firstValueFrom(
      repository.run('caseload', { barangayId: asId<BarangayId>('brgy-santa-ana') }),
    ).catch((error: unknown) => error);
    barangays();
    expect(await read).toBeInstanceOf(Error);
    http.expectNone(`${BASE}/office/reports/caseload`);
  });

  it('refuses a caseworker filter before asking: no report counts by caseworker', async () => {
    const filter = { caseworkerId: asId<StaffUserId>('2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02') };
    await expect(firstValueFrom(repository.run('caseload', filter))).rejects.toThrow(/caseworker/);
    await expect(firstValueFrom(repository.export('caseload', filter, 'csv'))).rejects.toThrow(
      /caseworker/,
    );
    http.expectNone(`${BASE}/office/reports/caseload`);
  });

  it('shows a small count as it is, and marks a protected sector Withheld with nothing to open (DL-252)', async () => {
    const { result } = await run(OFFICE_REPORT_VULNERABILITY);
    const series = result?.series[0];
    expect(series?.rows).toHaveLength(10);
    const withheld = series?.rows.filter((row) => row.isWithheld === true) ?? [];
    // Only the sectors this reader is not cleared for: nothing is withheld for being small.
    expect(withheld.map((row) => row.key).sort()).toEqual(['cicl', 'vawc-survivor']);
    for (const row of withheld) {
      expect(row.display).toMatch(/^Withheld: /);
      expect(row.routerLink).toBeUndefined();
    }
    // The reason is always said beside it (DL-247): a small count and an uncounted sector differ.
    expect(series?.rows.find((row) => row.key === 'solo-parent')?.value).toBe(3);
    expect(series?.rows.find((row) => row.key === 'unemployed')?.value).toBe(2);
    expect(series?.rows.find((row) => row.key === 'vawc-survivor')?.display).toBe(WITHHELD_WITH_REASON['protected-sector']);
    // Zero is a finding and is shown as one.
    expect(series?.rows.find((row) => row.key === 'indigenous-people')?.value).toBe(0);
    expect(series?.rows.find((row) => row.key === 'indigenous-people')?.isWithheld).toBeUndefined();
    // The total is the server's; the notice is only about the protected sectors.
    expect(series?.total).toBe(35);
    expect(series?.suppressionNotice).toMatch(/protected by law/);
    expect(series?.suppressionNotice).not.toMatch(/does not add up/);
    expect(result?.limits).toHaveLength(1);
    expect(result?.disclosureBasis).toMatch(/real number.*RA 10173/);
  });

  it('reads a series about people showing a count of one, the switch being off (DL-252)', async () => {
    const body = copy(OFFICE_REPORT_VULNERABILITY);
    const one = body.data.series[0]?.rows.find((row) => row.key === 'unemployed');
    if (one !== undefined) {
      Object.assign(one, { value: 1, withheld: null });
    }
    const read = (await refused(body)) as {
      readonly series: readonly { readonly rows: readonly { key: string; value: number }[] }[];
    };
    expect(read).not.toBeInstanceOf(Error);
    expect(read.series[0]?.rows.find((row) => row.key === 'unemployed')?.value).toBe(1);
  });

  it('refuses a withheld row that keeps its figure, words standing in for it, or a record to open', async () => {
    for (const plant of [
      { value: 3 },
      { display: 'three' },
      { resident_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c01' },
    ]) {
      // A protected sector's row: withheld whatever the switch (DL-38).
      const body = copy(OFFICE_REPORT_VULNERABILITY);
      const row = body.data.series[0]?.rows.find((entry) => entry.key === 'vawc-survivor');
      if (row !== undefined) {
        Object.assign(row, plant);
      }
      expect(await refused(body), JSON.stringify(plant)).toBeInstanceOf(Error);
    }
  });

  it('refuses a total taken after suppression, a missing summary, and a lower threshold', async () => {
    const afterSuppression = copy(OFFICE_REPORT_VULNERABILITY);
    const series = afterSuppression.data.series[0];
    if (series !== undefined) {
      // Rows that do not overlap must total at least what they show plus one for each withheld:
      // a small cell the server withheld (the switch on) and a total that does not count it.
      const unemployed = series.rows.find((row) => row.key === 'unemployed');
      if (unemployed !== undefined) Object.assign(unemployed, { value: null, withheld: 'small-cell' });
      series.overlapping = false;
      series.total = 36;
    }
    expect(await refused(afterSuppression)).toBeInstanceOf(Error);

    const unsummarised = copy(OFFICE_REPORT_VULNERABILITY);
    const first = unsummarised.data.series[0];
    if (first !== undefined) {
      first.summary = '';
    }
    expect(await refused(unsummarised)).toBeInstanceOf(Error);

    const lowered = copy(OFFICE_REPORT_VULNERABILITY);
    lowered.data.disclosure.threshold = 3;
    expect(await refused(lowered)).toBeInstanceOf(Error);
  });

  it('reads not found and not yours as no report', async () => {
    const read = firstValueFrom(repository.run('data-completeness', {}));
    barangays();
    http
      .expectOne(`${BASE}/office/reports/data-completeness`)
      .flush(
        { error: { code: 'NOT_FOUND', message: 'No such report.' } },
        { status: 404, statusText: 'Not Found' },
      );
    expect(await read).toBeNull();
  });

  it('formats money from integer centavos and never values goods', async () => {
    const { result } = await run(OFFICE_REPORT_PROGRAMS, {}, 'program-utilisation');
    const cash = result?.series.find((series) => series.key === 'cash-by-program');
    expect(cash?.rows.map((row) => [row.value, row.display])).toEqual([
      [2_450_000, '₱24,500.00'],
      [0, '₱0.00'],
    ]);
    expect(cash?.total).toBe(2_450_000);
    expect(cash?.totalDisplay).toBe('₱24,500.00');
    // A count series keeps its count as the figure.
    expect(result?.series[0]?.totalDisplay).toBeUndefined();
    expect(result?.limits.join(' ')).toMatch(/membership is not recorded/);
    // The filter the server applied, read back in the console's own barangay ids.
    expect(result?.appliedFilter).toEqual({ period: 'last-90-days', barangayId: 'brgy-dolores' });
  });

  it('opens a named record only on the report that names people', async () => {
    const { result } = await run(OFFICE_REPORT_COMPLETENESS, {}, 'data-completeness');
    expect(result?.grain).toBe('person-level');
    expect(result?.series[0]?.rows.map((row) => [row.label, row.display, row.routerLink])).toEqual([
      ['Lazaro, P.', 'household', '/residents/7d1c2b3a-4e5f-4a6b-8c7d-8e9f0a1b2c02'],
      [
        'Mercado, Ana Lim',
        'mobile number, household',
        '/residents/7d1c2b3a-4e5f-4a6b-8c7d-8e9f0a1b2c01',
      ],
    ]);

    // The same row on an aggregate report is refused: a count does not open a person.
    const body = copy(OFFICE_REPORT_PROGRAMS);
    const row = body.data.series[0]?.rows[0];
    if (row !== undefined) {
      Object.assign(row, { resident_id: '7d1c2b3a-4e5f-4a6b-8c7d-8e9f0a1b2c01' });
    }
    const read = firstValueFrom(repository.run('program-utilisation', {})).catch(
      (error: unknown) => error,
    );
    barangays();
    http.expectOne(`${BASE}/office/reports/program-utilisation`).flush(body);
    expect(await read).toBeInstanceOf(Error);
  });

  it('asks for a CSV file and hands over the one the server composed, conditions inside', async () => {
    const read = firstValueFrom(
      repository.export('vulnerability-indicators', { barangayId: MUZON }, 'csv'),
    );
    barangays();
    const sent = http.expectOne(
      (request) => request.url === `${BASE}/office/reports/vulnerability-indicators/export`,
    );
    expect(sent.request.method).toBe('GET');
    expect(sent.request.params.get('format')).toBe('csv');
    expect(sent.request.params.get('barangay_id')).toBe(MUZON_API);
    sent.flush(OFFICE_REPORT_EXPORT);
    const file = await read;

    expect(file.content).toBe(OFFICE_REPORT_EXPORT.data.content);
    expect(file.filename).toBe('vulnerability-indicators-2026-11-07.csv');
    expect(file.manifest.includesPersonLevel).toBe(false);
    expect(file.manifest.handlingNotice).toContain('RA 10173');
    expect(file.manifest.limits).toHaveLength(1);
    expect(file.content.split('\r\n')[0]).toBe('Report,"Household vulnerability indicators"');
  });

  it('reads overlapping rows whose total counts each household once, and says they overlap', async () => {
    // DL-247: sectors overlap, so the total is of different households and is less than the rows add up to.
    const body = copy(OFFICE_REPORT_VULNERABILITY);
    const series = body.data.series[0];
    if (series !== undefined) {
      series.total = 20;
    }
    const { result } = await run(body);
    expect(result?.series[0]?.overlapping).toBe(true);
    expect(result?.series[0]?.total).toBe(20);
    const missing = copy(OFFICE_REPORT_VULNERABILITY) as { data: { series: Record<string, unknown>[] } };
    delete missing.data.series[0]?.['overlapping'];
    expect(await refused(missing)).toBeInstanceOf(Error);
  });

  it('reads a file that starts with the byte-order mark Excel needs, and hands it over unchanged', async () => {
    const marked = copy(OFFICE_REPORT_EXPORT);
    marked.data.content = String.fromCodePoint(0xfeff) + marked.data.content;
    const read = firstValueFrom(repository.export('vulnerability-indicators', {}, 'csv'));
    barangays();
    http.expectOne((request) => request.url.endsWith('/export')).flush(marked);
    expect((await read).content).toBe(marked.data.content);
  });

  it('refuses a file that does not carry its conditions, or says it names nobody when it does', async () => {
    const strip = (pattern: RegExp) => {
      const body = copy(OFFICE_REPORT_EXPORT);
      body.data.content = body.data.content
        .split('\r\n')
        .filter((line) => !pattern.test(line))
        .join('\r\n');
      return body;
    };
    const mislabelled = copy(OFFICE_REPORT_EXPORT);
    mislabelled.data.manifest.includes_person_level = true;
    for (const body of [
      strip(/^Handling,/),
      strip(/^Filter applied,/),
      strip(/^Generated by,/),
      mislabelled,
    ]) {
      const read = firstValueFrom(repository.export('vulnerability-indicators', {}, 'csv')).catch(
        (error: unknown) => error,
      );
      barangays();
      http.expectOne((request) => request.url.endsWith('/export')).flush(body);
      expect(await read).toBeInstanceOf(Error);
    }
  });

  it('asks for no printable view: the server composes a CSV file only', async () => {
    await expect(firstValueFrom(repository.export('caseload', {}, 'printable'))).rejects.toThrow(
      /CSV/,
    );
    http.expectNone(`${BASE}/office/reports/caseload/export`);
  });
});

/**
 * The summary report over the API (`DL-228`): seven named filters and nothing else, the barangay
 * by the API's own id, and an answer that cannot be read is refused whole.
 */
describe('the summary report over the API (DL-228)', () => {
  let http: HttpTestingController;
  let repository: HttpReportRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpReportRepository);
  });

  afterEach(() => http.verify());

  it('sends the filter as named keys, the barangay as the API knows it', async () => {
    const read = firstValueFrom(
      repository.summary({
        from: asIsoDate('2026-01-01'),
        to: asIsoDate('2026-06-30'),
        barangayId: MUZON,
        sex: 'female',
        age: '60-plus',
        sector: 'senior-citizen',
      }),
    );
    http.expectOne(`${BASE}/barangays`).flush(BARANGAYS);
    const sent = http.expectOne((request) => request.url === `${BASE}/office/reports/summary`);
    sent.flush(OFFICE_REPORT_SUMMARY);

    expect(sent.request.params.keys().sort()).toEqual([
      'age',
      'barangay_id',
      'from',
      'sector',
      'sex',
      'to',
    ]);
    expect(sent.request.params.get('barangay_id')).toBe(MUZON_API);
    expect((await read).sections).toHaveLength(9);
  });

  it('sends nothing for an empty filter, and asks for no barangay list', async () => {
    const read = firstValueFrom(repository.summary({}));
    const sent = http.expectOne(`${BASE}/office/reports/summary`);
    sent.flush(OFFICE_REPORT_SUMMARY);

    expect(sent.request.params.keys()).toEqual([]);
    expect((await read).period.from).toBe('2026-01-01');
  });

  it('refuses an answer that cannot be read, rather than drawing part of it', async () => {
    const body = copy(OFFICE_REPORT_SUMMARY);
    (body.data.executive_summary.figures as { overdue_now: unknown }).overdue_now = 2;
    const read = firstValueFrom(repository.summary({})).catch((error: unknown) => error);
    http.expectOne(`${BASE}/office/reports/summary`).flush(body);

    expect(await read).toBeInstanceOf(Error);
  });

  it('asks for the CSV with the same filter and hands over the server’s file as it is', async () => {
    const read = firstValueFrom(repository.exportSummary({ sex: 'male' }));
    const sent = http.expectOne(
      (request) => request.url === `${BASE}/office/reports/summary/export`,
    );
    sent.flush(OFFICE_REPORT_SUMMARY_EXPORT);

    expect(sent.request.params.get('format')).toBe('csv');
    expect(sent.request.params.get('sex')).toBe('male');
    expect((await read).content).toBe(OFFICE_REPORT_SUMMARY_EXPORT.data.content);
  });
});

/**
 * The citizen registry report over the API (`DL-234`): the overview's five filters by their wire
 * names and nothing else, the barangay by the API's own id, and an answer read whole or refused.
 */
describe('the citizen registry report over the API (DL-234)', () => {
  let http: HttpTestingController;
  let repository: HttpReportRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpReportRepository);
  });

  afterEach(() => http.verify());

  it('sends the filter as the wire names it, the barangay as the API knows it', async () => {
    const read = firstValueFrom(
      repository.citizens({
        barangayId: MUZON,
        sector: 'senior-citizen',
        ageGroup: 'senior',
        sex: 'female',
        period: 'quarter',
      }),
    );
    http.expectOne(`${BASE}/barangays`).flush(BARANGAYS);
    const sent = http.expectOne((request) => request.url === `${BASE}/office/reports/citizens`);
    sent.flush(OFFICE_REPORT_CITIZENS);

    expect(sent.request.params.keys().sort()).toEqual([
      'age_group',
      'barangay_id',
      'period',
      'sector',
      'sex',
    ]);
    expect(sent.request.params.get('barangay_id')).toBe(MUZON_API);
    const report = await read;
    expect(report.sections.map((section) => `${section.letter}:${section.key}`)).toEqual([
      'A:at-a-glance',
      'B:registry-by-month',
      'C:by-barangay',
      'D:by-age-sex',
      'E:by-sector',
      'F:registry-to-id',
      'G:this-month',
    ]);
    expect(report.executiveSummary.figures.residents).toBe(27);
    expect(report.signatories.approvedBy.title).toBe('Municipal Mayor');
  });

  it('sends nothing for an empty filter: the year to date is the API’s default', async () => {
    const read = firstValueFrom(repository.citizens({}));
    const sent = http.expectOne(`${BASE}/office/reports/citizens`);
    sent.flush(OFFICE_REPORT_CITIZENS);

    expect(sent.request.params.keys()).toEqual([]);
    expect((await read).period.from).toBe(OFFICE_REPORT_CITIZENS.data.period.from);
  });

  it('reads a count of people of one as one, the switch being off (DL-252)', async () => {
    const body = copy(OFFICE_REPORT_CITIZENS);
    const sector = body.data.sections.find((section) => section.key === 'by-sector');
    const pwd = sector?.rows.find((row) => row.key === 'pwd');
    if (pwd === undefined) throw new Error('fixture: no PWD row');
    (pwd.values as Record<string, unknown>)['residents'] = 1;
    const read = firstValueFrom(repository.citizens({})).catch((error: unknown) => error);
    http.expectOne(`${BASE}/office/reports/citizens`).flush(body);

    const report = await read;
    expect(report).not.toBeInstanceOf(Error);
  });

  it('refuses a registry report on another small-cell setting than the console’s (DL-252)', async () => {
    const body = copy(OFFICE_REPORT_CITIZENS);
    body.data.disclosure.threshold = 5;
    const read = firstValueFrom(repository.citizens({})).catch((error: unknown) => error);
    http.expectOne(`${BASE}/office/reports/citizens`).flush(body);

    expect(await read).toBeInstanceOf(Error);
  });

  it('refuses a sheet missing a section', async () => {
    const body = copy(OFFICE_REPORT_CITIZENS);
    body.data.sections = body.data.sections.filter((section) => section.key !== 'by-sector');
    const read = firstValueFrom(repository.citizens({})).catch((error: unknown) => error);
    http.expectOne(`${BASE}/office/reports/citizens`).flush(body);

    expect(await read).toBeInstanceOf(Error);
  });

  it('asks for the CSV with the same filter and hands over the server’s file as it is', async () => {
    const read = firstValueFrom(repository.exportCitizens({ sex: 'male', period: 'month' }));
    const sent = http.expectOne(
      (request) => request.url === `${BASE}/office/reports/citizens/export`,
    );
    sent.flush(OFFICE_REPORT_CITIZENS_EXPORT);

    expect(sent.request.params.get('format')).toBe('csv');
    expect(sent.request.params.get('sex')).toBe('male');
    expect(sent.request.params.get('period')).toBe('month');
    expect((await read).content).toBe(OFFICE_REPORT_CITIZENS_EXPORT.data.content);
  });
});
