import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import {
  asId,
  attachmentsFor,
  CLAIM_DETAILS_LIMITS,
  describeIssuanceWait,
  describeProcessingStandard,
  ISSUANCE_BOUNDARIES,
  ISSUANCE_MOVE_EFFECTS,
  ISSUANCE_REASON_LIMITS,
  ISSUANCE_REPOSITORY,
  ISSUANCE_STATUS_CATALOG,
  ISSUANCE_STATUS_TRANSITIONS,
  ISSUANCE_STATUSES,
  isOpenIssuanceStatus,
  needsClaimDetails,
  waitingOn,
  type IssuanceAttachment,
  type IssuanceEvent,
  type IssuanceFileGrant,
  type IssuanceMimeType,
  type IssuanceRequest,
  type IssuanceRequestId,
  type IssuanceStatus,
} from '@domain/index';
import {
  StatusTransition,
  type StatusTransitionRequest,
  type TransitionGuidance,
} from '@shared/cases/status-transition';
import { ObjectUrls } from '@shared/media/object-urls';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { failureReason } from '@shared/state/failure-reason';
import {
  failed,
  IDLE,
  LOADING,
  ready,
  toViewState,
  valueOf,
  type ViewState,
} from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { Icon } from '@shared/ui/icon/icon';

import { ISSUANCE_COPY } from './issuance.copy';

/** A grant the reader has been shown, with what it is a grant for. */
interface PendingFile {
  readonly grant: IssuanceFileGrant;
  readonly label: string;
  readonly version: number;
}

/** One `StatusTransition` guidance per office move: what it does, and who reads the words. */
function moveGuidance(): Partial<Record<IssuanceStatus, TransitionGuidance>> {
  const copy = ISSUANCE_COPY.request;
  const guidance: Partial<Record<IssuanceStatus, TransitionGuidance>> = {};
  for (const to of ISSUANCE_STATUSES) {
    const consequences = ISSUANCE_MOVE_EFFECTS[to];
    if (consequences === undefined) {
      continue;
    }
    guidance[to] = needsClaimDetails(to)
      ? {
          reasonLabel: copy.reasonLabel,
          reasonHint: copy.reasonHint,
          consequences,
          detail: {
            label: copy.claimLabel,
            hint: copy.claimHint,
            minimum: CLAIM_DETAILS_LIMITS.minimum,
            maximum: CLAIM_DETAILS_LIMITS.maximum,
          },
        }
      : { reasonLabel: copy.reasonLabel, reasonHint: copy.reasonHint, consequences };
  }
  return guidance;
}

interface OpenedFile {
  /** A `blob:` URL this page's `ObjectUrls` made, and the only place it is held. */
  readonly url: string;
  readonly mimeType: IssuanceMimeType;
  readonly alt: string;
}

/**
 * One resident's document request, as the issuing office works it (`DL-184`).
 *
 * ## What the resident sent opens only after a warning
 *
 * Each file is a resident's own document — an ID, a birth certificate. Nothing is fetched until the
 * reader asks: "Show" asks the server for a single-use grant, whose warning — composed by the
 * server, naming the file and the request — is shown first, word for word. Only "Open it" fetches
 * the bytes, with the handle in a body and the bearer in a header, never a URL. The bytes become an
 * object URL held by this page's `ObjectUrls` alone, and it is revoked when the window closes, when
 * another request is opened here and when the page is left. An image is shown in the window; a PDF
 * is offered as a link that opens in a new tab, from the same short-lived address.
 *
 * ## Every word the office writes here reaches the resident
 *
 * The moves are the server's (`allowed_moves`), intersected with the domain's own lifecycle by
 * `StatusTransition`, which refuses a move without words. What each move does is shown between
 * the choice and the button, the reason's label names its reader — the resident — and marking a
 * request ready asks, beside the reason, when and where to claim it.
 *
 * ## Whose act each line of the history is
 *
 * The history says the resident or the office, and shows the account as the API gives it. The
 * console cannot name a member of staff (the staff directory is not served), so it says "You" for
 * the signed-in account and the account ID otherwise, rather than a name it would have to guess.
 */
