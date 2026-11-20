import { inject, Injectable } from '@angular/core';
import { from, switchMap, throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDate,
  asIsoDateTime,
  ASSISTANCE_IMPORT_FIELDS,
  CIVIL_STATUSES,
  IMPORT_FILE_LIMITS,
  SEXES,
  TAYTAY_BARANGAYS,
  type AssistanceImport,
  type AssistanceImportCandidate,
  type AssistanceImportCreateRecord,
  type AssistanceImportField,
  type AssistanceImportFieldSpec,
  type AssistanceImportGroup,
  type AssistanceImportId,
  type AssistanceImportMapping,
  type AssistanceImportOutcome,
  type AssistanceImportRepository,
  type AssistanceImportResolution,
  type AssistanceImportResolutionRecord,
  type AssistanceImportRow,
  type AssistanceImportSummary,
  type CursorPage,
  type CursorRequest,
  type ImportTemplate,
  type Resident,
  type ResidentDraft,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';

/** The server's fields and words for them (`office/assistance-imports`), sample adapter only. */
const FIELDS: readonly AssistanceImportFieldSpec[] = [
  { field: 'fullName', label: 'Name', required: false },
  { field: 'lastName', label: 'Surname', required: false },
  { field: 'firstName', label: 'Given name', required: false },
  { field: 'middleName', label: 'Middle name', required: false },
  { field: 'suffix', label: 'Suffix', required: false },
  { field: 'sex', label: 'Sex', required: false },
  { field: 'birthDate', label: 'Birth date', required: false },
  { field: 'barangay', label: 'Barangay', required: true },
  { field: 'purokOrSitio', label: 'Purok', required: false },
  { field: 'streetAddress', label: 'Address', required: false },
  { field: 'mobile', label: 'Contact number', required: false },
  { field: 'program', label: 'Type of assistance', required: true },
  { field: 'dateGiven', label: 'Date given', required: true },
  { field: 'dateApplied', label: 'Date applied', required: false },
  { field: 'amount', label: 'Amount', required: false },
  { field: 'status', label: 'Status', required: false },
  { field: 'controlNumber', label: 'Control no.', required: false },
  { field: 'purpose', label: 'Purpose', required: false },
  { field: 'remarks', label: 'Remarks', required: false },
  { field: 'receivedBy', label: 'Received by', required: false },
];

interface HeldResolution extends AssistanceImportResolutionRecord {
  readonly record: AssistanceImportCreateRecord | null;
}

interface HeldImport {
  summary: AssistanceImportSummary;
  headers: readonly string[];
  /** Emptied at commit, as the server empties them. */
  cells: readonly (readonly string[])[];
  mapping: AssistanceImportMapping;
  resolutions: Map<number, HeldResolution>;
  outcomes: readonly AssistanceImportOutcome[];
}

/**
 * Imports of past assistance over the mock registry (`DL-228`), as `office/assistance-imports`
 * behaves in outline: a .csv is read (the sample adapter reads no .xlsx), the mapping guessed from
 * the header, each row grouped — error, duplicate control number within the file, ready on a single
 * strong match in its barangay or a person's finding, needs review otherwise — and nothing filed
 * until commit, which is refused while a required field is unmapped or a row waits.
 *
 * **The sample adapter files no request.** Its commit reports each row's outcome and creates the
 * records a person asked for, but writes nothing to the mock casework: the closed requests and
 * releases are the API's to make. Sample data only, behind the mock.
 */
@Injectable()
export class MockAssistanceImportRepository implements AssistanceImportRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly store = inject(MockResidentStore);
  private imports: HeldImport[] = [];
  private issued = 0;

  list(page: CursorRequest): Observable<CursorPage<AssistanceImportSummary>> {
    const denied = this.deny<CursorPage<AssistanceImportSummary>>();
    if (denied) return denied;
    const newest = [...this.imports].reverse().map((held) => held.summary);
    const start = page.cursor ? Number(page.cursor) : 0;
    const end = start + page.limit;
    const hasMore = end < newest.length;
    return this.latency.respond({
      items: newest.slice(start, end),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }

  upload(file: File): Observable<AssistanceImportSummary> {
    const denied = this.deny<AssistanceImportSummary>();
    if (denied) return denied;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return throwError(() => new Error('The sample adapter reads .csv files only.'));
    }
    if (file.size > IMPORT_FILE_LIMITS.maxBytes) {
      return throwError(() => new Error('That file is larger than the API accepts.'));
    }
    return from(file.text()).pipe(
      switchMap((text) => {
        const lines = text
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '')
          .map((line) => line.split(line.includes(';') ? ';' : ',').map((cell) => cell.trim()));
        const [headers, ...rows] = lines;
        if (headers === undefined || rows.length === 0) {
          return throwError(() => new Error('The file has no rows under its header.'));
        }
        const held: HeldImport = {
          summary: {
            id: asId<AssistanceImportId>(
              `assistance-import-${String(++this.issued).padStart(4, '0')}`,
            ),
            fileName: file.name,
            kind: 'csv',
            status: 'open',
            rowCount: rows.length,
            createdAt: asIsoDateTime(new Date()),
            createdBy: this.access.currentUser()?.displayName ?? null,
            committedAt: null,
            committedBy: null,
            result: null,
            withdrawal: null,
          },
          headers,
          cells: rows,
          mapping: guessMapping(headers),
          resolutions: new Map(),
          outcomes: [],
        };
        this.imports = [...this.imports, held];
        return this.latency.respond(held.summary);
      }),
    );
  }

  get(id: AssistanceImportId): Observable<AssistanceImport | null> {
    const denied = this.deny<AssistanceImport | null>();
    if (denied) return denied;
    const held = this.find(id);
    return this.latency.respond(held === undefined ? null : this.view(held));
  }

  map(id: AssistanceImportId, mapping: AssistanceImportMapping): Observable<AssistanceImport> {
    const denied = this.deny<AssistanceImport>();
    if (denied) return denied;
    const held = this.find(id);
    if (held === undefined) return throwError(() => new Error('That import was not found.'));
    if (held.summary.status !== 'open' || held.resolutions.size > 0) {
      return throwError(
        () => new Error('The columns cannot change once a row is decided or the import committed.'),
      );
    }
    const used = Object.values(mapping).filter((column) => column !== null && column !== undefined);
    if (new Set(used).size !== used.length) {
      return throwError(() => new Error('A column feeds one field at most.'));
    }
    held.mapping = mapping;
    return this.latency.respond(this.view(held));
  }

  resolve(
    id: AssistanceImportId,
    row: number,
    resolution: AssistanceImportResolution,
  ): Observable<AssistanceImport> {
    const denied = this.deny<AssistanceImport>();
    if (denied) return denied;
    const held = this.find(id);
    if (held === undefined) return throwError(() => new Error('That import was not found.'));
    const target = this.rows(held).find((candidate) => candidate.row === row);
    if (target === undefined || held.summary.status !== 'open') {
      return throwError(() => new Error('That row cannot be decided.'));
    }
    if (target.group === 'error') {
      return throwError(
        () =>
          new Error(
            'A row with errors is skipped at commit. Correct it in the file and import that row again.',
          ),
      );
    }
    if (resolution.reason.trim() === '') {
      return throwError(() => new Error('A decision needs a reason.'));
    }
    if (resolution.action === 'create') {
      const draft = toDraft(target, resolution.record);
      if (draft === null) {
        return throwError(
          () => new Error('The registry needs more than the row gives to make a record.'),
        );
      }
    }
    held.resolutions.set(row, {
      action: resolution.action,
      residentId: resolution.action === 'link' ? resolution.residentId : null,
      record: resolution.action === 'create' ? resolution.record : null,
      reason: resolution.reason.trim(),
      by: this.access.currentUser()?.displayName ?? null,
      at: asIsoDateTime(new Date()),
    });
    return this.latency.respond(this.view(held));
  }

  commit(id: AssistanceImportId): Observable<AssistanceImportSummary> {
    const denied = this.deny<AssistanceImportSummary>();
    if (denied) return denied;
    const held = this.find(id);
    if (held === undefined) return throwError(() => new Error('That import was not found.'));
    const view = this.view(held);
    if (
      view.status !== 'open' ||
      view.missingFields.length > 0 ||
      view.counts['needs-review'] > 0
    ) {
      return throwError(
        () => new Error('Every required field needs a column, and every row a decision, first.'),
      );
    }
    const user = this.access.currentUser();
    let residentsCreated = 0;
    const outcomes = view.rows.map((row): AssistanceImportOutcome => {
      const base = { row: row.row, sourceLine: row.sourceLine, requestId: null };
      if (row.group === 'error') {
        return { ...base, outcome: 'error', note: 'The row could not be read under the mapping.' };
      }
      if (row.group === 'duplicate') {
        return {
          ...base,
          outcome: 'duplicate',
          note:
            row.duplicate?.ofRow === null || row.duplicate?.ofRow === undefined
              ? 'The same release is already in the system.'
              : `The same control number under the same programme is already in row ${row.duplicate.ofRow} of this file.`,
        };
      }
      if (row.group === 'skipped') return { ...base, outcome: 'skipped', note: null };
      const decided = held.resolutions.get(row.row);
      if (decided?.action === 'create') {
        const draft = toDraft(row, decided.record ?? {});
        if (draft === null) {
          return { ...base, outcome: 'error', note: 'The registry refused the record.' };
        }
        this.store.add(draft, user?.id ?? null);
        residentsCreated += 1;
      }
      return { ...base, outcome: 'imported', note: null };
    });
    const count = (kind: AssistanceImportOutcome['outcome']): number =>
      outcomes.filter((outcome) => outcome.outcome === kind).length;
    held.outcomes = outcomes;
    held.cells = [];
    held.summary = {
      ...held.summary,
      status: 'committed',
      committedAt: asIsoDateTime(new Date()),
      committedBy: user?.displayName ?? null,
      result: {
        imported: count('imported'),
        skipped: count('skipped'),
        duplicates: count('duplicate'),
        errors: count('error'),
        residentsCreated,
      },
    };
    return this.latency.respond(held.summary);
  }

  withdraw(id: AssistanceImportId, reason: string): Observable<AssistanceImportSummary> {
    const denied = this.deny<AssistanceImportSummary>();
    if (denied) return denied;
    const held = this.find(id);
    if (held === undefined) return throwError(() => new Error('That import was not found.'));
    if (held.summary.status !== 'committed') {
      return throwError(
        () => new Error('Only a committed import can be withdrawn, and only once.'),
      );
    }
    if (reason.trim() === '') return throwError(() => new Error('A withdrawal needs a reason.'));
    held.summary = {
      ...held.summary,
      status: 'withdrawn',
      withdrawal: {
        at: asIsoDateTime(new Date()),
        by: this.access.currentUser()?.displayName ?? null,
        reason: reason.trim(),
      },
    };
    return this.latency.respond(held.summary);
  }

  /** A header-only CSV of the fields' labels, as the server hands out: no sample row. */
  template(): Observable<ImportTemplate> {
    const denied = this.deny<ImportTemplate>();
    if (denied) return denied;
    const header = FIELDS.filter((spec) => spec.field !== 'fullName').map((spec) => spec.label);
    return this.latency.respond({
      fileName: 'import-past-assistance-template.csv',
      contentType: 'text/csv',
      content: `\uFEFF${header.join(',')}\r\n`,
    });
  }

  private deny<T>(): Observable<T> | null {
    return denyUnless<T>(this.access.currentUser(), 'request.import');
  }

  private find(id: AssistanceImportId): HeldImport | undefined {
    return this.imports.find((held) => held.summary.id === id);
  }

  private rows(held: HeldImport): readonly AssistanceImportRow[] {
    const seen = new Map<string, number>();
    // As the API groups them: rows resolved `create` for the same name, barangay, birth date and sex.
    const firstCreate = new Map<string, number>();
    return held.cells.map((cells, index): AssistanceImportRow => {
      const values: Partial<Record<AssistanceImportField, string>> = {};
      for (const field of ASSISTANCE_IMPORT_FIELDS) {
        const column = held.mapping[field];
        const value = column === null || column === undefined ? undefined : cells[column];
        if (value !== undefined && value !== '') values[field] = value;
      }
      const row = index + 1;
      const { last, first } = nameOf(values);
      const problems = [
        ...(last === '' || first === ''
          ? [{ field: null, message: 'The row gives no name to file it under.' }]
          : []),
        ...FIELDS.filter((spec) => spec.required && values[spec.field] === undefined).map(
          (spec) => ({ field: spec.field, message: `${spec.label} is empty.` }),
        ),
      ];
      const key = `${(values.controlNumber ?? '').toLowerCase()}|${(values.program ?? '').toLowerCase()}`;
      const earlier =
        problems.length === 0 && values.controlNumber !== undefined ? seen.get(key) : undefined;
      if (problems.length === 0 && values.controlNumber !== undefined && earlier === undefined) {
        seen.set(key, row);
      }
      const candidates = problems.length > 0 ? [] : this.candidatesFor(values);
      const decided = held.resolutions.get(row) ?? null;
      const strong = candidates.filter((candidate) => candidate.strength === 'strong');
      const proposed = strong.length === 1 ? strong[0] : undefined;
      const group: AssistanceImportGroup =
        problems.length > 0
          ? 'error'
          : earlier !== undefined
            ? 'duplicate'
            : decided?.action === 'skip'
              ? 'skipped'
              : decided !== null || proposed !== undefined
                ? 'ready'
                : 'needs-review';
      const linked =
        decided?.action === 'link'
          ? candidates.find((candidate) => candidate.residentId === decided.residentId)
          : undefined;
      const match =
        decided?.action === 'link' && decided.residentId !== null
          ? { residentId: decided.residentId, label: linked?.label ?? '', how: 'linked' as const }
          : decided === null && proposed !== undefined && group === 'ready'
            ? { residentId: proposed.residentId, label: proposed.label, how: 'proposed' as const }
            : null;
      const draft = toDraftValues(values, {});
      const person =
        `${last}|${first}|${values.barangay ?? ''}|${values.birthDate ?? ''}|${values.sex ?? ''}`.toLowerCase();
      const createsWithRow =
        group === 'ready' && decided?.action === 'create'
          ? (firstCreate.get(person) ?? null)
          : null;
      if (group === 'ready' && decided?.action === 'create' && createsWithRow === null) {
        firstCreate.set(person, row);
      }
      return {
        row,
        sourceLine: row + 1,
        group,
        values: held.summary.status === 'open' ? values : null,
        problems,
        match,
        willCreate: decided?.action === 'create' && createsWithRow === null,
        createsWithRow,
        createProblems: draft === null ? ['The registry needs a civil status and an address.'] : [],
        candidates,
        duplicate:
          earlier === undefined
            ? null
            : { reason: 'control-number', ofRow: earlier, ofRequestReference: null },
        resolution:
          decided === null
            ? null
            : {
                action: decided.action,
                residentId: decided.residentId,
                reason: decided.reason,
                by: decided.by,
                at: decided.at,
              },
      };
    });
  }

  private candidatesFor(
    values: Partial<Record<AssistanceImportField, string>>,
  ): readonly AssistanceImportCandidate[] {
    const { last, first } = nameOf(values);
    const barangay = barangayOf(values.barangay);
    return this.store
      .all()
      .filter(
        (resident) =>
          resident.name.last.toLowerCase() === last.toLowerCase() &&
          resident.name.first.toLowerCase() === first.toLowerCase(),
      )
      .map((resident) => candidate(resident, barangay));
  }

  private view(held: HeldImport): AssistanceImport {
    const rows = held.summary.status === 'open' ? this.rows(held) : [];
    const count = (group: AssistanceImportGroup): number =>
      rows.filter((row) => row.group === group).length;
    const nameMapped =
      (held.mapping.fullName ?? null) !== null ||
      ((held.mapping.lastName ?? null) !== null && (held.mapping.firstName ?? null) !== null);
    return {
      ...held.summary,
      columns: held.headers.map((header, index) => ({
        index,
        header,
        samples:
          held.summary.status === 'open'
            ? held.cells.slice(0, 3).map((cells) => cells[index] ?? '')
            : [],
      })),
      fields: FIELDS,
      mapping: held.mapping,
      missingFields: [
        ...(nameMapped ? [] : (['fullName'] as const)),
        ...FIELDS.filter(
          (spec) => spec.required && (held.mapping[spec.field] ?? null) === null,
        ).map((spec) => spec.field),
      ],
      counts: {
        ready: count('ready'),
        'needs-review': count('needs-review'),
        skipped: count('skipped'),
        duplicate: count('duplicate'),
        error: count('error'),
      },
      rows,
      outcomes: held.outcomes,
    };
  }
}

