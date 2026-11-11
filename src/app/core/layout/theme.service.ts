import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';

/** What a person asked for. `system` follows the computer's light or dark setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** The attribute on `<html>` that `src/styles.scss` reads: `light`, `dark`, or absent. */
export const THEME_ATTRIBUTE = 'data-theme';

const isExplicit = (value: string | null): value is 'light' | 'dark' =>
  value === 'light' || value === 'dark';

/**
 * The console's colour theme (`DL-204`).
 *
 * The stylesheet does the work: with no attribute on `<html>` it follows
 * `prefers-color-scheme`, and `data-theme` overrides that either way. So the
 * default needs no script at all, and nothing flashes before the app starts —
 * which matters because the CSP (`script-src 'self'`) refuses the usual inline
 * snippet that would read a saved choice first.
 *
 * The choice is held for this tab only, and never written to web storage:
 * `check:auth` refuses `localStorage`, `sessionStorage`, cookies and IndexedDB
 * anywhere in the console, on the ground that a rule about *whether* the
 * console stores anything needs no judgement and a rule about *what* it stores
 * does. A theme is harmless, but carving it out would turn the first rule into
 * the second. A reload therefore returns to the system setting, and the
 * control says so.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  private readonly current = signal<ThemePreference>(this.fromDocument());

  readonly preference = this.current.asReadonly();

  choose(preference: ThemePreference): void {
    this.current.set(preference);

    if (preference === 'system') {
      this.root.removeAttribute(THEME_ATTRIBUTE);
    } else {
      this.root.setAttribute(THEME_ATTRIBUTE, preference);
    }
  }

  /** Whatever the page already says, so the control never misstates the theme on screen. */
  private fromDocument(): ThemePreference {
    const value = this.root.getAttribute(THEME_ATTRIBUTE);
    return isExplicit(value) ? value : 'system';
  }
}
