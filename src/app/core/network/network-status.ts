import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Whether the browser thinks it can reach the network.
 *
 * `navigator.onLine` is a weak signal — it reports whether an interface is up,
 * not whether the API is reachable — and this service is deliberately honest
 * about that. It drives a **warning**, never a behaviour change: nothing is
 * queued, retried automatically or marked saved on the strength of it.
 *
 * That restraint is the point. The master command is explicit that this is an
 * admin system and that full offline transactional integrity must not be
 * promised without a backend strategy, and `DL-87` already settled the honest
 * capture doctrine for field visits: exactly one state means the office record
 * has it, and a failed send says plainly that nothing was queued in the
 * background.
 *
 * `DL-118` extends that application-wide.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatus {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly online = signal(true);
  readonly isOnline = this.online.asReadonly();

  /**
   * True once the connection has dropped in this session.
   *
   * Kept after reconnection so a screen can say "you were offline — check
   * anything you submitted", which is the part an officer actually needs. A
   * banner that vanishes the moment the wifi returns tells nobody anything.
   */
  private readonly dropped = signal(false);
  readonly hasDropped = this.dropped.asReadonly();

  constructor() {
    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    this.online.set(view.navigator.onLine);

    const goOffline = (): void => {
      this.online.set(false);
      this.dropped.set(true);
    };
    const goOnline = (): void => this.online.set(true);

    view.addEventListener('offline', goOffline);
    view.addEventListener('online', goOnline);

    this.destroyRef.onDestroy(() => {
      view.removeEventListener('offline', goOffline);
      view.removeEventListener('online', goOnline);
    });
  }

  /** Cleared when the officer has read the warning. Never cleared automatically. */
  acknowledgeDrop(): void {
    this.dropped.set(false);
  }
}

/**
 * What the office is told, and what it is deliberately not told.
 *
 * No "your work will be saved when you reconnect", because it will not be.
 * Nothing is held, nothing is retried in the background, and a submission that
 * failed has failed. Promising otherwise is how a caseworker closes a tab
 * believing a request was filed.
 */
export const OFFLINE_NOTICE =
  'This device has lost its connection. You can keep reading anything already on screen, but ' +
  'nothing can be saved until it returns — and nothing is being held in the background to send ' +
  'later.';

export const RECONNECTED_NOTICE =
  'The connection is back. Anything you tried to save while it was down was not kept, so check ' +
  'the record and enter it again if it is missing.';

export const OFFLINE_ACTION_REFUSED =
  'That could not be saved because the device is offline. Nothing was queued — try again once the ' +
  'connection is back.';
