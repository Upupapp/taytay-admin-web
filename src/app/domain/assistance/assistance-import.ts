import type { DuplicateStrength, MatchSignal } from '../beneficiaries/duplicate-review';
import type { CivilStatus, Sex } from '../residents/resident';
import type { ImportColumn, ResidentImportKind } from '../residents/resident-import';
import type {
  AssistanceImportId,
  AssistanceRequestId,
  IsoDateTime,
  ResidentId,
} from '../shared/ids';

/**
 * Importing the office's past assistance (`DL-228`, ADR 0005 §3), read from
 * `office/assistance-imports` (`request.import`).
 *
 * The office's old Tulong reports become **closed** assistance requests on the registry records
 * they were for, so the dashboard, the reports and the intake's look-back count what a family
 * already received. Nothing is filed until a person commits; the steps are the citizen import's
 * (`DL-214`): upload, match the columns, review the rows, commit.
 *
 * **The software proposes; a person decides** (`DL-60`, `DL-73`). A row is filed on a record by
 * itself only on a single strong match in its barangay, and the officer may override it. Every other
 * row waits for a person to link it, create a record from it, or skip it, each with a reason kept
 * with their name. A candidate carries a masked label, a band and signals — never a value.
 *
 * **Withdrawn, never deleted** (`DL-225`). A committed import is withdrawn with a reason: its
 * requests stay on the records, flagged, and stop being counted.
 */
export interface AssistanceImportSummary {
  readonly id: AssistanceImportId;
  readonly fileName: string;
  readonly kind: ResidentImportKind;
  readonly status: AssistanceImportStatus;
  readonly rowCount: number;
  readonly createdAt: IsoDateTime;
  /** As the account names itself; `null` when the API gives no name. */
  readonly createdBy: string | null;
  readonly committedAt: IsoDateTime | null;
  readonly committedBy: string | null;
  /** What became of the rows, once committed. */
  readonly result: AssistanceImportResult | null;
  /** Who withdrew the import, when and why, once withdrawn. */
  readonly withdrawal: AssistanceImportWithdrawal | null;
}

export const ASSISTANCE_IMPORT_STATUSES = ['open', 'committed', 'withdrawn'] as const;
export type AssistanceImportStatus = (typeof ASSISTANCE_IMPORT_STATUSES)[number];

export interface AssistanceImportResult {
  readonly imported: number;
  readonly skipped: number;
  readonly duplicates: number;
  readonly errors: number;
  readonly residentsCreated: number;
}

export interface AssistanceImportWithdrawal {
  readonly at: IsoDateTime;
  readonly by: string | null;
  readonly reason: string;
}

/** The fields a column can feed, in the server's order. A name is whole or surname and given name. */
export const ASSISTANCE_IMPORT_FIELDS = [
  'fullName',
  'lastName',
  'firstName',
  'middleName',
  'suffix',
  'sex',
  'birthDate',
  'barangay',
  'purokOrSitio',
  'streetAddress',
  'mobile',
  'program',
  'dateGiven',
  'dateApplied',
  'amount',
  'status',
  'controlNumber',
  'purpose',
  'remarks',
  'receivedBy',
] as const;
export type AssistanceImportField = (typeof ASSISTANCE_IMPORT_FIELDS)[number];

export interface AssistanceImportFieldSpec {
  readonly field: AssistanceImportField;
  /** The server's own words for the field. */
  readonly label: string;
  readonly required: boolean;
}

/** Field → the column feeding it, or `null` when none does. A column feeds one field at most. */
export type AssistanceImportMapping = Readonly<
  Partial<Record<AssistanceImportField, number | null>>
>;

/** How the server grouped a row. Advice, like the citizen import's grouping (`DL-60`). */
export const ASSISTANCE_IMPORT_GROUPS = [
  'ready',
  'needs-review',
  'skipped',
  'duplicate',
  'error',
] as const;
export type AssistanceImportGroup = (typeof ASSISTANCE_IMPORT_GROUPS)[number];

export type AssistanceImportCounts = Readonly<Record<AssistanceImportGroup, number>>;

export interface AssistanceImportProblem {
  /** The field the problem is about, or `null` when it is about the row as a whole. */
  readonly field: AssistanceImportField | null;
  readonly message: string;
}

/** Whose record the row will be filed on: proposed by the server, or linked by a person. */
export interface AssistanceImportMatch {
  readonly residentId: ResidentId;
  /** Surname and given initial, as the server masks it (`DL-73`). */
  readonly label: string;
  readonly how: 'proposed' | 'linked';
}

/** A registry record the row resembles: a masked label, a band and signals, never a value. */
export interface AssistanceImportCandidate {
  readonly residentId: ResidentId;
  readonly label: string;
  readonly strength: DuplicateStrength;
  readonly signals: readonly MatchSignal[];
}

/** Why a row repeats a release already held — in the system, or earlier in the file. */
export interface AssistanceImportDuplicate {
  readonly reason: 'control-number' | 'same-day';
  /** The earlier row of this file, when it is the file that repeats itself. */
  readonly ofRow: number | null;
  /** The request already in the system, by its reference. */
  readonly ofRequestReference: string | null;
}

