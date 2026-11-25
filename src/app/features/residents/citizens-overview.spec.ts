import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { SessionStore } from '@core/auth/session.store';
import {
  RESIDENT_IMPORT_REPOSITORY,
  UNSERVED_PORTS,
  VERIFICATION_REPOSITORY,
  asIsoDate,
  asIsoDateTime,
  RESIDENT_REPOSITORY,
  WITHHELD_DISPLAY,
  type Permission,
  type ReportSeries,
  type ResidentSummary,
  type ResidentSummaryFilter,
} from '@domain/index';

import { CitizensOverviewPage } from './citizens-overview-page';
import { CITIZENS_OVERVIEW_COPY } from './citizens-overview.copy';
import { REGISTRY_PANELS_COPY } from './registry-panels.copy';

function series(key: string, rows: ReportSeries['rows'], total: number): ReportSeries {
  return {
    key,
    title: `Series ${key}`,
    summary: `What ${key} says.`,
    labelHeader: 'Label',
    valueHeader: 'Residents',
    rows,
    total,
    suppressionNotice: rows.some((row) => row.isWithheld) ? 'Some figures are withheld.' : null,
  };
}

const withheld = (key: string, label: string): ReportSeries['rows'][number] => ({
  key,
  label,
  value: 0,
  display: WITHHELD_DISPLAY,
  isWithheld: true,
});

const SUMMARY: ResidentSummary = {
  asOf: asIsoDateTime('2026-11-12T06:00:00.000Z'),
  period: {
    kind: 'month',
    from: asIsoDate('2026-11-01'),
    to: asIsoDate('2026-11-12'),
    previousFrom: asIsoDate('2026-10-01'),
    previousTo: asIsoDate('2026-10-31'),
  },
  residents: {
    current: 120,
    previous: 100,
    byMonth: [
      { month: '2026-10', figure: { value: 100, withheld: false } },
      { month: '2026-11', figure: { value: 120, withheld: false } },
    ],
    addedByMonth: [
      {
        month: '2026-10',
        office: { value: 12, withheld: false },
        imported: { value: null, withheld: true },
      },
      {
        month: '2026-11',
        office: { value: 8, withheld: false },
        imported: { value: 31, withheld: false },
      },
    ],
  },
  registered: { current: { value: null, withheld: true }, previous: { value: 9, withheld: false } },
  byBarangay: series(
    'by-barangay',
    [{ key: 'brgy-dolores', label: 'Dolores', value: 80 }, withheld('brgy-muzon', 'Muzon')],
    83,
  ),
  bySector: series(
    'by-sector',
    [
      { key: 'senior-citizen', label: 'Senior citizens', value: 30 },
      withheld('pwd', 'Persons with disability'),
      { key: 'solo-parent', label: 'Solo parents', value: 12 },
    ],
    44,
  ),
  byAgeSex: series(
    'by-age-sex',
    [{ key: 'senior.female', label: 'Seniors, female', value: 18 }],
    18,
  ),
  totalBySex: { female: 18, male: 0 },
  funnel: {
    onRegistry: 120,
    onApp: { value: 40, withheld: false },
    verified: { value: 20, withheld: false },
    activeIds: { value: null, withheld: true },
  },
  atPeriodStart: {
    at: asIsoDateTime('2026-10-31T16:00:00.000Z'),
    bySector: [
      { sector: 'senior-citizen', figure: { value: 25, withheld: false } },
      { sector: 'pwd', figure: { value: 7, withheld: false } },
      { sector: 'solo-parent', figure: { value: 12, withheld: false } },
    ],
    onApp: { value: 31, withheld: false },
    activeIds: null,
    activeIdsRecordedFrom: asIsoDateTime('2026-11-25T04:00:00.000Z'),
  },
  thisMonth: {
    month: '2026-11',
    turning60: { value: 6, withheld: false },
    turning18: { value: null, withheld: true },
    soloParentIdsDue: { value: 0, withheld: false },
    pwdIdsExpiring: { value: 0, withheld: false },
  },
  coverage: null,
  attention: null,
  byDisabilityType: null,
  recordsToTidy: [
    { key: 'missing-contact', count: 7, basis: 'No mobile and no email.', lastRunAt: null },
    { key: 'possible-duplicates', count: null, basis: 'Name and birth date.', lastRunAt: null },
  ],
  disclosure: { threshold: 5, provenance: 'Pending confirmation.', basis: 'DL-105.' },
};

