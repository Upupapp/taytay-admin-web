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
  | 'factor-corrected';

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
