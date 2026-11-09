import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BRAND_COPY } from './brand.copy';

/**
 * What `MunicipalSeal` draws when the manifest has not cleared a seal: a dashed
 * square with initials, visibly not a government seal.
 *
 * Since `DL-199` the seal is vendored, so this renders only if the seal is
 * withdrawn by setting its provenance back. It is its own component so that
 * fallback stays tested while the live path draws the real seal.
 */
@Component({
  selector: 'app-seal-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="seal-placeholder"
      [style.width.px]="pixels()"
      [style.height.px]="pixels()"
      [attr.title]="copy.sealPlaceholderTooltip"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-label]="decorative() ? null : copy.sealPlaceholderLabel"
      [attr.aria-hidden]="decorative() ? 'true' : null"
    >
      <span class="seal-placeholder__mark" aria-hidden="true">TR</span>
    </span>
  `,
  styleUrl: './seal-placeholder.scss',
})
export class SealPlaceholder {
  readonly pixels = input.required<number>();
  readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly copy = BRAND_COPY;
}
