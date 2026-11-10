import { ChangeDetectionStrategy, Component } from '@angular/core';

import { BRAND_COPY } from '@shared/brand/brand.copy';
import { Icon } from '@shared/ui/icon/icon';

import { AUTH_COPY } from './auth.copy';

/**
 * The deep panel beside the sign-in form. Decoration only, so the host is hidden from assistive
 * technology: the console's name and a few of its module names, and nothing about any record —
 * there is no session yet, so there is nothing a figure here could truthfully count.
 */
@Component({
  selector: 'app-sign-in-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { 'aria-hidden': 'true' },
  template: `
    <span class="art__place">{{ brand.municipality }}</span>

    <div class="art__tiles">
      <div class="art__tile art__tile--wide">
        <span class="art__chip"><app-icon name="file" [size]="20" /></span>
        {{ copy.artModules.requests }}
      </div>
      <div class="art__tile art__tile--gold">
        <span class="art__chip"><app-icon name="shield" [size]="20" /></span>
        {{ copy.artModules.verification }}
      </div>
      <div class="art__tile art__tile--sky">
        <span class="art__chip"><app-icon name="cash" [size]="20" /></span>
        {{ copy.artModules.releases }}
      </div>
      <div class="art__tile">
        <span class="art__chip"><app-icon name="pin" [size]="20" /></span>
        {{ copy.artModules.visits }}
      </div>
      <div class="art__tile">
        <span class="art__chip art__chip--red"><app-icon name="news" [size]="20" /></span>
        {{ copy.artModules.balita }}
      </div>
    </div>

    <div class="art__title">
      <span class="art__name">{{ copy.artTitle }}</span>
      <span class="art__unit">{{ brand.organisationUnit }}</span>
    </div>
  `,
  styleUrl: './sign-in-art.scss',
})
export class SignInArt {
  protected readonly copy = AUTH_COPY;
  protected readonly brand = BRAND_COPY;
}
