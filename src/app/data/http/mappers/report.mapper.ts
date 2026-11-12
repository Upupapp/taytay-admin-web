import {
  PERMISSIONS,
  REPORT_AREA_LABELS,
  REPORT_CATALOGUE,
  REPORT_PERIOD_LABELS,
  SMALL_CELL_THRESHOLD,
  WITHHELD_DISPLAY,
  centavos,
  describePesos,
  isSmallCell,
  reportProblems,
  type ExportManifest,
  type ProgramId,
  type ReportArea,
  type ReportDefinition,
  type ReportExport,
  type ReportFilter,
  type ReportFilterSupport,
  type ReportGrain,
  type ReportId,
  type ReportPeriod,
  type ReportResult,
  type ReportRow,
  type ReportSeries,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { dateTime, field, flag, id, int, oneOf, str } from './wire';

/**
 * Reports, from the Node API (`DL-190`).
 *
 * | Wire                                                    | Domain                       | Absent or wrong means  |
 * | ------------------------------------------------------- | ---------------------------- | ---------------------- |
 * | `[]{id,area,title,question,grain,permission,…}`         | `ReportDefinition`           | the catalogue refused  |
 * | `definition`, `applied_filter`, `…_description`         | `ReportResult` conditions    | the report refused     |
 * | `series[]{…,measure,rows,total,suppression_notice}`     | `ReportSeries`               | the report refused     |
 * | `rows[]{key,label,value,display,withheld,resident_id}`  | `ReportRow`                  | the report refused     |
 * | `limits[]`, `disclosure{threshold,provenance,basis}`    | `limits`, `disclosureBasis`  | the report refused     |
 * | `manifest`, `format`, `filename`, `content`             | `ReportExport`               | the file refused       |
 *
 * **The server suppresses; this file refuses to show what it should have.** Suppression is the
 * server's (`DL-105`), and nothing here can undo it — there is no unsuppressed figure on the wire to
 * read. But a series counting people that arrives with a shown figure below the threshold, a
 * withheld row still carrying a figure or a record to open, or a total smaller than the rows it was
 * taken before, is refused whole rather than rendered: a regression on the server must not become a
 * disclosure on this screen. The threshold is the console's own `SMALL_CELL_THRESHOLD`, so a server
 * that lowered its figure would be refused here until the console agreed.
 *
 * **A definition that breaks the catalogue's rules is refused**, by the same `reportProblems` the
 * console's catalogue is held to (`DL-104`): a person-level report with no stated reason, or one
 * readable on `report.view` alone, does not reach the hub.
 *
 * **Money is formatted here from integer centavos** with the domain's `describePesos`, on a series
 * the server says counts money; goods are counted by the server and never valued (`DL-93`).
 */

const REPORT_IDS: readonly ReportId[] = REPORT_CATALOGUE.map((report) => report.id);
const REPORT_AREAS = Object.keys(REPORT_AREA_LABELS) as ReportArea[];
const REPORT_PERIODS = Object.keys(REPORT_PERIOD_LABELS) as ReportPeriod[];
const GRAINS: readonly ReportGrain[] = ['aggregate', 'person-level'];
const MEASURES = ['people', 'households', 'records', 'centavos'] as const;
const WITHHELD = ['small-cell', 'protected-sector'] as const;
const FORMATS = ['csv'] as const;

type Measure = (typeof MEASURES)[number];

/** Every element mapped, or `null` when any one of them could not be. */
function whole<T>(value: unknown, map: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const mapped: T[] = [];
  for (const raw of value) {
    const item = map(raw);
    if (item === null) {
      return null;
    }
    mapped.push(item);
  }
  return mapped;
}

/** A string that may be absent, or `undefined` when present and not a string. */
function nullableText(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return str(value) ?? undefined;
}

function toFilterSupport(wire: unknown): ReportFilterSupport | null {
  const period = flag(field(wire, 'period'));
  const barangay = flag(field(wire, 'barangay'));
  const program = flag(field(wire, 'program'));
  const status = flag(field(wire, 'status'));
  const caseworker = flag(field(wire, 'caseworker'));
  if (
    period === null ||
    barangay === null ||
    program === null ||
    status === null ||
    caseworker === null
  ) {
    return null;
  }
  return { period, barangay, program, status, caseworker };
}

/**
 * One definition of `GET office/reports`, or `null` when it cannot be read or breaks the
 * catalogue's own rules.
 *
 * @consumes GET office/reports
 */
export function toReportDefinition(wire: unknown): ReportDefinition | null {
  const reportId = oneOf(field(wire, 'id'), REPORT_IDS);
  const area = oneOf(field(wire, 'area'), REPORT_AREAS);
  const title = str(field(wire, 'title'));
  const question = str(field(wire, 'question'));
  const grain = oneOf(field(wire, 'grain'), GRAINS);
  const permission = oneOf(field(wire, 'permission'), PERMISSIONS);
  const justification = nullableText(field(wire, 'person_level_justification'));
  const filters = toFilterSupport(field(wire, 'filters'));
  const unit = str(field(wire, 'unit'));
  const caution = nullableText(field(wire, 'caution'));
  if (
    reportId === null ||
    area === null ||
    title === null ||
    question === null ||
    grain === null ||
    permission === null ||
    justification === undefined ||
    filters === null ||
    unit === null ||
    caution === undefined
  ) {
    return null;
  }
  const definition: ReportDefinition = {
    id: reportId,
    area,
    title,
    question,
    grain,
    permission,
    personLevelJustification: justification,
    filters,
    unit,
    caution,
  };
  return reportProblems(definition).length === 0 ? definition : null;
}

/** The catalogue, whole, or `null`. */
export function toReportDefinitions(wire: unknown): readonly ReportDefinition[] | null {
  return whole(wire, toReportDefinition);
}

/** The filter the server applied, in the console's words. `all-time` is no period filter at all. */
function toAppliedFilter(wire: unknown, barangays: BarangayIndex): ReportFilter | null {
  const period = oneOf(field(wire, 'period'), REPORT_PERIODS);
  const apiBarangay = str(field(wire, 'barangay_id'));
  // The API's barangay, read back as the console's; one the console cannot place is refused.
  const barangayId = barangays.toConsole(apiBarangay);
  if (period === null || (apiBarangay !== null && barangayId === null)) {
    return null;
  }
  const programId = id<ProgramId>(field(wire, 'program_id'));
  const status = str(field(wire, 'status'));
  return {
    ...(period === 'all-time' ? {} : { period }),
    ...(barangayId === null ? {} : { barangayId }),
    ...(programId === null ? {} : { programId }),
    ...(status === null ? {} : { status }),
  };
}

interface WireRow {
  readonly key: string;
  readonly label: string;
  readonly value: number | null;
  readonly display: string | null;
  readonly withheld: (typeof WITHHELD)[number] | null;
  readonly residentId: string | null;
}

function toWireRow(wire: unknown): WireRow | null {
  const key = str(field(wire, 'key'));
  const label = str(field(wire, 'label'));
  const rawValue = field(wire, 'value');
  const value = rawValue === null ? null : int(rawValue);
  const display = nullableText(field(wire, 'display'));
  const rawWithheld = field(wire, 'withheld');
  const withheld = rawWithheld === null ? null : oneOf(rawWithheld, WITHHELD);
  const rawResident = field(wire, 'resident_id');
  const residentId = rawResident === null ? null : str(rawResident);
  if (
    key === null ||
    label === null ||
    (rawValue !== null && (value === null || value < 0)) ||
    display === undefined ||
    (rawWithheld !== null && withheld === null) ||
    (rawResident !== null && residentId === null)
  ) {
    return null;
  }
  return { key, label, value, display, withheld, residentId };
}

/**
 * One series, or `null` — including when it shows what it should have withheld.
 *
 * A withheld row has no figure, no words standing in for one and no record to open; a row with no
 * figure is withheld. A series about people or households shows no figure below the threshold, says
 * so whenever it withheld a small one, and its total — taken before suppression — is at least the
 * shown rows plus one for every small figure withheld. Only those series withhold anything.
 */
function toSeries(wire: unknown, grain: ReportGrain): ReportSeries | null {
  const key = str(field(wire, 'key'));
  const title = str(field(wire, 'title'));
  const summary = str(field(wire, 'summary'));
  const labelHeader = str(field(wire, 'label_header'));
  const valueHeader = str(field(wire, 'value_header'));
  const measure = oneOf<Measure>(field(wire, 'measure'), MEASURES);
  const rows = whole(field(wire, 'rows'), toWireRow);
  const total = int(field(wire, 'total'));
  const notice = nullableText(field(wire, 'suppression_notice'));
  if (
    key === null ||
    title === null ||
    // Required: the table's plain-text equivalent (`DL-108`).
    summary === null ||
    labelHeader === null ||
    valueHeader === null ||
    measure === null ||
    rows === null ||
    total === null ||
    total < 0 ||
    notice === undefined
  ) {
    return null;
  }

  const aboutPeople = measure === 'people' || measure === 'households';
  let shown = 0;
  let smallWithheld = 0;
  for (const row of rows) {
    if ((row.withheld === null) !== (row.value !== null)) {
      return null;
    }
    if (row.withheld !== null) {
      // Withholding the figure and linking to the records behind it withholds nothing (`DL-105`).
      if (!aboutPeople || row.display !== null || row.residentId !== null) {
        return null;
      }
      smallWithheld += row.withheld === 'small-cell' ? 1 : 0;
      continue;
    }
    const value = row.value ?? 0;
    if (aboutPeople && isSmallCell(value)) {
      return null;
    }
    // A record to open belongs to the report that names people, and to nothing aggregate.
    if (row.residentId !== null && grain !== 'person-level') {
      return null;
    }
    shown += value;
  }
  if (smallWithheld > 0 && (notice === null || total - shown < smallWithheld)) {
    return null;
  }

  const money = measure === 'centavos';
  return {
    key,
    title,
    summary,
    labelHeader,
    valueHeader,
    rows: rows.map((row) => toRow(row, money)),
    total,
    ...(money ? { totalDisplay: describePesos(centavos(total)) } : {}),
    suppressionNotice: notice,
  };
}

function toRow(row: WireRow, money: boolean): ReportRow {
  if (row.withheld !== null) {
    // Never a zero and never blank on screen: the label stays, marked (`DL-105`).
    return {
      key: row.key,
      label: row.label,
      value: 0,
      display: WITHHELD_DISPLAY,
      isWithheld: true,
    };
  }
  const value = row.value ?? 0;
  const display = money ? describePesos(centavos(value)) : row.display;
  return {
    key: row.key,
    label: row.label,
    value,
    ...(display === null ? {} : { display }),
    ...(row.residentId === null ? {} : { routerLink: `/residents/${row.residentId}` }),
  };
}

function textList(wire: unknown): readonly string[] | null {
  return whole(wire, (item) => str(item));
}

/**
 * `GET office/reports/{id}` → `ReportResult`, or `null` when any part of it cannot be read or shows
 * what it should not.
 *
 * @consumes GET office/reports/{id}
 */
export function toReportResult(wire: unknown, barangays: BarangayIndex): ReportResult | null {
  const definition = toReportDefinition(field(wire, 'definition'));
  const appliedFilter = toAppliedFilter(field(wire, 'applied_filter'), barangays);
  const description = str(field(wire, 'applied_filter_description'));
  const generatedAt = dateTime(field(wire, 'generated_at'));
  const grain = oneOf(field(wire, 'grain'), GRAINS);
  const caution = nullableText(field(wire, 'caution'));
  const limits = textList(field(wire, 'limits'));
  const disclosure = field(wire, 'disclosure');
  const threshold = int(field(disclosure, 'threshold'));
  const basis = str(field(disclosure, 'basis'));
  if (
    definition === null ||
    appliedFilter === null ||
    description === null ||
    generatedAt === null ||
    grain === null ||
    grain !== definition.grain ||
    caution === undefined ||
    limits === null ||
    basis === null ||
    // The console's threshold, not the server's: a lower figure there is refused here.
    threshold !== SMALL_CELL_THRESHOLD
  ) {
    return null;
  }
  const series = whole(field(wire, 'series'), (item) => toSeries(item, grain));
  if (series === null) {
    return null;
  }
  return {
    definition,
    appliedFilter,
    appliedFilterDescription: description,
    generatedAt,
    grain,
    series,
    caution,
    disclosureBasis: basis,
    limits,
  };
}

/** The conditions a file must carry inside it, found as lines in the file itself (`DL-106`). */
const CONDITIONS_IN_THE_FILE = [
  /^Report,/m,
  /^Question,/m,
  /^Filter applied,/m,
  /^Generated at,/m,
  /^Generated by,/m,
  /^Names individuals,"(Yes|No)"/m,
  /^Handling,.*RA 10173/m,
];

/**
 * `GET office/reports/{id}/export` → `ReportExport`, or `null` — including a file that does not
 * carry its own conditions.
 *
 * @consumes GET office/reports/{id}/export
 */
export function toReportExport(wire: unknown): ReportExport | null {
  const manifestWire = field(wire, 'manifest');
  const reportId = oneOf(field(manifestWire, 'report_id'), REPORT_IDS);
  const reportTitle = str(field(manifestWire, 'report_title'));
  const question = str(field(manifestWire, 'question'));
  const description = str(field(manifestWire, 'applied_filter_description'));
  const generatedAt = dateTime(field(manifestWire, 'generated_at'));
  const generatedBy = str(field(manifestWire, 'generated_by'));
  const rowCount = int(field(manifestWire, 'row_count'));
  const includesPersonLevel = flag(field(manifestWire, 'includes_person_level'));
  const handlingNotice = str(field(manifestWire, 'handling_notice'));
  const suppressionNotice = nullableText(field(manifestWire, 'suppression_notice'));
  const limits = textList(field(manifestWire, 'limits'));
  const format = oneOf(field(wire, 'format'), FORMATS);
  const filename = str(field(wire, 'filename'));
  const content = str(field(wire, 'content'));
  if (
    reportId === null ||
    reportTitle === null ||
    question === null ||
    description === null ||
    generatedAt === null ||
    generatedBy === null ||
    rowCount === null ||
    includesPersonLevel === null ||
    handlingNotice === null ||
    !handlingNotice.includes('RA 10173') ||
    suppressionNotice === undefined ||
    limits === null ||
    format === null ||
    filename === null ||
    content === null ||
    CONDITIONS_IN_THE_FILE.some((condition) => !condition.test(content)) ||
    // The file says it names people exactly when its manifest does.
    content.includes('Names individuals,"Yes"') !== includesPersonLevel
  ) {
    return null;
  }
  const manifest: ExportManifest = {
    reportId,
    reportTitle,
    question,
    appliedFilterDescription: description,
    generatedAt,
    generatedBy,
    rowCount,
    includesPersonLevel,
    handlingNotice,
    suppressionNotice,
    limits,
  };
  return { manifest, format, content, filename };
}

/**
 * One aggregate series read with every rule `toSeries` holds — no figure below the threshold, a
 * withheld row with nothing to open, a total at least the shown rows — for the Citizens overview,
 * which answers the reports' own series shape (`DL-213`).
 */
export function toAggregateSeries(wire: unknown): ReportSeries | null {
  return toSeries(wire, 'aggregate');
}
