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
import { SealPlaceholder } from './seal-placeholder';

export type SealSize = 'sm' | 'md' | 'lg' | 'xl';

const SEAL_PIXELS: Readonly<Record<SealSize, number>> = {
  sm: 32,
  md: 48,
  lg: 96,
  xl: 160,
};

/**
 * Renders the official municipal seal — but only when the manifest says an
 * asset has actually been acquired, as it has since `DL-199`.
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
 * See `DL-22` and `DL-199`.
 */
@Component({
  selector: 'app-municipal-seal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppImage, SealPlaceholder],
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
      <app-seal-placeholder [pixels]="pixels()" [decorative]="decorative()" />
    }
  `,
})
export class MunicipalSeal {
  readonly size = input<SealSize>('md');
  readonly decorative = input(false, { transform: booleanAttribute });
  readonly priority = input(false, { transform: booleanAttribute });

  protected readonly copy = BRAND_COPY;

  /** `null` only if the seal is withdrawn from the manifest; since `DL-199` it is vendored. */
  protected readonly renderableSeal = computed<RenderableAsset | null>(() =>
    asRenderable(findAsset(MUNICIPAL_SEAL_ID)),
  );

  protected readonly pixels = computed(() => SEAL_PIXELS[this.size()]);
}
