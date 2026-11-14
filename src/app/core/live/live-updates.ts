import { DOCUMENT } from '@angular/common';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import {
  asyncScheduler,
  filter,
  map,
  Subject,
  throttleTime,
  type Observable,
  type Subscription,
} from 'rxjs';

import { SessionState } from '../auth/session-state';
import { NetworkStatus } from '../network/network-status';

import { CHANGE_FEED, type ChangeFeedEvent, type LiveTopic } from './change-feed';

/** Where live updates stand, as the topbar says it (`DL-222`). */
export type LiveStatus =
  /** No change feed (the mock set), or nobody signed in: nothing live, and nothing shown. */
  | 'off'
  /** Opening the first stream since sign-in. */
  | 'connecting'
  /** The stream is open: a change reaches the screen in about a second. */
  | 'live'
  /** The stream dropped, or cannot be opened yet; trying again with backoff. */
  | 'reconnecting'
  /** An API without the feed (404 or 501): screens are re-read every 15 seconds while visible. */
  | 'polling'
  /** Paused by the person at the keyboard (WCAG 2.2.2). */
  | 'paused'
  /** Nobody has used the console for 30 minutes, or the tab was hidden for 5: stopped. */
  | 'idle';

/** First reconnection delay; doubled per failure up to the ceiling, each with jitter. */
export const RECONNECT_FIRST_MS = 1_000;
export const RECONNECT_CEILING_MS = 30_000;
/** The re-read interval against an API that has no change feed, while the tab is visible. */
export const POLL_EVERY_MS = 15_000;
/** How long a hidden tab keeps its stream before closing it. */
export const HIDDEN_CLOSE_MS = 5 * 60_000;
/** How long without a pointer or a key before the console stops talking to the API. */
export const IDLE_AFTER_MS = 30 * 60_000;
/** At most one re-read per screen in this window, the first and the last of a burst both kept. */
export const REFRESH_THROTTLE_MS = 2_000;

/**
 * The reconnection delay after `failures` failed attempts: exponential from a second to thirty,
 * with "equal jitter" — half the step fixed, half random — so that an office's thirty consoles,
 * dropped together by the same server restart, do not all come back in the same second.
 */
export function reconnectDelay(failures: number, random: number): number {
  const step = Math.min(RECONNECT_CEILING_MS, RECONNECT_FIRST_MS * 2 ** Math.max(0, failures));
  return Math.round(step / 2 + (step / 2) * random);
}

/** Why a screen should read again: some topics changed, or everything may have. */
type Wake = { readonly all: true } | { readonly all: false; readonly topics: readonly string[] };

const EVERYTHING: Wake = { all: true };

type TimerPurpose = 'reconnect' | 'poll' | 'hidden' | 'idle';

/** Pointer and keyboard activity: what "somebody is using this console" means here. */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

/**
 * Live updates (`DL-222`): **the only place in the console that schedules anything.**
 *
 * The API pushes "this topic changed" hints over `GET changes`; this service holds the one stream,
 * and each screen asks `changes([...topics])` when to read again — quietly, through its own
 * repository (`liveViewState`). A hint carries topic names only, so nothing reaches a screen that
 * its own authorised read would not give it.
 *
 * ## What it will not do
 *
 * - **Poll every second.** A hint costs the API nothing while nothing changes; a poll costs a query
 *   per screen per console per second on a shared 2 GB server, from an office behind one IP.
 * - **Talk to an unattended console.** After 30 minutes with no pointer or key it closes the stream
 *   and stops every re-read until somebody comes back. Token renewal is still only ever done by an
 *   API request on its way out (`DL-166`), so an idle console stops renewing too — live updates
 *   never become a background renewal.
 * - **Queue, retry or claim a save** (`DL-118`). A re-read is a read; it changes nothing.
 *
 * ## When `changes()` emits
 *
 * A matching `change`; `resync`; every reconnection after the first `ready`; the tab coming back
 * into view; the network coming back; `refreshNow()`; and, against an API without the feed, every
 * 15 seconds while visible. At most once per 2 seconds per subscriber, leading and trailing, and
 * never while paused or idle.
 */
