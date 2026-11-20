import {
  ASSISTANCE_IMPORT_ACTIONS,
  ASSISTANCE_IMPORT_FIELDS,
  ASSISTANCE_IMPORT_GROUPS,
  ASSISTANCE_IMPORT_OUTCOMES,
  ASSISTANCE_IMPORT_STATUSES,
  RESIDENT_IMPORT_KINDS,
  type AssistanceImport,
  type AssistanceImportCandidate,
  type AssistanceImportCreateRecord,
  type AssistanceImportDuplicate,
  type AssistanceImportField,
  type AssistanceImportFieldSpec,
  type AssistanceImportId,
  type AssistanceImportMapping,
  type AssistanceImportMatch,
  type AssistanceImportOutcome,
  type AssistanceImportProblem,
  type AssistanceImportResolution,
  type AssistanceImportResolutionRecord,
  type AssistanceImportResult,
  type AssistanceImportRow,
  type AssistanceImportSummary,
  type AssistanceImportWithdrawal,
  type AssistanceRequestId,
  type DuplicateStrength,
  type ImportColumn,
  type MatchAttribute,
  type MatchOutcome,
  type MatchSignal,
  type ResidentId,
} from '@domain/index';

import { dateTime, field, id, int, oneOf, str } from './wire';

/**
 * The wire's field names and the domain's, one to one. The only place either list is spelled out
 * beside the other: the API validates snake_case and the domain is camelCase (`DL-165`).
 */
const WIRE_FIELD: Readonly<Record<AssistanceImportField, string>> = {
  fullName: 'full_name',
  lastName: 'last_name',
  firstName: 'first_name',
  middleName: 'middle_name',
  suffix: 'suffix',
  sex: 'sex',
  birthDate: 'birth_date',
  barangay: 'barangay',
  purokOrSitio: 'purok_or_sitio',
  streetAddress: 'street_address',
  mobile: 'mobile',
  program: 'program',
  dateGiven: 'date_given',
  dateApplied: 'date_applied',
  amount: 'amount',
  status: 'status',
  controlNumber: 'control_number',
  purpose: 'purpose',
  remarks: 'remarks',
  receivedBy: 'received_by',
};

const STRENGTHS: readonly DuplicateStrength[] = ['strong', 'moderate', 'weak'];
const ATTRIBUTES: readonly MatchAttribute[] = [
  'surname',
  'given-name',
  'birth-date',
  'sex',
  'barangay',
  'street-address',
  'mobile',
  'philsys-last-four',
  'household',
];
const OUTCOMES: readonly MatchOutcome[] = ['same', 'similar', 'differs', 'not-comparable'];

function fieldFromWire(value: unknown): AssistanceImportField | null {
  return ASSISTANCE_IMPORT_FIELDS.find((candidate) => WIRE_FIELD[candidate] === value) ?? null;
}

/** Every item read, or `null`: a list with a row dropped reads as a smaller file. */
function every<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

/** An account as `{ id, name }` or `null`, read for the name only; `undefined` when unreadable. */
function actor(value: unknown): string | null | undefined {
  if (value === null) return null;
  const name = field(value, 'name');
  if (name === null) return null;
  return str(name) ?? undefined;
}

/**
 * `AssistanceImportSummary` → `AssistanceImportSummary` (`DL-228`). Every field is required;
 * `created_by`, `committed_by` and the withdrawal's `by` are read for the name only.
 *
 * @consumes GET office/assistance-imports
 * @consumes POST office/assistance-imports
 * @consumes POST office/assistance-imports/{id}/commit
 * @consumes POST office/assistance-imports/{id}/withdraw
 */
