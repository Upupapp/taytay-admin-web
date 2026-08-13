import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BRAND_COPY } from './brand.copy';
import { MunicipalSeal, type SealSize } from './municipal-seal';

export type BrandMarkTone = 'light' | 'dark';

/**
 * The application's lockup: seal (or its placeholder) beside the office name.
 *
 * This is the one place the product is named on screen. Everything else reads
 * the copy module, so a rename is a one-line change rather than a search.
 */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MunicipalSeal],
  template: `
    <span class="mark" [class]="'mark--' + tone()">
      <app-municipal-seal [size]="sealSize()" [priority]="priority()" decorative />

      @if (showText()) {
        <span class="mark__text">
          <strong class="mark__name">{{ copy.organisationName }}</strong>
          <small class="mark__unit">{{ secondary() }}</small>
        </span>
      }
    </span>
  `,
  styleUrl: './brand-mark.scss',
})
export class BrandMark {
  readonly sealSize = input<SealSize>('sm');
  readonly tone = input<BrandMarkTone>('dark');
  readonly showText = input(true, { transform: booleanAttribute });
  readonly priority = input(false, { transform: booleanAttribute });
  /** Swap the second line for the municipality when the unit is implied. */
  readonly secondaryLine = input<'unit' | 'municipality'>('municipality');

  protected readonly copy = BRAND_COPY;

  protected secondary(): string {
    return this.secondaryLine() === 'unit' ? this.copy.organisationUnit : this.copy.municipality;
  }
}