function configure(
  answer: Observable<ResidentSummary>,
  granted: readonly Permission[] = ['resident.view'],
): ResidentSummaryFilter[] {
  const asked: ResidentSummaryFilter[] = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: RESIDENT_REPOSITORY,
        useValue: {
          summary: (filter: ResidentSummaryFilter): Observable<ResidentSummary> => {
            asked.push(filter);
            return answer;
          },
        },
      },
      {
        provide: SessionStore,
        useValue: { user: signal(null), permissions: signal(new Set<Permission>(granted)) },
      },
      { provide: UNSERVED_PORTS, useValue: [] },
      {
        provide: RESIDENT_IMPORT_REPOSITORY,
        useValue: { list: () => of({ items: [], hasMore: false, nextCursor: null }) },
      },
      {
        provide: VERIFICATION_REPOSITORY,
        useValue: { list: () => of({ items: [], hasMore: false, nextCursor: null, stats: STATS }) },
      },
    ],
  });
  return asked;
}

/** The review queue's own figures: three waiting, the oldest sent two days ago. */
const STATS = {
  pending: 3,
  oldestPendingAt: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000).toISOString(),
  decided7d: { approved: 5, rejected: 1 },
  sentByDay: Array.from({ length: 7 }, (_, index) => ({
    date: `2026-11-1${index}`,
    count: index % 3,
  })),
};

async function render(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(CitizensOverviewPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const text = (root: HTMLElement): string => root.textContent?.replace(/\s+/g, ' ') ?? '';

describe('CitizensOverviewPage (DL-213)', () => {
  it('draws the server’s figures, each linked to the registry filtered the same way', async () => {
    const asked = configure(of(SUMMARY));
    const root = await render();

    expect(asked).toEqual([{}]);
    expect(text(root)).toContain('120');
    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.delta.up(20));
    // The strip's hint line (DL-253): the change and "vs last period".
    expect(text(root)).toContain(
      `${CITIZENS_OVERVIEW_COPY.change.up(20)} ${CITIZENS_OVERVIEW_COPY.change.against}`,
    );
    expect(root.querySelector('.kpi-strip')?.textContent).not.toContain('RA 9994');
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a.kpi-strip__cell')].map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toContain('/residents');
    expect(links).toContain('/residents?sector=senior-citizen');
  });

  it('compares the sectors and the app with the period start, and says no earlier card figure is recorded (DL-254)', async () => {
    configure(
      of({ ...SUMMARY, funnel: { ...SUMMARY.funnel, activeIds: { value: 3, withheld: false } } }),
    );
    const root = await render();
    const cell = (key: keyof typeof CITIZENS_OVERVIEW_COPY.kpiSector): string => {
      const label = CITIZENS_OVERVIEW_COPY.kpiSector[key];
      const found = [...root.querySelectorAll('.kpi-strip__cell')].find((each) =>
        each.textContent?.includes(label),
      );
      return found?.textContent?.replace(/\s+/g, ' ') ?? '';
    };

    // Seniors 30 now, 25 as the period began; solo parents unchanged; the app 40 against 31.
    expect(cell('senior-citizen')).toContain(CITIZENS_OVERVIEW_COPY.delta.up(5));
    expect(cell('solo-parent')).toContain(CITIZENS_OVERVIEW_COPY.delta.same);
    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.delta.up(9));
    // A withheld figure draws no change against the earlier one.
    expect(cell('pwd')).toContain(CITIZENS_OVERVIEW_COPY.withheldHint);
    // The period began before the cards' history did (DL-257): said on the tile, visibly, with
    // the day the record begins — never a dash alone.
    const hints = [...root.querySelectorAll('.kpi-strip__hint')].map((hint) =>
      hint.textContent?.replace(/\s+/g, ' ').trim(),
    );
    const notRecorded = CITIZENS_OVERVIEW_COPY.delta.notRecordedFrom('25 Nov 2026');
    expect(hints.filter((hint) => hint === notRecorded)).toHaveLength(1);
  });

  it('compares the active Digital IDs once the cards’ history covers the period (DL-257)', async () => {
    configure(
      of({
        ...SUMMARY,
        funnel: { ...SUMMARY.funnel, activeIds: { value: 3, withheld: false } },
        atPeriodStart: { ...SUMMARY.atPeriodStart, activeIds: { value: 1, withheld: false } },
      }),
    );
    const root = await render();
    const ids = [...root.querySelectorAll('.kpi-strip__cell')].find((each) =>
      each.textContent?.includes(REGISTRY_PANELS_COPY.funnelSteps.activeIds),
    );
    expect(ids?.textContent).toContain(CITIZENS_OVERVIEW_COPY.delta.up(2));
    expect(ids?.textContent).not.toContain(CITIZENS_OVERVIEW_COPY.delta.notRecorded);
  });

  it('says a withheld figure is withheld, links nothing to it, and draws no delta against it', async () => {
    configure(of(SUMMARY));
    const root = await render();

    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.withheld);
    // A withheld figure's one hint line says why, in place of a change (DL-253).
    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.withheldHint);
    expect(text(root)).not.toContain(CITIZENS_OVERVIEW_COPY.delta.none);
    const hrefs = [...root.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.includes('sector=pwd'))).toBe(false);
    expect(hrefs.some((href) => href.includes('barangay=brgy-muzon'))).toBe(false);
    expect(hrefs.some((href) => href.includes('barangay=brgy-dolores'))).toBe(true);
    expect(
      hrefs.some((href) => href.includes('ageGroup=senior') && href.includes('sex=female')),
    ).toBe(true);
  });

  it('counts records to tidy, never lists them, and says when no detection pass has run', async () => {
    configure(of(SUMMARY));
    const root = await render();

    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.tidy['missing-contact']);
    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.tidyNotRun);
  });

  it('words a timestamp and a provenance token instead of printing them raw (DL-227)', async () => {
    configure(
      of({
        ...SUMMARY,
        recordsToTidy: [
          {
            key: 'possible-duplicates',
            count: 3,
            basis: 'Detection pass of 2026-11-19T17:14:02.863Z.',
            lastRunAt: null,
          },
        ],
        disclosure: { ...SUMMARY.disclosure, provenance: 'convention-pending-confirmation' },
      } satisfies ResidentSummary),
    );
    const root = await render();

    expect(text(root)).not.toContain('2026-11-19T17:14:02.863Z');
    expect(text(root)).toMatch(/Detection pass of \d+ Nov 2026, \d+:\d{2} [AP]M\./);
    expect(text(root)).not.toContain('convention-pending-confirmation');
    expect(text(root)).toContain(
      CITIZENS_OVERVIEW_COPY.provenance['convention-pending-confirmation'] ?? 'missing',
    );
  });

  it('offers the protected sectors only to a reader cleared for them', async () => {
    configure(of(SUMMARY));
    let root = await render();
    let options = [...root.querySelectorAll('option')].map((option) => option.value);
    expect(options).not.toContain('vawc-survivor');

    configure(of(SUMMARY), ['resident.view', 'request.view-sensitive']);
    root = await render();
    options = [...root.querySelectorAll('option')].map((option) => option.value);
    expect(options).toContain('vawc-survivor');
  });

  it('shows the error with Try again, and no figure', async () => {
    configure(throwError(() => new Error('The figures from the server could not be read.')));
    const root = await render();

    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.errorHeading);
    expect(root.querySelectorAll('.kpi-strip__cell')).toHaveLength(0);
  });
});

