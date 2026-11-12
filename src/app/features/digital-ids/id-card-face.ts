import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { DIGITAL_ID_STATUS_CATALOG, type DigitalIdStatus, type IsoDateTime } from '@domain/index';
import { MunicipalSeal } from '@shared/brand/municipal-seal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { DIGITAL_IDS_COPY } from './digital-ids.copy';

/**
 * The card as the resident sees it in the app (CitizenIDRecord mock-up, `DL-211`): the blue band
 * with the seal, the photo, the name, the number and the validity, and the status.
 *
 * **Presentation only.** It is handed what the card panel already read and fetches nothing: the
 * photo slot shows the image only when `CardPhoto` has opened it after its warning, and says it is
 * hidden otherwise. It carries no QR code and nothing drawn to look like one — the code is what the
 * resident shows, not something the office keeps (`DL-171`).
 */
@Component({
  selector: 'app-id-card-face',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, MunicipalSeal, StatusBadge],
  styleUrl: './id-card-face.scss',
  template: `
    <section class="id-card" [attr.aria-label]="copy.label(number())">
      <div class="id-card__band">
        <app-municipal-seal size="sm" decorative />
        <span class="id-card__issuer">
          <span class="id-card__province">{{ copy.province }}</span>
          <span class="id-card__town">{{ copy.town }}</span>
        </span>
        <span class="id-card__kind">{{ copy.kind }}</span>
      </div>
      <div class="id-card__body">
        <div class="id-card__photo">
          @if (photoUrl(); as url) {
            <img [src]="url" [alt]="photoAlt()" />
          } @else {
            <span class="id-card__photo-note">{{ copy.photoHidden }}</span>
          }
        </div>
        <dl class="id-card__fields">
          <div class="id-card__field id-card__field--full">
            <dt>{{ copy.name }}</dt>
            <dd class="id-card__name">{{ name() }}</dd>
          </div>
          <div class="id-card__field id-card__field--full">
            <dt>{{ copy.number }}</dt>
            <dd>{{ number() }}</dd>
          </div>
          <div class="id-card__field">
            <dt>{{ copy.issued }}</dt>
            <dd>{{ issuedAt() | date: 'd MMM y' }}</dd>
          </div>
          <div class="id-card__field">
            <dt>{{ copy.expires }}</dt>
            <dd>{{ expiresAt() | date: 'd MMM y' }}</dd>
          </div>
        </dl>
      </div>
      <div class="id-card__foot">
        <app-status-badge [catalog]="catalog" [status]="status()" />
      </div>
      <div class="id-card__stripe" aria-hidden="true"></div>
    </section>
  `,
})
export class IdCardFace {
  readonly name = input.required<string>();
  readonly number = input.required<string>();
  readonly status = input.required<DigitalIdStatus>();
  readonly issuedAt = input.required<IsoDateTime>();
  readonly expiresAt = input.required<IsoDateTime>();
  /** The object URL `CardPhoto` holds while the photo is shown; `null` while it is hidden. */
  readonly photoUrl = input<string | null>(null);
  readonly photoAlt = input('');

  protected readonly copy = DIGITAL_IDS_COPY.face;
  protected readonly catalog = DIGITAL_ID_STATUS_CATALOG;
}