@Injectable({ providedIn: 'root' })
export class LiveUpdates {
  private readonly feed = inject(CHANGE_FEED, { optional: true });
  private readonly session = inject(SessionState);
  private readonly network = inject(NetworkStatus);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly signedIn = computed(() => this.session.user() !== null);
  private readonly fallback = signal(false);
  private readonly link = signal<'closed' | 'opening' | 'open' | 'waiting'>('closed');
  private readonly connectedOnce = signal(false);
  /** Reopening straight after `expired`: still live, as far as anybody looking can tell. */
  private readonly renewing = signal(false);
  private readonly paused = signal(false);
  private readonly inactive = signal(false);
  private readonly asleep = signal(false);
  private readonly updatedAt = signal<Date | null>(null);
  private readonly failed = signal(false);
  private readonly offered = signal<ReadonlySet<string>>(new Set());

  readonly status: Signal<LiveStatus> = computed(() => {
    if (this.feed === null || !this.signedIn()) return 'off';
    if (this.paused()) return 'paused';
    if (this.inactive() || this.asleep()) return 'idle';
    if (this.fallback()) return 'polling';
    if (this.renewing()) return 'live';
    switch (this.link()) {
      case 'open':
        return 'live';
      case 'waiting':
        return 'reconnecting';
      case 'opening':
        return this.connectedOnce() ? 'reconnecting' : 'connecting';
      case 'closed':
        return 'connecting';
    }
  });

  /** When a screen last read successfully, live or not; `null` until one has. */
  readonly lastUpdatedAt = this.updatedAt.asReadonly();
  /** A quiet re-read failed: the screen still shows what it had, which may be out of date. */
  readonly refreshFailed = this.failed.asReadonly();
  /** The topics this connection can ever carry, from the server's `ready`. */
  readonly topics = this.offered.asReadonly();

  private readonly wakes = new Subject<Wake>();
  private connection: Subscription | null = null;
  private failures = 0;
  private hidden = false;
  private online = true;
  private lastActivity = 0;
  /** Every timer this service holds, one per purpose: one-shot, never a repeating interval. */
  private readonly timers = new Map<TimerPurpose, ReturnType<typeof setTimeout>>();

  constructor() {
    // The mock set binds no feed: nothing to schedule, nothing to listen to, status `off`.
    if (this.feed === null) {
      return;
    }

    const view = this.document.defaultView;
    this.hidden = this.document.visibilityState === 'hidden';
    this.online = this.network.isOnline();

    const onVisibility = (): void => this.visibilityChanged();
    const onActivity = (): void => this.activity();
    this.document.addEventListener('visibilitychange', onVisibility);
    for (const name of ACTIVITY_EVENTS) {
      view?.addEventListener(name, onActivity, { passive: true, capture: true });
    }

    effect(() => {
      const signedIn = this.signedIn();
      untracked(() => (signedIn ? this.start() : this.stop()));
    });
    effect(() => {
      const online = this.network.isOnline();
      untracked(() => this.networkChanged(online));
    });

    this.destroyRef.onDestroy(() => {
      this.stop();
      this.document.removeEventListener('visibilitychange', onVisibility);
      for (const name of ACTIVITY_EVENTS) {
        view?.removeEventListener(name, onActivity, { capture: true });
      }
    });
  }

  /**
   * When a screen should read again: any of `topics` changed, or everything may have. Silent while
   * paused, idle, signed out, or with no feed at all.
   */
  changes(topics: readonly LiveTopic[]): Observable<void> {
    const wanted: ReadonlySet<string> = new Set(topics);
    return this.wakes.pipe(
      filter((wake) => wake.all || wake.topics.some((topic) => wanted.has(topic))),
      throttleTime(REFRESH_THROTTLE_MS, asyncScheduler, { leading: true, trailing: true }),
      // A trailing re-read that falls due after a pause is dropped with the rest.
      filter(() => this.talking()),
      map((): void => undefined),
    );
  }

