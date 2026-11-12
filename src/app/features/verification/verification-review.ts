import { DatePipe, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map } from 'rxjs';

import {
  approvalBar,
  awaitsReview,
  ID_DOCUMENT_TYPE_LABELS,
  identityToConfirm,
  imagesOf,
  REVIEW_NOTE_LIMITS,
  reviewMovesFor,
  VERIFICATION_DECISION_EFFECTS,
  VERIFICATION_IMAGE_LABELS,
  VERIFICATION_REPOSITORY,
  VERIFICATION_STATUS_CATALOG,
  VERIFICATION_STATUS_TRANSITIONS,
  type ConfirmedIdentity,
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
import { Icon } from '@shared/ui/icon/icon';
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
 * ## Approving says the ID shows the account's name
 *
 * While a request waits, the API sends the name and birth date the account gives, and they are
 * shown above the images (`DL-197`). Approval asks the reviewer to tick that the ID shows them —
 * the statement names the very name, so the tick is about this record — and sends them back as
 * read; the server refuses if the account no longer matches. An account with no name cannot be
 * approved at all: approval is not offered, and the screen says why.
 *
 * ## An erased selfie is said, never fetched
 *
 * When the resident withdrew the biometric consent, or the office verified them in person, the
 * server erased the selfie (`DL-218`). The review then says when, in place of the image, and never
 * asks for it: `imagesOf` leaves it out, so only the ID is offered behind the warning. Approval is
 * not offered either — the server refuses it with a 409 — and the screen says why.
 *
 * The decision is not gated on having opened the images. A reviewer who has not is told so, beside
 * the button: a warning rather than a block, as elsewhere here (`DL-91`), because a rejection can
 * rest on what the resident wrote.
 */
@Component({
  selector: 'app-verification-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, Icon, Modal, StatusBadge, StatusTransition],
  templateUrl: './verification-review.html',
  styleUrl: './verification-review.scss',
})
export class VerificationReview {
  private readonly repository = inject(VERIFICATION_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly objectUrls = new ObjectUrls();

  readonly request = input.required<VerificationRequest>();

  /** The request as the server answered after a decision, so the queue can be read again. */
  readonly decided = output<VerificationRequest>();

  protected readonly copy = VERIFICATION_COPY.review;
  protected readonly catalog = VERIFICATION_STATUS_CATALOG;
  protected readonly transitions = VERIFICATION_STATUS_TRANSITIONS;
  protected readonly limits = REVIEW_NOTE_LIMITS;

  /** What approving would confirm; `null` when the account gives no name to check. */
  protected readonly identity = computed(() => identityToConfirm(this.request()));
  protected readonly moves = computed(() => reviewMovesFor(this.request()));

  /**
   * Built per request, so the approval's statement names this record's name and is ticked afresh
   * for every record. Without a name there is no statement, and no approval is offered (`moves`).
   */
  protected readonly guidance = computed<Partial<Record<VerificationStatus, TransitionGuidance>>>(
    () => {
      const identity = this.identity();
      return {
        approved: {
          reasonLabel: this.copy.approveLabel,
          reasonHint: this.copy.approveHint,
          consequences: VERIFICATION_DECISION_EFFECTS.approved,
          ...(identity === null
            ? {}
            : { confirmation: { label: this.statement(identity), hint: this.copy.confirmHint } }),
        },
        rejected: {
          reasonLabel: this.copy.rejectLabel,
          reasonHint: this.copy.rejectHint,
          consequences: VERIFICATION_DECISION_EFFECTS.rejected,
        },
      };
    },
  );

  protected readonly warningOpen = signal(false);
  protected readonly images = signal<ViewState<readonly OpenedImage[]>>(IDLE);
  protected readonly opened = signal(false);
  protected readonly busy = signal(false);
  /** The live region's text: the outcome of the last decision, or why it was not recorded. */
  protected readonly outcome = signal('');

  protected readonly idTypeLabel = computed(() => ID_DOCUMENT_TYPE_LABELS[this.request().idType]);
  /** Why approval is not offered, when it is not: no name to check, or no selfie to see. */
  protected readonly approvalBar = computed(() => approvalBar(this.request()));
  /** When the selfie was erased, in words, or `null` while it is still held. */
  protected readonly erasedOn = computed(() => {
    const at = this.request().selfieErasedAt;
    return at === null ? null : formatDate(at, 'd MMM y, HH:mm', this.locale);
  });
  /** The warning names what is about to appear: an ID alone once the selfie is gone. */
  protected readonly warningSentences = computed(() =>
    this.erasedOn() === null ? this.copy.warning : this.copy.warningIdOnly,
  );
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
    const identity = identityToConfirm(request);
    const act =
      event.to === 'approved' && identity !== null
        ? this.repository.approve(request.id, event.reason, identity)
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

  /** What the reviewer ticks: the very name, and the birth date when the account gives one. */
  private statement(identity: ConfirmedIdentity): string {
    return identity.birthDate === null
      ? this.copy.confirmName(identity.name)
      : this.copy.confirmNameAndBirthDate(
          identity.name,
          formatDate(identity.birthDate, 'd MMMM y', this.locale),
        );
  }

  /** Revokes every object URL this component made. Idempotent. */
  private discardImages(): void {
    this.objectUrls.revokeAll();
    this.images.set(IDLE);
  }
}