export const ASSISTANCE_IMPORT_ACTIONS = ['link', 'create', 'skip'] as const;
export type AssistanceImportAction = (typeof ASSISTANCE_IMPORT_ACTIONS)[number];

/**
 * A resolution as the server keeps it, with who made it and when. What a `create` added is not
 * read: it is the officer's typing, emptied at commit, and the row's outcome says what was made.
 */
export interface AssistanceImportResolutionRecord {
  readonly action: AssistanceImportAction;
  readonly residentId: ResidentId | null;
  readonly reason: string;
  readonly by: string | null;
  readonly at: IsoDateTime;
}

export interface AssistanceImportRow {
  readonly row: number;
  /** The line in the file, header included, so a person can find it there. */
  readonly sourceLine: number;
  readonly group: AssistanceImportGroup;
  /** The row's cells under the mapping; `null` once the cells are emptied. */
  readonly values: Readonly<Partial<Record<AssistanceImportField, string>>> | null;
  readonly problems: readonly AssistanceImportProblem[];
  readonly match: AssistanceImportMatch | null;
  /** A record will be made from the row at commit. */
  readonly willCreate: boolean;
  /**
   * An earlier row of the file that makes the same new person's record: this row is filed on that
   * record, so a person new to the registry who appears in several rows becomes one record.
   */
  readonly createsWithRow: number | null;
  /** What the registry would refuse in the record a create would make, in the server's words. */
  readonly createProblems: readonly string[];
  readonly candidates: readonly AssistanceImportCandidate[];
  readonly duplicate: AssistanceImportDuplicate | null;
  readonly resolution: AssistanceImportResolutionRecord | null;
}

export const ASSISTANCE_IMPORT_OUTCOMES = ['imported', 'skipped', 'duplicate', 'error'] as const;
export type AssistanceImportOutcomeKind = (typeof ASSISTANCE_IMPORT_OUTCOMES)[number];

export interface AssistanceImportOutcome {
  readonly row: number;
  readonly sourceLine: number;
  /** `null` when the server recorded none for the row. */
  readonly outcome: AssistanceImportOutcomeKind | null;
  readonly requestId: AssistanceRequestId | null;
  /** Why a row was not imported, naming nobody. */
  readonly note: string | null;
}

export interface AssistanceImport extends AssistanceImportSummary {
  readonly columns: readonly ImportColumn[];
  readonly fields: readonly AssistanceImportFieldSpec[];
  readonly mapping: AssistanceImportMapping;
  /** Required fields no column feeds yet: commit is refused while any remains. */
  readonly missingFields: readonly AssistanceImportField[];
  readonly counts: AssistanceImportCounts;
  /** Empty once committed. */
  readonly rows: readonly AssistanceImportRow[];
  /** What became of each row, once committed. */
  readonly outcomes: readonly AssistanceImportOutcome[];
}

/**
 * What the registry requires and the row lacks, given by the officer for a `create`. Each field
 * given replaces the row's; one left out keeps the row's. The barangay is always the row's.
 */
export interface AssistanceImportCreateRecord {
  readonly sex?: Sex;
  /** `YYYY-MM-DD`, as a date field gives it. */
  readonly birthDate?: string;
  readonly civilStatus?: CivilStatus;
  readonly purokOrSitio?: string;
  readonly streetAddress?: string;
}

/** A person's finding on one row. Every one takes a reason, kept with their name. */
export type AssistanceImportResolution =
  | { readonly action: 'link'; readonly residentId: ResidentId; readonly reason: string }
  | {
      readonly action: 'create';
      readonly record: AssistanceImportCreateRecord;
      readonly reason: string;
    }
  | { readonly action: 'skip'; readonly reason: string };

/** The wizard's steps after the upload, in order; the step is in the URL (`DL-62`). */
export const ASSISTANCE_IMPORT_STEPS = ['map', 'review', 'commit', 'done'] as const;
export type AssistanceImportStep = (typeof ASSISTANCE_IMPORT_STEPS)[number];

export type AssistanceImportBlocker = 'not-open' | 'unmapped' | 'needs-review';

/** Whether the server would refuse a commit now, and why, in the order a person fixes them. */
export function assistanceImportBlockers(
  record: AssistanceImport,
): readonly AssistanceImportBlocker[] {
  const blockers: AssistanceImportBlocker[] = [];
  if (record.status !== 'open') blockers.push('not-open');
  if (record.missingFields.length > 0) blockers.push('unmapped');
  if (record.counts['needs-review'] > 0) blockers.push('needs-review');
  return blockers;
}

/** A mapping can change only while the import is open and no row is resolved, as the server holds. */
export function canRemapAssistanceImport(record: AssistanceImport): boolean {
  return record.status === 'open' && record.rows.every((row) => row.resolution === null);
}

/** Only a committed import is withdrawn, and only once. */
export function canWithdrawAssistanceImport(summary: AssistanceImportSummary): boolean {
  return summary.status === 'committed';
}

/** Rows a person may resolve: neither refused for errors nor already held as a duplicate. */
export function isResolvable(row: AssistanceImportRow): boolean {
  return row.group !== 'error' && row.group !== 'duplicate';
}
