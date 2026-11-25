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

  it('reads the strip as the period began, a protected sector withheld, and no card figure before the cards’ history (DL-254, DL-257)', () => {
    const summary = toResidentSummary(SUMMARY.data, BARANGAYS);
    const then = summary?.atPeriodStart;

    expect(then?.at).toBe('2026-11-01T00:00:00+08:00');
    expect(then?.onApp).toEqual({ value: 290, withheld: false });
    expect(then?.bySector.find((row) => row.sector === 'pwd')?.figure).toEqual({
      value: 64,
      withheld: false,
    });
    expect(then?.bySector.find((row) => row.sector === 'cicl')?.figure).toEqual({
      value: null,
      withheld: true,
    });
    expect(then?.activeIds).toBeNull();
    expect(then?.activeIdsRecordedFrom).toBe('2026-11-25T04:00:00.000Z');
  });

  it('reads the cards as the period began once their history covers it, and refuses a malformed one (DL-257)', () => {
    const start = SUMMARY.data.at_period_start;
    const counted = {
      ...SUMMARY.data,
      at_period_start: { ...start, active_ids: { value: 3, withheld: null } },
    };
    expect(toResidentSummary(counted, BARANGAYS)?.atPeriodStart.activeIds).toEqual({
      value: 3,
      withheld: false,
    });
    const withheld = {
      ...SUMMARY.data,
      at_period_start: { ...start, active_ids: { value: null, withheld: 'small-cell' } },
    };
    expect(toResidentSummary(withheld, BARANGAYS)?.atPeriodStart.activeIds).toEqual({
      value: null,
      withheld: true,
    });
    const malformed = { ...SUMMARY.data, at_period_start: { ...start, active_ids: 3 } };
    expect(toResidentSummary(malformed, BARANGAYS)).toBeNull();
    const unsaid = Object.fromEntries(
      Object.entries(start).filter(([key]) => key !== 'active_ids_recorded_from'),
    );
    expect(toResidentSummary({ ...SUMMARY.data, at_period_start: unsaid }, BARANGAYS)).toBeNull();
  });

  it('refuses a summary without the period start, or with a sector it does not know (DL-254)', () => {
    const { at_period_start: start, ...without } = SUMMARY.data;
    expect(toResidentSummary(without, BARANGAYS)).toBeNull();
    const unknown = {
      ...SUMMARY.data,
      at_period_start: {
        ...start,
        by_sector: [{ key: 'farmers', value: 3, withheld: null }],
      },
    };
    expect(toResidentSummary(unknown, BARANGAYS)).toBeNull();
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
