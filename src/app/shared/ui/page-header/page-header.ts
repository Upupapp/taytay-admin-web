import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Consistent page title block. `<ng-content select="[page-actions]">` receives
 * the primary actions, which callers gate with `*appHasPermission`.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="page-header__text">
        <h1 class="page-header__title">{{ title() }}</h1>
        @if (subtitle(); as text) {
          <p class="page-header__subtitle">{{ text }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content select="[page-actions]"></ng-content>
      </div>
    </header>
  `,
  styleUrl: './page-header.scss',
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
}
