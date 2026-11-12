import { describe, expect, it } from 'vitest';

import SUMMARY from '../fixtures/office-residents-summary.json';
import { toBarangayIndex } from './resident.mapper';
import { toResidentSummary } from './resident-summary.mapper';

const BARANGAYS = toBarangayIndex([
  { id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04', name: 'San Juan' },
  { id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01', name: 'Dolores' },
]);

describe('resident summary mapper (DL-213)', () => {
  it('reads the figures as the server sent them, a withheld one as withheld', () => {
    const summary = toResidentSummary(SUMMARY.data, BARANGAYS);

    expect(summary?.residents).toEqual({ current: 1204, previous: 1180 });
    expect(summary?.registered.current).toEqual({ value: null, withheld: true });
    expect(summary?.registered.previous).toEqual({ value: 24, withheld: false });
    expect(summary?.byBarangay.total).toBe(1204);
    expect(summary?.recordsToTidy.map((item) => item.count)).toEqual([31, null]);
  });

  it('re-keys a barangay row to the console’s barangay, and keeps a withheld row unlinked', () => {
    const rows = toResidentSummary(SUMMARY.data, BARANGAYS)?.byBarangay.rows ?? [];

    expect(rows.map((row) => row.key)).toEqual(['brgy-san-juan', 'brgy-dolores']);
    expect(rows[1]?.isWithheld).toBe(true);
    expect(rows[1]?.routerLink).toBeUndefined();
  });

  it('refuses a summary that shows a figure it should have withheld', () => {
    const leaking = {
      ...SUMMARY.data,
      by_barangay: {
        ...SUMMARY.data.by_barangay,
        rows: [{ ...SUMMARY.data.by_barangay.rows[0], value: 2 }],
      },
    };
    expect(toResidentSummary(leaking, BARANGAYS)).toBeNull();
  });

  it('refuses a summary missing a series rather than showing part of it', () => {
    const partial = Object.fromEntries(
      Object.entries(SUMMARY.data).filter(([key]) => key !== 'by_age_sex'),
    );
    expect(toResidentSummary(partial, BARANGAYS)).toBeNull();
  });
});