@Component({
  selector: 'app-issuance-request-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DatePipe,
    Icon,
    Modal,
    PageHeader,
    PesoPipe,
    RouterLink,
    StatusBadge,
    StatusTransition,
  ],
  templateUrl: './issuance-request-page.html',
  styleUrl: './issuance-request-page.scss',
})
export class IssuanceRequestPage {
  private readonly repository = inject(ISSUANCE_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly objectUrls = new ObjectUrls();

  /** The `:requestId` route parameter. */
  readonly requestId = input.required<string>();

  protected readonly copy = ISSUANCE_COPY.request;
  protected readonly boundaries = ISSUANCE_BOUNDARIES;
  protected readonly catalog = ISSUANCE_STATUS_CATALOG;
  protected readonly transitions = ISSUANCE_STATUS_TRANSITIONS;
  protected readonly limits = ISSUANCE_REASON_LIMITS;

  protected readonly guidance = moveGuidance();

  private readonly transition = viewChild(StatusTransition);

  private readonly id = computed(() => asId<IssuanceRequestId>(this.requestId()));
  /** Bumped on "Try again". */
  private readonly generation = signal(0);
  /** The request as the server answered a move, shown until the next read. */
  private readonly answered = signal<IssuanceRequest | null>(null);

  private readonly read = toSignal(
    toObservable(computed(() => ({ id: this.id(), generation: this.generation() }))).pipe(
      switchMap(({ id }) => toViewState(this.repository.request(id))),
    ),
    { initialValue: LOADING as ViewState<IssuanceRequest> },
  );

  protected readonly state = computed<ViewState<IssuanceRequest>>(() => {
    const answered = this.answered();
    return answered !== null && answered.id === this.id() ? ready(answered) : this.read();
  });
  protected readonly current = computed(() => valueOf(this.state()));

  protected readonly now = new Date();
  protected readonly busy = signal(false);
  /** The live region's text: the outcome of the last move, or why it was not recorded. */
  protected readonly outcome = signal('');

  protected readonly pending = signal<PendingFile | null>(null);
  protected readonly granting = signal<string | null>(null);
  protected readonly file = signal<ViewState<OpenedFile>>(IDLE);
  protected readonly fileProblem = signal('');

  constructor() {
    // Another request opened on this page must never show the previous one's file.
    effect(() => {
      this.id();
      untracked(() => {
        this.closeFile();
        this.outcome.set('');
        this.fileProblem.set('');
      });
    });
    this.destroyRef.onDestroy(() => this.objectUrls.revokeAll());
  }

  protected reload(): void {
    this.answered.set(null);
    this.generation.update((n) => n + 1);
  }

  protected waiting(request: IssuanceRequest): string {
    return describeIssuanceWait(request, this.now);
  }

  protected standard(request: IssuanceRequest): string {
    return describeProcessingStandard(request.processingDays);
  }

  protected versionsFor(request: IssuanceRequest, code: string): readonly IssuanceAttachment[] {
    return attachmentsFor(request, code);
  }

  /** Files whose requirement the request no longer lists — shown, never dropped. */
  protected otherFiles(request: IssuanceRequest): readonly IssuanceAttachment[] {
    const codes = new Set(request.requirements.map((requirement) => requirement.code));
    return request.attachments.filter((attachment) => !codes.has(attachment.requirementCode));
  }

  protected canMove(request: IssuanceRequest): boolean {
    return request.allowedMoves.length > 0;
  }

  protected awaitsResident(request: IssuanceRequest): boolean {
    return waitingOn(request.status) === 'resident';
  }

  protected hasEnded(request: IssuanceRequest): boolean {
    return !isOpenIssuanceStatus(request.status);
  }

  protected actorLabel(request: IssuanceRequest, event: IssuanceEvent): string {
    if (event.side === 'resident') {
      return `${this.copy.byResident}${request.resident.name === null ? '' : ` (${request.resident.name})`}`;
    }
    return event.actorId === this.session.user()?.id ? this.copy.byYou : this.copy.byOffice;
  }

  protected eventLabel(event: IssuanceEvent): string {
    return event.from === null ? this.copy.filedLine : this.catalog[event.to].label;
  }

  protected onMove(event: StatusTransitionRequest<IssuanceStatus>): void {
    const id = this.id();
    this.busy.set(true);
    this.outcome.set('');
    this.repository
      .move(id, {
        to: event.to,
        reason: event.reason,
        claimDetails: needsClaimDetails(event.to) ? event.detail : null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (moved) => {
          this.busy.set(false);
          this.answered.set(moved);
          this.transition()?.reset();
          this.outcome.set(this.copy.moved(this.catalog[moved.status].label));
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.outcome.set(this.copy.notMoved(failureReason(failure) ?? this.copy.failed));
        },
      });
  }

  /** Asks the server for a grant. Nothing is fetched until the reader has read its warning. */
  protected askToOpen(attachment: IssuanceAttachment, label: string): void {
    this.closeFile();
    this.fileProblem.set('');
    this.granting.set(attachment.id);
    this.repository
      .grantAttachment(this.id(), attachment.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (grant) => {
          this.granting.set(null);
          this.pending.set({ grant, label, version: attachment.version });
        },
        error: () => {
          this.granting.set(null);
          this.fileProblem.set(this.copy.grantFailed);
        },
      });
  }

  /** The only path that fetches a file: the warning's own button. */
  protected confirmOpen(): void {
    const pending = this.pending();
    if (pending === null || this.file().kind === 'loading') {
      return;
    }
    this.file.set(LOADING);
    this.repository
      .readAttachment(pending.grant)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bytes) => {
          // Closed, or another file asked for, while the bytes were on their way.
          if (this.pending() !== pending) {
            return;
          }
          this.objectUrls.revokeAll();
          this.file.set(
            ready({
              url: this.objectUrls.make(bytes),
              mimeType: pending.grant.mimeType,
              alt: this.copy.imageAlt(pending.label, pending.version),
            }),
          );
        },
        error: () => this.file.set(failed(this.copy.fileFailed)),
      });
  }

  /** Closes the window and gives back every address this page made. Idempotent. */
  protected closeFile(): void {
    this.pending.set(null);
    this.file.set(IDLE);
    this.objectUrls.revokeAll();
  }
}
