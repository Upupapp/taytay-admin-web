import { TestBed } from '@angular/core/testing';
import { Subject, type Observable, type Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  asId,
  ROLE_DEFINITIONS,
  type AuthenticatedUser,
  type Permission,
  type StaffUserId,
} from '@domain/index';

import { SessionState } from '../auth/session-state';

import { CHANGE_FEED, type ChangeFeed, type ChangeFeedEvent, type LiveTopic } from './change-feed';
import {
  HIDDEN_CLOSE_MS,
  IDLE_AFTER_MS,
  LiveUpdates,
  POLL_EVERY_MS,
  reconnectDelay,
  REFRESH_THROTTLE_MS,
} from './live-updates';

const USER: AuthenticatedUser = {
  id: asId<StaffUserId>('staff-1'),
  displayName: 'Test User',
  email: 'test@example.gov.ph',
  role: 'mswdo-head',
  roleLabel: ROLE_DEFINITIONS['mswdo-head'].label,
  position: 'Tester',
  barangayId: null,
  scope: ROLE_DEFINITIONS['mswdo-head'].scope,
  permissions: new Set<Permission>(ROLE_DEFINITIONS['mswdo-head'].permissions),
};

/** A feed whose every connection is a subject the test speaks through. */
class FakeFeed implements ChangeFeed {
  readonly streams: Subject<ChangeFeedEvent>[] = [];

  open(): Observable<ChangeFeedEvent> {
    const stream = new Subject<ChangeFeedEvent>();
    this.streams.push(stream);
    return stream;
  }

  get current(): Subject<ChangeFeedEvent> {
    const stream = this.streams.at(-1);
    if (stream === undefined) throw new Error('No stream was opened.');
    return stream;
  }

  /** Whether the latest connection is still held open by the console. */
  get isOpen(): boolean {
    return this.streams.at(-1)?.observed ?? false;
  }
}

