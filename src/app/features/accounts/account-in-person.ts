import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { NotConnected } from '@core/access/not-connected';
import { PermissionService } from '@core/access/permission.service';
import { ServedPorts } from '@core/access/served-ports';
import {
  afterInPersonCheck,
  takesInPersonCheck,
  type AppAccount,
  type InPersonOutcome,
  type InPersonSubject,
} from '@domain/index';
import { VerifyInPersonDialog } from '@shared/verification/verify-in-person-dialog';

import { ACCOUNTS_COPY } from './accounts.copy';

/**
 * Verifies a resident's account in person, from the account the reader looked up (`DL-219`).
 *
 * This is where the office meets the person: at the counter, the resident is found by name in this
 * list, not in the ID review queue, which names nobody. So the act lives here, beside the role it
 * changes, offered for a resident account that is not yet verified, to a reader who holds
 * `verification.review` — the key that approves an ID review, because this is the same decision.
 * The form itself is the shared `VerifyInPersonDialog`, a centred dialog.
 *
 * An account that gives no name is not offered the form: there is nothing to check the ID against,
 * and the server refuses it. The section says so, and what the resident does first.
 */
@Component({
  selector: 'app-account-in-person',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NotConnected, VerifyInPersonDialog],
  templateUrl: './account-in-person.html',
  // The panel's layout, so this section reads as one more block of it.
  styleUrl: './account-panel.scss',
})
export class AccountInPerson {
  private readonly permissions = inject(PermissionService);

  readonly account = input.required<AppAccount>();
  /** True for the signed-in administrator's own account. */
  readonly own = input(false);

  /** The account as the server's answer leaves it. */
  readonly changed = output<AppAccount>();
  /** What the check did, for the panel's one live region. */
  readonly announced = output<string>();

  protected readonly copy = ACCOUNTS_COPY.inPerson;
  protected readonly canVerify = this.permissions.can('verification.review');
  /** The check is the verification port's; a console bound to no server for it says so (`DL-175`). */
  protected readonly servesVerification = inject(ServedPorts).serves('verification');
  protected readonly applies = computed(() => takesInPersonCheck(this.account()));

  /** The account and its name as this panel shows them, or `null` when it gives no name. */
  protected readonly subject = computed<InPersonSubject | null>(() => {
    const account = this.account();
    return account.name === null ? null : { accountId: account.id, name: account.name };
  });

  protected readonly opened = signal(false);

  constructor() {
    // Another account opened in the same panel starts with the dialog closed.
    effect(() => {
      this.account();
      untracked(() => this.opened.set(false));
    });
  }

  protected open(): void {
    if (!this.own() && this.subject() !== null) {
      this.opened.set(true);
    }
  }

  protected close(): void {
    this.opened.set(false);
  }

  protected done(outcome: InPersonOutcome): void {
    this.opened.set(false);
    this.announced.emit(
      outcome.record.supersededRequestId === null ? this.copy.done : this.copy.doneSuperseded,
    );
    this.changed.emit(afterInPersonCheck(this.account(), outcome));
  }
}
