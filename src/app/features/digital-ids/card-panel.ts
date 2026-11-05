import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap, type Observable } from 'rxjs';

import {
  actsOn,
  DIGITAL_ID_ALWAYS,
  DIGITAL_ID_EFFECTS,
  DIGITAL_ID_REPOSITORY,
  DIGITAL_ID_STATUS_CATALOG,
  isPastExpiry,
  type AppAccount,
  type DigitalIdAct,
  type DigitalIdCard,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { CardPhoto } from './card-photo';
import { DIGITAL_IDS_COPY } from './digital-ids.copy';

/**
 * One resident's card, kept by an administrator (`digital-id.manage`, `DL-171`).
 *
 * **Every act is confirmed, and says what it does first.** Choosing an act opens a confirmation whose
 * effects — read from the API's handlers (`DIGITAL_ID_EFFECTS`) — stand above its button: the
 * resident's card stops working in the app, a suspension cannot be lifted, a replacement has a new
 * number. Only the confirmation's button sends anything (`commit`).
 *
 * After an act the card is **read again** from the server rather than patched, so what is shown is
 * what the API now holds — for a revoked card, nothing.
 */
@Component({
  selector: 'app-card-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardPhoto, DatePipe, Modal, StatusBadge],
  templateUrl: './card-panel.html',
  styleUrl: './digital-ids.scss',
})
export class CardPanel {
  private readonly repository = inject(DIGITAL_ID_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = input.required<AppAccount>();

  protected readonly copy = DIGITAL_IDS_COPY.panel;
  protected readonly catalog = DIGITAL_ID_STATUS_CATALOG;
  protected readonly effects = DIGITAL_ID_EFFECTS;
  protected readonly always = DIGITAL_ID_ALWAYS;

  /** Bumped to read the card again — after an act, or on "Try again". */
  private readonly generation = signal(0);

  protected readonly card = toSignal(
    combineLatest([toObservable(this.account), toObservable(this.generation)]).pipe(
      switchMap(([account]) => toViewState(this.repository.cardOf(account.id))),
    ),
    { initialValue: LOADING as ViewState<DigitalIdCard | null> },
  );

  /** The card when one was read; `null` both while reading and when the account holds none. */
  protected readonly cardValue = computed(() => valueOf(this.card()));

  protected readonly whose = computed(() => this.account().name ?? this.account().email ?? '');

  /** The act whose confirmation is open; nothing is sent until its own button is pressed. */
  protected readonly pending = signal<DigitalIdAct | null>(null);
  protected readonly busy = signal(false);
  protected readonly problem = signal('');
  /** The live region's text: the outcome of the last act. */
  protected readonly outcome = signal('');

  protected actsOn(card: DigitalIdCard): readonly DigitalIdAct[] {
    return actsOn(card);
  }

  protected pastExpiry(card: DigitalIdCard): boolean {
    return isPastExpiry(card);
  }

  protected choose(act: DigitalIdAct): void {
    this.problem.set('');
    this.outcome.set('');
    this.pending.set(act);
  }

  protected cancel(): void {
    this.pending.set(null);
    this.problem.set('');
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  /** The only path that changes a card: from the confirmation's own button. */
  protected commit(card: DigitalIdCard | null): void {
    const act = this.pending();
    if (act === null || this.busy()) return;

    const request = this.requestFor(act, card);
    if (request === null) return;

    this.busy.set(true);
    this.problem.set('');
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.pending.set(null);
        this.outcome.set(this.copy.outcome[act]);
        this.generation.update((n) => n + 1);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.problem.set(this.copy.notDone(failureReason(failure) ?? this.copy.noAnswer));
      },
    });
  }

  private requestFor(act: DigitalIdAct, card: DigitalIdCard | null): Observable<unknown> | null {
    if (act === 'issue') {
      return card === null ? this.repository.issue(this.account().id) : null;
    }
    if (card === null) return null;
    switch (act) {
      case 'suspend':
        return this.repository.suspend(card.id);
      case 'revoke':
        return this.repository.revoke(card.id);
      case 'reissue':
        return this.repository.reissue(card.id);
    }
  }
}