function setUp(withFeed = true) {
  const feed = new FakeFeed();
  TestBed.configureTestingModule({
    providers: withFeed ? [{ provide: CHANGE_FEED, useValue: feed }] : [],
  });
  const live = TestBed.inject(LiveUpdates);
  const session = TestBed.inject(SessionState);
  const subscriptions: Subscription[] = [];

  return {
    feed,
    live,
    signIn: () => {
      session.set(USER);
      TestBed.tick();
    },
    signOut: () => {
      session.set(null);
      TestBed.tick();
    },
    /** Counts what `changes(topics)` emits. */
    watch: (topics: readonly LiveTopic[]) => {
      let count = 0;
      subscriptions.push(live.changes(topics).subscribe(() => (count += 1)));
      return () => count;
    },
  };
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('LiveUpdates (DL-222)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState');
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('is off, and schedules nothing, without a feed — the mock set', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    const { feed, live, signIn, watch } = setUp(false);
    const seen = watch(['notifications']);
    signIn();

    live.refreshNow();
    vi.advanceTimersByTime(IDLE_AFTER_MS * 2);

    expect(live.status()).toBe('off');
    expect(seen()).toBe(0);
    expect(setInterval).not.toHaveBeenCalled();
    expect(feed.streams).toHaveLength(0);
  });

  it('connects only while signed in, and is live from the first ready', () => {
    const { feed, live, signIn, signOut, watch } = setUp();
    const seen = watch(['notifications']);
    expect(live.status()).toBe('off');
    expect(feed.streams).toHaveLength(0);

    signIn();
    expect(live.status()).toBe('connecting');
    feed.current.next({ kind: 'ready', topics: ['notifications', 'residents'] });
    expect(live.status()).toBe('live');
    expect([...live.topics()]).toEqual(['notifications', 'residents']);
    // The first ready follows the screen's own first read: nothing to re-read.
    expect(seen()).toBe(0);

    signOut();
    expect(live.status()).toBe('off');
    expect(feed.isOpen).toBe(false);
  });

  it('wakes a screen for its own topics, on resync, and for nothing else', () => {
    const { feed, signIn, watch } = setUp();
    const residents = watch(['residents']);
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });

    feed.current.next({ kind: 'change', topics: ['cases', 'news'] });
    expect(residents()).toBe(0);

    feed.current.next({ kind: 'change', topics: ['cases', 'residents'] });
    expect(residents()).toBe(1);

    vi.advanceTimersByTime(REFRESH_THROTTLE_MS);
    feed.current.next({ kind: 'resync' });
    expect(residents()).toBe(2);
  });

  it('re-reads at most once per two seconds, the first and the last of a burst kept', () => {
    const { feed, signIn, watch } = setUp();
    const seen = watch(['cases']);
    signIn();
    feed.current.next({ kind: 'ready', topics: ['cases'] });

    for (let i = 0; i < 5; i++) feed.current.next({ kind: 'change', topics: ['cases'] });
    expect(seen()).toBe(1);
    vi.advanceTimersByTime(REFRESH_THROTTLE_MS);
    expect(seen()).toBe(2);
    vi.advanceTimersByTime(REFRESH_THROTTLE_MS * 3);
    expect(seen()).toBe(2);
  });

  it('reconnects with a doubling backoff, and re-reads on every reconnection', () => {
    const { feed, live, signIn, watch } = setUp();
    const seen = watch(['cases']);
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });

    feed.current.error({ status: 0 });
    expect(live.status()).toBe('reconnecting');
    vi.advanceTimersByTime(reconnectDelay(0, 0) - 1);
    expect(feed.streams).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(feed.streams).toHaveLength(2);

    feed.current.error({ status: 502 });
    vi.advanceTimersByTime(reconnectDelay(1, 0));
    expect(feed.streams).toHaveLength(3);

    feed.current.next({ kind: 'ready', topics: [] });
    expect(live.status()).toBe('live');
    expect(seen()).toBe(1);

    // A stream the server simply ends is a drop like any other, and the count starts again.
    feed.current.complete();
    vi.advanceTimersByTime(reconnectDelay(0, 0));
    expect(feed.streams).toHaveLength(4);
  });

  it('steps from a second to thirty, never past it, with jitter inside the step', () => {
    expect(reconnectDelay(0, 1)).toBe(1_000);
    expect(reconnectDelay(0, 0)).toBe(500);
    expect(reconnectDelay(3, 1)).toBe(8_000);
    expect(reconnectDelay(10, 1)).toBe(30_000);
    expect(reconnectDelay(10, 0)).toBe(15_000);
  });

  it('reopens at once on expired, and still says live', () => {
    const { feed, live, signIn } = setUp();
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });
    const first = feed.current;

    first.next({ kind: 'expired' });
    expect(first.observed).toBe(false);
    expect(feed.streams).toHaveLength(2);
    expect(live.status()).toBe('live');
  });

  it('stops trying after a refused credential: the session is over', () => {
    const { feed, signIn } = setUp();
    signIn();
    feed.current.error({ status: 401 });
    vi.advanceTimersByTime(RECONNECT_WAIT);
    expect(feed.streams).toHaveLength(1);
  });

  it('falls back to a fifteen-second re-read against an API without the feed, only while visible', () => {
    const { feed, live, signIn, watch } = setUp();
    const seen = watch(['residents']);
    signIn();
    feed.current.error({ status: 404 });
    expect(live.status()).toBe('polling');

    vi.advanceTimersByTime(POLL_EVERY_MS);
    expect(seen()).toBe(1);
    vi.advanceTimersByTime(POLL_EVERY_MS);
    expect(seen()).toBe(2);

    setVisibility('hidden');
    vi.advanceTimersByTime(POLL_EVERY_MS * 4);
    expect(seen()).toBe(2);

    setVisibility('visible');
    expect(seen()).toBe(3);
    vi.advanceTimersByTime(POLL_EVERY_MS);
    expect(seen()).toBe(4);
    expect(feed.streams).toHaveLength(1);
  });

  it('treats 501 as an older API too', () => {
    const { feed, live, signIn } = setUp();
    signIn();
    feed.current.error({ status: 501 });
    expect(live.status()).toBe('polling');
  });

  it('re-reads when the tab is looked at again, and closes the stream after five hidden minutes', () => {
    const { feed, live, signIn, watch } = setUp();
    const seen = watch(['cases']);
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });

    setVisibility('hidden');
    feed.current.next({ kind: 'change', topics: ['cases'] });
    expect(seen()).toBe(0);
    setVisibility('visible');
    expect(seen()).toBe(1);

    setVisibility('hidden');
    vi.advanceTimersByTime(HIDDEN_CLOSE_MS);
    expect(feed.isOpen).toBe(false);
    expect(live.status()).toBe('idle');

    setVisibility('visible');
    expect(feed.streams).toHaveLength(2);
    feed.current.next({ kind: 'ready', topics: [] });
    expect(live.status()).toBe('live');
    expect(seen()).toBe(2);
  });

  it('goes idle after thirty minutes without a pointer or a key, and wakes on the next one', () => {
    const { feed, live, signIn, watch } = setUp();
    const seen = watch(['cases']);
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });

    vi.advanceTimersByTime(IDLE_AFTER_MS - 1_000);
    window.dispatchEvent(new Event('keydown'));
    vi.advanceTimersByTime(IDLE_AFTER_MS - 1_000);
    expect(live.status()).toBe('live');

    vi.advanceTimersByTime(1_000);
    expect(live.status()).toBe('idle');
    expect(feed.isOpen).toBe(false);
    expect(seen()).toBe(0);

    window.dispatchEvent(new Event('pointermove'));
    expect(feed.streams).toHaveLength(2);
    feed.current.next({ kind: 'ready', topics: [] });
    expect(live.status()).toBe('live');
    expect(seen()).toBe(1);
  });

  it('is silent while idle: an idle console asks nothing of the API', () => {
    const { feed, live, signIn, watch } = setUp();
    const seen = watch(['cases']);
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });
    vi.advanceTimersByTime(IDLE_AFTER_MS);
    expect(live.status()).toBe('idle');

    setVisibility('hidden');
    setVisibility('visible');
    vi.advanceTimersByTime(IDLE_AFTER_MS);
    expect(seen()).toBe(0);
    expect(feed.streams).toHaveLength(1);
  });

  it('pauses and resumes: closed and silent while paused, re-read on resume', () => {
    const { feed, live, signIn, watch } = setUp();
    const seen = watch(['cases']);
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });

    live.pause();
    expect(live.status()).toBe('paused');
    expect(feed.isOpen).toBe(false);
    live.refreshNow();
    setVisibility('hidden');
    setVisibility('visible');
    expect(seen()).toBe(0);

    live.resume();
    expect(feed.streams).toHaveLength(2);
    feed.current.next({ kind: 'ready', topics: [] });
    expect(live.status()).toBe('live');
    expect(seen()).toBe(1);
  });

  it('drops a trailing re-read that falls due after a pause', () => {
    const { feed, live, signIn, watch } = setUp();
    const seen = watch(['cases']);
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });
    feed.current.next({ kind: 'change', topics: ['cases'] });
    feed.current.next({ kind: 'change', topics: ['cases'] });
    live.pause();
    vi.advanceTimersByTime(REFRESH_THROTTLE_MS);
    expect(seen()).toBe(1);
  });

  it('reconnects as soon as the network is back, without waiting out the backoff', () => {
    const { feed, signIn } = setUp();
    signIn();
    feed.current.next({ kind: 'ready', topics: [] });

    window.dispatchEvent(new Event('offline'));
    TestBed.tick();
    feed.current.error({ status: 0 });
    vi.advanceTimersByTime(RECONNECT_WAIT);
    expect(feed.streams).toHaveLength(1);

    window.dispatchEvent(new Event('online'));
    TestBed.tick();
    expect(feed.streams).toHaveLength(2);
  });

  it('keeps how the last read went, and forgets it when the screen changes', () => {
    const { live } = setUp();
    expect(live.lastUpdatedAt()).toBeNull();

    live.noteRefreshFailed();
    expect(live.refreshFailed()).toBe(true);
    live.noteRefreshed();
    expect(live.refreshFailed()).toBe(false);
    expect(live.lastUpdatedAt()).toEqual(new Date());

    live.forgetScreen();
    expect(live.lastUpdatedAt()).toBeNull();
  });

  /** `DL-166`: a token is renewed only by a request on its way out, so nothing here repeats. */
  it('never repeats on an interval', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');
    const { feed, signIn } = setUp();
    signIn();
    feed.current.error({ status: 404 });
    vi.advanceTimersByTime(POLL_EVERY_MS * 3);
    expect(setInterval).not.toHaveBeenCalled();
  });
});

/** Longer than any backoff step. */
const RECONNECT_WAIT = 60_000;
