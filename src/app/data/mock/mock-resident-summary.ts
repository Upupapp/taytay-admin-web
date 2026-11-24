import {
  asIsoDate,
  asIsoDateTime,
  describeSuppression,
  isInAgeGroup,
  isSensitiveSector,
  RESIDENT_AGE_GROUP_LABELS,
  RESIDENT_AGE_GROUPS,
  SEX_LABELS,
  SEXES,
  SMALL_CELL_BASIS,
  SMALL_CELL_PROVENANCE,
  SMALL_CELL_THRESHOLD,
  suppressSmallCells,
  TAYTAY_BARANGAYS,
  totalBeforeSuppression,
  VULNERABILITY_SECTOR_LABELS,
  VULNERABILITY_SECTORS,
  WITHHELD_WITH_REASON,
  type ReportRow,
  type ReportSeries,
  type Resident,
  type ResidentSummary,
  type ResidentSummaryFilter,
  type SectorAttention,
  type SectorCoverage,
  type SummaryFigure,
} from '@domain/index';

import { mockAppLinkOf, mockSectorDetailsOf } from './mock-registry-facts';
import { demoMonthEnds, demoNow, manilaDay } from './mock-time-series';

/**
 * The Citizens overview counted over the mock registry, the way the API's `summary.ts` counts it
 * (`DL-213`): active records under the filter, small cells withheld through the domain's own
 * `suppressSmallCells`, the total taken before, and a protected sector not counted at all for a
 * reader without `request.view-sensitive`. Sample figures only, behind the mock.
 */
