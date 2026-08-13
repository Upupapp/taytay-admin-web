import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type EmptyStateVariant = 'empty' | 'no-results' | 'error' | 'forbidden';

/**
 * The standard "there is nothing here" surface.
 *
 * Distinguishing `empty` (nothing exists yet) from `no-results` (filters hid
 * everything) matters: the first invites creating a record, the second invites
 * clearing filters. Screens must not collapse the two.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" [class]="'empty--' + variant()">
      <span class="empty__glyph" aria-hidden="true">{{ glyph() }}</span>
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
  readonly variant = input<EmptyStateVariant>('empty');
  readonly heading = input.required<string>();
  readonly message = input<string | null>(null);
  readonly actionLabel = input<string | null>(null);

  readonly actionSelected = output<void>();

  protected glyph(): string {
    switch (this.variant()) {
      case 'no-results':
        return '⌕';
      case 'error':
        return '!';
      case 'forbidden':
        return '⦸';
      case 'empty':
        return '◇';
    }
  }
}
