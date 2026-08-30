import type { BarangayId, IsoDateTime, ProgramId, StaffUserId } from '../shared/ids';
import type { ReportDefinition, ReportGrain, ReportId } from './report-definition';

/* ── Filters ──────────────────────────────────────────────────────────────── */

export type ReportPeriod = 'all-time' | 'last-30-days' | 'last-90-days' | 'this-year';

export const REPORT_PERIOD_LABELS: Readonly<Record<ReportPeriod, string>> = {
  'all-time': 'All time',
  'last-30-days': 'Last 30 days',
  'last-90-days': 'Last 90 days',
  'this-year': 'This year',
};

export interface ReportFilter {
  readonly period?: ReportPeriod;
  readonly barangayId?: BarangayId;
  readonly programId?: ProgramId;
  readonly status?: string;
  readonly caseworkerId?: StaffUserId;
}

export const EMPTY_REPORT_FILTER: ReportFilter = {};

export function isReportFilterActive(filter: ReportFilter): boolean {
  return (
    (filter.period !== undefined && filter.period !== 'all-time') ||
    filter.barangayId !== undefined ||
    filter.programId !== undefined ||
    filter.status !== undefined ||
    filter.caseworkerId !== undefined
  );
}

/**
 * The filter in words.
 *
 * This is what goes at the top of an export, and it is the reason the function
 * lives in the domain rather than in a template: a printed report that does not
 * say what it covers **will** be read as covering everything (`DL-106`).
 *
 * Labels are passed in rather than looked up, because the domain holds no
 * barangay or programme names — those are reference data the caller has.
 */
export interface FilterLabels {
  readonly barangay?: string;
  readonly program?: string;
  readonly caseworker?: string;
}

export function describeFilter(filter: ReportFilter, labels: FilterLabels = {}): string {
  const parts: string[] = [];
  parts.push(REPORT_PERIOD_LABELS[filter.period ?? 'all-time']);
  if (filter.barangayId !== undefined) {
    parts.push(`Barangay: ${labels.barangay ?? filter.barangayId}`);
  }
  if (filter.programId !== undefined) {
    parts.push(`Programme: ${labels.program ?? filter.programId}`);
  }
  if (filter.status !== undefined) {
    parts.push(`Status: ${filter.status}`);
  }
  if (filter.caseworkerId !== undefined) {
    parts.push(`Caseworker: ${labels.caseworker ?? filter.caseworkerId}`);
  }
  return parts.join(' · ');
}

/* ── Rows ─────────────────────────────────────────────────────────────────── */

/**
 * One row of a report.
 *
 * Deliberately the same shape the `ChartTable` primitive already renders, so
 * the chart **is** the table rather than a picture drawn beside one. Every
 * claim a reader can see is a row they can read (`CLAUDE.md` §7, `DL-20`).
 */
