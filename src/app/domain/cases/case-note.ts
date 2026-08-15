import type { Permission } from '../access/permission';
import type { PermissionCheck } from '../residents/resident-disclosure';
import type { CaseId, CaseNoteId, IsoDateTime, StaffUserId } from '../shared/ids';

/**
 * How closely a note is held.
 *
 * `routine` is the ordinary running record — a home visit, a phone call, a
 * document received. Anyone who may open the case may read it.
 *
 * `protected` is the narrow tier: safety planning for a VAWC survivor
 * (RA 9262), anything identifying a child in conflict with the law (RA 9344),
 * a third party's disclosure given in confidence, or clinical detail. It is
 * read only by staff holding `case.view-protected-note`.
 */
export type CaseNoteSensitivity = 'routine' | 'protected';

export const CASE_NOTE_SENSITIVITIES: readonly CaseNoteSensitivity[] = ['routine', 'protected'];

export const CASE_NOTE_PERMISSIONS: Readonly<Record<CaseNoteSensitivity, Permission>> = {
  routine: 'case.view',
  protected: 'case.view-protected-note',
};

export interface CaseNote {
  readonly id: CaseNoteId;
  readonly caseId: CaseId;
  readonly authorId: StaffUserId | null;
  readonly authorName: string;
  readonly body: string;
  readonly sensitivity: CaseNoteSensitivity;
  readonly createdAt: IsoDateTime;
}

/**
 * A note as a particular viewer is allowed to see it.
 *
 * `body` is `null` when withheld — **removed by the data layer, not hidden by a
 * template** (`DL-38`). A screen cannot leak a paragraph it never received, and
 * no future refactor of the markup can undo that.
 *
 * The note's *existence*, its author and its time are still disclosed. That is
 * deliberate: a caseworker who cannot see that three restricted entries exist
 * will read the file as complete and act as though nothing happened. Knowing
 * that a record is there, and that it is not yours to read, is what makes it
 * possible to ask the right person.
 */
export interface CaseNoteView {
  readonly id: CaseNoteId;
  readonly caseId: CaseId;
  readonly authorName: string;
  readonly sensitivity: CaseNoteSensitivity;
  readonly createdAt: IsoDateTime;
  readonly body: string | null;
  readonly isWithheld: boolean;
}

/**
 * Applies the note disclosure policy. Pure, so the adapter, the API contract
 * and a test all agree on what a role may read.
 */
export function discloseCaseNote(note: CaseNote, holds: PermissionCheck): CaseNoteView {
  const cleared = holds(CASE_NOTE_PERMISSIONS[note.sensitivity]);
  return {
    id: note.id,
    caseId: note.caseId,
    authorName: note.authorName,
    sensitivity: note.sensitivity,
    createdAt: note.createdAt,
    body: cleared ? note.body : null,
    isWithheld: !cleared,
  };
}

export function withheldNoteCount(notes: readonly CaseNoteView[]): number {
  return notes.filter((note) => note.isWithheld).length;
}

/** A note is worth storing when it says something. Nothing else is enforced. */
export const CASE_NOTE_MIN_LENGTH = 8;

export function isValidNoteBody(body: string): boolean {
  return body.trim().length >= CASE_NOTE_MIN_LENGTH;
}