function nameOf(values: Partial<Record<AssistanceImportField, string>>): {
  readonly last: string;
  readonly first: string;
} {
  if (values.lastName !== undefined || values.firstName !== undefined) {
    return { last: values.lastName ?? '', first: values.firstName ?? '' };
  }
  const [last = '', first = ''] = (values.fullName ?? '').split(',').map((part) => part.trim());
  return { last, first };
}

function barangayOf(name: string | undefined): (typeof TAYTAY_BARANGAYS)[number] | undefined {
  return TAYTAY_BARANGAYS.find(
    (candidate) => candidate.name.toLowerCase() === name?.trim().toLowerCase(),
  );
}

/** A masked label, a band and signals — never a value (`DL-73`). */
function candidate(
  resident: Resident,
  barangay: (typeof TAYTAY_BARANGAYS)[number] | undefined,
): AssistanceImportCandidate {
  const sameBarangay = barangay !== undefined && resident.address.barangayId === barangay.id;
  return {
    residentId: resident.id,
    label: `${resident.name.last}, ${resident.name.first.slice(0, 1)}.`,
    strength: sameBarangay ? 'strong' : 'moderate',
    signals: [
      { attribute: 'surname', outcome: 'same', rule: 'The surnames are the same, ignoring case.' },
      {
        attribute: 'given-name',
        outcome: 'same',
        rule: 'The given names are the same, ignoring case.',
      },
      {
        attribute: 'barangay',
        outcome: sameBarangay ? 'same' : 'differs',
        rule: 'The row’s barangay is compared with the record’s.',
      },
    ],
  };
}

