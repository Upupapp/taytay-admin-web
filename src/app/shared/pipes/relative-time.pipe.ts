import { Pipe, type PipeTransform } from '@angular/core';

const RELATIVE = new Intl.RelativeTimeFormat('en-PH', { numeric: 'auto' });

const UNITS: readonly (readonly [Intl.RelativeTimeFormatUnit, number])[] = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
];

/** "3 days ago". Falls back to an em dash so tables never show "Invalid Date". */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined, now: Date = new Date()): string {
    if (!value) {
      return '—';
    }
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      return '—';
    }

    const elapsed = timestamp - now.getTime();
    for (const [unit, milliseconds] of UNITS) {
      if (Math.abs(elapsed) >= milliseconds) {
        return RELATIVE.format(Math.round(elapsed / milliseconds), unit);
      }
    }
    return 'just now';
  }
}
