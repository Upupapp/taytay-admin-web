import type { PlatformAuditEntry, PlatformAuditEntryId } from '@domain/index';

import { dateTime, field, id, str } from './wire';

/**
 * `AuditEntry` → `PlatformAuditEntry` (`DL-171`).
 *
 * | wire           | domain        | if absent                |
 * | -------------- | ------------- | ------------------------ |
 * | `id`           | `id`          | the row is not readable  |
 * | `action`       | `action`      | the row is not readable  |
 * | `subject_type` | `subjectType` | the row is not readable  |
 * | `created_at`   | `at`          | the row is not readable  |
 * | `actor_id`     | `actorId`     | no actor recorded        |
 * | `subject_id`   | `subjectId`   | no record named          |
 *
 * Those six are everything the API returns, and everything read: a field the API added later — a
 * value, a reason — would not reach this screen until somebody decided it should (`DL-114`).
 *
 * @consumes GET admin/audit
 */
export function toPlatformAuditEntry(wire: unknown): PlatformAuditEntry | null {
  const entryId = id<PlatformAuditEntryId>(field(wire, 'id'));
  const action = str(field(wire, 'action'));
  const subjectType = str(field(wire, 'subject_type'));
  const at = dateTime(field(wire, 'created_at'));

  if (entryId === null || action === null || subjectType === null || at === null) {
    return null;
  }

  return {
    id: entryId,
    actorId: str(field(wire, 'actor_id')),
    action,
    subjectType,
    subjectId: str(field(wire, 'subject_id')),
    at,
  };
}
