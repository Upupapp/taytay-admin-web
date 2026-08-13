import {
  asId,
  asIsoDateTime,
  type AuditStamp,
  type IsoDateTime,
  type StaffUserId,
} from '@domain/index';

/**
 * Seed data is generated relative to a fixed anchor so mock output is stable
 * across runs and snapshot-friendly, while still looking "recent" to a reader.
 */
export const SEED_ANCHOR = new Date('2026-08-01T08:00:00.000Z');

export function daysBeforeAnchor(days: number, hour = 9): IsoDateTime {
  const date = new Date(SEED_ANCHOR);
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return asIsoDateTime(date);
}

export function stamp(createdDaysAgo: number, updatedDaysAgo = createdDaysAgo): AuditStamp {
  const actor = asId<StaffUserId>('staff-admin');
  return {
    createdAt: daysBeforeAnchor(createdDaysAgo),
    createdBy: actor,
    updatedAt: daysBeforeAnchor(updatedDaysAgo),
    updatedBy: actor,
  };
}
