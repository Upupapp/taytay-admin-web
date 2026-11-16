import type { ArchiveEventId, IsoDateTime } from './ids';

/**
 * Archive, never delete (`DL-225`).
 *
 * What the municipality offered its residents, and when, is a public record (RA 9470 §18, as the
 * backend's ADR 0002 reads it): nothing an office user does in this console deletes one. An office,
 * a Tulong page, a hotline, a home banner or link, a saved view or an app flag is **archived** — it
 * leaves what residents see, stays here under Archived with who did it, when and why, and can be
 * restored.
 *
 * `ArchiveRecord` is where a record stands: `null` on the model while it is in use, this while it is
 * archived. It is the server's word, never the console's: an archive the console assumed would be
 * one nobody can name in the record.
 */
export interface ArchiveRecord {
  readonly at: IsoDateTime;
  /**
   * Who archived it, as the office trail names an account: the account's name, "An account since
   * closed", or "An account with no name recorded". `null` only for a saved view, whose answer names
   * nobody — the view is the reader's own, or the office's.
   */
  readonly byName: string | null;
  /**
   * Why, as the administrator wrote it. `null` for a feature flag and a saved view, which are
   * archived without one: a flag by the settings' own review, a view as a filter somebody put away.
   */
  readonly reason: string | null;
}

export type ArchiveAct = 'archived' | 'restored';

/**
 * One line of a record's archive history (`GET admin/archive-events`): append-only, newest first.
 * The history says each time a record left and came back, which the record's own `archived` — only
 * the latest — cannot.
 */
export interface ArchiveEvent {
  readonly id: ArchiveEventId;
  readonly act: ArchiveAct;
  readonly reason: string | null;
  readonly actorName: string;
  readonly occurredAt: IsoDateTime;
}

/** The API's own limits on a reason: trimmed, 1 to 500 characters (`ArchiveReason`). */
export const ARCHIVE_REASON_LIMIT = 500;

/** Why a reason would be refused, in words, or `null` when the server would take it. */
export function archiveReasonProblem(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed === '') {
    return 'Give a reason. It is kept with the record, under your name.';
  }
  if (trimmed.length > ARCHIVE_REASON_LIMIT) {
    return `A reason is at most ${ARCHIVE_REASON_LIMIT} characters.`;
  }
  return null;
}

/**
 * What a `409` about the archive means, as the domain names it — never the API's code, which a
 * screen must not show (`DL-225`).
 *
 * - `already-archived` / `not-archived`: somebody else archived or restored it first.
 * - `read-only`: it was archived while it was being changed; an archived record is read-only until
 *   it is restored.
 * - `office-in-use`: an office still named by staff accounts, Tulong pages or document types.
 * - `office-archived`: the act would put something under, or link somebody to, an archived office.
 */
export type ArchiveRefusalKind =
  'already-archived' | 'not-archived' | 'read-only' | 'office-in-use' | 'office-archived';

/** What still names an office, as the server counted it when it refused to archive the office. */
export interface OfficeInUse {
  readonly staffAccounts: number;
  readonly services: number;
  readonly issuanceTypes: number;
}

/**
 * The server, or the mock acting as it, refused an archive-related act. Both adapter sets raise this
 * one error, so a screen says the same plain sentence whichever set it runs on.
 */
export class ArchiveRefusedError extends Error {
  constructor(
    readonly kind: ArchiveRefusalKind,
    message: string,
    /** Present only with `office-in-use`. */
    readonly inUse: OfficeInUse | null = null,
  ) {
    super(message);
    this.name = 'ArchiveRefusedError';
  }
}

export function isArchiveRefusal(failure: unknown): failure is ArchiveRefusedError {
  return failure instanceof ArchiveRefusedError;
}
