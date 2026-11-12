import {
  IMPORT_ACTIONS,
  IMPORT_FIELDS,
  IMPORT_GROUPS,
  IMPORT_OUTCOMES,
  RESIDENT_IMPORT_KINDS,
  RESIDENT_IMPORT_STATUSES,
  type ImportCandidate,
  type ImportColumn,
  type ImportField,
  type ImportFieldSpec,
  type ImportGroup,
  type ImportMapping,
  type ImportOutcome,
  type ImportProblem,
  type ImportResolution,
  type ImportResolutionRecord,
  type ImportRow,
  type ResidentId,
  type ResidentImport,
  type ResidentImportId,
  type ResidentImportResult,
  type ResidentImportSummary,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { dateTime, field, id, int, oneOf, str } from './wire';

/**
 * The wire's field names and the domain's, one to one. The only place either list is spelled out
 * beside the other: the API validates snake_case and the domain is camelCase (`DL-165`).
 */
const WIRE_FIELD: Readonly<Record<ImportField, string>> = {
  lastName: 'last_name',
  firstName: 'first_name',
  middleName: 'middle_name',
  suffix: 'suffix',
  sex: 'sex',
  birthDate: 'birth_date',
  civilStatus: 'civil_status',
  barangay: 'barangay',
  purokOrSitio: 'purok_or_sitio',
  streetAddress: 'street_address',
  mobile: 'mobile',
  email: 'email',
};

function fieldFromWire(value: unknown): ImportField | null {
  return IMPORT_FIELDS.find((candidate) => WIRE_FIELD[candidate] === value) ?? null;
}

/** Every item read, or `null`: a list with a row dropped reads as a smaller file. */
function every<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

function actor(value: unknown): string | null | undefined {
  if (value === null) return null;
  const name = field(value, 'name');
  if (name === null) return null;
  return str(name) ?? undefined;
}

/**
 * `ResidentImportSummary` → `ResidentImportSummary` (`DL-214`). Every field is required; `created_by`
 * and `committed_by` are read for the name only.
 *
 * @consumes GET office/imports
 * @consumes POST office/imports
 * @consumes POST office/imports/{id}/commit
 */
export function toResidentImportSummary(wire: unknown): ResidentImportSummary | null {
  const importId = id<ResidentImportId>(field(wire, 'id'));
  const fileName = str(field(wire, 'file_name'));
  const kind = oneOf(field(wire, 'kind'), RESIDENT_IMPORT_KINDS);
  const status = oneOf(field(wire, 'status'), RESIDENT_IMPORT_STATUSES);
  const rowCount = int(field(wire, 'row_count'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const createdBy = actor(field(wire, 'created_by'));
  const rawCommittedAt = field(wire, 'committed_at');
  const committedAt = rawCommittedAt === null ? null : dateTime(rawCommittedAt);
  const committedBy = actor(field(wire, 'committed_by'));
  const rawResult = field(wire, 'result');
  const result = rawResult === null ? null : toResult(rawResult);

  if (
    importId === null ||
    fileName === null ||
    kind === null ||
    status === null ||
    rowCount === null ||
    createdAt === null ||
    createdBy === undefined ||
    (rawCommittedAt !== null && committedAt === null) ||
    committedBy === undefined ||
    (rawResult !== null && result === null)
  ) {
    return null;
  }

  return {
    id: importId,
    fileName,
    kind,
    status,
    rowCount,
    createdAt,
    createdBy,
    committedAt,
    committedBy,
    result,
  };
}

function toResult(wire: unknown): ResidentImportResult | null {
  const created = int(field(wire, 'created'));
  const attached = int(field(wire, 'attached'));
  const skipped = int(field(wire, 'skipped'));
  const errors = int(field(wire, 'errors'));
  if (created === null || attached === null || skipped === null || errors === null) return null;
  return { created, attached, skipped, errors };
}

/**
 * `ResidentImport` → `ResidentImport` (`DL-214`): the summary, and while open the columns, fields,
 * mapping, the rows grouped and the counts; once committed the outcomes. Whole or nothing: a row
 * left out of a group is a row nobody resolves.
 *
 * **Not read**: a candidate's `birth_date` — the row's own, which is how it matched (`DL-73`).
 *
 * @consumes GET office/imports/{id}
 * @consumes PUT office/imports/{id}/mapping
 * @consumes POST office/imports/{id}/rows/{row}/resolve
 */
export function toResidentImport(wire: unknown, barangays: BarangayIndex): ResidentImport | null {
  const summary = toResidentImportSummary(wire);
  const columns = every(field(wire, 'columns'), toColumn);
  const fields = every(field(wire, 'fields'), toFieldSpec);
  const mapping = toMapping(field(wire, 'mapping'));
  const missingFields = every(field(wire, 'missing_fields'), fieldFromWire);
  const counts = field(wire, 'counts');
  const countNew = int(field(counts, 'new'));
  const countMatch = int(field(counts, 'match'));
  const countDuplicate = int(field(counts, 'duplicate'));
  const countError = int(field(counts, 'error'));
  const unresolved = int(field(counts, 'unresolved'));
  const groupsWire = field(wire, 'groups');
  const readRow = (item: unknown): ImportRow | null => toRow(item, barangays);
  const groups: Partial<Record<ImportGroup, readonly ImportRow[]>> = {};
  for (const group of IMPORT_GROUPS) {
    const rows = every(field(groupsWire, group), readRow);
    if (rows === null) return null;
    groups[group] = rows;
  }
  const outcomes = every(field(wire, 'outcomes'), toOutcome);

  if (
    summary === null ||
    columns === null ||
    fields === null ||
    mapping === null ||
    missingFields === null ||
    countNew === null ||
    countMatch === null ||
    countDuplicate === null ||
    countError === null ||
    unresolved === null ||
    outcomes === null
  ) {
    return null;
  }

  return {
    ...summary,
    columns,
    fields,
    mapping,
    missingFields,
    counts: {
      new: countNew,
      match: countMatch,
      duplicate: countDuplicate,
      error: countError,
      unresolved,
    },
    groups: {
      new: groups.new ?? [],
      match: groups.match ?? [],
      duplicate: groups.duplicate ?? [],
      error: groups.error ?? [],
    },
    outcomes,
  };
}

function toColumn(wire: unknown): ImportColumn | null {
  const index = int(field(wire, 'index'));
  const header = str(field(wire, 'header'));
  const samples = every(field(wire, 'samples'), str);
  if (index === null || header === null || samples === null) return null;
  return { index, header, samples };
}

function toFieldSpec(wire: unknown): ImportFieldSpec | null {
  const name = fieldFromWire(field(wire, 'field'));
  const label = str(field(wire, 'label'));
  const required = field(wire, 'required');
  if (name === null || label === null || typeof required !== 'boolean') return null;
  return { field: name, label, required };
}

function toMapping(wire: unknown): ImportMapping | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const mapping: Partial<Record<ImportField, number | null>> = {};
  for (const name of IMPORT_FIELDS) {
    const raw = field(wire, WIRE_FIELD[name]);
    if (raw === undefined) continue;
    const column = raw === null ? null : int(raw);
    if (raw !== null && column === null) return null;
    mapping[name] = column;
  }
  return mapping;
}

function toValues(wire: unknown): Readonly<Partial<Record<ImportField, string>>> | null {
  const values: Partial<Record<ImportField, string>> = {};
  for (const name of IMPORT_FIELDS) {
    const value = str(field(wire, WIRE_FIELD[name]));
    if (value !== null) values[name] = value;
  }
  return values;
}

function toProblem(wire: unknown): ImportProblem | null {
  const message = str(field(wire, 'message'));
  if (message === null) return null;
  return { field: fieldFromWire(field(wire, 'field')), message };
}

function toCandidate(wire: unknown, barangays: BarangayIndex): ImportCandidate | null {
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const name = str(field(wire, 'name'));
  const isActive = field(wire, 'is_active');
  if (residentId === null || name === null || typeof isActive !== 'boolean') return null;
  return {
    residentId,
    name,
    barangayId: barangays.toConsole(str(field(wire, 'barangay_id'))),
    isActive,
  };
}

function toResolutionRecord(wire: unknown): ImportResolutionRecord | null {
  const action = oneOf(field(wire, 'action'), IMPORT_ACTIONS);
  const rawResident = field(wire, 'resident_id');
  const residentId = rawResident === null ? null : id<ResidentId>(rawResident);
  const reason = str(field(wire, 'reason'));
  const by = actor(field(wire, 'by'));
  const at = dateTime(field(wire, 'at'));
  if (
    action === null ||
    (rawResident !== null && residentId === null) ||
    reason === null ||
    by === undefined ||
    at === null
  ) {
    return null;
  }
  return { action, residentId, reason, by, at };
}

function toRow(wire: unknown, barangays: BarangayIndex): ImportRow | null {
  const row = int(field(wire, 'row'));
  const sourceLine = int(field(wire, 'source_line'));
  const rawValues = field(wire, 'values');
  const values = rawValues === null ? null : toValues(rawValues);
  const problems = every(field(wire, 'problems'), toProblem);
  const candidates = every(field(wire, 'candidates'), (item) => toCandidate(item, barangays));
  const rawDuplicate = field(wire, 'duplicate_of');
  const duplicateOf = rawDuplicate === null ? null : int(rawDuplicate);
  const rawResolution = field(wire, 'resolution');
  const resolution = rawResolution === null ? null : toResolutionRecord(rawResolution);
  if (
    row === null ||
    sourceLine === null ||
    problems === null ||
    candidates === null ||
    (rawDuplicate !== null && duplicateOf === null) ||
    (rawResolution !== null && resolution === null)
  ) {
    return null;
  }
  return { row, sourceLine, values, problems, candidates, duplicateOf, resolution };
}

function toOutcome(wire: unknown): ImportOutcome | null {
  const row = int(field(wire, 'row'));
  const sourceLine = int(field(wire, 'source_line'));
  const outcome = oneOf(field(wire, 'outcome'), IMPORT_OUTCOMES);
  const rawResident = field(wire, 'resident_id');
  const residentId = rawResident === null ? null : id<ResidentId>(rawResident);
  if (row === null || sourceLine === null || outcome === null) return null;
  if (rawResident !== null && residentId === null) return null;
  return { row, sourceLine, outcome, residentId };
}

/** `ResidentImportMappingBody`: the whole mapping, every field named, `null` where none is fed. */
export interface ResidentImportMappingWire {
  readonly mapping: {
    readonly last_name: number | null;
    readonly first_name: number | null;
    readonly middle_name: number | null;
    readonly suffix: number | null;
    readonly sex: number | null;
    readonly birth_date: number | null;
    readonly civil_status: number | null;
    readonly barangay: number | null;
    readonly purok_or_sitio: number | null;
    readonly street_address: number | null;
    readonly mobile: number | null;
    readonly email: number | null;
  };
}

export function toWireImportMapping(mapping: ImportMapping): ResidentImportMappingWire {
  return {
    mapping: {
      last_name: mapping.lastName ?? null,
      first_name: mapping.firstName ?? null,
      middle_name: mapping.middleName ?? null,
      suffix: mapping.suffix ?? null,
      sex: mapping.sex ?? null,
      birth_date: mapping.birthDate ?? null,
      civil_status: mapping.civilStatus ?? null,
      barangay: mapping.barangay ?? null,
      purok_or_sitio: mapping.purokOrSitio ?? null,
      street_address: mapping.streetAddress ?? null,
      mobile: mapping.mobile ?? null,
      email: mapping.email ?? null,
    },
  };
}

/** `ResidentImportResolveBody`: the action, the reason, and for `same-person` the record. */
export interface ResidentImportResolveWire {
  readonly action: ImportResolution['action'];
  readonly reason: string;
  readonly resident_id?: string;
}

export function toWireImportResolve(resolution: ImportResolution): ResidentImportResolveWire {
  const reason = resolution.reason.trim();
  return resolution.action === 'same-person'
    ? { action: resolution.action, reason, resident_id: resolution.residentId }
    : { action: resolution.action, reason };
}

/** The upload's one multipart field. The file keeps its own name, which the API keeps as the import's. */
export interface ResidentImportUploadWire {
  readonly file: Blob;
}

export function toWireImportUpload(file: File): ResidentImportUploadWire {
  return { file };
}
