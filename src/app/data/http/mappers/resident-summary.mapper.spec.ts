import { describe, expect, it } from 'vitest';

import SUMMARY from '../fixtures/office-residents-summary.json';
import { toBarangayIndex } from './resident.mapper';
import { toResidentSummary } from './resident-summary.mapper';

const BARANGAYS = toBarangayIndex([
  { id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04', name: 'San Juan' },
  { id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01', name: 'Dolores' },
]);

describe('resident summary mapper (DL-213)', () => {
  it('reads the figures as the server sent them, small ones as their numbers (DL-252)', () => {
    const summary = toResidentSummary(SUMMARY.data, BARANGAYS);

    expect(summary?.residents).toMatchObject({ current: 1204, previous: 1180 });
    expect(summary?.residents.byMonth).toHaveLength(12);
    expect(summary?.totalBySex).toEqual({ female: 120, male: 0 });
    expect(summary?.funnel.activeIds).toEqual({ value: 4, withheld: false });
    expect(summary?.thisMonth.turning60).toEqual({ value: 9, withheld: false });
    expect(summary?.coverage).toBeNull();
    expect(summary?.registered.current).toEqual({ value: 3, withheld: false });
    expect(summary?.registered.previous).toEqual({ value: 24, withheld: false });
    expect(summary?.byBarangay.total).toBe(1204);
    expect(summary?.recordsToTidy.map((item) => item.count)).toEqual([31, null]);
    expect(summary?.residents.addedByMonth).toHaveLength(12);
    expect(summary?.residents.addedByMonth[11]).toEqual({
      month: '2026-11',
      office: { value: 5, withheld: false },
      imported: { value: 0, withheld: false },
    });
  });

  it('reads a withheld addition as withheld, and refuses one shown below the threshold (DL-249)', () => {
    const months = SUMMARY.data.residents.added_by_month;
    const withheld = {
      ...SUMMARY.data,
      residents: {
        ...SUMMARY.data.residents,
        added_by_month: months.map((month, index) =>
          index === 0 ? { ...month, imported: { value: null, withheld: 'small-cell' } } : month,
        ),
      },
    };
    expect(toResidentSummary(withheld, BARANGAYS)?.residents.addedByMonth[0]?.imported).toEqual({
      value: null,
      withheld: true,
    });

    const leaking = {
      ...SUMMARY.data,
      residents: {
        ...SUMMARY.data.residents,
        added_by_month: months.map((month, index) =>
          index === 0 ? { ...month, imported: { value: null, withheld: null } } : month,
        ),
      },
    };
    expect(toResidentSummary(leaking, BARANGAYS)).toBeNull();
  });

  it('re-keys a barangay row to the console’s barangay, and shows a small one as it is (DL-252)', () => {
    const rows = toResidentSummary(SUMMARY.data, BARANGAYS)?.byBarangay.rows ?? [];

    expect(rows.map((row) => row.key)).toEqual(['brgy-san-juan', 'brgy-dolores']);
    expect(rows[1]?.value).toBe(3);
    expect(rows[1]?.isWithheld).toBeUndefined();
  });

  it('refuses a summary on another small-cell setting than the console’s (DL-252)', () => {
    const other = {
      ...SUMMARY.data,
      disclosure: { ...SUMMARY.data.disclosure, threshold: 5 },
    };
    expect(toResidentSummary(other, BARANGAYS)).toBeNull();
  });

  it('refuses a summary missing a series rather than showing part of it', () => {
    const partial = Object.fromEntries(
      Object.entries(SUMMARY.data).filter(([key]) => key !== 'by_age_sex'),
    );
    expect(toResidentSummary(partial, BARANGAYS)).toBeNull();
  });
});
