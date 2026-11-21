import {
  CITIZEN_REPORT_SECTION_KEYS,
  SUMMARY_MEASURES,
  SUMMARY_SECTION_KEYS,
  SUMMARY_SECTION_LETTERS,
  SUMMARY_WITHHELD_REASONS,
  type CitizenReport,
  type CitizenReportFigures,
  type SummaryCell,
  type SummaryColumn,
  type SummaryFigures,
  type SummaryNamedFigure,
  type SummaryReport,
  type SummaryReportExport,
  type SummaryRow,
  type SummarySection,
  type SummarySignatory,
  type SummaryTile,
  type SummaryWithheldReason,
} from '@domain/index';

import { date, dateTime, field, int, oneOf, str } from './wire';

/**
 * `SummaryReport` (`GET office/reports/summary`) → `SummaryReport` (`DL-228`).
 *
 * | wire                 | domain             | if absent or malformed          |
 * | -------------------- | ------------------ | ------------------------------- |
 * | `letterhead[]`       | `letterhead`       | the report is not readable      |
 * | `title`              | `title`            | the report is not readable      |
 * | `period.*`           | `period`           | the report is not readable      |
 * | `filters_in_words[]` | `filtersInWords`   | the report is not readable      |
 * | `executive_summary`  | `executiveSummary` | the report is not readable      |
 * | `sections[]`         | `sections`         | the report is not readable      |
 * | `signatories.*`      | `signatories`      | the report is not readable      |
 * | `footer.*`           | `footer`           | the report is not readable      |
 * | `disclosure.*`       | `disclosure`       | the report is not readable      |
 *
 * **Whole or nothing.** A sheet missing section G reads as "nobody in any sector", which is the
 * failure small-cell suppression exists to prevent; so all nine sections must arrive, once each.
 *
 * **What should have been withheld is refused** (`DL-105`). A cell is `null` exactly when it names
 * a reason, and a count of people shown below the server's own threshold is refused whole, as the
 * other reports are: a figure that identifies somebody is not drawn because the server slipped.
 * The overdue figure must be `null` with its sentence (`DL-101`): a number there would state a
 * service standard nobody set.
 *
 * **Not read**: `filters`, which repeats the ids the console sent; `filters_in_words` says them.
 *
 * @consumes GET office/reports/summary
 */
export function toSummaryReport(wire: unknown): SummaryReport | null {
  const letterhead = texts(field(wire, 'letterhead'));
  const title = str(field(wire, 'title'));
  const period = toPeriod(field(wire, 'period'));
  const filtersInWords = texts(field(wire, 'filters_in_words'));
  const disclosure = toDisclosure(field(wire, 'disclosure'));
  const threshold = disclosure?.threshold ?? null;
  const executiveSummary =
    threshold === null ? null : toExecutiveSummary(field(wire, 'executive_summary'), threshold);
  const sections =
    threshold === null
      ? null
      : toSections(field(wire, 'sections'), threshold, SUMMARY_SECTION_KEYS);
  const signatories = toSignatories(field(wire, 'signatories'));
  const footer = toFooter(field(wire, 'footer'));
  if (
    letterhead === null ||
    letterhead.length === 0 ||
    title === null ||
    period === null ||
    filtersInWords === null ||
    disclosure === null ||
    executiveSummary === null ||
    sections === null ||
    signatories === null ||
    footer === null
  ) {
    return null;
  }
  return {
    letterhead,
    title,
    period,
    filtersInWords,
    executiveSummary,
    sections,
    signatories,
    footer,
    disclosure,
  };
}

/**
 * `SummaryReportExport` (`GET office/reports/summary/export`) → `SummaryReportExport`, or `null` —
 * including a file that does not carry its own conditions before the first figure (`DL-106`).
 *
 * @consumes GET office/reports/summary/export
 */
export function toSummaryReportExport(wire: unknown): SummaryReportExport | null {
  return toSheetFile(wire);
}