function toDraft(
  row: AssistanceImportRow,
  record: AssistanceImportCreateRecord,
): ResidentDraft | null {
  return toDraftValues(row.values ?? {}, record);
}

function toDraftValues(
  values: Partial<Record<AssistanceImportField, string>>,
  record: AssistanceImportCreateRecord,
): ResidentDraft | null {
  const { last, first } = nameOf(values);
  const sex = record.sex ?? SEXES.find((candidate) => candidate === values.sex?.toLowerCase());
  const birthDate = record.birthDate ?? values.birthDate;
  const civil = record.civilStatus;
  const barangay = barangayOf(values.barangay);
  const street = record.streetAddress ?? values.streetAddress;
  if (
    last === '' ||
    first === '' ||
    sex === undefined ||
    civil === undefined ||
    !CIVIL_STATUSES.includes(civil) ||
    barangay === undefined ||
    street === undefined ||
    birthDate === undefined ||
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)
  ) {
    return null;
  }
  return {
    name: { first, middle: values.middleName ?? '', last, suffix: values.suffix ?? '' },
    sex,
    birthDate: asIsoDate(birthDate),
    civilStatus: civil,
    address: {
      barangayId: barangay.id,
      purokOrSitio: record.purokOrSitio ?? values.purokOrSitio ?? null,
      streetAddress: street,
    },
    contact: { mobile: values.mobile ?? null, email: null },
    sectors: [],
    philsysLastFour: null,
    monthlyIncome: null,
    householdId: null,
  };
}

/** The header's words to a field, as the server guesses them: a simple, sample-only rule. */
function guessMapping(headers: readonly string[]): AssistanceImportMapping {
  const mapping: Partial<Record<AssistanceImportField, number | null>> = {};
  const used = new Set<number>();
  for (const spec of FIELDS) {
    const words = [spec.label, spec.field].map((word) =>
      word.toLowerCase().replace(/[\s_.]+/g, ''),
    );
    const index = headers.findIndex(
      (header, column) =>
        !used.has(column) && words.includes(header.toLowerCase().replace(/[\s_.]+/g, '')),
    );
    mapping[spec.field] = index === -1 ? null : index;
    if (index !== -1) used.add(index);
  }
  return mapping;
}
