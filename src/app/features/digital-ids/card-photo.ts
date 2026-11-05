import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DIGITAL_ID_REPOSITORY, type MediaId } from '@domain/index';
import { ObjectUrls } from '@shared/media/object-urls';
import { Modal } from '@shared/ui/modal/modal';

import { DIGITAL_IDS_COPY } from './digital-ids.copy';

type PhotoState =
  | { readonly kind: 'closed' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'open'; readonly url: string };

/**
 * The photo on a resident's card, **only on request** (`DL-167`'s pattern, `DL-171`).
 *
 * Asking opens a warning first, and only the warning's own button fetches the bytes — through the
 * data layer, with the token in a header, never a URL to the API. The object URL is held here alone
 * and revoked when the photo is hidden, when another card is shown, and when the component goes.
 */
@Component({
  selector: 'app-card-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  styleUrl: './digital-ids.scss',
  template: `
    @switch (state().kind) {
      @case ('closed') {
        <button type="button" class="btn" (click)="ask()">{{ copy.show }}</button>
      }
      @case ('loading') {
        <p class="digital-ids__note" role="status">{{ copy.loading }}</p>
      }
      @case ('failed') {
        <p class="digital-ids__problem" role="alert">{{ copy.failed }}</p>
        <button type="button" class="btn" (click)="ask()">{{ copy.show }}</button>
      }
      @case ('open') {
        <figure class="digital-ids__photo">
          <img [src]="openUrl()" [alt]="copy.alt(whose())" width="150" />
        </figure>
        <button type="button" class="btn" (click)="hide()">{{ copy.hide }}</button>
      }
    }

    @if (warning()) {
      <app-modal
        [open]="true"
        [heading]="copy.warningHeading"
        size="small"
        (dismissed)="warning.set(false)"
      >
        <div modal-body>
          @for (line of copy.warning; track $index) {
            <p>{{ line }}</p>
          }
        </div>
        <button type="button" modal-actions class="btn" (click)="warning.set(false)">
          {{ copy.cancel }}
        </button>
        <button type="button" modal-actions class="btn btn--primary" (click)="open()">
          {{ copy.confirm }}
        </button>
      </app-modal>
    }
  `,
})
export class CardPhoto {
  private readonly repository = inject(DIGITAL_ID_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectUrls = new ObjectUrls();

  readonly photo = input.required<MediaId>();
  /** Whose card, for the image's text alternative. */
  readonly whose = input.required<string>();

  protected readonly copy = DIGITAL_IDS_COPY.photo;
  protected readonly warning = signal(false);
  protected readonly state = signal<PhotoState>({ kind: 'closed' });

  constructor() {
    // Another card shown in the same place must never show the previous card's photo.
    effect(() => {
      this.photo();
      untracked(() => this.hide());
    });
    this.destroyRef.onDestroy(() => this.objectUrls.revokeAll());
  }

  protected openUrl(): string {
    const state = this.state();
    return state.kind === 'open' ? state.url : '';
  }

  protected ask(): void {
    this.warning.set(true);
  }

  /** The only path that fetches the photo: from the warning's own button. */
  protected open(): void {
    this.warning.set(false);
    const photo = this.photo();
    this.hide();
    this.state.set({ kind: 'loading' });
    this.repository
      .openPhoto(photo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          // Answered after another card was shown: this is not that card's photo.
          if (this.photo() === photo) {
            this.state.set({ kind: 'open', url: this.objectUrls.make(blob) });
          }
        },
        error: () => this.state.set({ kind: 'failed' }),
      });
  }

  protected hide(): void {
    this.objectUrls.revokeAll();
    this.state.set({ kind: 'closed' });
  }
}
