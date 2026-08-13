import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type LoadingSize = 'small' | 'medium' | 'large';

/**
 * Determinate-free busy indicator with an accessible live message. Every async
 * surface uses this rather than its own spinner markup.
 */
@Component({
  selector: 'app-loading-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="loading" [class]="'loading--' + size()" role="status">
      <span class="loading__spinner" aria-hidden="true"></span>
      @if (message(); as text) {
        <span class="loading__message">{{ text }}</span>
      } @else {
        <span class="visually-hidden">Loading</span>
      }
    </div>
  `,
  styleUrl: './loading-indicator.scss',
})
export class LoadingIndicator {
  readonly size = input<LoadingSize>('medium');
  readonly message = input<string | null>(null);
}
