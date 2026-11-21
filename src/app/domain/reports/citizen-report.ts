import type { ResidentAgeGroup, Sex, VulnerabilitySector } from '../residents/resident';
import type { ResidentSummaryPeriod } from '../residents/resident-summary';
import type { BarangayId } from '../shared/ids';
import type { SummaryReport, SummarySection } from './summary-report';

/**
 * The citizen registry report (`DL-234`; backend ADR 0007): the Citizens overview's figures in the
 * office's standard template — the Tulong report's letterhead, period, filter in words, executive
 * summary, lettered sections, signatures and footer — so both print on the same A4 sheet.
 *
 * **The API counts; the console draws**, exactly as for the summary report (`DL-228`). Every figure,
 * withheld cell, total and sentence arrives from `GET office/reports/citizens` already decided, by
 * the same functions that answer `GET office/residents/summary`. Nothing here adds a column up.
 *
 * Every read is a run the server records (`office_report.citizens_read`), so a screen asks for it
 * deliberately and never on a timer.
 */

/** The sections, A to G, in the template's order: a section's letter is its place here. */
export const CITIZEN_REPORT_SECTION_KEYS = [
  'at-a-glance',
  'registry-by-month',
  'by-barangay',
  'by-age-sex',
  'by-sector',
  'registry-to-id',
  'this-month',
] as const;
export type CitizenReportSectionKey = (typeof CITIZEN_REPORT_SECTION_KEYS)[number];

/**
 * What a reader may narrow the report to, the overview's own filters. An empty filter is the year
 * to date across the reader's whole scope, which is the API's default for this report.
 */
export interface CitizenReportFilter {
  readonly barangayId?: BarangayId;
  /** A protected sector only for a reader holding `request.view-sensitive`; the API refuses it otherwise. */
  readonly sector?: VulnerabilitySector;
  readonly ageGroup?: ResidentAgeGroup;
  readonly sex?: Sex;
  /** The calendar period, to date, that "registered this period" and the change are counted over. */
  readonly period?: ResidentSummaryPeriod;
}

/** The figures the executive summary was written from; each count of people is `null` when withheld. */
export interface CitizenReportFigures {
  /** Active records under the filter now: a total, taken before suppression. */
  readonly residents: number;
  readonly residentsPrevious: number;
  readonly registered: number | null;
  readonly registeredWithheld: boolean;
  readonly womenSharePercent: number | null;
  readonly onApp: number | null;
  readonly verified: number | null;
  readonly activeIds: number | null;
}

export interface CitizenReport extends Omit<SummaryReport, 'executiveSummary' | 'sections'> {
  readonly executiveSummary: {
    readonly paragraphs: readonly string[];
    readonly figures: CitizenReportFigures;
  };
  readonly sections: readonly SummarySection<CitizenReportSectionKey>[];
}

/** True when nobody is on the registry under the filter: the sheet says so instead of seven empty tables. */
export function isCitizenReportEmpty(report: CitizenReport): boolean {
  return report.executiveSummary.figures.residents === 0;
}
