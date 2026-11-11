import { DOCUMENT } from '@angular/common';
import { computed, inject, Injectable, signal } from '@angular/core';

/** The console's two themes. Light is the default, whatever the computer is set to (`DL-207`). */
export type ThemeName = 'light' | 'dark';

/** The attribute on `<html>` that `src/styles.scss` reads: `dark`, or absent for light. */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * The console's colour theme (`DL-204`, `DL-207`).
 *
 * Light always comes first: the stylesheet draws light unless `<html>` carries
 * `data-theme="dark"`, and it no longer reads `prefers-color-scheme`. The
 * owner's instruction was that the console opens light even on a computer set
 * to dark, with a button to switch. So the default needs no script at all, and
 * nothing flashes before the app starts — which matters because the CSP
 * (`script-src 'self'`) refuses the usual inline snippet that would read a
 * saved choice first.
 *
 * The choice is held for this tab only, and never written to web storage:
 * `check:auth` refuses `localStorage`, `sessionStorage`, cookies and IndexedDB
 * anywhere in the console, on the ground that a rule about *whether* the
 * console stores anything needs no judgement and a rule about *what* it stores
 * does. A reload therefore opens light again, which is the default asked for.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  private readonly current = signal<ThemeName>(this.fromDocument());

  readonly theme = this.current.asReadonly();

  readonly isDark = computed(() => this.current() === 'dark');

  choose(theme: ThemeName): void {
    this.current.set(theme);

    if (theme === 'dark') {
      this.root.setAttribute(THEME_ATTRIBUTE, 'dark');
    } else {
      this.root.removeAttribute(THEME_ATTRIBUTE);
    }
  }

  toggle(): void {
    this.choose(this.isDark() ? 'light' : 'dark');
  }

  /** Whatever the page already says, so the control never misstates the theme on screen. */
  private fromDocument(): ThemeName {
    return this.root.getAttribute(THEME_ATTRIBUTE) === 'dark' ? 'dark' : 'light';
  }
}