/**
 * `CitizenReport` (`GET office/reports/citizens`) → `CitizenReport` (`DL-234`): the summary
 * report's template with the registry's sections A to G. Read by the same rules, whole or nothing:
 * every section once and in its place, a count of people shown below the threshold refused, a cell
 * `null` exactly when it names why.
 *
 * **Not read**: `filters`, which repeats what the console sent; `filters_in_words` says it.
 *
 * @consumes GET office/reports/citizens
 */
export function toCitizenReport(wire: unknown): CitizenReport | null {
  const letterhead = texts(field(wire, 'letterhead'));
  const title = str(field(wire, 'title'));
  const period = toPeriod(field(wire, 'period'));
  const filtersInWords = texts(field(wire, 'filters_in_words'));
  const disclosure = toDisclosure(field(wire, 'disclosure'));
  const threshold = disclosure?.threshold ?? null;
  const summary = field(wire, 'executive_summary');
  const paragraphs = texts(field(summary, 'paragraphs'));
  const figures =
    threshold === null ? null : toCitizenFigures(field(summary, 'figures'), threshold);
  const sections =
    threshold === null
      ? null
      : toSections(field(wire, 'sections'), threshold, CITIZEN_REPORT_SECTION_KEYS);
  const signatories = toSignatories(field(wire, 'signatories'));
  const footer = toFooter(field(wire, 'footer'));
  if (
    letterhead === null ||
    letterhead.length === 0 ||
    title === null ||
    period === null ||
    filtersInWords === null ||
    disclosure === null ||
    paragraphs === null ||
    paragraphs.length < 2 ||
    figures === null ||
    sections === null ||
    signatories === null ||
    footer === null
  ) {
    return null;
  }
  return {
    letterhead,
    title,
    period,
    filtersInWords,
    executiveSummary: { paragraphs, figures },
    sections,
    signatories,
    footer,
    disclosure,
  };
}

/**
 * `GET office/reports/citizens/export` → `SummaryReportExport`, or `null` when the file does not
 * carry its own conditions before the first figure (`DL-106`).
 *
 * @consumes GET office/reports/citizens/export
 */
export function toCitizenReportExport(wire: unknown): SummaryReportExport | null {
  return toSheetFile(wire);
}

function toCitizenFigures(wire: unknown, threshold: number): CitizenReportFigures | null {
  const residents = count(field(wire, 'residents'));
  const residentsPrevious = count(field(wire, 'residents_previous'));
  const registered = shownCount(field(wire, 'registered'), threshold);
  const registeredWithheld = field(wire, 'registered_withheld');
  const shareWire = field(wire, 'women_share_percent');
  const womenSharePercent = shareWire === null ? null : count(shareWire);
  const onApp = shownCount(field(wire, 'on_app'), threshold);
  const verified = shownCount(field(wire, 'verified'), threshold);
  const activeIds = shownCount(field(wire, 'active_ids'), threshold);
  if (
    residents === null ||
    residentsPrevious === null ||
    registered === undefined ||
    typeof registeredWithheld !== 'boolean' ||
    (registered === null) !== registeredWithheld ||
    (shareWire !== null && (womenSharePercent === null || womenSharePercent > 100)) ||
    onApp === undefined ||
    verified === undefined ||
    activeIds === undefined
  ) {
    return null;
  }
  return {
    residents,
    residentsPrevious,
    registered,
    registeredWithheld,
    womenSharePercent,
    onApp,
    verified,
    activeIds,
  };
}

/** A count of people or `null` (withheld); `undefined` when malformed or shown below the threshold. */
function shownCount(wire: unknown, threshold: number): number | null | undefined {
  if (wire === null) return null;
  const value = count(wire);
  return value !== null && shownPeople(value, threshold) ? value : undefined;
}

function toSheetFile(wire: unknown): SummaryReportExport | null {
  const format = oneOf(field(wire, 'format'), ['csv'] as const);
  const filename = str(field(wire, 'filename'));
  const content = str(field(wire, 'content'));
  if (
    format === null ||
    filename === null ||
    content === null ||
    SUMMARY_FILE_CONDITIONS.some((condition) => !condition.test(content))
  ) {
    return null;
  }
  return { format, filename, content };
}

