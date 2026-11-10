import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { NetworkStatus } from '@core/network/network-status';

import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icons';

export type EmptyStateVariant = 'empty' | 'no-results' | 'error' | 'forbidden';

/** What the empty state draws above its heading. Decoration only; the words carry it. */
type EmptyStateArt =
  | { readonly kind: 'illustration'; readonly src: string }
  | { readonly kind: 'tile'; readonly icon: IconName };

const NO_RESULTS_ILLUSTRATION = 'illustrations/empty-no-results.svg';
const OFFLINE_ILLUSTRATION = 'illustrations/empty-offline.svg';

/**
 * The standard "there is nothing here" surface.
 *
 * Distinguishing `empty` (nothing exists yet) from `no-results` (filters hid
 * everything) matters: the first invites creating a record, the second invites
 * clearing filters. Screens must not collapse the two, and they do not look
 * alike either: `no-results` draws the design's search illustration, `empty` an
 * icon tile.
 *
 * The design's offline illustration is drawn for a failed load while the
 * device is offline, which is when it is true. A failure while online gets an
 * icon instead, because it says nothing about the connection.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="empty" [class]="'empty--' + variant()">
      @let shown = art();
      @if (shown.kind === 'illustration') {
        <img
          class="empty__glyph empty__illustration"
          aria-hidden="true"
          alt=""
          width="168"
          height="132"
          [src]="shown.src"
        />
      } @else {
        <span class="empty__glyph empty__tile" aria-hidden="true">
          <app-icon [name]="shown.icon" [size]="26" />
        </span>
      }
      <h3 class="empty__heading">{{ heading() }}</h3>
      @if (message(); as text) {
        <p class="empty__message">{{ text }}</p>
      }
      @if (actionLabel(); as label) {
        <button type="button" class="btn btn--primary" (click)="actionSelected.emit()">
          {{ label }}
        </button>
      }
    </div>
  `,
  styleUrl: './empty-state.scss',
})
export class EmptyState {
  private readonly network = inject(NetworkStatus);

  readonly variant = input<EmptyStateVariant>('empty');
  readonly heading = input.required<string>();
  readonly message = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);

  readonly actionSelected = output<void>();

  protected readonly art = computed<EmptyStateArt>(() => {
    switch (this.variant()) {
      case 'no-results':
        return { kind: 'illustration', src: NO_RESULTS_ILLUSTRATION };
      case 'error':
        return this.network.isOnline()
          ? { kind: 'tile', icon: 'error' }
          : { kind: 'illustration', src: OFFLINE_ILLUSTRATION };
      case 'forbidden':
        return { kind: 'tile', icon: 'lock' };
      case 'empty':
        return { kind: 'tile', icon: 'inbox' };
    }
  });
}
