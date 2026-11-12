import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  CARD_PHOTO_CONSENT_STATEMENT,
  CARD_PHOTO_EFFECTS,
  DIGITAL_ID_REPOSITORY,
  type AppAccountId,
  type TakenCardPhoto,
} from '@domain/index';
import { ImageFileField } from '@shared/media/image-file-field';
import { failureReason } from '@shared/state/failure-reason';

import { DIGITAL_IDS_COPY } from './digital-ids.copy';

/**
 * Take card photo (`DL-221`): the face for a resident who sent no reviewed selfie — one verified in
 * person — chosen as a file taken at the counter. This console uses no camera (`check:digital-ids`):
 * the photo is a file, refused before it is sent if the API would refuse it (`ImageFileField`, the
 * selfie's rules: JPEG, PNG or WebP by its bytes, 5 MB).
 *
 * **Only with the resident's agreement, said before the button.** The statement and its tick stand
 * above the effects and the button; the button sends nothing until both a photo and the tick are
 * there, and `take()` is the only place the photo is sent from. Nothing is issued here: the photo is
 * handed up to be chosen for the card.
 */
@Component({
  selector: 'app-card-photo-take',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ImageFileField],
  templateUrl: './card-photo-take.html',
})
export class CardPhotoTake {
  private readonly repository = inject(DIGITAL_ID_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = input.required<AppAccountId>();
  readonly taken = output<TakenCardPhoto>();

  protected readonly copy = DIGITAL_IDS_COPY.take;
  protected readonly statement = CARD_PHOTO_CONSENT_STATEMENT;
  protected readonly effects = CARD_PHOTO_EFFECTS;

  protected readonly photo = signal<Blob | null>(null);
  protected readonly agreed = signal(false);
  protected readonly busy = signal(false);
  protected readonly problem = signal('');
  protected readonly outcome = signal('');

  protected chose(photo: Blob | null): void {
    this.photo.set(photo);
    this.problem.set('');
    this.outcome.set('');
  }

  protected tick(event: Event): void {
    this.agreed.set((event.target as HTMLInputElement).checked);
    this.problem.set('');
  }

  /** The only place a card photo is sent from, and only with a photo and the resident's agreement. */
  protected take(): void {
    const photo = this.photo();
    if (photo === null) {
      this.problem.set(this.copy.noPhoto);
      return;
    }
    if (!this.agreed()) {
      this.problem.set(this.copy.noConsent);
      return;
    }
    if (this.busy()) return;
    this.busy.set(true);
    this.problem.set('');
    this.repository
      .takeCardPhoto(this.account(), photo, { confirmed: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (taken) => {
          this.busy.set(false);
          this.agreed.set(false);
          this.outcome.set(this.copy.taken);
          this.taken.emit(taken);
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.problem.set(this.copy.notTaken(failureReason(failure) ?? this.copy.noAnswer));
        },
      });
  }
}
