import { of, Subject, throwError, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { liveViewState, unlessPaged, type RefreshReport } from './live-view-state';
import type { ViewState } from './view-state';

/** A read the test answers by hand, one request at a time. */
function scriptedRead() {
  const requests: Subject<number>[] = [];
  return {
    requests,
    load: (): Observable<number> => {
      const answer = new Subject<number>();
      requests.push(answer);
      return answer;
    },
    answer(value: number): void {
      const request = requests.at(-1);
      request?.next(value);
      request?.complete();
    },
    fail(): void {
      requests.at(-1)?.error(new Error('down'));
    },
  };
}

function record<T>(source: Observable<ViewState<T>>) {
  const states: ViewState<T>[] = [];
  const subscription = source.subscribe((state) => states.push(state));
  return { states, subscription, kinds: () => states.map((state) => state.kind) };
}

function reporter(): RefreshReport & { refreshed: number; failed: number } {
  const report = {
    refreshed: 0,
    failed: 0,
    noteRefreshed: () => (report.refreshed += 1),
    noteRefreshFailed: () => (report.failed += 1),
  };
  return report;
}

describe('liveViewState (DL-222)', () => {
  it('shows the skeleton for the first read only, and never on a re-read', () => {
    const read = scriptedRead();
    const refreshes = new Subject<void>();
    const report = reporter();
    const { states, kinds } = record(liveViewState(read.load, refreshes, report));

    expect(kinds()).toEqual(['loading']);
    read.answer(1);
    expect(kinds()).toEqual(['loading', 'ready']);

    refreshes.next();
    expect(read.requests).toHaveLength(2);
    expect(kinds()).toEqual(['loading', 'ready']);
    read.answer(2);
    expect(kinds()).toEqual(['loading', 'ready', 'ready']);
    expect(states.at(-1)).toEqual({ kind: 'ready', value: 2 });
    expect(report.refreshed).toBe(2);
  });

  it('keeps what is on screen when a re-read fails, and says so', () => {
    const read = scriptedRead();
    const refreshes = new Subject<void>();
    const report = reporter();
    const { states } = record(liveViewState(read.load, refreshes, report));
    read.answer(1);

    refreshes.next();
    read.fail();

    expect(states.at(-1)).toEqual({ kind: 'ready', value: 1 });
    expect(states.some((state) => state.kind === 'error')).toBe(false);
    expect(report.failed).toBe(1);

    // And the screen stays live: the next hint reads again.
    refreshes.next();
    read.answer(3);
    expect(states.at(-1)).toEqual({ kind: 'ready', value: 3 });
  });

  it('never stacks a re-read behind a slow one', () => {
    const read = scriptedRead();
    const refreshes = new Subject<void>();
    record(liveViewState(read.load, refreshes));
    read.answer(1);

    refreshes.next();
    refreshes.next();
    refreshes.next();
    expect(read.requests).toHaveLength(2);
    read.answer(2);
    refreshes.next();
    expect(read.requests).toHaveLength(3);
  });

  it('ignores a hint during the first read: that read is already the newest', () => {
    const read = scriptedRead();
    const refreshes = new Subject<void>();
    const { kinds } = record(liveViewState(read.load, refreshes));

    refreshes.next();
    expect(read.requests).toHaveLength(1);
    read.answer(1);
    expect(kinds()).toEqual(['loading', 'ready']);
  });

  it('keeps the error panel and its Try again after a failed first read, until a re-read works', () => {
    const read = scriptedRead();
    const refreshes = new Subject<void>();
    const { states, kinds } = record(liveViewState(read.load, refreshes));
    read.fail();
    expect(kinds()).toEqual(['loading', 'error']);

    const failure = states.at(-1);
    expect(failure?.kind === 'error' && failure.retry !== undefined).toBe(true);

    refreshes.next();
    read.fail();
    expect(kinds()).toEqual(['loading', 'error']);

    refreshes.next();
    read.answer(5);
    expect(states.at(-1)).toEqual({ kind: 'ready', value: 5 });
  });

  it('stops reading when the screen leaves', () => {
    const load = vi.fn(() => of(1));
    const refreshes = new Subject<void>();
    const { subscription } = record(liveViewState(load, refreshes));
    expect(load).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
    refreshes.next();
    expect(load).toHaveBeenCalledTimes(1);
    expect(refreshes.observed).toBe(false);
  });

  it('reports a load that throws as a failure, not a crash', () => {
    const { kinds } = record(
      liveViewState(() => throwError(() => new Error('refused')), new Subject<void>()),
    );
    expect(kinds()).toEqual(['loading', 'error']);
  });
});

describe('unlessPaged (DL-222)', () => {
  it('passes hints through while one page is loaded, and holds them once more are', () => {
    const refreshes = new Subject<void>();
    let pages = 1;
    let held = 0;
    let passed = 0;
    unlessPaged(
      refreshes,
      () => pages > 1,
      () => (held += 1),
    ).subscribe(() => (passed += 1));

    refreshes.next();
    expect(passed).toBe(1);

    pages = 2;
    refreshes.next();
    refreshes.next();
    expect(passed).toBe(1);
    expect(held).toBe(2);
  });
});