export function toAssistanceImportSummary(wire: unknown): AssistanceImportSummary | null {
  const importId = id<AssistanceImportId>(field(wire, 'id'));
  const fileName = str(field(wire, 'file_name'));
  const kind = oneOf(field(wire, 'kind'), RESIDENT_IMPORT_KINDS);
  const status = oneOf(field(wire, 'status'), ASSISTANCE_IMPORT_STATUSES);
  const rowCount = int(field(wire, 'row_count'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const createdBy = actor(field(wire, 'created_by'));
  const rawCommittedAt = field(wire, 'committed_at');
  const committedAt = rawCommittedAt === null ? null : dateTime(rawCommittedAt);
  const committedBy = actor(field(wire, 'committed_by'));
  const rawResult = field(wire, 'result');
  const result = rawResult === null ? null : toResult(rawResult);
  const rawWithdrawal = field(wire, 'withdrawal');
  const withdrawal = rawWithdrawal === null ? null : toWithdrawal(rawWithdrawal);

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
    (rawResult !== null && result === null) ||
    (rawWithdrawal !== null && withdrawal === null)
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
    withdrawal,
  };
}

function toResult(wire: unknown): AssistanceImportResult | null {
  const imported = int(field(wire, 'imported'));
  const skipped = int(field(wire, 'skipped'));
  const duplicates = int(field(wire, 'duplicates'));
  const errors = int(field(wire, 'errors'));
  const residentsCreated = int(field(wire, 'residents_created'));
  if (
    imported === null ||
    skipped === null ||
    duplicates === null ||
    errors === null ||
    residentsCreated === null
  ) {
    return null;
  }
  return { imported, skipped, duplicates, errors, residentsCreated };
}

function toWithdrawal(wire: unknown): AssistanceImportWithdrawal | null {
  const at = dateTime(field(wire, 'at'));
  const by = actor(field(wire, 'by'));
  const reason = str(field(wire, 'reason'));
  if (at === null || by === undefined || reason === null) return null;
  return { at, by, reason };
}

/**
 * `AssistanceImport` → `AssistanceImport` (`DL-228`): the summary, and while open the columns,
 * fields, mapping, counts and rows; once committed the outcomes. Whole or nothing: a row left out
 * is a row nobody resolves.
 *
 * **Not read**: what a resolution's `record` added — the officer's typing, emptied at commit — and
 * any value of a candidate: it carries a masked label, a band and signals only (`DL-73`).
 *
 * @consumes GET office/assistance-imports/{id}
 * @consumes PUT office/assistance-imports/{id}/mapping
 * @consumes POST office/assistance-imports/{id}/rows/{row}/resolve
 */
export function toAssistanceImport(wire: unknown): AssistanceImport | null {
  const summary = toAssistanceImportSummary(wire);
  const columns = every(field(wire, 'columns'), toColumn);
  const fields = every(field(wire, 'fields'), toFieldSpec);
  const mapping = toMapping(field(wire, 'mapping'));
  const missingFields = every(field(wire, 'missing_fields'), fieldFromWire);
  const counts = field(wire, 'counts');
  const ready = int(field(counts, 'ready'));
  const needsReview = int(field(counts, 'needs_review'));
  const skipped = int(field(counts, 'skipped'));
  const duplicate = int(field(counts, 'duplicate'));
  const error = int(field(counts, 'error'));
  const rows = every(field(wire, 'rows'), toRow);
  const outcomes = every(field(wire, 'outcomes'), toOutcome);

  if (
    summary === null ||
    columns === null ||
    fields === null ||
    mapping === null ||
    missingFields === null ||
    ready === null ||
    needsReview === null ||
    skipped === null ||
    duplicate === null ||
    error === null ||
    rows === null ||
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
    counts: { ready, 'needs-review': needsReview, skipped, duplicate, error },
    rows,
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

function toFieldSpec(wire: unknown): AssistanceImportFieldSpec | null {
  const name = fieldFromWire(field(wire, 'field'));
  const label = str(field(wire, 'label'));
  const required = field(wire, 'required');
  if (name === null || label === null || typeof required !== 'boolean') return null;
  return { field: name, label, required };
}

function toMapping(wire: unknown): AssistanceImportMapping | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const mapping: Partial<Record<AssistanceImportField, number | null>> = {};
  for (const name of ASSISTANCE_IMPORT_FIELDS) {
    const raw = field(wire, WIRE_FIELD[name]);
    if (raw === undefined) continue;
    const column = raw === null ? null : int(raw);
    if (raw !== null && column === null) return null;
    mapping[name] = column;
  }
  return mapping;
}

function toValues(wire: unknown): Readonly<Partial<Record<AssistanceImportField, string>>> {
  const values: Partial<Record<AssistanceImportField, string>> = {};
  for (const name of ASSISTANCE_IMPORT_FIELDS) {
    const value = str(field(wire, WIRE_FIELD[name]));
    if (value !== null) values[name] = value;
  }
  return values;
}

function toProblem(wire: unknown): AssistanceImportProblem | null {
  const message = str(field(wire, 'message'));
  if (message === null) return null;
  return { field: fieldFromWire(field(wire, 'field')), message };
}

function toMatch(wire: unknown): AssistanceImportMatch | null {
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const label = str(field(wire, 'label'));
  const how = oneOf(field(wire, 'how'), ['proposed', 'linked'] as const);
  if (residentId === null || label === null || how === null) return null;
  return { residentId, label, how };
}

function toSignal(wire: unknown): MatchSignal | null {
  const attribute = oneOf(field(wire, 'attribute'), ATTRIBUTES);
  const outcome = oneOf(field(wire, 'outcome'), OUTCOMES);
  const rule = str(field(wire, 'rule'));
  // An attribute, an outcome and a rule, and nothing else is read: a value is never carried (DL-73).
  return attribute === null || outcome === null || rule === null
    ? null
    : { attribute, outcome, rule };
}

function toCandidate(wire: unknown): AssistanceImportCandidate | null {
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const label = str(field(wire, 'label'));
  const strength = oneOf(field(wire, 'strength'), STRENGTHS);
  const signals = every(field(wire, 'signals'), toSignal);
  if (residentId === null || label === null || strength === null || signals === null) return null;
  return { residentId, label, strength, signals };
}

function toDuplicate(wire: unknown): AssistanceImportDuplicate | null {
  const reason = oneOf(field(wire, 'reason'), ['control-number', 'same-day'] as const);
  const rawRow = field(wire, 'of_row');
  const ofRow = rawRow === null ? null : int(rawRow);
  const rawReference = field(wire, 'of_request_reference');
  const ofRequestReference = rawReference === null ? null : str(rawReference);
  if (
    reason === null ||
    (rawRow !== null && ofRow === null) ||
    (rawReference !== null && ofRequestReference === null)
  ) {
    return null;
  }
  return { reason, ofRow, ofRequestReference };
}

function toResolutionRecord(wire: unknown): AssistanceImportResolutionRecord | null {
  const action = oneOf(field(wire, 'action'), ASSISTANCE_IMPORT_ACTIONS);
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

function toRow(wire: unknown): AssistanceImportRow | null {
  const row = int(field(wire, 'row'));
  const sourceLine = int(field(wire, 'source_line'));
  const group = oneOf(field(wire, 'group'), ASSISTANCE_IMPORT_GROUPS);
  const rawValues = field(wire, 'values');
  const values = rawValues === null ? null : toValues(rawValues);
  const problems = every(field(wire, 'problems'), toProblem);
  const rawMatch = field(wire, 'match');
  const match = rawMatch === null ? null : toMatch(rawMatch);
  const willCreate = field(wire, 'will_create');
  const rawCreatesWith = field(wire, 'creates_with_row');
  const createsWithRow = int(rawCreatesWith);
  const createProblems = every(field(wire, 'create_problems'), str);
  const candidates = every(field(wire, 'candidates'), toCandidate);
  const rawDuplicate = field(wire, 'duplicate');
  const duplicate = rawDuplicate === null ? null : toDuplicate(rawDuplicate);
  const rawResolution = field(wire, 'resolution');
  const resolution = rawResolution === null ? null : toResolutionRecord(rawResolution);
  if (
    row === null ||
    sourceLine === null ||
    group === null ||
    problems === null ||
    (rawMatch !== null && match === null) ||
    typeof willCreate !== 'boolean' ||
    (rawCreatesWith !== null && createsWithRow === null) ||
    createProblems === null ||
    candidates === null ||
    (rawDuplicate !== null && duplicate === null) ||
    (rawResolution !== null && resolution === null)
  ) {
    return null;
  }
  return {
    row,
    sourceLine,
    group,
    values,
    problems,
    match,
    willCreate,
    createsWithRow,
    createProblems,
    candidates,
    duplicate,
    resolution,
  };
}

function toOutcome(wire: unknown): AssistanceImportOutcome | null {
  const row = int(field(wire, 'row'));
  const sourceLine = int(field(wire, 'source_line'));
  const rawOutcome = field(wire, 'outcome');
  const outcome = rawOutcome === null ? null : oneOf(rawOutcome, ASSISTANCE_IMPORT_OUTCOMES);
  const rawRequest = field(wire, 'request_id');
  const requestId = rawRequest === null ? null : id<AssistanceRequestId>(rawRequest);
  const rawNote = field(wire, 'note');
  const note = rawNote === null ? null : str(rawNote);
  if (
    row === null ||
    sourceLine === null ||
    (rawOutcome !== null && outcome === null) ||
    (rawRequest !== null && requestId === null) ||
    (rawNote !== null && note === null)
  ) {
    return null;
  }
  return { row, sourceLine, outcome, requestId, note };
}

/** `AssistanceImportMappingBody`: the whole mapping, every field named, `null` where none is fed. */
export interface AssistanceImportMappingWire {
  readonly mapping: {
    readonly full_name: number | null;
    readonly last_name: number | null;
    readonly first_name: number | null;
    readonly middle_name: number | null;
    readonly suffix: number | null;
    readonly sex: number | null;
    readonly birth_date: number | null;
    readonly barangay: number | null;
    readonly purok_or_sitio: number | null;
    readonly street_address: number | null;
    readonly mobile: number | null;
    readonly program: number | null;
    readonly date_given: number | null;
    readonly date_applied: number | null;
    readonly amount: number | null;
    readonly status: number | null;
    readonly control_number: number | null;
    readonly purpose: number | null;
    readonly remarks: number | null;
    readonly received_by: number | null;
  };
}

export function toWireAssistanceImportMapping(
  mapping: AssistanceImportMapping,
): AssistanceImportMappingWire {
  return {
    mapping: {
      full_name: mapping.fullName ?? null,
      last_name: mapping.lastName ?? null,
      first_name: mapping.firstName ?? null,
      middle_name: mapping.middleName ?? null,
      suffix: mapping.suffix ?? null,
      sex: mapping.sex ?? null,
      birth_date: mapping.birthDate ?? null,
      barangay: mapping.barangay ?? null,
      purok_or_sitio: mapping.purokOrSitio ?? null,
      street_address: mapping.streetAddress ?? null,
      mobile: mapping.mobile ?? null,
      program: mapping.program ?? null,
      date_given: mapping.dateGiven ?? null,
      date_applied: mapping.dateApplied ?? null,
      amount: mapping.amount ?? null,
      status: mapping.status ?? null,
      control_number: mapping.controlNumber ?? null,
      purpose: mapping.purpose ?? null,
      remarks: mapping.remarks ?? null,
      received_by: mapping.receivedBy ?? null,
    },
  };
}

/** The `record` of a create: only what the officer gave, each replacing the row's. */
export interface AssistanceImportRecordWire {
  readonly sex?: string;
  readonly birth_date?: string;
  readonly civil_status?: string;
  readonly purok_or_sitio?: string;
  readonly street_address?: string;
}

/** `AssistanceImportResolveBody`: the action, the reason, the record linked or what a create adds. */
export interface AssistanceImportResolveWire {
  readonly action: AssistanceImportResolution['action'];
  readonly reason: string;
  readonly resident_id?: string;
  readonly record?: AssistanceImportRecordWire;
}

function toWireRecord(record: AssistanceImportCreateRecord): AssistanceImportRecordWire {
  const given = (value: string | undefined): string | undefined => {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? undefined : trimmed;
  };
  const sex = record.sex;
  const birthDate = given(record.birthDate);
  const civilStatus = record.civilStatus;
  const purokOrSitio = given(record.purokOrSitio);
  const streetAddress = given(record.streetAddress);
  return {
    ...(sex === undefined ? {} : { sex }),
    ...(birthDate === undefined ? {} : { birth_date: birthDate }),
    ...(civilStatus === undefined ? {} : { civil_status: civilStatus }),
    ...(purokOrSitio === undefined ? {} : { purok_or_sitio: purokOrSitio }),
    ...(streetAddress === undefined ? {} : { street_address: streetAddress }),
  };
}

export function toWireAssistanceImportResolve(
  resolution: AssistanceImportResolution,
): AssistanceImportResolveWire {
  const reason = resolution.reason.trim();
  switch (resolution.action) {
    case 'link':
      return { action: resolution.action, reason, resident_id: resolution.residentId };
    case 'create':
      return { action: resolution.action, reason, record: toWireRecord(resolution.record) };
    case 'skip':
      return { action: resolution.action, reason };
  }
}

/** `AssistanceImportWithdrawBody`: the reason, trimmed. */
export interface AssistanceImportWithdrawWire {
  readonly reason: string;
}

export function toWireAssistanceImportWithdraw(reason: string): AssistanceImportWithdrawWire {
  return { reason: reason.trim() };
}

/** The upload's one multipart field. The file keeps its own name, which the API keeps as the import's. */
export interface AssistanceImportUploadWire {
  readonly file: Blob;
}

export function toWireAssistanceImportUpload(file: File): AssistanceImportUploadWire {
  return { file };
}
