import { ChangeDetectionStrategy, Component } from '@angular/core';

import { BRAND_COPY } from '@shared/brand/brand.copy';

import { AUTH_COPY } from './auth.copy';

/**
 * The photograph panel beside the sign-in form (DL-243). The photograph is a CSS background, so it
 * is decorative by construction; the words and the photo credit are text a screen reader reaches,
 * which is why the host is a labelled landmark rather than `aria-hidden` as the tile artwork was.
 * It holds no control and nothing shaped like one: the tiles it replaces looked like buttons on a
 * page where nothing can be opened yet.
 */
@Component({
  selector: 'app-sign-in-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'complementary', '[attr.aria-label]': 'copy.artLabel' },
  template: `
    <div class="art__panel">
      <div class="art__words">
        <span class="art__place">{{ brand.municipality }}</span>
        <p class="art__headline">{{ copy.artHeadline }}</p>
        <p class="art__lede">{{ copy.artLede }}</p>
      </div>

      <div class="art__foot">
        <p class="art__unit">{{ brand.organisationUnit }}</p>
        <p class="art__credit">{{ copy.artPhotoCredit }}</p>
      </div>
    </div>
  `,
  styleUrl: './sign-in-art.scss',
})
export class SignInArt {
  protected readonly copy = AUTH_COPY;
  protected readonly brand = BRAND_COPY;
}
