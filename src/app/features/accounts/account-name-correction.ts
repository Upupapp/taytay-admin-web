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

import { PermissionService } from '@core/access/permission.service';
import {
  APP_ACCOUNT_REPOSITORY,
  hasCheckedName,
  NAME_CORRECTION_EFFECTS,
  NAME_CORRECTION_MAX,
  nameCorrectionProblems,
  type AppAccount,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';

import { ACCOUNTS_COPY } from './accounts.copy';

/**
 * Corrects a verified account's name at the counter, against a government ID the administrator has
 * seen (`DL-198`).
 *
 * Since `DL-197` the resident cannot change a name the office checked against their ID, so a legal
 * name change — a marriage, a court order — comes here. It is offered only for a verified account,
 * and only to a reader who holds `verification.review`, the key that approves an ID: correcting a
 * checked name is the same judgement. What the server does is said first, between the field and
 * the button; the button waits for a statement that the ID was seen, and the statement clears with
 * every keystroke and every other account, so it is always about the name on the screen now.
 *
 * No reason is asked for: the server keeps none, and a box whose words go nowhere is worse than no
 * box (`DL-168`). The earlier name is the server's to keep, in its append-only history.
 */
@Component({
  selector: 'app-account-name-correction',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-name-correction.html',
  // The panel's layout, so this section reads as one more block of it.
  styleUrl: './account-panel.scss',
})
export class AccountNameCorrection {
  private readonly repository = inject(APP_ACCOUNT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = input.required<AppAccount>();
  /** True for the signed-in administrator's own account. */
  readonly own = input(false);

  /** The account as the server answered after a correction. */
  readonly changed = output<AppAccount>();
  /** What the correction did, or why it was not made, for the panel's one live region. */
  readonly announced = output<string>();

  protected readonly copy = ACCOUNTS_COPY.nameCorrection;
  protected readonly effects = NAME_CORRECTION_EFFECTS;
  protected readonly max = NAME_CORRECTION_MAX;

  protected readonly canCorrect = this.permissions.can('verification.review');
  protected readonly applies = computed(() => hasCheckedName(this.account()));

  protected readonly name = signal('');
  protected readonly seen = signal(false);
  protected readonly busy = signal(false);

  protected readonly problems = computed(() => nameCorrectionProblems(this.account(), this.name()));
  protected readonly ready = computed(
    () => this.seen() && this.problems().length === 0 && !this.busy(),
  );

  constructor() {
    // Another account opened in the same panel starts with nothing typed and nothing ticked.
    effect(() => {
      this.account();
      untracked(() => {
        this.name.set('');
        this.seen.set(false);
      });
    });
  }

  protected type(event: Event): void {
    this.name.set(event.target instanceof HTMLInputElement ? event.target.value : '');
    // The statement is about the name typed; a different name has not been checked yet.
    this.seen.set(false);
  }

  protected tick(event: Event): void {
    this.seen.set(event.target instanceof HTMLInputElement && event.target.checked);
  }

  protected save(): void {
    const account = this.account();
    if (this.own() || !this.applies() || account.name === null) {
      return;
    }
    if (!this.ready()) {
      return;
    }
    this.busy.set(true);
    this.announced.emit('');
    this.repository
      .correctName(account.id, { name: this.name(), previousName: account.name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answered) => {
          this.busy.set(false);
          this.announced.emit(this.copy.saved(answered.name ?? ''));
          this.changed.emit(answered);
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.announced.emit(this.copy.notDone(failureReason(failure) ?? this.copy.failed));
        },
      });
  }
}
