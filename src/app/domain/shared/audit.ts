import type { AuditEntryId, IsoDateTime, StaffUserId } from './ids';

/** Creation / last-modification stamp carried by every persisted entity. */
export interface AuditStamp {
  readonly createdAt: IsoDateTime;
  readonly createdBy: StaffUserId | null;
  readonly updatedAt: IsoDateTime;
  readonly updatedBy: StaffUserId | null;
}

export type AuditAction =
  'created' | 'updated' | 'status-changed' | 'viewed' | 'exported' | 'deleted';

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
  readonly actorId: StaffUserId | null;
  readonly actorName: string;
  readonly occurredAt: IsoDateTime;
}
