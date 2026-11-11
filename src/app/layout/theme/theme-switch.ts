import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { type ThemePreference, ThemeService } from '@core/layout/theme.service';

import { LAYOUT_COPY } from '../layout.copy';

interface ThemeOption {
  readonly value: ThemePreference;
  readonly label: string;
}

/**
 * System / Light / Dark, in the sidebar's account footer beside identity and
 * sign-out, so it is reachable at every width (the footer stays in the drawer
 * on a narrow screen).
 *
 * Built from the design system only (`DL-204`): a `.choice-list` fieldset whose
 * legend names the group, a `.tabs.tabs--fill` pill of `.tab` labels, the chosen
 * one `.tab--active` (the mock-ups' Light / Dark switch is the same pill), and a
 * `.field__hint`. Native radio buttons, visually hidden inside each tab: arrow
 * keys move and choose, a screen reader announces the group, the option and its
 * state, and the tab draws a focused radio's ring (`_patterns.scss`).
 */
@Component({
  selector: 'app-theme-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="choice-list" aria-describedby="theme-switch-hint">
      <legend>{{ copy.themeLegend }}</legend>
      <div class="tabs tabs--fill">
        @for (option of options; track option.value) {
          <label class="tab" [class.tab--active]="theme.preference() === option.value">
            <input
              type="radio"
              class="visually-hidden"
              name="app-theme"
              [value]="option.value"
              [checked]="theme.preference() === option.value"
              (change)="theme.choose(option.value)"
            />
            {{ option.label }}
          </label>
        }
      </div>
      <p id="theme-switch-hint" class="field__hint">{{ copy.themeHint }}</p>
    </fieldset>
  `,
})
export class ThemeSwitch {
  protected readonly theme = inject(ThemeService);
  protected readonly copy = LAYOUT_COPY;

  protected readonly options: readonly ThemeOption[] = [
    { value: 'system', label: LAYOUT_COPY.themeSystem },
    { value: 'light', label: LAYOUT_COPY.themeLight },
    { value: 'dark', label: LAYOUT_COPY.themeDark },
  ];
}
