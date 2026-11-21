import { asIsoDate, type IsoDate } from '@domain/index';

import { SEED_ANCHOR } from './seed/seed-utils';

/**
 * The day series the API counts by — Asia/Manila calendar days, weeks starting Monday, months —
 * for the mock adapters.
 *
 * **The demo's today is the seed's anchor**, not the real clock: every seed record is dated around
 * `SEED_ANCHOR`, so a series ending on the real today would read all zeros in the demo and say
 * nothing about the panel it feeds. The API ends its series on the real today.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Asia/Manila calendar day a timestamp falls on, as `YYYY-MM-DD`. */
export function manilaDay(timestamp: string | Date): IsoDate {
  const time = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp.getTime();
  return asIsoDate(new Date(time + MANILA_OFFSET_MS).toISOString().slice(0, 10));
}

function addDays(day: IsoDate, days: number): IsoDate {
  return asIsoDate(
    new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10),
  );
}

/** The demo's today and the `count - 1` days before it, oldest first. */
export function demoDays(count: number): readonly IsoDate[] {
  const today = manilaDay(SEED_ANCHOR);
  return Array.from({ length: count }, (_, index) => addDays(today, index - (count - 1)));
}

/** The Mondays of the demo's current week and the `count - 1` weeks before it, oldest first. */
export function demoWeeks(count: number): readonly IsoDate[] {
  const today = manilaDay(SEED_ANCHOR);
  const sinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addDays(today, -sinceMonday);
  return Array.from({ length: count }, (_, index) => addDays(monday, (index - (count - 1)) * 7));
}

/** The last day of the demo's current month and the `count - 1` months before it, oldest first. */
export function demoMonthEnds(count: number): readonly IsoDate[] {
  const today = new Date(`${manilaDay(SEED_ANCHOR)}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const end = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (count - 1) + index + 1, 0),
    );
    return asIsoDate(end.toISOString().slice(0, 10));
  });
}

/** How many timestamps fall on each day, the days as given. */
export function countByDay(
  days: readonly IsoDate[],
  timestamps: readonly (string | null)[],
): readonly { readonly date: IsoDate; readonly count: number }[] {
  const seen = timestamps.flatMap((t) => (t === null ? [] : [manilaDay(t)]));
  return days.map((day) => ({ date: day, count: seen.filter((s) => s === day).length }));
}

/** How many timestamps fall in each week named by its Monday, up to the demo's today. */
export function countByWeek(
  mondays: readonly IsoDate[],
  timestamps: readonly (string | null)[],
): readonly { readonly weekStart: IsoDate; readonly count: number }[] {
  const today = manilaDay(SEED_ANCHOR);
  const seen = timestamps.flatMap((t) => (t === null ? [] : [manilaDay(t)]));
  return mondays.map((monday) => {
    const next = addDays(monday, 7);
    return {
      weekStart: monday,
      count: seen.filter((s) => s >= monday && s < next && s <= today).length,
    };
  });
}

/** The demo's now, as the instant a "last 7 days" window is measured back from. */
export function demoNow(): Date {
  return new Date(SEED_ANCHOR);
}
