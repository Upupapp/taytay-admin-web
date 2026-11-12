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
  WITHHELD_DISPLAY,
  type ReportRow,
  type ReportSeries,
  type Resident,
  type ResidentSummary,
  type ResidentSummaryFilter,
  type SummaryFigure,
} from '@domain/index';

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
  const inFilter = everyone.filter(
    (resident) =>
      (filter.barangayId === undefined || resident.address.barangayId === filter.barangayId) &&
      (filter.sector === undefined || resident.sectors.includes(filter.sector)) &&
      (filter.ageGroup === undefined || isInAgeGroup(resident.birthDate, filter.ageGroup)) &&
      (filter.sex === undefined || resident.sex === filter.sex),
  );
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
function protect(counted: ReportSeries, every: readonly ReportRow[], cleared: boolean): ReportSeries {
  if (cleared) return counted;
  return {
    ...counted,
    rows: every.map(
      (row) =>
        counted.rows.find((shown) => shown.key === row.key) ?? {
          key: row.key,
          label: row.label,
          value: 0,
          display: WITHHELD_DISPLAY,
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
