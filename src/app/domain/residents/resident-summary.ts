import type { ReportSeries } from '../reports/report-result';
import type { BarangayId, IsoDate, IsoDateTime } from '../shared/ids';
import type { ResidentAgeGroup, Sex, VulnerabilitySector } from './resident';

/**
 * The Citizens overview (`DL-213`): the registry counted by the API, never by this console, from
 * `GET office/residents/summary` (`resident.view`, under the registry list's own scope).
 *
 * **Small cells are withheld by the server** (`DL-105`). A count of people from 1 to the threshold
 * less one arrives as no figure, said to be withheld, never a zero; the series total is taken before
 * anything is withheld. A protected sector is never counted for a reader without
 * `request.view-sensitive`. Nothing here recomputes, rounds or fills in a figure.
 */
export interface ResidentSummary {
  readonly asOf: IsoDateTime;
  readonly period: ResidentSummaryPeriodRange;
  /** Active records under the filter: now, and as the period began. Taken before suppression. */
  readonly residents: { readonly current: number; readonly previous: number };
  /** Records created this period (to date) and in the whole previous one; each may be withheld. */
  readonly registered: { readonly current: SummaryFigure; readonly previous: SummaryFigure };
  readonly byBarangay: ReportSeries;
  /** Sectors overlap: one person may be counted under several. */
  readonly bySector: ReportSeries;
  readonly byAgeSex: ReportSeries;
  readonly recordsToTidy: readonly RecordsToTidy[];
  readonly disclosure: SummaryDisclosure;
}

export interface ResidentSummaryPeriodRange {
  readonly kind: ResidentSummaryPeriod;
  readonly from: IsoDate;
  readonly to: IsoDate;
  readonly previousFrom: IsoDate;
  readonly previousTo: IsoDate;
}

/** A count of people the server may have withheld: `value` is `null` exactly when it did. */
export interface SummaryFigure {
  readonly value: number | null;
  readonly withheld: boolean;
}

/**
 * A condition of the records, as an office alert (`DL-98`, `DL-103`): a count with the rule that
 * produced it, never a list of who. `count` is `null` for possible duplicates before any detection
 * pass has run — said, not shown as zero.
 */
export interface RecordsToTidy {
  readonly key: RecordsToTidyKind;
  readonly count: number | null;
  readonly basis: string;
  readonly lastRunAt: IsoDateTime | null;
}

export const RECORDS_TO_TIDY_KINDS = ['missing-contact', 'possible-duplicates'] as const;
export type RecordsToTidyKind = (typeof RECORDS_TO_TIDY_KINDS)[number];

export interface SummaryDisclosure {
  readonly threshold: number;
  readonly provenance: string;
  readonly basis: string;
}

export const RESIDENT_SUMMARY_PERIODS = ['month', 'quarter', 'year'] as const;
export type ResidentSummaryPeriod = (typeof RESIDENT_SUMMARY_PERIODS)[number];

export interface ResidentSummaryFilter {
  readonly barangayId?: BarangayId;
  readonly sector?: VulnerabilitySector;
  readonly ageGroup?: ResidentAgeGroup;
  readonly sex?: Sex;
  /** The server's default is the month. */
  readonly period?: ResidentSummaryPeriod;
}

export type SummaryDelta =
  | { readonly direction: 'up' | 'down'; readonly amount: number }
  | { readonly direction: 'same' };

/**
 * How a figure moved from the previous period: `null` when either side was withheld, because a
 * difference against a figure nobody may see would disclose it.
 */
export function summaryDelta(current: number | null, previous: number | null): SummaryDelta | null {
  if (current === null || previous === null) return null;
  if (current === previous) return { direction: 'same' };
  return current > previous
    ? { direction: 'up', amount: current - previous }
    : { direction: 'down', amount: previous - current };
}

/** True when anything but the period narrows the overview. */
export function isResidentSummaryFiltered(filter: ResidentSummaryFilter): boolean {
  return (
    filter.barangayId !== undefined ||
    filter.sector !== undefined ||
    filter.ageGroup !== undefined ||
    filter.sex !== undefined
  );
}
