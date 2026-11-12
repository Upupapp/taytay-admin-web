import {
  RECORDS_TO_TIDY_KINDS,
  RESIDENT_SUMMARY_PERIODS,
  type RecordsToTidy,
  type ReportSeries,
  type ResidentSummary,
  type ResidentSummaryPeriodRange,
  type SummaryDisclosure,
  type SummaryFigure,
} from '@domain/index';

import { toAggregateSeries } from './report.mapper';
import type { BarangayIndex } from './resident.mapper';
import { date, dateTime, field, int, list, oneOf, str } from './wire';

/**
 * `OfficeResidentSummary` → `ResidentSummary` (`DL-213`).
 *
 * | wire                 | domain          | if absent or malformed          |
 * | -------------------- | --------------- | ------------------------------- |
 * | `as_of`              | `asOf`          | the summary is not readable     |
 * | `period.*`           | `period`        | the summary is not readable     |
 * | `residents.*`        | `residents`     | the summary is not readable     |
 * | `registered.*`       | `registered`    | the summary is not readable     |
 * | `by_barangay`        | `byBarangay`    | the summary is not readable     |
 * | `by_sector`          | `bySector`      | the summary is not readable     |
 * | `by_age_sex`         | `byAgeSex`      | the summary is not readable     |
 * | `records_to_tidy[]`  | `recordsToTidy` | the summary is not readable     |
 * | `disclosure.*`       | `disclosure`    | the summary is not readable     |
 *
 * **Whole or nothing.** An overview missing one series reads as "none of those", which is the
 * failure small-cell suppression exists to prevent; a figure shown when it should have been withheld
 * is refused, by the same rules as the reports (`toAggregateSeries`). A barangay row is re-keyed from
 * the API's id to the console's, so the screen can link it to the registry; a barangay the console
 * does not know keeps the API's id and is not linked.
 *
 * **Not read**: `applied_filter`, which repeats the filter the console sent.
 *
 * @consumes GET office/residents/summary
 */
export function toResidentSummary(wire: unknown, barangays: BarangayIndex): ResidentSummary | null {
  const asOf = dateTime(field(wire, 'as_of'));
  const period = toPeriod(field(wire, 'period'));
  const residents = field(wire, 'residents');
  const residentsNow = int(field(residents, 'current'));
  const residentsBefore = int(field(residents, 'previous'));
  const registered = field(wire, 'registered');
  const registeredNow = toFigure(field(registered, 'current'));
  const registeredBefore = toFigure(field(registered, 'previous'));
  const byBarangay = toAggregateSeries(field(wire, 'by_barangay'));
  const bySector = toAggregateSeries(field(wire, 'by_sector'));
  const byAgeSex = toAggregateSeries(field(wire, 'by_age_sex'));
  const tidyWire = field(wire, 'records_to_tidy');
  const tidy = Array.isArray(tidyWire) ? list(tidyWire, toRecordsToTidy) : null;
  const disclosure = toDisclosure(field(wire, 'disclosure'));

  if (
    asOf === null ||
    period === null ||
    residentsNow === null ||
    residentsBefore === null ||
    registeredNow === null ||
    registeredBefore === null ||
    byBarangay === null ||
    bySector === null ||
    byAgeSex === null ||
    tidy === null ||
    !Array.isArray(tidyWire) ||
    tidy.length !== tidyWire.length ||
    disclosure === null
  ) {
    return null;
  }

  return {
    asOf,
    period,
    residents: { current: residentsNow, previous: residentsBefore },
    registered: { current: registeredNow, previous: registeredBefore },
    byBarangay: rekeyBarangays(byBarangay, barangays),
    bySector,
    byAgeSex,
    recordsToTidy: tidy,
    disclosure,
  };
}

function toPeriod(wire: unknown): ResidentSummaryPeriodRange | null {
  const kind = oneOf(field(wire, 'kind'), RESIDENT_SUMMARY_PERIODS);
  const from = date(field(wire, 'from'));
  const to = date(field(wire, 'to'));
  const previousFrom = date(field(wire, 'previous_from'));
  const previousTo = date(field(wire, 'previous_to'));
  if (kind === null || from === null || to === null || previousFrom === null || previousTo === null) {
    return null;
  }
  return { kind, from, to, previousFrom, previousTo };
}

/** A withheld figure has no value; a shown one has no withholding. Anything else is refused. */
function toFigure(wire: unknown): SummaryFigure | null {
  const raw = field(wire, 'value');
  const withheld = field(wire, 'withheld');
  if (raw === null && withheld === 'small-cell') return { value: null, withheld: true };
  const value = int(raw);
  if (value !== null && value >= 0 && withheld === null) return { value, withheld: false };
  return null;
}

function toRecordsToTidy(wire: unknown): RecordsToTidy | null {
  const key = oneOf(field(wire, 'key'), RECORDS_TO_TIDY_KINDS);
  const rawCount = field(wire, 'count');
  const count = rawCount === null ? null : int(rawCount);
  const basis = str(field(wire, 'basis'));
  const rawRun = field(wire, 'last_run_at');
  const lastRunAt = rawRun === null || rawRun === undefined ? null : dateTime(rawRun);
  if (
    key === null ||
    (rawCount !== null && (count === null || count < 0)) ||
    basis === null ||
    (rawRun !== null && rawRun !== undefined && lastRunAt === null)
  ) {
    return null;
  }
  return { key, count, basis, lastRunAt };
}

function toDisclosure(wire: unknown): SummaryDisclosure | null {
  const threshold = int(field(wire, 'threshold'));
  const provenance = str(field(wire, 'provenance'));
  const basis = str(field(wire, 'basis'));
  if (threshold === null || provenance === null || basis === null) return null;
  return { threshold, provenance, basis };
}

function rekeyBarangays(series: ReportSeries, barangays: BarangayIndex): ReportSeries {
  return {
    ...series,
    rows: series.rows.map((row) => ({ ...row, key: barangays.toConsole(row.key) ?? row.key })),
  };
}
