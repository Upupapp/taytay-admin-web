import { formatDate } from '@angular/common';
import { inject, LOCALE_ID, Pipe, type PipeTransform } from '@angular/core';

/**
 * What a rendered date says, and so how it is written. One pattern per kind, used on every
 * screen (DL-227): a console that writes "2026-11-21" on one page, "Nov 21, 2026" on the next
 * and "21 Nov 2026, 19:17" on a third makes an officer stop and work out which is which.
 *
 * - `date`: 21 Nov 2026 — the month in words, so 03/11 is never read as either day or month.
 * - `date-time`: 21 Nov 2026, 7:17 PM — the 12-hour clock with AM and PM.
 * - `time`: 7:17 PM.
 * - `date-time-seconds`: 21 Nov 2026, 7:17:02 PM — only where the order of acts within a
 *   minute matters (an audit trail, a count's "as of").
 * - `weekday-date-time`: Sat 21 Nov 2026, 7:17 PM — when the day of the week is part of the
 *   answer (when an event is on).
 * - `manila-date-time`: 21 Nov 2026, 7:17 PM (Asia/Manila, UTC+08:00) — when a sheet or a file
 *   says when it was made (DL-247). On Manila's clock whatever the computer's, with the zone said,
 *   as the file beside it writes it: a printout from a laptop set to another zone said a time eight
 *   hours off the CSV made in the same minute.
 */
export type DisplayDateKind =
  'date' | 'date-time' | 'time' | 'date-time-seconds' | 'weekday-date-time' | 'manila-date-time';

export const DISPLAY_DATE_FORMATS: Readonly<Record<DisplayDateKind, string>> = {
  date: 'd MMM y',
  'date-time': 'd MMM y, h:mm a',
  time: 'h:mm a',
  'date-time-seconds': 'd MMM y, h:mm:ss a',
  'weekday-date-time': 'EEE d MMM y, h:mm a',
  'manila-date-time': 'd MMM y, h:mm a',
};

/** The zone a `manila-date-time` is written in, said after it — the words the report files use. */
export const MANILA_ZONE_WORDS = '(Asia/Manila, UTC+08:00)';

export type DisplayDateValue = Date | string | number;

/**
 * Formats a moment or a calendar date for display, or null for nothing (or something that is
 * not a date) so a screen can say "—" in its own words rather than "Invalid Date". A bare
 * `YYYY-MM-DD` is read as that calendar day wherever the browser is, never shifted by a
 * timezone.
 */
export function formatDisplayDate(
  value: DisplayDateValue | null | undefined,
  kind: DisplayDateKind = 'date',
  locale = 'en-US',
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  try {
    if (kind === 'manila-date-time') {
      // The Philippines keeps no daylight saving, so Manila is UTC+08:00 all year.
      return `${formatDate(value, DISPLAY_DATE_FORMATS[kind], locale, '+0800')} ${MANILA_ZONE_WORDS}`;
    }
    return formatDate(value, DISPLAY_DATE_FORMATS[kind], locale);
  } catch {
    return null;
  }
}

/**
 * `{{ release.scheduledFor | displayDate }}`, `{{ entry.at | displayDate: 'date-time' }}`.
 * Keep a machine-readable `datetime` on a `<time>` element where there is one.
 */
@Pipe({ name: 'displayDate' })
export class DisplayDatePipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: DisplayDateValue, kind?: DisplayDateKind): string | null;
  transform(value: null | undefined, kind?: DisplayDateKind): null;
  transform(value: DisplayDateValue | null | undefined, kind?: DisplayDateKind): string | null;
  transform(
    value: DisplayDateValue | null | undefined,
    kind: DisplayDateKind = 'date',
  ): string | null {
    return formatDisplayDate(value, kind, this.locale);
  }
}
