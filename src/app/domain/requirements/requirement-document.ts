import type {
  DocumentVersionId,
  IsoDate,
  IsoDateTime,
  RequirementDocumentId,
  RequirementId,
  StaffUserId,
} from '../shared/ids';

/**
 * A document presented against one requirement, and everything that has ever
 * stood in its place.
 *
 * The acceptance criterion is that **replacing a file does not erase history**.
 * So a document is not a file with a pointer that gets overwritten: it is an
 * append-only list of versions, and replacing one appends. Nothing in this
 * module removes a version, and `check:documents` fails the build if a mutator
 * appears that would.
 *
 * Why it matters beyond tidiness: the superseded version is the evidence of what
 * the office actually saw when it made a decision. A request approved in March
 * on the strength of a certificate that was replaced in June must still be
 * explicable in December, and an overwriting model makes that permanently
 * unanswerable.
 */

export type DocumentSource = 'uploaded' | 'scanned' | 'encoded' | 'external-verification';

export const DOCUMENT_SOURCES: readonly DocumentSource[] = [
  'uploaded',
  'scanned',
  'encoded',
  'external-verification',
];

export const DOCUMENT_SOURCE_LABELS: Readonly<Record<DocumentSource, string>> = {
  uploaded: 'Uploaded by staff',
  scanned: 'Scanned at the office',
  encoded: 'Encoded from a paper copy',
  'external-verification': 'Confirmed with the issuing office',
};

export const DOCUMENT_SOURCE_DESCRIPTIONS: Readonly<Record<DocumentSource, string>> = {
  uploaded: 'A file supplied in digital form.',
  scanned: 'A paper document imaged at the counter.',
  encoded: 'Details typed from a paper document. There is no image to open.',
  'external-verification':
    'No copy held. A staff member confirmed the document directly with the office that issued it.',
};

/**
 * `encoded` and `external-verification` deliberately carry no file. The office
 * routinely verifies a document without keeping a copy of it, and inventing an
 * empty file for those cases would make "is there something to open?" a question
 * the screen has to guess at.
 */
export function sourceHoldsAFile(source: DocumentSource): boolean {
  return source === 'uploaded' || source === 'scanned';
}

/**
 * A file that has been **stored** — what a version carries once it exists.
 *
 * Distinct from `DocumentVersionDraft.file`, which is the browser `File` being sent. The two were
 * the same type until TAB 19, which is how the console came to describe uploads it could not
 * perform.
 */
export interface DocumentFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly byteSize: number;
  /** `null` for images and anything whose page count is not known. */
  readonly pageCount: number | null;
}

export interface DocumentVersion {
  readonly id: DocumentVersionId;
  /** 1-based, and never reused. The first version is 1 whatever happens after. */
  readonly version: number;
  /** `null` when the source holds no file — see `sourceHoldsAFile`. */
  readonly file: DocumentFile | null;
  readonly source: DocumentSource;
  /**
   * The number printed on the document, where it has one.
   *
   * **Sensitive.** Never rendered whole in a list or table; `maskDocumentNumber`
   * is the only sanctioned way to put it on a screen without an explicit
   * permission check.
   */
  readonly documentNumber: string | null;
  readonly issuedOn: IsoDate | null;
  /** `null` means "does not expire", which is different from "unknown". */
  readonly expiresOn: IsoDate | null;
  readonly receivedBy: StaffUserId;
  readonly receivedAt: IsoDateTime;
  /** Set when a later version replaced this one. Never unset. */
  readonly supersededAt: IsoDateTime | null;
  /** Why it was replaced. Required on the version being superseded. */
  readonly supersededReason: string | null;
}

export interface RequirementDocument {
  readonly id: RequirementDocumentId;
  readonly requirementId: RequirementId;
  /** Append-only, oldest first. The last entry is the current one. */
  readonly versions: readonly DocumentVersion[];
}

/** The version in force. `null` only for a document with no versions at all. */
export function currentVersion(document: RequirementDocument): DocumentVersion | null {
  return document.versions.at(-1) ?? null;
}

/** Everything replaced, newest first — what the version drawer lists. */
export function supersededVersions(
  document: RequirementDocument,
): readonly DocumentVersion[] {
  return document.versions.filter((version) => version.supersededAt !== null).slice().reverse();
}

/* ── Validity over time ───────────────────────────────────────────────────── */

export type DocumentValidity = 'valid' | 'expiring-soon' | 'expired' | 'no-expiry' | 'unknown';

export const DOCUMENT_VALIDITY_LABELS: Readonly<Record<DocumentValidity, string>> = {
  valid: 'Valid',
  'expiring-soon': 'Expires soon',
  expired: 'Expired',
  'no-expiry': 'Does not expire',
  unknown: 'Expiry not recorded',
};

