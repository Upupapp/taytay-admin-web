import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import {
  NetworkStatus,
  OFFLINE_NOTICE,
  RECONNECTED_NOTICE,
} from '@core/network/network-status';

/**
 * The connection banner.
 *
 * Mounted once by the shell, above the main landmark, so it is the first thing
 * after the skip link — an officer who cannot save needs to know before they
 * spend five minutes typing, not after.
 *
 * Three deliberate choices:
 *
 *  - **`role="status"`, not `role="alert"`.** Losing a connection is not an
 *    error in the page; it is a condition of the device. `alert` interrupts a
 *    screen reader mid-sentence, and this is not worth interrupting somebody's
 *    reading of a case note for.
 *  - **The reconnected message does not auto-dismiss.** It says work was *not*
 *    kept, which is exactly the message that must survive somebody looking
 *    away. It is dismissed by a person, never by a timer.
 *  - **No "we will retry" anywhere.** Nothing is queued (`DL-118`). Saying
 *    otherwise is how a caseworker closes a tab believing a request was filed.
 */
@Component({
  selector: 'app-connection-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOffline()) {
      <div class="connection connection--offline" role="status">
        <p class="connection__message">
          <span class="connection__label">Offline</span>
          {{ offlineNotice }}
        </p>
      </div>
    } @else if (showReconnected()) {
      <div class="connection connection--restored" role="status">
        <p class="connection__message">
          <span class="connection__label">Connection restored</span>
          {{ reconnectedNotice }}
        </p>
        <button type="button" class="connection__dismiss" (click)="acknowledge()">
          Dismiss
        </button>
      </div>
    }
  `,
  styleUrl: './connection-banner.scss',
})
export class ConnectionBanner {
  private readonly network = inject(NetworkStatus);

  protected readonly offlineNotice = OFFLINE_NOTICE;
  protected readonly reconnectedNotice = RECONNECTED_NOTICE;

  protected readonly isOffline = computed(() => !this.network.isOnline());

  /** Shown after a drop, until a person dismisses it. Never on a timer. */
  protected readonly showReconnected = computed(
    () => this.network.isOnline() && this.network.hasDropped(),
  );

  protected acknowledge(): void {
    this.network.acknowledgeDrop();
  }
}
