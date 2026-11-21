import type { VulnerabilitySector } from '../residents/resident';
import type { BarangayId, IsoDate, IsoDateTime, ProgramId } from '../shared/ids';

/**
 * The summary report — Esperanza's standard template, which the office calls its Tulong report
 * (backend ADR 0005, decision 4; `DL-228`).
 *
 * **The API counts; the console draws.** Every figure, every sentence of the executive summary,
 * every withheld cell and every total arrives from `GET office/reports/summary` already decided.
 * The sheet lays them out on A4 and computes nothing: a total worked out here would be a second
 * answer to the same question, and one that adds up figures the server withheld (`DL-105`).
 *
 * A withheld cell is `null` with its reason beside it — never a zero, never dropped, never rounded.
 * A total is the server's, taken before anything was withheld, and labelled so by the server.
 */

/** The sexes the API filters on, as the registry records them. */
export const SUMMARY_SEXES = ['female', 'male'] as const;
export type SummarySex = (typeof SUMMARY_SEXES)[number];

/** Age on the day filed or served. The API's three bands and no other. */
export const SUMMARY_AGE_GROUPS = ['0-17', '18-59', '60-plus'] as const;
export type SummaryAgeGroup = (typeof SUMMARY_AGE_GROUPS)[number];

/**
 * What a reader may narrow the report to. Every key is optional: an empty filter is the year to
 * date across the office's whole scope, which is the API's own default.
 */
export interface SummaryReportFilter {
  readonly from?: IsoDate;
  readonly to?: IsoDate;
  readonly barangayId?: BarangayId;
  readonly programId?: ProgramId;
  readonly sex?: SummarySex;
  readonly age?: SummaryAgeGroup;
  /** A protected sector only for a reader holding `request.view-sensitive`; the API refuses it otherwise. */
  readonly sector?: VulnerabilitySector;
}

export const SUMMARY_SECTION_KEYS = [
  'at-a-glance',
  'month-by-month',
  'by-program',
  'by-barangay',
  'by-sex',
  'by-age',
  'by-sector',
  'open-by-stage',
  'digital-ids',
] as const;
export type SummarySectionKey = (typeof SUMMARY_SECTION_KEYS)[number];

export const SUMMARY_SECTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export type SummarySectionLetter = (typeof SUMMARY_SECTION_LETTERS)[number];

export const SUMMARY_MEASURES = ['records', 'people', 'centavos', 'percent', 'days'] as const;
/** What a figure counts. `centavos` is money (integer centavos, `Money`); `people` is suppressed. */
export type SummaryMeasure = (typeof SUMMARY_MEASURES)[number];

export const SUMMARY_WITHHELD_REASONS = ['small-cell', 'protected-sector'] as const;
/** Why a cell has no value: too small to publish (`DL-105`), or a sector this reader may not count. */
export type SummaryWithheldReason = (typeof SUMMARY_WITHHELD_REASONS)[number];

/** A cell is a count, a word (who an open request waits on), or `null` when withheld. */
export type SummaryCell = number | string | null;

export interface SummaryTile {
  readonly key: string;
  readonly label: string;
  /** `null` exactly when `withheld` is set. */
  readonly value: number | null;
  readonly measure: SummaryMeasure;
  readonly withheld: SummaryWithheldReason | null;
  readonly hint: string;
}

export interface SummaryColumn {
  readonly key: string;
  readonly label: string;
  readonly measure: SummaryMeasure;
}

export interface SummaryRow {
  readonly key: string;
  readonly label: string;
  readonly values: Readonly<Record<string, SummaryCell>>;
  /** Each withheld column and why; that column's value is `null`. */
  readonly withheld: Readonly<Record<string, SummaryWithheldReason>>;
}

/**
 * One lettered section. Generic over its keys because the citizen registry report
 * (`citizen-report.ts`) is drawn in the same template with its own sections A to G.
 */
export interface SummarySection<K extends string = SummarySectionKey> {
  readonly key: K;
  readonly letter: SummarySectionLetter;
  readonly title: string;
  readonly note: string | null;
  /** False only for the digital IDs, for a reader who does not read the ID register. */
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly tiles: readonly SummaryTile[];
  readonly columns: readonly SummaryColumn[];
  readonly rows: readonly SummaryRow[];
  /** The server's totals, taken before anything was withheld. Never summed here. */
  readonly totals: Readonly<Record<string, number>> | null;
  readonly totalsLabel: string | null;
  readonly suppressionNotice: string | null;
}

export interface SummaryNamedFigure {
  readonly id: string;
  readonly name: string;
  readonly served: number;
}

export interface SummaryFigures {
  readonly received: number;
  readonly served: number;
  /** `null` when withheld (`personsServedWithheld`). */
  readonly personsServed: number | null;
  readonly personsServedWithheld: boolean;
  readonly amountReleasedCentavos: number;
  /** Releases of goods, counted and never valued (`DL-93`). */
  readonly goodsReleased: number;
  readonly rejected: number;
  readonly topProgram: SummaryNamedFigure | null;
  readonly topBarangay: SummaryNamedFigure | null;
  readonly womenSharePercent: number | null;
  readonly averageProcessingDays: number | null;
  readonly processingBasis: string;
  readonly openNow: number;
  /** Always `null`: the office has set no service standard, so nothing is overdue (`DL-101`). */
  readonly overdueNow: null;
  readonly overdueBasis: string;
}

export interface SummarySignatory {
  readonly name: string | null;
  readonly title: string | null;
}

export interface SummaryReport {
  readonly letterhead: readonly string[];
  readonly title: string;
  readonly period: { readonly from: IsoDate; readonly to: IsoDate; readonly label: string };
  /** The filter in words, as the server applied it. Empty when nothing narrows the report. */
  readonly filtersInWords: readonly string[];
  readonly executiveSummary: {
    readonly paragraphs: readonly string[];
    readonly figures: SummaryFigures;
  };
  readonly sections: readonly SummarySection[];
  readonly signatories: {
    readonly preparedBy: SummarySignatory;
    readonly notedBy: SummarySignatory;
    readonly approvedBy: SummarySignatory;
  };
  readonly footer: {
    readonly generatedAt: IsoDateTime;
    readonly generatedBy: string;
    /** The RA 10173 handling rule (`DL-106`). */
    readonly handlingNotice: string;
  };
  readonly disclosure: {
    readonly threshold: number;
    readonly provenance: string;
    readonly basis: string;
  };
}

/** The server's CSV of the same tables, with its conditions before the first figure (`DL-106`). */
export interface SummaryReportExport {
  readonly format: 'csv';
  readonly filename: string;
  readonly content: string;
}

/**
 * The columns a section's chart draws: those counting records or people whose every cell is a
 * number or withheld, at most two. Money, shares and words stay in the table, because a bar of
 * pesos beside a bar of requests puts two scales on one axis.
 */
export function summaryChartColumns(section: SummarySection<string>): readonly SummaryColumn[] {
  return section.columns
    .filter(
      (column) =>
        (column.measure === 'records' || column.measure === 'people') &&
        section.rows.every((row) => {
          const value = row.values[column.key];
          return typeof value === 'number' || value === null || value === undefined;
        }),
    )
    .slice(0, 2);
}

/** True when the period counted nothing at all: no request filed, served, rejected or open. */
export function isSummaryEmpty(report: SummaryReport): boolean {
  const figures = report.executiveSummary.figures;
  return (
    figures.received === 0 &&
    figures.served === 0 &&
    figures.rejected === 0 &&
    figures.openNow === 0
  );
}