/** What the server writes before the first figure; a file without any of it is refused. */
const SUMMARY_FILE_CONDITIONS: readonly RegExp[] = [
  /^Period covered,/m,
  /^Narrowed to,/m,
  /^Generated at,/m,
  /^Generated by,/m,
  /^Names individuals,"No"/m,
  /^Handling,.*RA 10173/m,
];

function texts(wire: unknown): readonly string[] | null {
  if (!Array.isArray(wire)) return null;
  const read = wire.map((item) => str(item));
  return read.every((item): item is string => item !== null) ? read : null;
}

function nullableText(wire: unknown): string | null | undefined {
  if (wire === null) return null;
  return str(wire) ?? undefined;
}

function toPeriod(wire: unknown): SummaryReport['period'] | null {
  const from = date(field(wire, 'from'));
  const to = date(field(wire, 'to'));
  const label = str(field(wire, 'label'));
  if (from === null || to === null || label === null || from > to) return null;
  return { from, to, label };
}

function toDisclosure(wire: unknown): SummaryReport['disclosure'] | null {
  const threshold = int(field(wire, 'threshold'));
  const provenance = str(field(wire, 'provenance'));
  const basis = str(field(wire, 'basis'));
  if (threshold === null || threshold < 1 || provenance === null || basis === null) return null;
  return { threshold, provenance, basis };
}

/** A count of people the reader may see: zero, or at least the threshold. Anything else is refused. */
function shownPeople(value: number, threshold: number): boolean {
  return value === 0 || value >= threshold;
}

function count(wire: unknown): number | null {
  const value = int(wire);
  return value !== null && value >= 0 ? value : null;
}

function toExecutiveSummary(
  wire: unknown,
  threshold: number,
): SummaryReport['executiveSummary'] | null {
  const paragraphs = texts(field(wire, 'paragraphs'));
  const figures = toFigures(field(wire, 'figures'), threshold);
  if (paragraphs === null || paragraphs.length < 2 || figures === null) return null;
  return { paragraphs, figures };
}

function toFigures(wire: unknown, threshold: number): SummaryFigures | null {
  const received = count(field(wire, 'received'));
  const served = count(field(wire, 'served'));
  const personsWire = field(wire, 'persons_served');
  const personsWithheld = field(wire, 'persons_served_withheld');
  const personsServed = personsWire === null ? null : count(personsWire);
  const amount = count(field(wire, 'amount_released_centavos'));
  const goods = count(field(wire, 'goods_released'));
  const rejected = count(field(wire, 'rejected'));
  const topProgram = toNamedFigure(field(wire, 'top_program'));
  const topBarangay = toNamedFigure(field(wire, 'top_barangay'));
  const womenWire = field(wire, 'women_share_percent');
  const womenShare = womenWire === null ? null : int(womenWire);
  const daysWire = field(wire, 'average_processing_days');
  const days = typeof daysWire === 'number' && Number.isFinite(daysWire) ? daysWire : null;
  const processingBasis = str(field(wire, 'processing_basis'));
  const openNow = count(field(wire, 'open_now'));
  const overdue = field(wire, 'overdue_now');
  const overdueBasis = str(field(wire, 'overdue_basis'));
  const personsReadable =
    personsWire === null
      ? personsWithheld === 'small-cell'
      : personsServed !== null && personsWithheld === null && shownPeople(personsServed, threshold);
  if (
    received === null ||
    served === null ||
    !personsReadable ||
    amount === null ||
    goods === null ||
    rejected === null ||
    topProgram === undefined ||
    topBarangay === undefined ||
    (womenWire !== null && (womenShare === null || womenShare < 0 || womenShare > 100)) ||
    (daysWire !== null && days === null) ||
    processingBasis === null ||
    openNow === null ||
    // No service standard is set, so a number here would invent one (`DL-101`).
    overdue !== null ||
    overdueBasis === null
  ) {
    return null;
  }
  return {
    received,
    served,
    personsServed,
    personsServedWithheld: personsWire === null,
    amountReleasedCentavos: amount,
    goodsReleased: goods,
    rejected,
    topProgram,
    topBarangay,
    womenSharePercent: womenShare,
    averageProcessingDays: days,
    processingBasis,
    openNow,
    overdueNow: null,
    overdueBasis,
  };
}

