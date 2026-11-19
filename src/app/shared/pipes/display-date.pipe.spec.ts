import { TestBed } from '@angular/core/testing';

import { DisplayDatePipe, formatDisplayDate } from './display-date.pipe';

// A local moment, so the expectations hold in any timezone the tests run in.
const EVENING = new Date(2026, 10, 21, 19, 17, 2);

describe('formatDisplayDate (DL-227)', () => {
  it('writes a date as day, month in words, year', () => {
    expect(formatDisplayDate(EVENING)).toBe('21 Nov 2026');
    expect(formatDisplayDate(EVENING, 'date')).toBe('21 Nov 2026');
  });

  it('writes a moment on the 12-hour clock', () => {
    expect(formatDisplayDate(EVENING, 'date-time')).toBe('21 Nov 2026, 7:17 PM');
    expect(formatDisplayDate(EVENING, 'time')).toBe('7:17 PM');
    expect(formatDisplayDate(EVENING, 'date-time-seconds')).toBe('21 Nov 2026, 7:17:02 PM');
    expect(formatDisplayDate(EVENING, 'weekday-date-time')).toBe('Sat 21 Nov 2026, 7:17 PM');
  });

  it('reads a bare calendar date as that day, never shifted by a timezone', () => {
    expect(formatDisplayDate('2026-11-21')).toBe('21 Nov 2026');
    expect(formatDisplayDate('2026-01-01')).toBe('1 Jan 2026');
  });

  it('gives nothing for nothing, or for something that is not a date', () => {
    expect(formatDisplayDate(null)).toBeNull();
    expect(formatDisplayDate(undefined)).toBeNull();
    expect(formatDisplayDate('')).toBeNull();
    expect(formatDisplayDate('not a date')).toBeNull();
  });
});

describe('DisplayDatePipe', () => {
  it('formats through the same patterns, the date by default', () => {
    const pipe = TestBed.runInInjectionContext(() => new DisplayDatePipe());
    expect(pipe.transform('2026-11-21')).toBe('21 Nov 2026');
    expect(pipe.transform(EVENING, 'date-time')).toBe('21 Nov 2026, 7:17 PM');
    expect(pipe.transform(null)).toBeNull();
  });
});