  /** Stops every live re-read and closes the stream, until `resume()`. */
  pause(): void {
    if (this.status() === 'off') return;
    this.paused.set(true);
    this.reconcile();
  }

  /** Resumes, and re-reads what is on screen: anything may have changed meanwhile. */
  resume(): void {
    if (!this.paused()) return;
    this.paused.set(false);
    this.activity();
    this.reconcile();
    // A reopened stream re-reads on its `ready`; a poll has nothing to wait for.
    if (this.fallback()) this.wake(EVERYTHING);
  }

  /** Re-reads what is on screen now, as a person asked. */
  refreshNow(): void {
    this.activity();
    this.wake(EVERYTHING);
  }

  /** A screen read successfully; said in the topbar as "Updated 10:32". */
  noteRefreshed(): void {
    this.failed.set(false);
    this.updatedAt.set(new Date());
  }

  /** A quiet re-read failed and the screen kept what it had. */
  noteRefreshFailed(): void {
    this.failed.set(true);
  }

  /** Forgets the last screen's read, so the topbar never vouches for one nobody is looking at. */
  forgetScreen(): void {
    this.failed.set(false);
    this.updatedAt.set(null);
  }

  /* ── lifecycle ─────────────────────────────────────────────────────────── */

  private start(): void {
    this.lastActivity = Date.now();
    this.armIdle();
    this.reconcile();
  }

  private stop(): void {
    this.closeStream();
    for (const purpose of [...this.timers.keys()]) {
      this.clear(purpose);
    }
    this.link.set('closed');
    this.connectedOnce.set(false);
    this.renewing.set(false);
    this.fallback.set(false);
    this.paused.set(false);
    this.inactive.set(false);
    this.asleep.set(false);
    this.offered.set(new Set());
    this.failures = 0;
    this.forgetScreen();
  }

  /** Whether the console should be talking to the API at all right now. */
  private talking(): boolean {
    return (
      this.feed !== null && this.signedIn() && !this.paused() && !this.inactive() && !this.asleep()
    );
  }

  /** Opens or closes whatever the current state calls for, and nothing else. */
  private reconcile(): void {
    if (!this.talking()) {
      this.closeStream();
      this.clear('reconnect');
      this.clear('poll');
      this.link.set('closed');
      this.renewing.set(false);
      return;
    }

    if (this.fallback()) {
      if (this.hidden) {
        this.clear('poll');
      } else if (!this.timers.has('poll')) {
        this.armPoll();
      }
      return;
    }

    if (this.connection === null && !this.timers.has('reconnect')) {
      this.connect();
    }
  }

  /* ── the stream ────────────────────────────────────────────────────────── */

  private connect(): void {
    this.clear('reconnect');
    const feed = this.feed;
    if (feed === null) return;

    // Offline: nothing to try. The network coming back reconnects at once.
    if (!this.online) {
      this.link.set('waiting');
      return;
    }

    this.link.set('opening');
    const subscription = feed.open().subscribe({
      next: (event) => this.receive(event),
      error: (error: unknown) => this.dropped(error),
      complete: () => this.dropped(null),
    });
    this.connection = subscription.closed ? null : subscription;
  }

  private receive(event: ChangeFeedEvent): void {
    switch (event.kind) {
      case 'ready': {
        const reconnected = this.connectedOnce();
        this.failures = 0;
        this.connectedOnce.set(true);
        this.renewing.set(false);
        this.link.set('open');
        this.offered.set(new Set(event.topics));
        // The first `ready` after sign-in follows the screen's own first read; any later one
        // follows a gap in which something may have changed unseen.
        if (reconnected) {
          this.wake(EVERYTHING);
        }
        return;
      }
      case 'change':
        this.wake({ all: false, topics: event.topics });
        return;
      case 'resync':
        this.wake(EVERYTHING);
        return;
      case 'expired':
        // The server closes next; reopen at once. The header interceptor renews the token on the
        // way out, on demand, as for any request (`DL-166`).
        this.closeStream();
        this.renewing.set(true);
        this.connect();
        return;
    }
  }

