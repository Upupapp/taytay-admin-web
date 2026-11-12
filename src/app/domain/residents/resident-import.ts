import type { BarangayId, IsoDateTime, ResidentId, ResidentImportId } from '../shared/ids';

/**
 * Importing a list into the registry (`DL-214`), read from `office/imports` (`resident.import`).
 *
 * **Nothing reaches the registry until a person commits.** An upload holds the file's rows for
 * checking under a mapping the server guessed from the header; the rows are read and grouped —
 * error, duplicate within the file, match against the registry, new — and a person confirms the
 * mapping, resolves every match and duplicate, and only then commits.
 *
 * **There is no merge** (`DL-74`). A match is resolved as a finding with a reason: `create` (a
 * different person), `same-person` (the row is that registry record — it is attached, and nothing on
 * the record is written over), or `skip`. A later resolution of the same row is appended and is the
 * one in force; the server keeps each with the reviewer's name.
 *
 * **The grouping advises; it never decides** (`DL-60`). A match is a name and birth date seen
 * before, not a finding that it is the same person.
 */
export interface ResidentImportSummary {
  readonly id: ResidentImportId;
  readonly fileName: string;
  readonly kind: ResidentImportKind;
  readonly status: ResidentImportStatus;
  readonly rowCount: number;
  readonly createdAt: IsoDateTime;
  /** As the account names itself; `null` when the API gives no name. */
  readonly createdBy: string | null;
  readonly committedAt: IsoDateTime | null;
  readonly committedBy: string | null;
  /** What became of the rows, once committed. */
  readonly result: ResidentImportResult | null;
}

export const RESIDENT_IMPORT_KINDS = ['csv', 'xlsx'] as const;
export type ResidentImportKind = (typeof RESIDENT_IMPORT_KINDS)[number];

export const RESIDENT_IMPORT_STATUSES = ['open', 'committed'] as const;
export type ResidentImportStatus = (typeof RESIDENT_IMPORT_STATUSES)[number];

export interface ResidentImportResult {
  readonly created: number;
  readonly attached: number;
  readonly skipped: number;
  readonly errors: number;
}

/** The registry fields a column can feed, in the server's order. */
export const IMPORT_FIELDS = [
  'lastName',
  'firstName',
  'middleName',
  'suffix',
  'sex',
  'birthDate',
  'civilStatus',
  'barangay',
  'purokOrSitio',
  'streetAddress',
  'mobile',
  'email',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export interface ImportColumn {
  /** From 0, as the mapping names it. */
  readonly index: number;
  readonly header: string;
  /** Up to three values from the file, to recognise the column by. */
  readonly samples: readonly string[];
}

export interface ImportFieldSpec {
  readonly field: ImportField;
  /** The server's own words for the field. */
  readonly label: string;
  readonly required: boolean;
}

/** Field → the column feeding it, or `null` when none does. A column feeds one field at most. */
export type ImportMapping = Readonly<Partial<Record<ImportField, number | null>>>;

export const IMPORT_GROUPS = ['new', 'match', 'duplicate', 'error'] as const;
export type ImportGroup = (typeof IMPORT_GROUPS)[number];

export interface ImportCounts {
  readonly new: number;
  readonly match: number;
  readonly duplicate: number;
  readonly error: number;
  /** Matches and duplicates nobody has resolved yet: commit is refused while this is above 0. */
  readonly unresolved: number;
}

export interface ImportProblem {
  /** The field the problem is about, or `null` when it is about the row as a whole. */
  readonly field: ImportField | null;
  readonly message: string;
}

/**
 * A registry record with the same name and birth date as the row, as the registry lists it for this
 * reader. Its birth date is not read: it is the row's own, which is how it matched.
 */
export interface ImportCandidate {
  readonly residentId: ResidentId;
  readonly name: string;
  readonly barangayId: BarangayId | null;
  readonly isActive: boolean;
}

export const IMPORT_ACTIONS = ['create', 'same-person', 'skip'] as const;
export type ImportAction = (typeof IMPORT_ACTIONS)[number];

/** A resolution as the server keeps it, with who made it and when. */
export interface ImportResolutionRecord {
  readonly action: ImportAction;
  readonly residentId: ResidentId | null;
  readonly reason: string;
  readonly by: string | null;
  readonly at: IsoDateTime;
}

export interface ImportRow {
  readonly row: number;
  /** The line in the file, header included, so a person can find it there. */
  readonly sourceLine: number;
  /** The row's cells under the mapping; `null` once the import is committed and the cells emptied. */
  readonly values: Readonly<Partial<Record<ImportField, string>>> | null;
  readonly problems: readonly ImportProblem[];
  readonly candidates: readonly ImportCandidate[];
  /** For a duplicate: the earlier row of this file it repeats. */
  readonly duplicateOf: number | null;
  readonly resolution: ImportResolutionRecord | null;
}

export const IMPORT_OUTCOMES = ['created', 'attached', 'skipped', 'error'] as const;
export type ImportOutcomeKind = (typeof IMPORT_OUTCOMES)[number];

export interface ImportOutcome {
  readonly row: number;
  readonly sourceLine: number;
  readonly outcome: ImportOutcomeKind;
  readonly residentId: ResidentId | null;
}

export interface ResidentImport extends ResidentImportSummary {
  readonly columns: readonly ImportColumn[];
  readonly fields: readonly ImportFieldSpec[];
  readonly mapping: ImportMapping;
  /** Required fields no column feeds yet: commit is refused while any remains. */
  readonly missingFields: readonly ImportField[];
  readonly counts: ImportCounts;
  /** Empty once committed. */
  readonly groups: Readonly<Record<ImportGroup, readonly ImportRow[]>>;
  /** What became of each row, once committed. */
  readonly outcomes: readonly ImportOutcome[];
}

/** A person's finding on one row. Every one takes a reason, kept with their name (`DL-74`). */
export type ImportResolution =
  | { readonly action: 'create'; readonly reason: string }
  | { readonly action: 'same-person'; readonly residentId: ResidentId; readonly reason: string }
  | { readonly action: 'skip'; readonly reason: string };

/** The API's limits on a file, said before it is chosen. */
export const IMPORT_FILE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 5000,
  maxColumns: 40,
  extensions: ['.csv', '.xlsx'],
} as const;

export const IMPORT_REASON_MAX_LENGTH = 500;

/** The wizard's steps after the upload, in order; the step is in the URL (`DL-62`). */
export const IMPORT_STEPS = ['map', 'check', 'confirm', 'done'] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

/** Whether the server would refuse a commit now, and why, in the order a person fixes them. */
export function commitBlockers(record: ResidentImport): readonly ('unmapped' | 'unresolved' | 'committed')[] {
  const blockers: ('unmapped' | 'unresolved' | 'committed')[] = [];
  if (record.status === 'committed') blockers.push('committed');
  if (record.missingFields.length > 0) blockers.push('unmapped');
  if (record.counts.unresolved > 0) blockers.push('unresolved');
  return blockers;
}

/** A mapping can change only while nothing has been resolved, as the server holds it. */
export function canRemap(record: ResidentImport): boolean {
  return (
    record.status === 'open' &&
    IMPORT_GROUPS.every((group) => record.groups[group].every((row) => row.resolution === null))
  );
}
