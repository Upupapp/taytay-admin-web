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
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  hasCheckedName,
  REGISTRY_UNLINK_EFFECTS,
  VERIFICATION_REPOSITORY,
  type AppAccount,
  type RegistryLinkHistoryEntry,
  type RegistryMatches,
} from '@domain/index';
import { ArchiveDialog } from '@shared/archive/archive-dialog';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import { Modal } from '@shared/ui/modal/modal';
import { AccountLinkChoice, type AccountLinkState } from '@shared/verification/account-link-choice';

import { ACCOUNTS_COPY } from './accounts.copy';

/**
 * Links a verified account to the office's registry record after its verification (`DL-260`).
 *
 * An account verified before links were made at verification, or left unlinked then, had no way to
 * be linked except a sector application — so a resident told "ask the office to link your account"
 * met a counter with no button. This is that button: the same decision as at verification, by a
 * reviewer with an ID showing the account's verified name in hand, with the chosen record beside the
 * account and what to do when they disagree. Offered for a verified resident account only, to a
 * reader who holds `verification.review`, never for one's own.
 *
 * A link made to the wrong record is ended here too (`DL-262`), by the same reviewer, with a
 * reason, in the shared archive dialog's shape: its effects before its primary button, because a
 * link is restored by linking again. The account's link history below says who linked and who
 * unlinked it, when and why; nothing in it is ever removed.
 *
 * Read once when the panel opens, not live: it is part of a decision, and the link it shows is
 * answered again by the server when the button is pressed.
 */
@Component({
  selector: 'app-account-registry-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccountLinkChoice, ArchiveDialog, DatePipe, Modal, RouterLink],
  templateUrl: './account-registry-link.html',
  styleUrl: './account-panel.scss',
})
export class AccountRegistryLink {
  private readonly repository = inject(VERIFICATION_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = input.required<AppAccount>();
  /** True for the signed-in administrator's own account. */
  readonly own = input(false);

  /** What the link did, or why it was not made, for the panel's one live region. */
  readonly announced = output<string>();

  protected readonly copy = ACCOUNTS_COPY.registryLink;
  protected readonly canLink = this.permissions.can('verification.review');
  protected readonly applies = computed(() => hasCheckedName(this.account()));

  /** Bumped after a link, so the section reads the account's link again. */
  private readonly reread = signal(0);

  protected readonly current = toSignal(
    toObservable(
      computed(() => ({
        account: this.account(),
        go: this.applies() && this.canLink() && !this.own(),
        reread: this.reread(),
      })),
    ).pipe(
      switchMap(({ account, go }) =>
        go
          ? toViewState(this.repository.registryMatches(account.id))
          : of<ViewState<RegistryMatches>>(LOADING),
      ),
    ),
    { initialValue: LOADING as ViewState<RegistryMatches> },
  );

  /** The record the account is linked to now, once read. */
  protected readonly linkedResidentId = computed(() => {
    const state = this.current();
    return state.kind === 'ready' ? state.value.linkedResidentId : null;
  });

  /** The account's links as made and ended, read with the link and again after every act. */
  protected readonly history = toSignal(
    toObservable(
      computed(() => ({
        account: this.account(),
        go: this.applies() && this.canLink() && !this.own(),
        reread: this.reread(),
      })),
    ).pipe(
      switchMap(({ account, go }) =>
        go
          ? toViewState(this.repository.registryLinkHistory(account.id))
          : of<ViewState<readonly RegistryLinkHistoryEntry[]>>(LOADING),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly RegistryLinkHistoryEntry[]> },
  );

  protected readonly unlinkEffects = REGISTRY_UNLINK_EFFECTS;
  protected readonly unlinking = signal(false);
  protected readonly unlinkBusy = signal(false);
  protected readonly unlinkProblem = signal<string | null>(null);

  protected readonly opened = signal(false);
  protected readonly link = signal<AccountLinkState | null>(null);
  protected readonly seen = signal(false);
  protected readonly busy = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected readonly ready = computed(
    () => this.link()?.kind === 'ready' && this.seen() && !this.busy(),
  );

  constructor() {
    // Another account opened in the same panel starts closed, with nothing chosen or ticked.
    effect(() => {
      this.account();
      untracked(() => {
        this.close();
        this.closeUnlink();
      });
    });
  }

  protected openUnlink(): void {
    this.unlinkProblem.set(null);
    this.unlinking.set(true);
  }

  protected closeUnlink(): void {
    if (this.unlinkBusy()) {
      return;
    }
    this.unlinking.set(false);
    this.unlinkProblem.set(null);
  }

  /** Ends the link once the dialog has said what it does and a reason was given (`DL-262`). */
  protected confirmUnlink(reason: string): void {
    const account = this.account();
    if (this.own() || this.unlinkBusy()) {
      return;
    }
    this.unlinkBusy.set(true);
    this.unlinkProblem.set(null);
    this.announced.emit('');
    this.repository
      .unlinkAccount(account.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.unlinkBusy.set(false);
          this.unlinking.set(false);
          this.announced.emit(this.copy.unlinkDone);
          this.reread.update((count) => count + 1);
        },
        error: (failure: unknown) => {
          this.unlinkBusy.set(false);
          this.unlinkProblem.set(this.copy.notUnlinked(failureReason(failure) ?? this.copy.failed));
        },
      });
  }

  protected open(): void {
    this.refusal.set(null);
    this.seen.set(false);
    this.link.set(null);
    this.opened.set(true);
  }

  protected close(): void {
    if (this.busy()) {
      return;
    }
    this.opened.set(false);
    this.seen.set(false);
    this.link.set(null);
    this.refusal.set(null);
  }

  protected tick(event: Event): void {
    this.seen.set(event.target instanceof HTMLInputElement && event.target.checked);
  }

  protected chosen(state: AccountLinkState): void {
    this.link.set(state);
    // The statement is about the record and corrections now on screen; another choice is unchecked.
    this.seen.set(false);
  }

  protected save(): void {
    const state = this.link();
    const account = this.account();
    if (state?.kind !== 'ready' || !this.ready() || this.own()) {
      return;
    }
    this.busy.set(true);
    this.refusal.set(null);
    this.announced.emit('');
    this.repository
      .linkLater(account.id, state.decision)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (outcome) => {
          this.busy.set(false);
          this.opened.set(false);
          this.announced.emit(this.copy.done(outcome.corrected.length));
          this.reread.update((count) => count + 1);
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.refusal.set(this.copy.notDone(failureReason(failure) ?? this.copy.failed));
        },
      });
  }
}
