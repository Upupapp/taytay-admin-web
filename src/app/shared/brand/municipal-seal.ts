import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { AppImage } from './app-image';
import { BRAND_COPY } from './brand.copy';
import { asRenderable, findAsset, MUNICIPAL_SEAL_ID, type RenderableAsset } from './asset-manifest';

export type SealSize = 'sm' | 'md' | 'lg' | 'xl';

const SEAL_PIXELS: Readonly<Record<SealSize, number>> = {
  sm: 32,
  md: 48,
  lg: 96,
  xl: 160,
};

/**
 * Renders the official municipal seal — but only when the manifest says an
 * asset has actually been acquired.
 *
 * The safety property is structural rather than procedural: this component
 * cannot render a seal the manifest has not cleared, because the path and
 * dimensions come from the manifest and `isRenderable()` gates on provenance.
 * There is no `src` input to override.
 *
 * The seal is never altered. It is drawn into a square box with
 * `object-fit: contain`, so it scales uniformly and is never cropped,
 * stretched, recoloured, rotated or overlaid. Size is chosen from a fixed set
 * so callers cannot introduce a non-uniform box.
 *
 * See `DL-22`.
 */
@Component({
  selector: 'app-municipal-seal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppImage],
  template: `
    @if (renderableSeal(); as asset) {
      <app-image
        [src]="asset.optimizedPath"
        [alt]="decorative() ? '' : copy.sealAlt"
        [decorative]="decorative()"
        [width]="pixels()"
        [height]="pixels()"
        [priority]="priority()"
      />
    } @else {
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
    }
  `,
  styleUrl: './municipal-seal.scss',
})
export class MunicipalSeal {
  readonly size = input<SealSize>('md');
  readonly decorative = input(false, { transform: booleanAttribute });
  readonly priority = input(false, { transform: booleanAttribute });

  protected readonly copy = BRAND_COPY;

  /** `null` whenever the seal has not been lawfully acquired — the normal case today. */
  protected readonly renderableSeal = computed<RenderableAsset | null>(() =>
    asRenderable(findAsset(MUNICIPAL_SEAL_ID)),
  );

  protected readonly pixels = computed(() => SEAL_PIXELS[this.size()]);
}
