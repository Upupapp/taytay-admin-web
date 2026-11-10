import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ICONS, type IconDefinition, type IconName } from './icons';

/**
 * One icon from the console's set, drawn in the colour of the text around it.
 *
 * Always decorative: the host is `aria-hidden`, so an icon never becomes the
 * accessible name of anything. A control whose only content is an icon still
 * needs a name of its own (`aria-label` or a `visually-hidden` span) and the
 * `.icon-button` class (`check:shell`).
 *
 *   <app-icon name="bell" [size]="20" />
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'icon', 'aria-hidden': 'true' },
  template: `
    <svg
      viewBox="0 0 24 24"
      focusable="false"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.fill]="definition().solid ? 'currentColor' : 'none'"
      [attr.stroke]="definition().solid ? null : 'currentColor'"
      [attr.stroke-width]="definition().solid ? null : stroke()"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path [attr.d]="definition().d" [attr.fill-rule]="definition().solid ? 'evenodd' : null" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  /** Edge length in CSS pixels. The mock-ups draw 13–20. */
  readonly size = input(18);
  /** Line weight for a stroked icon; ignored by a solid one. */
  readonly stroke = input(1.8);

  protected readonly definition = computed<IconDefinition>(() => ICONS[this.name()]);
}