describe('CitizensOverviewPage — how the registry grew and the review queue (DL-249)', () => {
  it('draws additions by month, office and imports apart, a withheld cell never a zero', async () => {
    configure(of(SUMMARY));
    const root = await render();
    const panel = root.querySelector('app-registry-additions');
    const rows = [...(panel?.querySelectorAll('tbody tr') ?? [])].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()).join(' | '),
    );

    expect(rows).toEqual(['October 2026 | 12 | Withheld', 'November 2026 | 8 | 31']);
    expect(panel?.querySelector('thead')?.textContent).toContain('From an imported list');
    // The month a line breaks is said in words, not left as a gap to be read as none.
    expect(panel?.textContent).toContain('Oct 2026, imported');
  });

  it('shows the review queue only to a reviewer, its oldest wait in days', async () => {
    configure(of(SUMMARY));
    expect((await render()).querySelector('app-registry-review-queue')).toBeNull();

    configure(of(SUMMARY), ['resident.view', 'verification.review']);
    const queue = (await render()).querySelector('app-registry-review-queue');
    const words = queue?.textContent?.replace(/\s+/g, ' ') ?? '';

    expect(words).toMatch(/Waiting for a review\s*3/);
    expect(words).toMatch(/Oldest has waited\s*2 days/);
    expect(words).toContain('5 approved, 1 not accepted');
    expect(words.toLowerCase()).not.toContain('overdue');
    expect(queue?.querySelector('a')?.getAttribute('href')).toBe('/verification');
  });
});

