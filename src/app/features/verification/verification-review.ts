import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';

import {
  awaitsReview,
  ID_DOCUMENT_TYPE_LABELS,
  imagesOf,
  REVIEW_NOTE_LIMITS,
  VERIFICATION_DECISION_EFFECTS,
  VERIFICATION_IMAGE_LABELS,
  VERIFICATION_REPOSITORY,
  VERIFICATION_REVIEW_MOVES,
  VERIFICATION_STATUS_CATALOG,
  VERIFICATION_STATUS_TRANSITIONS,
  type VerificationImageKind,
  type VerificationRequest,
  type VerificationStatus,
} from '@domain/index';
import {
  StatusTransition,
  type StatusTransitionRequest,
  type TransitionGuidance,
} from '@shared/cases/status-transition';
import { ObjectUrls } from '@shared/media/object-urls';
import { failureReason } from '@shared/state/failure-reason';
import { failed, IDLE, LOADING, ready, type ViewState } from '@shared/state/view-state';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { VERIFICATION_COPY } from './verification.copy';

interface OpenedImage {
  readonly kind: VerificationImageKind;
  readonly label: string;
  /** A `blob:` URL this component's `ObjectUrls` made, and the only place it is held. */
  readonly url: string;
}

/**
 * One ID verification request, reviewed (`DL-167`).
 *
 * ## The images are a government ID and a face
 *
 * They are **not loaded until the reviewer asks**, and asking opens a warning first — the
 * `openDocument` precedent (`DL-77`): reading a sensitive file is a separate act, said before it
 * happens. Only after "Show them" does the data layer fetch the bytes, with the bearer token in a
 * header (`ApiClient.blob`), never in a URL. The bytes become object URLs made by this component's
 * own `ObjectUrls` and held nowhere else, and every one is **revoked** when the images are hidden,
 * when another request is opened in this drawer, and when the component is destroyed — closing the
 * review or leaving the page. Nothing is written to storage, and a failure says only that the images could not be opened:
 * no image, address or identifier reaches a message or a log.
 *
 * ## A decision says what it does before it is made
 *
 * Approve and reject go through `StatusTransition`, which refuses a move without words. Each
 * decision's consequences — as the API's own code describes them (`VERIFICATION_DECISION_EFFECTS`)
 * — appear between the choice and the button, and the reason's label names its reader: the office
 * for an approval, **the resident** for a rejection.
 *
 * The decision is not gated on having opened the images. A reviewer who has not is told so, beside
 * the button: a warning rather than a block, as elsewhere here (`DL-91`), because a rejection can
 * rest on what the resident wrote.
 */
@Component({
  selector: 'app-verification-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Modal, StatusBadge, StatusTransition],
  templateUrl: './verification-review.html',
  styleUrl: './verification-review.scss',
})
export class VerificationReview {
  private readonly repository = inject(VERIFICATION_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectUrls = new ObjectUrls();

  readonly request = input.required<VerificationRequest>();

  /** The request as the server answered after a decision, so the queue can be read again. */
  readonly decided = output<VerificationRequest>();

  protected readonly copy = VERIFICATION_COPY.review;
  protected readonly catalog = VERIFICATION_STATUS_CATALOG;
  protected readonly transitions = VERIFICATION_STATUS_TRANSITIONS;
  protected readonly moves = VERIFICATION_REVIEW_MOVES;
  protected readonly limits = REVIEW_NOTE_LIMITS;

  protected readonly guidance: Partial<Record<VerificationStatus, TransitionGuidance>> = {
    approved: {
      reasonLabel: this.copy.approveLabel,
      reasonHint: this.copy.approveHint,
      consequences: VERIFICATION_DECISION_EFFECTS.approved,
    },
    rejected: {
      reasonLabel: this.copy.rejectLabel,
      reasonHint: this.copy.rejectHint,
      consequences: VERIFICATION_DECISION_EFFECTS.rejected,
    },
  };

  protected readonly warningOpen = signal(false);
  protected readonly images = signal<ViewState<readonly OpenedImage[]>>(IDLE);
  protected readonly opened = signal(false);
  protected readonly busy = signal(false);
  /** The live region's text: the outcome of the last decision, or why it was not recorded. */
  protected readonly outcome = signal('');

  protected readonly idTypeLabel = computed(() => ID_DOCUMENT_TYPE_LABELS[this.request().idType]);
  protected readonly decidable = computed(() => awaitsReview(this.request()));
  protected readonly imageCount = computed(() => imagesOf(this.request()).length);

  private readonly requestId = computed(() => this.request().id);

  constructor() {
    // Another request opened in the same drawer must never show the previous one's images.
    effect(() => {
      this.requestId();
      untracked(() => {
        this.discardImages();
        this.opened.set(false);
        this.warningOpen.set(false);
        this.outcome.set('');
      });
    });
    this.destroyRef.onDestroy(() => this.discardImages());
  }

  protected askToOpen(): void {
    this.warningOpen.set(true);
  }

  protected cancelOpen(): void {
    this.warningOpen.set(false);
  }

  /** The only path that fetches an image: from the warning's own button. */
  protected confirmOpen(): void {
    this.warningOpen.set(false);
    const request = this.request();
    this.discardImages();
    this.images.set(LOADING);

    forkJoin(
      imagesOf(request).map((kind) =>
        this.repository.openImage(request, kind).pipe(map((blob) => ({ kind, blob }))),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blobs) => {
          // Answered after the reviewer moved to another request: these are not this one's.
          if (this.request().id !== request.id) {
            return;
          }
          this.opened.set(true);
          this.images.set(
            ready(
              blobs.map(({ kind, blob }) => ({
                kind,
                label: VERIFICATION_IMAGE_LABELS[kind],
                url: this.objectUrls.make(blob),
              })),
            ),
          );
        },
        error: () => this.images.set(failed(this.copy.imagesFailed)),
      });
  }

  protected hideImages(): void {
    this.discardImages();
  }

  protected decide(event: StatusTransitionRequest<VerificationStatus>): void {
    const request = this.request();
    const act =
      event.to === 'approved'
        ? this.repository.approve(request.id, event.reason)
        : event.to === 'rejected'
          ? this.repository.reject(request.id, event.reason)
          : null;

    if (act === null) {
      return;
    }

    this.busy.set(true);
    this.outcome.set('');
    act.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (answered) => {
        this.busy.set(false);
        this.outcome.set(
          answered.status === 'approved' ? this.copy.outcomeApproved : this.copy.outcomeRejected,
        );
        this.decided.emit(answered);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.outcome.set(this.copy.notRecorded(failureReason(failure) ?? this.copy.failed));
      },
    });
  }

  /** Revokes every object URL this component made. Idempotent. */
  private discardImages(): void {
    this.objectUrls.revokeAll();
    this.images.set(IDLE);
  }
}
