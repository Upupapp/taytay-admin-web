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
  /**
   * Active records under the filter: now, and as the period began. Taken before suppression.
   * `byMonth` is the registry at the end of each of the last twelve Manila months, the current one
   * as it stands, oldest first — each point a count of people, so each may be withheld.
   */
  readonly residents: {
    readonly current: number;
    readonly previous: number;
    readonly byMonth: readonly MonthFigure[];
    /**
     * The people on the registry now, by the Manila month their record was added and how — typed
     * in at the office, or created by an imported list — over the same twelve months (backend
     * ADR 0011). Each cell is a count of people and may be withheld on its own.
     */
    readonly addedByMonth: readonly AddedMonth[];
  };
  /** Records created this period (to date) and in the whole previous one; each may be withheld. */
  readonly registered: { readonly current: SummaryFigure; readonly previous: SummaryFigure };
  readonly byBarangay: ReportSeries;
  /** Sectors overlap: one person may be counted under several. */
  readonly bySector: ReportSeries;
  readonly byAgeSex: ReportSeries;
  /**
   * Female and male under the age-and-sex series, **taken before suppression** like a series total
   * and labelled so (`DL-105`): a reader adding the visible cells is not misled.
   */
  readonly totalBySex: { readonly female: number; readonly male: number };
  /** From the registry to a Digital ID under the same filter (`DL-232`). */
  readonly funnel: RegistryFunnel;
  /** The strip's figures as the period began, for "vs last period" (`DL-254`, backend ADR 0013). */
  readonly atPeriodStart: SummaryAtPeriodStart;
  /** This Manila month: birthdays that move a person between age groups, sector IDs ending. */
  readonly thisMonth: RegistryThisMonth;
  /** With a sector filter of senior citizens, PWD or solo parents only; `null` otherwise. */
  readonly coverage: SectorCoverage | null;
  /** With the same three sector filters only; `null` otherwise. Advice, never a decision. */
  readonly attention: readonly SectorAttention[] | null;
  /** With the PWD filter only. Free-text types under the threshold are pooled server-side. */
  readonly byDisabilityType: ReportSeries | null;
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

/** One month of a series of people: `YYYY-MM`, and its figure (withheld below the threshold). */
export interface MonthFigure {
  readonly month: string;
  readonly figure: SummaryFigure;
}

/** One month's additions to the registry, by how each record came onto it. */
export interface AddedMonth {
  readonly month: string;
  readonly office: SummaryFigure;
  readonly imported: SummaryFigure;
}

/**
 * The registry's way to a Digital ID: the total, then the records linked to an open app account,
 * those whose account is verified, and those holding an active card. The three after the total are
 * people, each withheld below the threshold.
 */
export interface RegistryFunnel {
  readonly onRegistry: number;
  readonly onApp: SummaryFigure;
  readonly verified: SummaryFigure;
  readonly activeIds: SummaryFigure;
}

/**
 * The strip's figures as the period began (`DL-254`, backend ADR 0013), each read by the server from
 * history it only ever appends to — sector acts, account links, their moves, closures, and since
 * `DL-257` (backend ADR 0014) each card's changes of status — so each is what a read at that instant
 * said, never an estimate. The cards' history began on a known day: for a period that began before
 * it there is no earlier card figure, and the screen says so and from when one is recorded.
 */
export interface SummaryAtPeriodStart {
  /** Midnight, Asia/Manila, on the period's first day. */
  readonly at: IsoDateTime;
  /** Every sector the server sent; a protected one is withheld from a reader not cleared for it. */
  readonly bySector: readonly SectorFigure[];
  readonly onApp: SummaryFigure;
  /** `null` when the period began before the cards' status history did: unknown, not zero. */
  readonly activeIds: SummaryFigure | null;
  /** When the cards' status history began. */
  readonly activeIdsRecordedFrom: IsoDateTime;
}

export interface SectorFigure {
  readonly sector: VulnerabilitySector;
  readonly figure: SummaryFigure;
}

/**
 * What the registry says falls in this Manila month. "Due" and "expiring" mean the latest sector
 * record's recorded validity ends this month — a recorded date, not a rule. It decides nothing.
 */
export interface RegistryThisMonth {
  /** `YYYY-MM`. */
  readonly month: string;
  readonly turning60: SummaryFigure;
  readonly turning18: SummaryFigure;
  readonly soloParentIdsDue: SummaryFigure;
  readonly pwdIdsExpiring: SummaryFigure;
}

/** A sector's benefits and IDs, each a count of people. `socialPension` is for seniors only. */
export interface SectorCoverage {
  readonly sectorIdOnFile: SummaryFigure;
  readonly socialPension: SummaryFigure | null;
  readonly appAccounts: SummaryFigure;
  readonly digitalIds: SummaryFigure;
}

export const SECTOR_ATTENTION_KINDS = [
  'milestone-birthdays',
  'centenarians',
  'no-sector-id',
] as const;
export type SectorAttentionKind = (typeof SECTOR_ATTENTION_KINDS)[number];

/**
 * A count a sector page puts in "Needs attention", with the label and the rule the API counted by
 * (`DL-98`). It gates nothing, and the count is of people, so it may be withheld.
 */
export interface SectorAttention {
  readonly key: SectorAttentionKind;
  readonly label: string;
  readonly figure: SummaryFigure;
  readonly basis: string;
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
  { readonly direction: 'up' | 'down'; readonly amount: number } | { readonly direction: 'same' };

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