export interface ReportRow {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Formatted for display — a peso amount, or `Withheld`. Falls back to `value`. */
  readonly display?: string;
  /** Set when the figure was withheld as a small cell (`DL-105`). */
  readonly isWithheld?: boolean;
  /** Drill-down into the records behind the row, where the reader may see them. */
  readonly routerLink?: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

/**
 * A named set of rows with the sentence that describes it.
 *
 * **The summary is required, not optional.** A visualisation with no plain-text
 * equivalent is one a screen reader cannot convey and a reader cannot check,
 * and the master command asks for every chart claim to be verifiable from
 * tabular data.
 */
export interface ReportSeries {
  readonly key: string;
  readonly title: string;
  /** What this series says, in a sentence. Rendered with the table caption. */
  readonly summary: string;
  readonly labelHeader: string;
  readonly valueHeader: string;
  readonly rows: readonly ReportRow[];
  /**
   * The true total before any suppression, with the rows' own arithmetic.
   * Reported separately so a reader adding up visible rows is not misled.
   */
  readonly total: number;
  /** Non-null when anything in this series was withheld (`DL-105`). */
  readonly suppressionNotice: string | null;
}

/* ── The result ───────────────────────────────────────────────────────────── */

/**
 * A report, its figures, and the conditions that produced them.
 *
 * The applied filter and the generation time are **echoed back with the data**,
 * on the same reasoning as `DashboardSummary`: a number and the conditions it
 * was computed under must travel together, or a screen will eventually show one
 * beside a filter that produced the other.
 */
export interface ReportResult {
  readonly definition: ReportDefinition;
  readonly appliedFilter: ReportFilter;
  /** The filter in words, composed by the data layer that applied it. */
  readonly appliedFilterDescription: string;
  readonly generatedAt: IsoDateTime;
  readonly grain: ReportGrain;
  readonly series: readonly ReportSeries[];
  /**
   * The office's own note about what these figures do and do not show.
   * Carried from the definition so a screen cannot drop it.
   */
  readonly caution: string | null;
  /** Stated whenever suppression is in force, whether or not it bit. */
  readonly disclosureBasis: string;
}

export function seriesFor(result: ReportResult, key: string): ReportSeries | null {
  return result.series.find((series) => series.key === key) ?? null;
}

export function hasAnyRows(result: ReportResult): boolean {
  return result.series.some((series) => series.rows.length > 0);
}

/* ── Exports ──────────────────────────────────────────────────────────────── */

export type ExportFormat = 'csv' | 'printable';

export const EXPORT_FORMAT_LABELS: Readonly<Record<ExportFormat, string>> = {
  csv: 'Spreadsheet (CSV)',
  printable: 'Printable view',
};

/**
 * What accompanies every export, without exception.
 *
 * A spreadsheet on somebody's desktop six months from now has no screen around
 * it. It must carry, in the file itself: which report it is, what filter
 * produced it, when it was generated and by whom, and whether it names people
 * (`DL-106`). A printed report that does not say what it covers will be read as
 * covering everything, and the office will make a decision on it.
 */
export interface ExportManifest {
  readonly reportId: ReportId;
  readonly reportTitle: string;
  readonly question: string;
  readonly appliedFilterDescription: string;
  readonly generatedAt: IsoDateTime;
  readonly generatedBy: string;
  readonly rowCount: number;
  readonly includesPersonLevel: boolean;
  /** The handling rule travelling with the file. */
  readonly handlingNotice: string;
  /** Stated in the file whenever figures were withheld. */
  readonly suppressionNotice: string | null;
}

export const EXPORT_HANDLING_NOTICE =
  'This export contains information held by the Municipal Social Welfare and Development Office ' +
  'of Taytay, Rizal and is protected under RA 10173. Keep it within the office, do not forward ' +
  'it, and delete it when the work it was produced for is finished.';

export const PERSON_LEVEL_WARNING =
  'This export names individual residents. Person-level data leaves the office the moment the ' +
  'file does, and nothing can be recalled. Export it only if the work genuinely cannot be done ' +
  'from the aggregate figures.';

export interface ReportExport {
  readonly manifest: ExportManifest;
  readonly format: ExportFormat;
  /** The file body, composed by the data layer rather than by a screen. */
  readonly content: string;
  readonly filename: string;
}

/**
 * Turns a manifest into the header rows that precede the data.
 *
 * In the file, not beside it. A reader who opens a CSV in six months sees the
 * conditions before the first figure.
 */
export function manifestHeaderLines(manifest: ExportManifest): readonly string[] {
  const lines = [
    `Report,${csvCell(manifest.reportTitle)}`,
    `Question,${csvCell(manifest.question)}`,
    `Filter applied,${csvCell(manifest.appliedFilterDescription)}`,
    `Generated at,${csvCell(manifest.generatedAt)}`,
    `Generated by,${csvCell(manifest.generatedBy)}`,
    `Rows,${manifest.rowCount}`,
    `Names individuals,${csvCell(manifest.includesPersonLevel ? 'Yes' : 'No')}`,
  ];
  if (manifest.suppressionNotice !== null) {
    lines.push(`Withheld figures,${csvCell(manifest.suppressionNotice)}`);
  }
  lines.push(`Handling,${csvCell(manifest.handlingNotice)}`);
  return lines;
}

/**
 * Quotes a CSV cell, and stops a spreadsheet reading one as a formula.
 *
 * Quoting alone handles the parsing problem — a comma or a quote in a barangay name must not shift
 * a column — and does **nothing** for the other one. Excel, LibreOffice and Sheets strip the quotes
 * while parsing and then evaluate the resulting value, so `"=HYPERLINK(...)"` arrives as a live
 * formula in the cell. The defence has to be in the value, not in the quoting.
 *
 * A leading `'` marks the rest as text in every spreadsheet that would otherwise evaluate it, and
 * is the OWASP-recommended defence. It is added only to a cell that would actually be evaluated —
 * one starting `=`, `+`, `-`, `@`, a tab or a carriage return — so ordinary text is untouched and
 * the file still reads as the office wrote it.
 *
 * This matters here more than in most places. `DL-106` exists because an export **leaves the
 * building**: it is opened on somebody else's laptop, months later, in a spreadsheet nobody in this
 * office configured. The cells carry names a clerk typed at intake, which is user-supplied text
 * reaching a program that executes some of it.
 *
 * Numbers do not come through here — a total is written unquoted by the composer — so nothing
 * numeric is turned into text by this.
 */
const EVALUATED_BY_SPREADSHEETS = /^[=+\-@\t\r]/;

export function csvCell(value: string): string {
  const guarded = EVALUATED_BY_SPREADSHEETS.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}
