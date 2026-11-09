import type { AuditEntryId, IsoDateTime, StaffUserId } from './ids';

/** Creation / last-modification stamp carried by every persisted entity. */
export interface AuditStamp {
  readonly createdAt: IsoDateTime;
  readonly createdBy: StaffUserId | null;
  readonly updatedAt: IsoDateTime;
  readonly updatedBy: StaffUserId | null;
}

export type AuditAction =
  | 'created'
  | 'updated'
  | 'status-changed'
  | 'viewed'
  | 'exported'
  | 'deleted'
  | 'membership-changed'
  | 'factor-corrected'
  /*
   * Newsfeed and Events seams, named by the late-phase command.
   *
   * Added to the existing union rather than given their own, so the audit
   * explorer, its filters and `DL-114`'s row/detail split apply to a published
   * event exactly as they do to a resident record. A second action vocabulary
   * would need a second explorer.
   *
   * The newsfeed was retired (`DL-194`) and its acts stay: this union is the
   * API's trail vocabulary too (its `category` and `action` filter name all
   * nineteen, and its governance test compares them with this list). Events
   * are published and cancelled, and releases and visits scheduled. Pinning,
   * unpinning and the three comment acts are kinds nothing in the office's
   * trail is yet, and the API answers them with an empty page. (No semicolon
   * in this comment: the API's parity test reads this union up to the first.)
   */
  | 'published'
  | 'scheduled'
  | 'archived'
  | 'pinned'
  | 'unpinned'
  | 'comment-hidden'
  | 'comment-restored'
  | 'comment-replied'
  | 'cancelled'
  | 'registration-changed'
  | 'attendance-changed';

/**
 * One immutable line of the audit trail. Required by RA 10173 accountability
 * duties: every access to, and change of, personal data is attributable.
 */
export interface AuditEntry {
  readonly id: AuditEntryId;
  readonly entityType: string;
  readonly entityId: string;
  readonly action: AuditAction;
  readonly summary: string;
  /**
   * Why the person did it, in their own words.
   *
   * Separate from `summary`, which says *what* changed. A trail that records
   * only the what answers "was this allowed?" and never "was this right?" —
   * and overriding a vulnerability factor is exactly a judgement whose grounds
   * matter more than its mechanics (`DL-42`). `null` where the action carries
   * its own reason, e.g. a creation.
   */
  readonly reason: string | null;
  readonly actorId: StaffUserId | null;
  readonly actorName: string;
  readonly occurredAt: IsoDateTime;
}
