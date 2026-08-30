import {
  asId,
  asIsoDateTime,
  CASE_NOTE_SENSITIVITIES,
  type AssistanceRequestId,
  type CaseNoteSensitivity,
  type RequestNote,
  type RequestNoteId,
  type StaffUserId,
} from '@domain/index';

import { bool, str } from './wire';

/**
 * `GET admin/assistance-requests/{case}/notes` → the domain.
 *
 * The list is under `notes`; `data` is an object, which is why `collection<T>` handed back a
 * non-array and the screen showed nothing (`DL-156`).
 *
 * ## The two sides already agreed on the hard part
 *
 * `DL-58` says a withheld note returns `body: null`, stays listed, and keeps its author and its
 * time — so nobody reads a partial file as a complete one. The API does exactly that, and adds a
 * `withheld_count` beside the list. Nothing had to be argued.
 *
 * ## The count is derived, not read
 *
 * `withheld_count` is not mapped. `withheldRequestNoteCount` computes it from the rows, and there
 * is no pagination on this endpoint, so the two cannot disagree — and a count read from the wire is
 * a number a screen can show while the list beneath it says something else. Same rule as every
 * other derived figure here (`DL-83`).
 *
 * ## An unrecognised sensitivity is read as `protected`
 *
 * The safe direction is the restrictive one. A tier this console does not know is one whose
 * handling it cannot reason about, and reading it as `routine` would show a body the office may
 * have meant to hold back.
 *
 * @consumes GET admin/assistance-requests/{case}/notes
 */
export function toRequestNotes(
  requestId: AssistanceRequestId,
  wire: unknown,
): readonly RequestNote[] {
  const row = typeof wire === 'object' && wire !== null ? (wire as Record<string, unknown>) : {};
  const notes = row['notes'];
  if (!Array.isArray(notes)) return [];

  return notes.flatMap((entry): RequestNote[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const note = entry as Record<string, unknown>;

    const id = str(note['id']);
    if (id === null) return [];

    const declared = str(note['sensitivity']);
    const sensitivity: CaseNoteSensitivity =
      CASE_NOTE_SENSITIVITIES.find((candidate) => candidate === declared) ?? 'protected';

    const author = str(note['author_subject_id']);
    const createdAt = str(note['created_at']);

    return [
      {
        id: asId<RequestNoteId>(id),
        // Known from the URL the caller asked at; the row does not repeat it.
        requestId,
        authorId: author === null ? null : asId<StaffUserId>(author),
        /*
         * The API sends a subject id and no name. Rendering the id would put a uuid where a screen
         * says who wrote the note, so this is blank and the screen shows nothing rather than
         * something meaningless. Recorded as a gap.
         */
        authorName: '',
        body: str(note['body']),
        isWithheld: bool(note['is_withheld']),
        sensitivity,
        createdAt:
          createdAt === null ? asIsoDateTime(new Date(0)) : asIsoDateTime(new Date(createdAt)),
      },
    ];
  });
}

/*
 * ── `is_withdrawn` and `withdrawn_reason` are read by nothing ───────────────────────────────
 *
 * The API models a withdrawn note — one the office has taken back, with a reason — and keeps the
 * row rather than deleting it. The console has no such state, so a withdrawn note currently reads
 * as an ordinary one.
 *
 * That is the shape `DL-127` settled for a comment: the **act** is append-only and the row stays,
 * so a reader can see that something was taken back and why. Modelling it here without a screen
 * that shows it would add a field nothing renders; it is filed in
 * `docs/integration/backend-requests.md` as work this console owes rather than something the API
 * is missing.
 */
