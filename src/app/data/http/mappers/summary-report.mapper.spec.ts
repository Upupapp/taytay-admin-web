import { describe, expect, it } from 'vitest';

import SUMMARY from '../fixtures/office-report-summary.json';
import SUMMARY_EXPORT from '../fixtures/office-report-summary-export.json';
import { toSummaryReport, toSummaryReportExport } from './summary-report.mapper';

/** A deep copy of the fixture's `data`, to bend one field at a time. */
function wire(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(SUMMARY.data)) as Record<string, unknown>;
}

function sections(body: Record<string, unknown>): Record<string, unknown>[] {
  return body['sections'] as Record<string, unknown>[];
}

function sectionOf(body: Record<string, unknown>, key: string): Record<string, unknown> {
  const found = sections(body).find((section) => section['key'] === key);
  if (found === undefined) throw new Error(`no section ${key}`);
  return found;
}

describe('toSummaryReport (DL-228)', () => {
  it('reads the whole sheet: letterhead, period, nine sections in order, signatories, footer', () => {
    const report = toSummaryReport(SUMMARY.data);

    expect(report).not.toBeNull();
    expect(report?.letterhead).toEqual([
      'Republic of the Philippines',
      'Province of Rizal',
      'Municipality of Taytay',
      'Municipal Social Welfare and Development Office',
    ]);
    expect(report?.period.label).toBe('1 January 2026 to 20 November 2026');
    expect(report?.sections.map((section) => section.letter).join('')).toBe('ABCDEFGHI');
    expect(report?.signatories.notedBy.title).toBe(
      'Municipal Social Welfare and Development Officer',
    );
    expect(report?.signatories.approvedBy).toEqual({ name: null, title: 'Municipal Mayor' });
    expect(report?.footer.handlingNotice).toContain('RA 10173');
  });

  it('reads a small count as its number, and a withheld cell as null with its reason (DL-252)', () => {
    const report = toSummaryReport(SUMMARY.data);
    const sex = report?.sections.find((section) => section.key === 'by-sex');
    const male = sex?.rows.find((row) => row.key === 'male');
    const sector = report?.sections.find((section) => section.key === 'by-sector');
    const vawc = sector?.rows.find((row) => row.key === 'vawc-survivor');

    expect(male?.values['persons']).toBe(4);
    expect(male?.withheld['persons']).toBeUndefined();
    expect(vawc?.values['persons']).toBeNull();
    expect(vawc?.withheld['persons']).toBe('protected-sector');
    // The total is the server's, under its own label.
    expect(sex?.totals).toEqual({ persons: 11 });
    expect(sex?.totalsLabel).toBe('Total');
  });

  it('refuses an answer on another small-cell setting than the console’s (DL-252)', () => {
    const other = structuredClone(SUMMARY.data);
    other.disclosure.threshold = 5;
    expect(toSummaryReport(other)).toBeNull();
  });

  it('reads section I as not counted for this reader, with the server’s sentence', () => {
    const ids = toSummaryReport(SUMMARY.data)?.sections.find(
      (section) => section.key === 'digital-ids',
    );

    expect(ids?.available).toBe(false);
    expect(ids?.unavailableReason).toContain('digital-id.manage');
    expect(ids?.rows).toEqual([]);
  });

  it('reads overdue as null with its sentence: no service standard is set (DL-101)', () => {
    const figures = toSummaryReport(SUMMARY.data)?.executiveSummary.figures;

    expect(figures?.overdueNow).toBeNull();
    expect(figures?.overdueBasis).toContain('no service standard');
  });

  it('keeps a string cell — who an open request waits on — as words', () => {
    const stage = toSummaryReport(SUMMARY.data)?.sections.find(
      (section) => section.key === 'open-by-stage',
    );

    expect(stage?.rows.map((row) => row.values['waiting_on'])).toEqual(['office', 'resident']);
  });

  it('refuses an overdue figure, which would invent a service standard', () => {
    const body = wire();
    const summary = body['executive_summary'] as Record<string, Record<string, unknown>>;
    (summary['figures'] as Record<string, unknown>)['overdue_now'] = 3;

    expect(toSummaryReport(body)).toBeNull();
  });

  it('reads a count of people of two as two, the switch being off (DL-252)', () => {
    const body = wire();
    const rows = sectionOf(body, 'by-age')['rows'] as Record<string, Record<string, unknown>>[];
    (rows[1] as Record<string, Record<string, unknown>>)['values'] = {
      persons: 2,
      share_percent: 18,
    };

    const age = toSummaryReport(body)?.sections.find((section) => section.key === 'by-age');
    expect(age?.rows[1]?.values['persons']).toBe(2);
  });

  it('refuses a withheld cell that carries a value, and a null cell that names no reason', () => {
    // A protected sector's row: withheld whatever the switch (DL-38).
    const vawc = (body: Record<string, unknown>): Record<string, unknown> => {
      const rows = sectionOf(body, 'by-sector')['rows'] as Record<string, unknown>[];
      const row = rows.find((entry) => entry['key'] === 'vawc-survivor');
      if (row === undefined) throw new Error('fixture: no VAWC row');
      return row;
    };
    const leaked = wire();
    vawc(leaked)['values'] = { persons: 4, share_percent: 36 };

    const silent = wire();
    vawc(silent)['withheld'] = {};

    expect(toSummaryReport(leaked)).toBeNull();
    expect(toSummaryReport(silent)).toBeNull();
  });

  it('refuses a sheet missing a section, or with one out of place', () => {
    const missing = wire();
    missing['sections'] = sections(missing).filter((section) => section['key'] !== 'by-sector');

    const misplaced = wire();
    sectionOf(misplaced, 'by-sector')['letter'] = 'C';

    expect(toSummaryReport(missing)).toBeNull();
    expect(toSummaryReport(misplaced)).toBeNull();
  });

  it('refuses a footer without the RA 10173 handling rule (DL-106)', () => {
    const body = wire();
    (body['footer'] as Record<string, unknown>)['handling_notice'] = 'Keep it safe.';

    expect(toSummaryReport(body)).toBeNull();
  });
});

describe('toSummaryReportExport (DL-106)', () => {
  it('reads the server’s file as it is', () => {
    const file = toSummaryReportExport(SUMMARY_EXPORT.data);

    expect(file?.filename).toBe('summary-report-2026-01-01-to-2026-11-20.csv');
    expect(file?.content).toBe(SUMMARY_EXPORT.data.content);
  });

  it('refuses a file that does not carry its conditions before the first figure', () => {
    const bare = { ...SUMMARY_EXPORT.data, content: '"A. At a glance"\r\n"Received",19' };

    expect(toSummaryReportExport(bare)).toBeNull();
  });
});
