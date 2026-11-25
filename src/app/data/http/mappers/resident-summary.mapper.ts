import {
  RECORDS_TO_TIDY_KINDS,
  RESIDENT_SUMMARY_PERIODS,
  SECTOR_ATTENTION_KINDS,
  SMALL_CELL_THRESHOLD,
  type AddedMonth,
  type MonthFigure,
  type RecordsToTidy,
  type RegistryFunnel,
  type RegistryThisMonth,
  type ReportSeries,
  type ResidentSummary,
  type ResidentSummaryPeriodRange,
  type SectorAttention,
  type SectorCoverage,
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
 * | `residents.by_month[]` | `residents.byMonth` | the summary is not readable |
 * | `residents.added_by_month[]{month,office,imported}` | `residents.addedByMonth` | the summary is not readable |
 * | `registered.*`       | `registered`    | the summary is not readable     |
 * | `by_barangay`        | `byBarangay`    | the summary is not readable     |
 * | `by_sector`          | `bySector`      | the summary is not readable     |
 * | `by_age_sex`         | `byAgeSex`      | the summary is not readable     |
 * | `by_age_sex.total_by_sex` | `totalBySex` | the summary is not readable    |
 * | `funnel.*`           | `funnel`        | the summary is not readable     |
 * | `this_month.*`       | `thisMonth`     | the summary is not readable     |
 * | `coverage` (or null) | `coverage`      | the summary is not readable     |
 * | `attention[]` (or null) | `attention`  | the summary is not readable     |
 * | `by_disability_type` (or null) | `byDisabilityType` | the summary is not readable |
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
  const byMonth = whole(field(residents, 'by_month'), toMonthFigure);
  const addedByMonth = whole(field(residents, 'added_by_month'), toAddedMonth);
  const sexWire = field(field(wire, 'by_age_sex'), 'total_by_sex');
  const female = count(field(sexWire, 'female'));
  const male = count(field(sexWire, 'male'));
  const funnel = toFunnel(field(wire, 'funnel'));
  const thisMonth = toThisMonth(field(wire, 'this_month'));
  const coverageWire = field(wire, 'coverage');
  const coverage = coverageWire === null ? null : toCoverage(coverageWire);
  const attentionWire = field(wire, 'attention');
  const attention = attentionWire === null ? null : whole(attentionWire, toAttention);
  const disabilityWire = field(wire, 'by_disability_type');
  const byDisabilityType = disabilityWire === null ? null : toAggregateSeries(disabilityWire);
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
    byMonth === null ||
    addedByMonth === null ||
    female === null ||
    male === null ||
    funnel === null ||
    thisMonth === null ||
    coverage === undefined ||
    (attentionWire !== null && attention === null) ||
    (disabilityWire !== null && byDisabilityType === null) ||
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
    residents: { current: residentsNow, previous: residentsBefore, byMonth, addedByMonth },
    registered: { current: registeredNow, previous: registeredBefore },
    byBarangay: rekeyBarangays(byBarangay, barangays),
    bySector,
    byAgeSex,
    totalBySex: { female, male },
    funnel,
    thisMonth,
    coverage,
    attention: attentionWire === null ? null : attention,
    byDisabilityType: disabilityWire === null ? null : byDisabilityType,
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
  if (
    kind === null ||
    from === null ||
    to === null ||
    previousFrom === null ||
    previousTo === null
  ) {
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

/** A count: a whole number, never negative. */
function count(wire: unknown): number | null {
  const value = int(wire);
  return value !== null && value >= 0 ? value : null;
}

/** Every element read, or `null` if any one cannot be — a shorter series would misstate it. */
function whole<T>(wire: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(wire)) return null;
  const items = wire.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

function month(wire: unknown): string | null {
  const value = str(wire);
  return value !== null && MONTH.test(value) ? value : null;
}

function toMonthFigure(wire: unknown): MonthFigure | null {
  const at = month(field(wire, 'month'));
  const figure = toFigure(wire);
  return at === null || figure === null ? null : { month: at, figure };
}

function toAddedMonth(wire: unknown): AddedMonth | null {
  const at = month(field(wire, 'month'));
  const office = toFigure(field(wire, 'office'));
  const imported = toFigure(field(wire, 'imported'));
  return at === null || office === null || imported === null
    ? null
    : { month: at, office, imported };
}

function toFunnel(wire: unknown): RegistryFunnel | null {
  const onRegistry = count(field(wire, 'on_registry'));
  const onApp = toFigure(field(wire, 'on_app'));
  const verified = toFigure(field(wire, 'verified'));
  const activeIds = toFigure(field(wire, 'active_ids'));
  if (onRegistry === null || onApp === null || verified === null || activeIds === null) return null;
  return { onRegistry, onApp, verified, activeIds };
}

function toThisMonth(wire: unknown): RegistryThisMonth | null {
  const at = month(field(wire, 'month'));
  const turning60 = toFigure(field(wire, 'turning_60'));
  const turning18 = toFigure(field(wire, 'turning_18'));
  const soloParentIdsDue = toFigure(field(wire, 'solo_parent_ids_due'));
  const pwdIdsExpiring = toFigure(field(wire, 'pwd_ids_expiring'));
  if (
    at === null ||
    turning60 === null ||
    turning18 === null ||
    soloParentIdsDue === null ||
    pwdIdsExpiring === null
  ) {
    return null;
  }
  return { month: at, turning60, turning18, soloParentIdsDue, pwdIdsExpiring };
}

/** `undefined` when unreadable, so the wire's deliberate `null` stays an absence. */
function toCoverage(wire: unknown): SectorCoverage | undefined {
  const sectorIdOnFile = toFigure(field(wire, 'sector_id_on_file'));
  const pensionWire = field(wire, 'social_pension');
  const socialPension = pensionWire === null ? null : toFigure(pensionWire);
  const appAccounts = toFigure(field(wire, 'app_accounts'));
  const digitalIds = toFigure(field(wire, 'digital_ids'));
  if (
    sectorIdOnFile === null ||
    (pensionWire !== null && socialPension === null) ||
    appAccounts === null ||
    digitalIds === null
  ) {
    return undefined;
  }
  return { sectorIdOnFile, socialPension, appAccounts, digitalIds };
}

/** A count nobody can check is not shown (`DL-98`): no basis, no row — and so no summary. */
function toAttention(wire: unknown): SectorAttention | null {
  const key = oneOf(field(wire, 'key'), SECTOR_ATTENTION_KINDS);
  const label = str(field(wire, 'label'))?.trim() ?? '';
  const basis = str(field(wire, 'basis'))?.trim() ?? '';
  const figure = toFigure(wire);
  if (key === null || label === '' || basis === '' || figure === null) return null;
  return { key, label, figure, basis };
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
  // The console's threshold, as on a report (`DL-252`): a server on another setting is refused.
  if (
    threshold === null ||
    threshold !== SMALL_CELL_THRESHOLD ||
    provenance === null ||
    basis === null
  ) {
    return null;
  }
  return { threshold, provenance, basis };
}

function rekeyBarangays(series: ReportSeries, barangays: BarangayIndex): ReportSeries {
  return {
    ...series,
    rows: series.rows.map((row) => ({ ...row, key: barangays.toConsole(row.key) ?? row.key })),
  };
}
