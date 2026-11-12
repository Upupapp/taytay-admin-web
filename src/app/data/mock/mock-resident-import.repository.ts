import { inject, Injectable } from '@angular/core';
import { from, switchMap, throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDate,
  asIsoDateTime,
  CIVIL_STATUSES,
  IMPORT_FIELDS,
  IMPORT_FILE_LIMITS,
  SEXES,
  TAYTAY_BARANGAYS,
  type CursorPage,
  type CursorRequest,
  type ImportField,
  type ImportFieldSpec,
  type ImportMapping,
  type ImportOutcome,
  type ImportResolution,
  type ImportResolutionRecord,
  type ImportRow,
  type ResidentDraft,
  type ResidentImport,
  type ResidentImportId,
  type ResidentImportRepository,
  type ResidentImportSummary,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';

/** The server's fields and words for them (`office-imports`), sample adapter only. */
const FIELDS: readonly ImportFieldSpec[] = [
  { field: 'lastName', label: 'Surname', required: true },
  { field: 'firstName', label: 'Given name', required: true },
  { field: 'middleName', label: 'Middle name', required: false },
  { field: 'suffix', label: 'Suffix', required: false },
  { field: 'sex', label: 'Sex', required: true },
  { field: 'birthDate', label: 'Birth date', required: true },
  { field: 'civilStatus', label: 'Civil status', required: false },
  { field: 'barangay', label: 'Barangay', required: true },
  { field: 'purokOrSitio', label: 'Purok or sitio', required: false },
  { field: 'streetAddress', label: 'Street address', required: false },
  { field: 'mobile', label: 'Mobile number', required: false },
  { field: 'email', label: 'Email', required: false },
];

interface HeldImport {
  summary: ResidentImportSummary;
  headers: readonly string[];
  /** Emptied at commit, as the server empties them. */
  cells: readonly (readonly string[])[];
  mapping: ImportMapping;
  resolutions: Map<number, ImportResolutionRecord>;
  outcomes: readonly ImportOutcome[];
}

/**
 * Imports over the mock registry (`DL-214`), as `office-imports` behaves: a .csv is read (the
 * sample adapter reads no .xlsx), the mapping guessed from the header, rows grouped by the same
 * rules — error, repeat within the file, match by name and birth date, new — and nothing written to
 * the registry until commit, which is refused while a required field is unmapped or a match or
 * repeat is undecided. Sample data only, behind the mock.
 */
@Injectable()
export class MockResidentImportRepository implements ResidentImportRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly store = inject(MockResidentStore);
  private imports: HeldImport[] = [];
  private issued = 0;

  list(page: CursorRequest): Observable<CursorPage<ResidentImportSummary>> {
    const denied = this.deny<CursorPage<ResidentImportSummary>>();
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

  upload(file: File): Observable<ResidentImportSummary> {
    const denied = this.deny<ResidentImportSummary>();
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
          .split(/\r?\n/)
          .filter((line) => line.trim() !== '')
          .map((line) => line.split(line.includes(';') ? ';' : ',').map((cell) => cell.trim()));
        const [headers, ...rows] = lines;
        if (headers === undefined || rows.length === 0) {
          return throwError(() => new Error('The file has no rows under its header.'));
        }
        const now = asIsoDateTime(new Date());
        const held: HeldImport = {
          summary: {
            id: asId<ResidentImportId>(`import-${String(++this.issued).padStart(4, '0')}`),
            fileName: file.name,
            kind: 'csv',
            status: 'open',
            rowCount: rows.length,
            createdAt: now,
            createdBy: this.access.currentUser()?.displayName ?? null,
            committedAt: null,
            committedBy: null,
            result: null,
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

  get(id: ResidentImportId): Observable<ResidentImport | null> {
    const denied = this.deny<ResidentImport | null>();
    if (denied) return denied;
    const held = this.find(id);
    return this.latency.respond(held === undefined ? null : this.view(held));
  }

  map(id: ResidentImportId, mapping: ImportMapping): Observable<ResidentImport> {
    const denied = this.deny<ResidentImport>();
    if (denied) return denied;
    const held = this.find(id);
    if (held === undefined) return throwError(() => new Error('That import was not found.'));
    if (held.summary.status === 'committed' || held.resolutions.size > 0) {
      return throwError(
        () => new Error('The columns cannot change once a row is decided or the import confirmed.'),
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
    id: ResidentImportId,
    row: number,
    resolution: ImportResolution,
  ): Observable<ResidentImport> {
    const denied = this.deny<ResidentImport>();
    if (denied) return denied;
    const held = this.find(id);
    if (held === undefined) return throwError(() => new Error('That import was not found.'));
    const target = this.rows(held).find((candidate) => candidate.row === row);
    if (target === undefined || held.summary.status === 'committed') {
      return throwError(() => new Error('That row cannot be decided.'));
    }
    if (target.problems.length > 0) {
      return throwError(() => new Error('A row with problems cannot be decided: it is refused.'));
    }
    if (resolution.reason.trim() === '') {
      return throwError(() => new Error('A decision needs a reason.'));
    }
    held.resolutions.set(row, {
      action: resolution.action,
      residentId: resolution.action === 'same-person' ? resolution.residentId : null,
      reason: resolution.reason.trim(),
      by: this.access.currentUser()?.displayName ?? null,
      at: asIsoDateTime(new Date()),
    });
    return this.latency.respond(this.view(held));
  }

  commit(id: ResidentImportId): Observable<ResidentImportSummary> {
    const denied = this.deny<ResidentImportSummary>();
    if (denied) return denied;
    const held = this.find(id);
    if (held === undefined) return throwError(() => new Error('That import was not found.'));
    const view = this.view(held);
    if (view.status === 'committed' || view.missingFields.length > 0 || view.counts.unresolved > 0) {
      return throwError(
        () => new Error('Every required field needs a column, and every match a decision, first.'),
      );
    }
    const user = this.access.currentUser();
    const outcomes: ImportOutcome[] = this.rows(held).map((row): ImportOutcome => {
      const decided = held.resolutions.get(row.row);
      const base = { row: row.row, sourceLine: row.sourceLine };
      if (row.problems.length > 0) return { ...base, outcome: 'error', residentId: null };
      if (decided?.action === 'skip') return { ...base, outcome: 'skipped', residentId: null };
      if (decided?.action === 'same-person') {
        return { ...base, outcome: 'attached', residentId: decided.residentId };
      }
      const draft = toDraft(row);
      if (draft === null) return { ...base, outcome: 'error', residentId: null };
      const created = this.store.add(draft, user?.id ?? null);
      return { ...base, outcome: 'created', residentId: created.id };
    });
    const count = (kind: ImportOutcome['outcome']): number =>
      outcomes.filter((outcome) => outcome.outcome === kind).length;
    held.outcomes = outcomes;
    held.cells = [];
    held.summary = {
      ...held.summary,
      status: 'committed',
      committedAt: asIsoDateTime(new Date()),
      committedBy: user?.displayName ?? null,
      result: {
        created: count('created'),
        attached: count('attached'),
        skipped: count('skipped'),
        errors: count('error'),
      },
    };
    return this.latency.respond(held.summary);
  }

  private deny<T>(): Observable<T> | null {
    return denyUnless<T>(this.access.currentUser(), 'resident.import');
  }

  private find(id: ResidentImportId): HeldImport | undefined {
    return this.imports.find((held) => held.summary.id === id);
  }

  private rows(held: HeldImport): readonly ImportRow[] {
    const seen = new Map<string, number>();
    return held.cells.map((cells, index): ImportRow => {
      const values: Partial<Record<ImportField, string>> = {};
      for (const field of IMPORT_FIELDS) {
        const column = held.mapping[field];
        const value = column === null || column === undefined ? undefined : cells[column];
        if (value !== undefined && value !== '') values[field] = value;
      }
      const row = index + 1;
      const problems = FIELDS.filter((spec) => spec.required && values[spec.field] === undefined).map(
        (spec) => ({ field: spec.field, message: `${spec.label} is empty.` }),
      );
      const key = `${(values.lastName ?? '').toLowerCase()}|${(values.firstName ?? '').toLowerCase()}|${values.birthDate ?? ''}`;
      const earlier = problems.length === 0 ? seen.get(key) : undefined;
      if (problems.length === 0 && earlier === undefined) seen.set(key, row);
      const candidates =
        problems.length > 0 || earlier !== undefined
          ? []
          : this.store
              .all()
              .filter(
                (resident) =>
                  resident.name.last.toLowerCase() === (values.lastName ?? '').toLowerCase() &&
                  resident.name.first.toLowerCase() === (values.firstName ?? '').toLowerCase() &&
                  resident.birthDate === values.birthDate,
              )
              .map((resident) => ({
                residentId: resident.id,
                name: `${resident.name.last}, ${resident.name.first}`,
                barangayId: resident.address.barangayId,
                isActive: resident.isActive,
              }));
      return {
        row,
        sourceLine: row + 1,
        values: held.summary.status === 'committed' ? null : values,
        problems,
        candidates,
        duplicateOf: earlier ?? null,
        resolution: held.resolutions.get(row) ?? null,
      };
    });
  }

  private view(held: HeldImport): ResidentImport {
    const rows = this.rows(held);
    const group = (test: (row: ImportRow) => boolean): readonly ImportRow[] =>
      held.summary.status === 'committed' ? [] : rows.filter(test);
    const errors = group((row) => row.problems.length > 0);
    const duplicates = group((row) => row.problems.length === 0 && row.duplicateOf !== null);
    const matches = group(
      (row) => row.problems.length === 0 && row.duplicateOf === null && row.candidates.length > 0,
    );
    const fresh = group(
      (row) => row.problems.length === 0 && row.duplicateOf === null && row.candidates.length === 0,
    );
    return {
      ...held.summary,
      columns: held.headers.map((header, index) => ({
        index,
        header,
        samples: held.cells.slice(0, 3).map((cells) => cells[index] ?? ''),
      })),
      fields: FIELDS,
      mapping: held.mapping,
      missingFields: FIELDS.filter(
        (spec) => spec.required && (held.mapping[spec.field] ?? null) === null,
      ).map((spec) => spec.field),
      counts: {
        new: fresh.length,
        match: matches.length,
        duplicate: duplicates.length,
        error: errors.length,
        unresolved: [...matches, ...duplicates].filter((row) => row.resolution === null).length,
      },
      groups: { new: fresh, match: matches, duplicate: duplicates, error: errors },
      outcomes: held.outcomes,
    };
  }
}

/** The header's words to a field, as the server guesses them: a simple, sample-only rule. */
function guessMapping(headers: readonly string[]): ImportMapping {
  const mapping: Partial<Record<ImportField, number | null>> = {};
  const used = new Set<number>();
  for (const spec of FIELDS) {
    const words = [spec.label, spec.field].map((word) => word.toLowerCase().replace(/\s+/g, ''));
    const index = headers.findIndex(
      (header, column) =>
        !used.has(column) && words.includes(header.toLowerCase().replace(/[\s_]+/g, '')),
    );
    mapping[spec.field] = index === -1 ? null : index;
    if (index !== -1) used.add(index);
  }
  return mapping;
}

function toDraft(row: ImportRow): ResidentDraft | null {
  const values = row.values ?? {};
  const sex = SEXES.find((candidate) => candidate === values.sex?.toLowerCase());
  const barangay = TAYTAY_BARANGAYS.find(
    (candidate) => candidate.name.toLowerCase() === values.barangay?.toLowerCase(),
  );
  const civil = CIVIL_STATUSES.find((candidate) => candidate === values.civilStatus?.toLowerCase());
  if (
    sex === undefined ||
    civil === undefined ||
    barangay === undefined ||
    values.lastName === undefined ||
    values.firstName === undefined ||
    values.birthDate === undefined ||
    !/^\d{4}-\d{2}-\d{2}$/.test(values.birthDate)
  ) {
    return null;
  }
  return {
    name: {
      first: values.firstName,
      middle: values.middleName ?? '',
      last: values.lastName,
      suffix: values.suffix ?? '',
    },
    sex,
    birthDate: asIsoDate(values.birthDate),
    civilStatus: civil,
    address: {
      barangayId: barangay.id,
      purokOrSitio: values.purokOrSitio ?? null,
      streetAddress: values.streetAddress ?? null,
    },
    contact: { mobile: values.mobile ?? null, email: values.email ?? null },
    sectors: [],
    philsysLastFour: null,
    monthlyIncome: null,
    householdId: null,
  };
}
