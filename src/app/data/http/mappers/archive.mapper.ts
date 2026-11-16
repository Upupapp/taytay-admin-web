import type { ArchiveAct, ArchiveEvent, ArchiveEventId, ArchiveRecord } from '@domain/index';

import { dateTime, field, id, oneOf, str } from './wire';

/**
 * `ArchiveState` → where a record stands in the archive (`DL-225`), for every record an
 * administrator keeps: an office, a Tulong page, a hotline, a home banner or link.
 *
 * | wire               | domain   | if absent or `null`                                   |
 * | ------------------ | -------- | ----------------------------------------------------- |
 * | `archived_at`      | `at`     | in use — the answer is `null`                         |
 * | `archived_by_name` | `byName` | not named                                             |
 * | `archive_reason`   | `reason` | none given                                            |
 *
 * `undefined` when `archived_at` is there but is not a time: the record cannot say whether residents
 * see it, so the record is not read rather than shown as in use. A public read never carries the
 * fields — the home screen's banners and links — and reads as in use, which is what it is.
 *
 * @consumes GET admin/offices
 * @consumes POST admin/offices
 * @consumes PATCH admin/offices/{id}
 * @consumes POST admin/offices/{id}/archive
 * @consumes POST admin/offices/{id}/restore
 * @consumes GET admin/services
 * @consumes POST admin/services
 * @consumes PATCH admin/services/{id}
 * @consumes POST admin/services/{id}/media
 * @consumes POST admin/services/{id}/archive
 * @consumes POST admin/services/{id}/restore
 * @consumes GET admin/hotlines
 * @consumes POST admin/hotlines
 * @consumes PATCH admin/hotlines/{id}
 * @consumes POST admin/hotlines/{id}/archive
 * @consumes POST admin/hotlines/{id}/restore
 * @consumes GET admin/home/banners
 * @consumes POST admin/home/banners
 * @consumes PATCH admin/home/banners/{id}
 * @consumes POST admin/home/banners/{id}/archive
 * @consumes POST admin/home/banners/{id}/restore
 * @consumes GET admin/home/links
 * @consumes POST admin/home/links
 * @consumes PATCH admin/home/links/{id}
 * @consumes POST admin/home/links/{id}/archive
 * @consumes POST admin/home/links/{id}/restore
 */
export function toArchiveState(wire: unknown): ArchiveRecord | null | undefined {
  const archivedAt = field(wire, 'archived_at');

  if (archivedAt === null || archivedAt === undefined) {
    return null;
  }

  const at = dateTime(archivedAt);
  if (at === null) {
    return undefined;
  }

  return {
    at,
    byName: str(field(wire, 'archived_by_name')),
    reason: str(field(wire, 'archive_reason')),
  };
}

const ACTS: readonly ArchiveAct[] = ['archived', 'restored'];

/**
 * `ArchiveEvent` → one line of a record's archive history (`DL-225`). Every field but the reason is
 * required: a line that cannot say what was done, by whom and when is not shown as one that did.
 *
 * Not read: `entity_type` and `entity_id`, which repeat the record asked about, and `actor_id`, an
 * account id the screen has no use for beside the name.
 *
 * @consumes GET admin/archive-events
 */
export function toArchiveEvent(wire: unknown): ArchiveEvent | null {
  const eventId = id<ArchiveEventId>(field(wire, 'id'));
  const act = oneOf(field(wire, 'act'), ACTS);
  const actorName = str(field(wire, 'actor_name'));
  const occurredAt = dateTime(field(wire, 'occurred_at'));

  if (eventId === null || act === null || actorName === null || occurredAt === null) {
    return null;
  }

  return { id: eventId, act, reason: str(field(wire, 'reason')), actorName, occurredAt };
}

/** `ArchiveReason`: what every archive and restore of an administrator's record reads. */
export interface ArchiveReasonWire {
  readonly reason: string;
}

/** Trimmed, as the server keeps it. */
export function toWireArchiveReason(reason: string): ArchiveReasonWire {
  return { reason: reason.trim() };
}
