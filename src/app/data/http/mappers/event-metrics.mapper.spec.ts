import { describe, expect, it } from 'vitest';

import { asId, type LguEventId } from '@domain/index';

import { toEventMetrics } from './event-metrics.mapper';

const EVENT = asId<LguEventId>('evt-1');
const READ_AT = new Date('2026-08-30T02:15:00.000Z');

const summary = (over: Record<string, unknown> = {}) => ({
  registration_required: true,
  capacity: 50,
  waitlist_enabled: true,
  availability: 'open',
  registered_count: 40,
  waitlisted_count: 4,
  seats_remaining: 10,
  attendance: { attended: 30, no_show: 10, not_checked_in: 0 },
  ...over,
});

describe('reading an event’s registration summary', () => {
  it('maps the six counts the summary publishes', () => {
    const metrics = toEventMetrics(EVENT, summary(), READ_AT);

    expect(metrics.registeredCount).toBe(40);
    expect(metrics.waitlistedCount).toBe(4);
    expect(metrics.attendedCount).toBe(30);
    expect(metrics.noShowCount).toBe(10);
    expect(metrics.unmarkedCount).toBe(0);
  });

  /**
   * Cancellations are `null`, never `0`.
   *
   * `summaryFor` publishes nothing about withdrawals. A zero would say **nobody withdrew** — a
   * claim about a list of real people, made from a field the server never sent. That is `DL-146`
   * with a number in place of an empty list, and the same answer applies: show the absence.
   */
  it('reports cancellations as unknown rather than as none', () => {
    expect(toEventMetrics(EVENT, summary(), READ_AT).cancelledCount).toBeNull();
  });

  /**
   * The rate is withheld while anybody is still unmarked.
   *
   * `DL-131` keeps "not checked in" and "no-show" apart so that nothing turns an unmarked
   * registrant into an absent one. A rate taken mid-marking does exactly that, reading as a poor
   * turnout when it is really an unfinished afternoon.
   */
  it('states no attendance rate while the list is still being marked', () => {
    const metrics = toEventMetrics(
      EVENT,
      summary({ attendance: { attended: 30, no_show: 2, not_checked_in: 8 } }),
      READ_AT,
    );

    expect(metrics.attendanceRate).toBeNull();
  });

  it('states a rate once nothing is unmarked', () => {
    expect(toEventMetrics(EVENT, summary(), READ_AT).attendanceRate).toBeCloseTo(0.75);
  });

  it('does not divide by a registration count of zero', () => {
    const metrics = toEventMetrics(
      EVENT,
      summary({ registered_count: 0, attendance: { attended: 0, no_show: 0, not_checked_in: 0 } }),
      READ_AT,
    );

    expect(metrics.attendanceRate).toBeNull();
  });

  /**
   * `asOf` is the read time, because the server stamps nothing.
   *
   * `DL-129` requires the moment to travel with the counts. The closest true statement available is
   * when this console asked, which is why the field is worded *read at* everywhere it is shown.
   */
  it('stamps when the console read the counts', () => {
    expect(toEventMetrics(EVENT, summary(), READ_AT).asOf).toBe('2026-08-30T02:15:00.000Z');
  });

  it('is total: a payload of the wrong shape yields zeroes, not a throw', () => {
    const metrics = toEventMetrics(EVENT, null, READ_AT);

    expect(metrics.registeredCount).toBe(0);
    expect(metrics.attendedCount).toBe(0);
    expect(metrics.cancelledCount).toBeNull();
    expect(metrics.eventId).toBe(EVENT);
  });
});
