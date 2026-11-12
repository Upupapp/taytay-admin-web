import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { SessionStore } from '@core/auth/session.store';
import {
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
  residents: { current: 120, previous: 100 },
  registered: { current: { value: null, withheld: true }, previous: { value: 9, withheld: false } },
  byBarangay: series(
    'by-barangay',
    [
      { key: 'brgy-dolores', label: 'Dolores', value: 80 },
      withheld('brgy-muzon', 'Muzon'),
    ],
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
  byAgeSex: series('by-age-sex', [{ key: 'senior.female', label: 'Seniors, female', value: 18 }], 18),
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
    ],
  });
  return asked;
}

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
    const links = [...root.querySelectorAll<HTMLAnchorElement>('a.kpi')].map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toContain('/residents');
    expect(links).toContain('/residents?sector=senior-citizen');
  });

  it('says a withheld figure is withheld, links nothing to it, and draws no delta against it', async () => {
    configure(of(SUMMARY));
    const root = await render();

    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.withheld);
    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.delta.none);
    const hrefs = [...root.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.includes('sector=pwd'))).toBe(false);
    expect(hrefs.some((href) => href.includes('barangay=brgy-muzon'))).toBe(false);
    expect(hrefs.some((href) => href.includes('barangay=brgy-dolores'))).toBe(true);
    expect(hrefs.some((href) => href.includes('ageGroup=senior') && href.includes('sex=female'))).toBe(
      true,
    );
  });

  it('counts records to tidy, never lists them, and says when no detection pass has run', async () => {
    configure(of(SUMMARY));
    const root = await render();

    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.tidy['missing-contact']);
    expect(text(root)).toContain(CITIZENS_OVERVIEW_COPY.tidyNotRun);
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
    expect(root.querySelectorAll('.kpi')).toHaveLength(0);
  });
});