/** `undefined` when malformed, so it can be told from a figure that is honestly `null`. */
function toNamedFigure(wire: unknown): SummaryNamedFigure | null | undefined {
  if (wire === null) return null;
  const id = str(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  const served = count(field(wire, 'served'));
  if (id === null || name === null || served === null) return undefined;
  return { id, name, served };
}

function toSections<K extends string>(
  wire: unknown,
  threshold: number,
  template: readonly K[],
): readonly SummarySection<K>[] | null {
  if (!Array.isArray(wire)) return null;
  const sections = wire.map((item) => toSection(item, threshold, template));
  if (sections.some((section) => section === null)) return null;
  const read = sections.filter((section): section is SummarySection<K> => section !== null);
  const keys = new Set(read.map((section) => section.key));
  if (read.length !== template.length || keys.size !== template.length) {
    return null;
  }
  return read;
}

function toSection<K extends string>(
  wire: unknown,
  threshold: number,
  template: readonly K[],
): SummarySection<K> | null {
  const key = oneOf(field(wire, 'key'), template);
  const letter = oneOf(field(wire, 'letter'), SUMMARY_SECTION_LETTERS);
  const title = str(field(wire, 'title'));
  const note = nullableText(field(wire, 'note'));
  const available = field(wire, 'available');
  const unavailableReason = nullableText(field(wire, 'unavailable_reason'));
  const columns = toColumns(field(wire, 'columns'));
  const tiles = toTiles(field(wire, 'tiles'), threshold);
  const rows = columns === null ? null : toRows(field(wire, 'rows'), columns, threshold);
  const totals = columns === null ? undefined : toTotals(field(wire, 'totals'), columns);
  const totalsLabel = nullableText(field(wire, 'totals_label'));
  const suppressionNotice = nullableText(field(wire, 'suppression_notice'));
  if (
    key === null ||
    letter === null ||
    // The letter is the key's place in the template; a section out of place is not the template.
    template.indexOf(key) !== SUMMARY_SECTION_LETTERS.indexOf(letter) ||
    title === null ||
    note === undefined ||
    typeof available !== 'boolean' ||
    unavailableReason === undefined ||
    (!available && unavailableReason === null) ||
    columns === null ||
    tiles === null ||
    rows === null ||
    totals === undefined ||
    totalsLabel === undefined ||
    suppressionNotice === undefined
  ) {
    return null;
  }
  return {
    key,
    letter,
    title,
    note,
    available,
    unavailableReason,
    tiles,
    columns,
    rows,
    totals,
    totalsLabel,
    suppressionNotice,
  };
}

function toColumns(wire: unknown): readonly SummaryColumn[] | null {
  if (!Array.isArray(wire)) return null;
  const columns: SummaryColumn[] = [];
  for (const item of wire) {
    const key = str(field(item, 'key'));
    const label = str(field(item, 'label'));
    const measure = oneOf(field(item, 'measure'), SUMMARY_MEASURES);
    if (key === null || label === null || measure === null) return null;
    columns.push({ key, label, measure });
  }
  return columns;
}

function toTiles(wire: unknown, threshold: number): readonly SummaryTile[] | null {
  if (!Array.isArray(wire)) return null;
  const tiles: SummaryTile[] = [];
  for (const item of wire) {
    const key = str(field(item, 'key'));
    const label = str(field(item, 'label'));
    const measure = oneOf(field(item, 'measure'), SUMMARY_MEASURES);
    const hint = str(field(item, 'hint'));
    const rawValue = field(item, 'value');
    const rawWithheld = field(item, 'withheld');
    const withheld = rawWithheld === null ? null : oneOf(rawWithheld, SUMMARY_WITHHELD_REASONS);
    const value = rawValue === null ? null : count(rawValue);
    if (
      key === null ||
      label === null ||
      measure === null ||
      hint === null ||
      (rawWithheld !== null && withheld === null) ||
      (rawValue !== null && value === null) ||
      // A value is null exactly when it names why.
      (value === null) !== (withheld !== null) ||
      (measure === 'people' && value !== null && !shownPeople(value, threshold))
    ) {
      return null;
    }
    tiles.push({ key, label, value, measure, withheld, hint });
  }
  return tiles;
}

function toRows(
  wire: unknown,
  columns: readonly SummaryColumn[],
  threshold: number,
): readonly SummaryRow[] | null {
  if (!Array.isArray(wire)) return null;
  const rows: SummaryRow[] = [];
  for (const item of wire) {
    const key = str(field(item, 'key'));
    const label = str(field(item, 'label'));
    const values = toCells(field(item, 'values'), columns);
    const withheld = toWithheld(field(item, 'withheld'), columns);
    if (key === null || label === null || values === null || withheld === null) return null;
    for (const column of columns) {
      const value = values[column.key];
      const reason = withheld[column.key];
      if (value === undefined) return null;
      if ((value === null) !== (reason !== undefined)) return null;
      if (column.measure === 'people' && typeof value === 'number') {
        if (!shownPeople(value, threshold)) return null;
      }
    }
    rows.push({ key, label, values, withheld });
  }
  return rows;
}

function toCells(
  wire: unknown,
  columns: readonly SummaryColumn[],
): Readonly<Record<string, SummaryCell>> | null {
  if (wire === null || typeof wire !== 'object' || Array.isArray(wire)) return null;
  const cells: Record<string, SummaryCell> = {};
  for (const column of columns) {
    const value = field(wire, column.key);
    if (value === null || typeof value === 'string') {
      cells[column.key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      cells[column.key] = value;
    } else {
      return null;
    }
  }
  return cells;
}

function toWithheld(
  wire: unknown,
  columns: readonly SummaryColumn[],
): Readonly<Record<string, SummaryWithheldReason>> | null {
  if (wire === null || typeof wire !== 'object' || Array.isArray(wire)) return null;
  const known = new Set(columns.map((column) => column.key));
  const out: Record<string, SummaryWithheldReason> = {};
  for (const [key, value] of Object.entries(wire)) {
    const reason = oneOf(value, SUMMARY_WITHHELD_REASONS);
    if (!known.has(key) || reason === null) return null;
    out[key] = reason;
  }
  return out;
}

/** `undefined` when malformed; `null` when the section has no totals. */
function toTotals(
  wire: unknown,
  columns: readonly SummaryColumn[],
): Readonly<Record<string, number>> | null | undefined {
  if (wire === null) return null;
  if (typeof wire !== 'object' || Array.isArray(wire)) return undefined;
  const known = new Set(columns.map((column) => column.key));
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(wire)) {
    const total = count(value);
    if (!known.has(key) || total === null) return undefined;
    out[key] = total;
  }
  return out;
}

function toSignatory(wire: unknown): SummarySignatory | null {
  const name = nullableText(field(wire, 'name'));
  const title = nullableText(field(wire, 'title'));
  if (name === undefined || title === undefined) return null;
  return { name, title };
}

function toSignatories(wire: unknown): SummaryReport['signatories'] | null {
  const preparedBy = toSignatory(field(wire, 'prepared_by'));
  const notedBy = toSignatory(field(wire, 'noted_by'));
  const approvedBy = toSignatory(field(wire, 'approved_by'));
  if (preparedBy === null || notedBy === null || approvedBy === null) return null;
  return { preparedBy, notedBy, approvedBy };
}

function toFooter(wire: unknown): SummaryReport['footer'] | null {
  const generatedAt = dateTime(field(wire, 'generated_at'));
  const generatedBy = str(field(wire, 'generated_by'));
  const handlingNotice = str(field(wire, 'handling_notice'));
  if (
    generatedAt === null ||
    generatedBy === null ||
    handlingNotice === null ||
    !handlingNotice.includes('RA 10173')
  ) {
    return null;
  }
  return { generatedAt, generatedBy, handlingNotice };
}
