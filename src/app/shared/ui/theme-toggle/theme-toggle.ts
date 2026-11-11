import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../../state/theme.service';
import { Icon } from '../icon/icon';

export const THEME_TOGGLE_COPY = {
  label: 'Dark mode',
} as const;

/**
 * The one control that switches the console between light and dark (`DL-207`).
 *
 * The console opens light; this button turns dark mode on and off for the
 * tab. It is a toggle button (`aria-pressed`) with a label that never changes,
 * so a screen reader hears "Dark mode, pressed" or "not pressed" rather than a
 * name that swaps with the state. The icon shows what the button turns the
 * console into, and is decorative.
 *
 * In the sidebar's account footer, reachable at every width, and on the
 * sign-in page, so the theme can be changed before signing in.
 */
@Component({
  selector: 'app-theme-toggle',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn btn--secondary btn--small"
      [attr.aria-pressed]="theme.isDark()"
      (click)="theme.toggle()"
    >
      <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="16" [stroke]="2" />
      {{ copy.label }}
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly copy = THEME_TOGGLE_COPY;
}