/**
 * How close a document is to lapsing.
 *
 * The office's own convention, and stated as such: a certificate of indigency is
 * commonly treated as good for six months, and staff want warning before it
 * lapses rather than after. **Not verified against an issuance in this offline
 * run** — see `EXPIRY_WARNING_BASIS`.
 */
export const EXPIRY_WARNING_DAYS = 30;

export const EXPIRY_WARNING_BASIS =
  'Office convention, pending confirmation against a written issuance.';

export function documentValidity(
  version: DocumentVersion,
  on: Date = new Date(),
): DocumentValidity {
  if (version.expiresOn === null) {
    // A document that genuinely never expires and one whose expiry nobody wrote
    // down are different facts, and only the second one is somebody's work to
    // finish. The model keeps them apart rather than collapsing both to "fine".
    return version.issuedOn === null ? 'unknown' : 'no-expiry';
  }

  const expiry = new Date(`${version.expiresOn}T23:59:59.999Z`);
  if (Number.isNaN(expiry.getTime())) {
    return 'unknown';
  }
  if (expiry.getTime() < on.getTime()) {
    return 'expired';
  }

  const daysLeft = (expiry.getTime() - on.getTime()) / 86_400_000;
  return daysLeft <= EXPIRY_WARNING_DAYS ? 'expiring-soon' : 'valid';
}

/* ── Masking ──────────────────────────────────────────────────────────────── */

/**
 * A document number reduced to its last four characters.
 *
 * The default rendering everywhere. Four characters is enough for a clerk to
 * confirm they are looking at the right paper against the one in their hand,
 * and not enough to reconstruct an identifier — the same reasoning that limits
 * the PhilSys reference to four digits (RA 11055, `CLAUDE.md` §6.2).
 *
 * A number short enough that masking would reveal most of it is masked whole.
 */
export function maskDocumentNumber(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length <= 4) {
    return '•'.repeat(trimmed.length);
  }
  return `••••${trimmed.slice(-4)}`;
}

/* ── Appending a version ──────────────────────────────────────────────────── */

/** What a replacement submits. Identity, ordering and time are the store's. */
export interface DocumentVersionDraft {
  /**
   * **The bytes**, not a description of them.
   *
   * This was a `DocumentFile` — `fileName`, `mimeType`, `byteSize`, `pageCount` — which is the
   * shape of a version that has already been stored. As a *draft* field it meant the console could
   * describe a file it had no way to send, and the API's endpoint reads a multipart upload. So
   * document upload could not work, and did not: no screen had ever offered a file input.
   *
   * `null` where the source holds no file — see `sourceHoldsAFile`. A document seen at the counter
   * and handed back is a real record with no bytes attached.
   */
  readonly file: File | null;
  readonly source: DocumentSource;
  readonly documentNumber: string | null;
  readonly issuedOn: IsoDate | null;
  readonly expiresOn: IsoDate | null;
  /** Required when replacing an existing version; ignored on the first. */
  readonly replacesBecause: string | null;
}

export type DocumentProblem =
  | 'file-required-for-this-source'
  | 'file-on-a-sourceless-record'
  | 'replacement-needs-a-reason'
  | 'expiry-before-issue'
  | 'empty-file-name';

/**
 * Validates a version before it is appended. Pure, so the same rules run in the
 * form, in the adapter and in a test.
 */
export function documentVersionProblems(
  draft: DocumentVersionDraft,
  isReplacement: boolean,
): readonly DocumentProblem[] {
  const problems: DocumentProblem[] = [];

  if (sourceHoldsAFile(draft.source) && draft.file === null) {
    problems.push('file-required-for-this-source');
  }
  if (!sourceHoldsAFile(draft.source) && draft.file !== null) {
    problems.push('file-on-a-sourceless-record');
  }
  if (draft.file !== null && draft.file.name.trim().length === 0) {
    problems.push('empty-file-name');
  }
  // Replacing is the operation this whole model exists to make safe. An
  // unexplained replacement leaves a superseded version nobody can account for.
  if (isReplacement && (draft.replacesBecause ?? '').trim().length === 0) {
    problems.push('replacement-needs-a-reason');
  }
  if (draft.issuedOn !== null && draft.expiresOn !== null && draft.expiresOn < draft.issuedOn) {
    problems.push('expiry-before-issue');
  }

  return problems;
}

export class DocumentVersionInvalidError extends Error {
  readonly problems: readonly DocumentProblem[];

  constructor(problems: readonly DocumentProblem[]) {
    super('That document needs correcting before it can be recorded.');
    this.name = 'DocumentVersionInvalidError';
    this.problems = problems;
  }
}

export function isDocumentVersionInvalid(error: unknown): error is DocumentVersionInvalidError {
  return error instanceof DocumentVersionInvalidError;
}
