import { asIsoDateTime, type EventMetrics, type LguEventId } from '@domain/index';

import { int } from './wire';

/**
 * `GET admin/events/{event}/registration-summary` → `EventMetrics`.
 *
 * ## It was pointed at `/metrics`, which nobody serves
 *
 * The console asked for `admin/events/{event}/metrics`. The API publishes `registration-summary`,
 * and the two are not the same shape: the summary is built for a registration screen and carries
 * capacity and availability alongside the counts, with attendance nested under its own key.
 *
 * Six of the eight fields map exactly. The other two are the reason this is a mapper and not a
 * rename.
 *
 * ## `cancelledCount` has no counterpart, and is not defaulted to zero
 *
 * `summaryFor` publishes registered, waitlisted, seats remaining, and attendance as
 * `attended` / `no_show` / `not_checked_in`. Nothing about cancellations. A `0` would say **nobody
 * withdrew**, which is a claim about a list of real people made from a field the server never sent
 * — the `DL-146` failure with a number instead of an empty list.
 *
 * ## `asOf` is when this console read them
 *
 * The summary carries no timestamp of its own. `DL-129` requires the moment to travel with the
 * counts, so the closest true statement available is the read time, and the domain field says so:
 * screens word it *read at*, never *as of*. Only the server can say when it counted, and that it
 * does not is recorded as a gap rather than papered over with a stamp that implies otherwise.
 *
 * ## The rate is derived, and only once nothing is unmarked
 *
 * `attendanceRate` is `null` while any registrant is `not_checked_in`. A rate taken with half the
 * list unmarked reads as a poor turnout and is really an unfinished afternoon — and `DL-131` keeps
 * "unmarked" and "no-show" apart precisely so that nothing turns one into the other. Being unable
 * to state a rate is the correct answer until somebody has finished marking.
 *
 * @consumes GET admin/events/{event}/registration-summary
 */
export function toEventMetrics(eventId: LguEventId, wire: unknown, readAt: Date): EventMetrics {
  const row = typeof wire === 'object' && wire !== null ? (wire as Record<string, unknown>) : {};
  const attendanceWire = row['attendance'];
  const attendance =
    typeof attendanceWire === 'object' && attendanceWire !== null
      ? (attendanceWire as Record<string, unknown>)
      : {};

  const registeredCount = int(row['registered_count']) ?? 0;
  const attendedCount = int(attendance['attended']) ?? 0;
  const unmarkedCount = int(attendance['not_checked_in']) ?? 0;

  return {
    eventId,
    registeredCount,
    waitlistedCount: int(row['waitlisted_count']) ?? 0,
    // Not published. See the note above — never 0.
    cancelledCount: null,
    attendedCount,
    noShowCount: int(attendance['no_show']) ?? 0,
    unmarkedCount,
    attendanceRate:
      unmarkedCount > 0 || registeredCount === 0 ? null : attendedCount / registeredCount,
    asOf: asIsoDateTime(readAt),
  };
}
