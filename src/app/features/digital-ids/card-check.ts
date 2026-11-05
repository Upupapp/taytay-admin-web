import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  DIGITAL_ID_CHECK_EFFECTS,
  DIGITAL_ID_REPOSITORY,
  DIGITAL_ID_STATUS_CATALOG,
  QR_PAYLOAD_MAX_LENGTH,
  type DigitalIdHolder,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { CardPhoto } from './card-photo';
import { DIGITAL_IDS_COPY } from './digital-ids.copy';

/**
 * Checking the card a resident shows (`digital-id.verify`, `DL-171`).
 *
 * **A privacy-sensitive lookup, kept as small as the API makes it.** The code is held in the field
 * only until it is sent, and the field is emptied the moment it is; the answer lives in one signal
 * and is gone when another code is checked, the answer is cleared, or the page is left. Nothing is
 * logged or stored. The API records the check under the checker's account, and the screen says so
 * before the button.
 *
 * **No verdict.** The screen repeats what the API says — the card's status and whether it has
 * expired — and leaves what that settles to the person checking (`DL-60`).
 */
@Component({
  selector: 'app-card-check',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPhoto, StatusBadge],
  templateUrl: './card-check.html',
  styleUrl: './digital-ids.scss',
})
export class CardCheck {
  private readonly repository = inject(DIGITAL_ID_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = DIGITAL_IDS_COPY.check;
  protected readonly catalog = DIGITAL_ID_STATUS_CATALOG;
  protected readonly effects = DIGITAL_ID_CHECK_EFFECTS;
  protected readonly maxLength = QR_PAYLOAD_MAX_LENGTH;

  protected readonly payload = signal('');
  protected readonly busy = signal(false);
  protected readonly problem = signal('');
  protected readonly holder = signal<DigitalIdHolder | null>(null);
  /** The live region's text. */
  protected readonly outcome = signal('');

  protected typed(event: Event): void {
    const target = event.target;
    this.payload.set(target instanceof HTMLTextAreaElement ? target.value : '');
  }

  protected check(): void {
    const payload = this.payload().trim();
    if (payload === '') {
      this.problem.set(this.copy.empty);
      return;
    }
    if (payload.length > QR_PAYLOAD_MAX_LENGTH) {
      this.problem.set(this.copy.tooLong(QR_PAYLOAD_MAX_LENGTH));
      return;
    }

    // The code leaves the field as it leaves for the server: it is a short-lived pass, not a note.
    this.payload.set('');
    this.holder.set(null);
    this.problem.set('');
    this.outcome.set('');
    this.busy.set(true);
    this.repository
      .check(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (holder) => {
          this.busy.set(false);
          this.holder.set(holder);
          this.outcome.set(this.copy.announced);
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          const reason = failureReason(failure);
          this.problem.set(reason === null ? this.copy.failed : this.copy.refused(reason));
        },
      });
  }

  protected clear(): void {
    this.holder.set(null);
    this.outcome.set(this.copy.cleared);
  }

  protected inForce(holder: DigitalIdHolder): boolean {
    return holder.status === 'active' && !holder.expired;
  }
}