export function mockResidentSummary(
  everyone: readonly Resident[],
  filter: ResidentSummaryFilter,
  cleared: boolean,
  now: Date = new Date(),
): ResidentSummary {
  const period = periodOf(filter.period ?? 'month', now);
  const inFilter = everyone.filter((resident) => isInSummaryFilter(resident, filter));
  const active = inFilter.filter((resident) => resident.isActive);
  const createdBetween = (from: Date, to: Date): number =>
    inFilter.filter((resident) => {
      const created = new Date(resident.audit.createdAt).getTime();
      return created >= from.getTime() && created < to.getTime();
    }).length;

  const sectorRows: ReportRow[] = VULNERABILITY_SECTORS.map((sector) => ({
    key: sector,
    label: VULNERABILITY_SECTOR_LABELS[sector],
    value: active.filter((resident) => resident.sectors.includes(sector)).length,
  }));

  return {
    asOf: asIsoDateTime(now),
    period: {
      kind: filter.period ?? 'month',
      from: asIsoDate(day(period.from)),
      to: asIsoDate(day(now)),
      previousFrom: asIsoDate(day(period.previousFrom)),
      previousTo: asIsoDate(day(new Date(period.from.getTime() - DAY_MS))),
    },
    residents: {
      current: active.length,
      previous: active.filter((resident) => new Date(resident.audit.createdAt) < period.from)
        .length,
      // The registry at each month's end, ended on the demo's today (see mock-time-series).
      byMonth: demoMonthEnds(12).map((end) => ({
        month: end.slice(0, 7),
        figure: figure(
          active.filter((resident) => manilaDay(resident.audit.createdAt) <= end).length,
        ),
      })),
    },
    registered: {
      current: figure(createdBetween(period.from, now)),
      previous: figure(createdBetween(period.previousFrom, period.from)),
    },
    byBarangay: series(
      'by-barangay',
      'Residents by barangay',
      'Barangay',
      TAYTAY_BARANGAYS.map((barangay) => ({
        key: barangay.id,
        label: barangay.name,
        value: active.filter((resident) => resident.address.barangayId === barangay.id).length,
      })),
    ),
    bySector: protect(
      series(
        'by-sector',
        'Residents by sector',
        'Sector',
        sectorRows.filter((row) => cleared || !isProtected(row.key)),
      ),
      sectorRows,
      cleared,
    ),
    byAgeSex: series(
      'by-age-sex',
      'Residents by age group and sex',
      'Age group and sex',
      RESIDENT_AGE_GROUPS.flatMap((group) =>
        SEXES.map((sex) => ({
          key: `${group}.${sex}`,
          label: `${RESIDENT_AGE_GROUP_LABELS[group]}, ${SEX_LABELS[sex].toLowerCase()}`,
          value: active.filter(
            (resident) => resident.sex === sex && isInAgeGroup(resident.birthDate, group),
          ).length,
        })),
      ),
    ),
    totalBySex: {
      female: active.filter((resident) => resident.sex === 'female').length,
      male: active.filter((resident) => resident.sex === 'male').length,
    },
    funnel: {
      onRegistry: active.length,
      onApp: figure(active.filter((resident) => mockAppLinkOf(resident) !== null).length),
      verified: figure(
        active.filter((resident) => mockAppLinkOf(resident)?.verified === true).length,
      ),
      activeIds: figure(
        active.filter((resident) => mockAppLinkOf(resident)?.cardStatus === 'active').length,
      ),
    },
    thisMonth: thisMonthOf(active),
    coverage: coverageOf(active, filter.sector),
    attention: attentionOf(active, filter.sector),
    byDisabilityType:
      filter.sector === 'pwd'
        ? series(
            'by-disability-type',
            'Persons with disability by type of disability',
            'Type of disability',
            disabilityRows(active),
          )
        : null,
    recordsToTidy: [
      {
        key: 'missing-contact',
        // Protected records are left out for a reader not cleared for them, as the server does.
        count: active.filter(
          (resident) =>
            (cleared || !resident.sectors.some(isSensitiveSector)) &&
            resident.contact.mobile === null &&
            resident.contact.email === null,
        ).length,
        basis: 'Active records with neither a mobile number nor an email address.',
        lastRunAt: null,
      },
    ],
    disclosure: {
      threshold: SMALL_CELL_THRESHOLD,
      provenance: SMALL_CELL_PROVENANCE,
      basis: SMALL_CELL_BASIS,
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isInSummaryFilter(resident: Resident, filter: ResidentSummaryFilter): boolean {
  return (
    (filter.barangayId === undefined || resident.address.barangayId === filter.barangayId) &&
    (filter.sector === undefined || resident.sectors.includes(filter.sector)) &&
    (filter.ageGroup === undefined || isInAgeGroup(resident.birthDate, filter.ageGroup)) &&
    (filter.sex === undefined || resident.sex === filter.sex)
  );
}

/** The birthdays RA 11982 marks with a cash gift, as the API's `MILESTONE_AGES` (backend ADR 0006). */
export const MOCK_MILESTONE_AGES = [80, 85, 90, 95, 100] as const;

/**
 * This demo month's birthdays at each RA 11982 milestone age among the active records under the
 * filter, as the API's citizen registry report counts them (backend ADR 0007). Raw counts: the
 * report withholds the small ones.
 */
export function mockMilestoneBirthdays(
  everyone: readonly Resident[],
  filter: ResidentSummaryFilter,
): readonly { readonly age: number; readonly count: number }[] {
  const today = manilaDay(demoNow());
  const year = Number(today.slice(0, 4));
  const month = today.slice(5, 7);
  const active = everyone.filter(
    (resident) => resident.isActive && isInSummaryFilter(resident, filter),
  );
  return MOCK_MILESTONE_AGES.map((age) => ({
    age,
    count: active.filter(
      (resident) =>
        resident.birthDate.slice(5, 7) === month &&
        Number(resident.birthDate.slice(0, 4)) === year - age,
    ).length,
  }));
}

/** The sectors whose cards and benefits the sector pages count (backend ADR 0006). */
const CARDED = ['senior-citizen', 'pwd', 'solo-parent'] as const;
type CardedSector = (typeof CARDED)[number];

function isCarded(sector: ResidentSummaryFilter['sector']): sector is CardedSector {
  return CARDED.some((carded) => carded === sector);
}

/** The demo's month, as the API's `this_month` counts it, on the demo's today. */
function thisMonthOf(active: readonly Resident[]): ResidentSummary['thisMonth'] {
  const today = manilaDay(demoNow());
  const year = Number(today.slice(0, 4));
  const month = today.slice(5, 7);
  const turning = (age: number) =>
    active.filter(
      (resident) =>
        resident.birthDate.slice(5, 7) === month &&
        Number(resident.birthDate.slice(0, 4)) === year - age,
    ).length;
  const ending = (sector: CardedSector) =>
    active.filter((resident) =>
      mockSectorDetailsOf(resident, true).some(
        (detail) =>
          detail.sector === sector && detail.validUntil?.slice(0, 7) === today.slice(0, 7),
      ),
    ).length;
  return {
    month: today.slice(0, 7),
    turning60: figure(turning(60)),
    turning18: figure(turning(18)),
    soloParentIdsDue: figure(ending('solo-parent')),
    pwdIdsExpiring: figure(ending('pwd')),
  };
}

function coverageOf(
  active: readonly Resident[],
  sector: ResidentSummaryFilter['sector'],
): SectorCoverage | null {
  if (!isCarded(sector)) return null;
  const details = active.map((resident) =>
    mockSectorDetailsOf(resident, true).find((detail) => detail.sector === sector),
  );
  return {
    sectorIdOnFile: figure(details.filter((detail) => (detail?.idNumber ?? null) !== null).length),
    socialPension:
      sector === 'senior-citizen'
        ? figure(details.filter((detail) => detail?.socialPension === true).length)
        : null,
    appAccounts: figure(active.filter((resident) => mockAppLinkOf(resident) !== null).length),
    digitalIds: figure(
      active.filter((resident) => mockAppLinkOf(resident)?.cardStatus === 'active').length,
    ),
  };
}

/** The milestone birthdays RA 11982 marks with a cash gift (checked against its text, DL-232). */
const MILESTONE_AGES = [80, 85, 90, 95, 100] as const;

function attentionOf(
  active: readonly Resident[],
  sector: ResidentSummaryFilter['sector'],
): readonly SectorAttention[] | null {
  if (!isCarded(sector)) return null;
  const year = Number(manilaDay(demoNow()).slice(0, 4));
  const age = (resident: Resident) => year - Number(resident.birthDate.slice(0, 4));
  const noId = active.filter(
    (resident) =>
      !mockSectorDetailsOf(resident, true).some(
        (detail) => detail.sector === sector && detail.idNumber !== null,
      ),
  ).length;
  const rows: SectorAttention[] = [];
  if (sector === 'senior-citizen') {
    rows.push(
      {
        key: 'milestone-birthdays',
        label: `Turning ${MILESTONE_AGES.join(', ')} in ${year}`,
        figure: figure(
          active.filter((resident) =>
            MILESTONE_AGES.some((milestone) => milestone === age(resident)),
          ).length,
        ),
        basis:
          `Senior citizens under this filter whose birth year makes them ${MILESTONE_AGES.join(', ')} in ${year}: ` +
          'the birthdays RA 11982 marks with a cash gift. It counts birthdays and decides nothing.',
      },
      {
        key: 'centenarians',
        label: 'Aged 100 or more',
        figure: figure(active.filter((resident) => age(resident) >= 100).length),
        basis:
          'Senior citizens under this filter whose birth year makes them 100 or more this year.',
      },
    );
  }
  rows.push({
    key: 'no-sector-id',
    label: 'No sector ID on file',
    figure: figure(noId),
    basis: 'Members of this sector whose latest sector record holds no ID number.',
  });
  return rows;
}

function disabilityRows(active: readonly Resident[]): ReportRow[] {
  const counts = new Map<string, number>();
  for (const resident of active) {
    const type = mockSectorDetailsOf(resident, true).find(
      (detail) => detail.sector === 'pwd',
    )?.disabilityType;
    if (type !== undefined && type !== null) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, value]) => ({ key: type.toLowerCase(), label: type, value }));
}

function isProtected(key: string): boolean {
  return VULNERABILITY_SECTORS.some((sector) => sector === key && isSensitiveSector(sector));
}

function figure(value: number): SummaryFigure {
  return value > 0 && value < SMALL_CELL_THRESHOLD
    ? { value: null, withheld: true }
    : { value, withheld: false };
}

function series(key: string, title: string, labelHeader: string, rows: ReportRow[]): ReportSeries {
  const shown = suppressSmallCells(rows);
  return {
    key,
    title,
    summary: `${title}, active records under the filter. Counts below ${SMALL_CELL_THRESHOLD} are withheld.`,
    labelHeader,
    valueHeader: 'Residents',
    rows: shown,
    total: totalBeforeSuppression(rows),
    suppressionNotice: describeSuppression(shown),
  };
}

/** A protected sector's row stays, withheld, for a reader not cleared to see it counted. */
function protect(
  counted: ReportSeries,
  every: readonly ReportRow[],
  cleared: boolean,
): ReportSeries {
  if (cleared) return counted;
  return {
    ...counted,
    rows: every.map(
      (row) =>
        counted.rows.find((shown) => shown.key === row.key) ?? {
          key: row.key,
          label: row.label,
          value: 0,
          display: WITHHELD_WITH_REASON['protected-sector'],
          isWithheld: true,
        },
    ),
  };
}

function periodOf(
  kind: NonNullable<ResidentSummaryFilter['period']>,
  now: Date,
): { from: Date; previousFrom: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (kind) {
    case 'month':
      return { from: new Date(year, month, 1), previousFrom: new Date(year, month - 1, 1) };
    case 'quarter': {
      const start = month - (month % 3);
      return { from: new Date(year, start, 1), previousFrom: new Date(year, start - 3, 1) };
    }
    case 'year':
      return { from: new Date(year, 0, 1), previousFrom: new Date(year - 1, 0, 1) };
  }
}

function day(value: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
