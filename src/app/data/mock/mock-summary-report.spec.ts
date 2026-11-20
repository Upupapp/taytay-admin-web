import { describe, expect, it } from 'vitest';

import {
  SMALL_CELL_THRESHOLD,
  SUMMARY_SECTION_KEYS,
  asId,
  asIsoDate,
  toAuthenticatedUser,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { composeMockSummary, summaryCsv } from './mock-summary-report';
import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MOCK_DISBURSEMENTS } from './seed/releases.seed';
import { MOCK_RESIDENTS } from './seed/residents.seed';

function user(role: StaffRole) {
  const staff: StaffUser = {
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
  return toAuthenticatedUser(staff);
}

function compose(sensitiveCleared: boolean) {
  return composeMockSummary({
    user: user('mswdo-head'),
    filter: { from: asIsoDate('2020-01-01') },
    today: '2026-11-20',
    requests: MOCK_ASSISTANCE_REQUESTS,
    releases: MOCK_DISBURSEMENTS,
    programs: MOCK_PROGRAMS,
    resident: (id) => MOCK_RESIDENTS.find((resident) => resident.id === id),
    sensitiveCleared,
  });
}

describe('the mock summary report (DL-228)', () => {
  it('composes all nine sections in the template’s order', () => {
    expect(compose(true).sections.map((section) => section.key)).toEqual([...SUMMARY_SECTION_KEYS]);
  });

  it('never shows a count of people below the threshold, and withholds it with a reason', () => {
    for (const section of compose(true).sections) {
      for (const row of section.rows) {
        for (const column of section.columns.filter((entry) => entry.measure === 'people')) {
          const value = row.values[column.key];
          if (value === null) {
            expect(row.withheld[column.key]).toBeDefined();
          } else {
            expect(value === 0 || (value as number) >= SMALL_CELL_THRESHOLD).toBe(true);
          }
        }
      }
    }
  });

  it('leaves a protected sector uncounted for a reader not cleared for it', () => {
    const sector = compose(false).sections.find((section) => section.key === 'by-sector');
    const vawc = sector?.rows.find((row) => row.key === 'vawc-survivor');

    expect(vawc?.values['persons']).toBeNull();
    expect(vawc?.withheld['persons']).toBe('protected-sector');
  });

  it('counts nothing as overdue, and writes its conditions above the first figure', () => {
    const report = compose(true);
    const csv = summaryCsv(report);

    expect(report.executiveSummary.figures.overdueNow).toBeNull();
    expect(csv).toMatch(/^Period covered,/m);
    expect(csv).toMatch(/^Handling,.*RA 10173/m);
    expect(csv.indexOf('Handling,')).toBeLessThan(csv.indexOf('A. At a glance'));
  });
});