describe('CitizensOverviewPage — the sector list and the cards beside it (DL-250)', () => {
  const sectorRow = (key: string, label: string, value: number): ReportSeries['rows'][number] => ({
    key,
    label,
    value,
  });

  it('draws sectors largest first, a withheld row after them, and names a zero apart', async () => {
    configure(
      of({
        ...SUMMARY,
        bySector: series(
          'by-sector',
          [
            sectorRow('senior-citizen', 'Senior citizens', 12),
            withheld('pwd', 'Persons with disability'),
            sectorRow('out-of-school-youth', 'Out-of-school youth', 0),
            sectorRow('solo-parent', 'Solo parents', 30),
          ],
          44,
        ),
      }),
    );
    const root = await render();
    const panel = root.querySelector('.overview-trio__sector');
    const rows = [...(panel?.querySelectorAll('tbody tr') ?? [])].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()).join(' | '),
    );

    expect(rows).toEqual([
      'Solo parents | 30',
      'Senior citizens | 12',
      `Persons with disability | ${CITIZENS_OVERVIEW_COPY.withheld}`,
    ]);
    expect(panel?.textContent).toContain(CITIZENS_OVERVIEW_COPY.bySectorNone);
    expect([...(panel?.querySelectorAll('li.chip') ?? [])].map((chip) => chip.textContent)).toEqual(
      ['Out-of-school youth'],
    );
    expect(root.querySelector('.overview-trio--no-sectors')).toBeNull();
  });

  it('says in a sentence that no sector is recorded, and draws no bar, when every row is zero', async () => {
    configure(
      of({
        ...SUMMARY,
        bySector: series(
          'by-sector',
          [
            sectorRow('senior-citizen', 'Senior citizens', 0),
            sectorRow('pwd', 'Persons with disability', 0),
          ],
          0,
        ),
      }),
    );
    const root = await render();
    const panel = root.querySelector('.overview-trio__sector');

    expect(panel?.querySelector('table')).toBeNull();
    expect(panel?.querySelector('.chart__bar')).toBeNull();
    expect(panel?.textContent).toContain(CITIZENS_OVERVIEW_COPY.bySectorEmpty);
    expect([...(panel?.querySelectorAll('li.chip') ?? [])].map((chip) => chip.textContent)).toEqual(
      ['Senior citizens', 'Persons with disability'],
    );
    // With nothing to list, the sentence runs across the foot, under the funnel and the pyramid.
    expect(root.querySelector('.overview-trio--no-sectors')).not.toBeNull();
  });

  it('keeps a withheld sector in the table when nothing else has a figure (DL-105)', async () => {
    configure(
      of({
        ...SUMMARY,
        bySector: series(
          'by-sector',
          [
            sectorRow('senior-citizen', 'Senior citizens', 0),
            withheld('pwd', 'Persons with disability'),
          ],
          0,
        ),
      }),
    );
    const panel = (await render()).querySelector('.overview-trio__sector');

    expect(panel?.querySelector('tbody')?.textContent).toContain('Persons with disability');
    expect(panel?.textContent).not.toContain(CITIZENS_OVERVIEW_COPY.bySectorEmpty);
  });

  it('reads the age chart’s title once, and shows its summary without it', async () => {
    configure(
      of({
        ...SUMMARY,
        byAgeSex: {
          ...series(
            'by-age-sex',
            [
              { key: 'senior.female', label: 'Seniors, female', value: 18 },
              { key: 'senior.male', label: 'Seniors, male', value: 7 },
            ],
            25,
          ),
          summary: 'Series by-age-sex: 25 people in total.',
        },
      }),
    );
    const caption = (await render()).querySelector('.pyramid__caption');

    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Series by-age-sex 25 people in total.',
    );
    expect(caption?.querySelector('.visually-hidden')?.textContent).toBe('Series by-age-sex');
  });

  it('keeps an age band’s range on its own line, read with its name', async () => {
    configure(
      of({
        ...SUMMARY,
        byAgeSex: series(
          'by-age-sex',
          [
            { key: 'adult.female', label: 'Adults, female', value: 18 },
            { key: 'adult.male', label: 'Adults, male', value: 7 },
          ],
          25,
        ),
      }),
    );
    const band = (await render()).querySelector('.pyramid__band');

    expect(band?.querySelector('.pyramid__band-name')?.textContent).toBe('Adults');
    expect(band?.querySelector('.pyramid__band-range')?.textContent).toBe('(31–59)');
    expect(band?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Adults (31–59)');
  });
});