  private dropped(error: unknown): void {
    this.connection = null;
    this.renewing.set(false);
    if (!this.talking()) {
      this.link.set('closed');
      return;
    }

    const status = statusOf(error);

    // The credential was refused: the error interceptor has ended the session, and signing out
    // stops everything here. Trying again would only be refused again.
    if (status === 401) {
      this.link.set('closed');
      return;
    }

    // An API without the feed, or one that will not give it to this account: re-read on a slow
    // tick instead, only while somebody can see the screen.
    if (status === 404 || status === 501 || status === 403) {
      this.fallback.set(true);
      this.link.set('closed');
      this.reconcile();
      return;
    }

    this.link.set('waiting');
    const delay = reconnectDelay(this.failures, Math.random());
    this.failures += 1;
    this.schedule('reconnect', delay, () => this.connect());
  }

  private closeStream(): void {
    const connection = this.connection;
    this.connection = null;
    connection?.unsubscribe();
  }

  /* ── what wakes a screen ───────────────────────────────────────────────── */

  private wake(wake: Wake): void {
    // A hidden tab is woken all at once when it is looked at again, not change by change.
    if (!this.talking() || this.hidden) return;
    this.wakes.next(wake);
  }

  private armPoll(): void {
    this.schedule('poll', POLL_EVERY_MS, () => {
      this.wake(EVERYTHING);
      this.reconcile();
    });
  }

  private visibilityChanged(): void {
    const hidden = this.document.visibilityState === 'hidden';
    if (hidden === this.hidden) return;
    this.hidden = hidden;
    if (!this.signedIn()) return;

    if (hidden) {
      this.clear('poll');
      this.schedule('hidden', HIDDEN_CLOSE_MS, () => {
        this.asleep.set(true);
        this.reconcile();
      });
      return;
    }

    this.clear('hidden');
    if (this.asleep()) {
      this.asleep.set(false);
      this.reconcile();
      // A reopened stream re-reads on its `ready`; a poll has nothing to wait for.
      if (this.fallback()) this.wake(EVERYTHING);
      return;
    }
    this.wake(EVERYTHING);
    this.reconcile();
  }

  private networkChanged(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    if (!online || !this.talking()) return;

    if (this.fallback() || this.link() === 'open') {
      this.wake(EVERYTHING);
      return;
    }
    // Waiting out a backoff, or never tried because the device was offline: try now.
    this.failures = 0;
    this.closeStream();
    this.connect();
  }

  /* ── idle ──────────────────────────────────────────────────────────────── */

  /**
   * A timestamp, and nothing else, on every pointer move and key: the idle check reads it when its
   * own timer falls due. Coming back from idle reconnects, and the reconnection re-reads.
   */
  private activity(): void {
    this.lastActivity = Date.now();
    if (!this.inactive()) return;
    this.inactive.set(false);
    this.armIdle();
    this.reconcile();
    if (this.fallback()) this.wake(EVERYTHING);
  }

  private armIdle(): void {
    this.clear('idle');
    if (!this.signedIn()) return;
    const remaining = IDLE_AFTER_MS - (Date.now() - this.lastActivity);
    if (remaining <= 0) {
      this.inactive.set(true);
      this.reconcile();
      return;
    }
    this.schedule('idle', remaining, () => this.armIdle());
  }

  private schedule(purpose: TimerPurpose, delay: number, run: () => void): void {
    this.clear(purpose);
    this.timers.set(
      purpose,
      setTimeout(() => {
        this.timers.delete(purpose);
        run();
      }, delay),
    );
  }

  private clear(purpose: TimerPurpose): void {
    const timer = this.timers.get(purpose);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(purpose);
    }
  }
}

/** The HTTP status of a failure, whichever shape it arrived in; `null` when it carries none. */
function statusOf(error: unknown): number | null {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status: unknown = error.status;
    return typeof status === 'number' ? status : null;
  }
  return null;
}
