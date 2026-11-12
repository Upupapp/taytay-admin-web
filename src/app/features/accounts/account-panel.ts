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
import type { Observable } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  ACCOUNT_ROLE_CATALOG,
  ACCOUNT_ROLES,
  APP_ACCOUNT_REPOSITORY,
  OFFICE_ASSIGNMENT_EFFECTS,
  officeLabel,
  ROLE_CHANGE_ALWAYS,
  ROLE_CHANGE_EFFECTS,
  takesAnOffice,
  type AccountRole,
  type AppAccount,
  type Office,
  type OfficeId,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { valueOf, type ViewState } from '@shared/state/view-state';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { AccountInPerson } from './account-in-person';
import { AccountNameCorrection } from './account-name-correction';
import { AccountOfficeRole } from './account-office-role';
import { ACCOUNTS_COPY } from './accounts.copy';

/**
 * One account, managed (`DL-168`): its role, and — for staff — its office.
 *
 * ## A change says what it does before it is made
 *
 * Choosing a role shows what the server does on that change — `ROLE_CHANGE_EFFECTS` and
 * `ROLE_CHANGE_ALWAYS`, read from the backend's handlers — and only then the button, which names the
 * role it changes to. An office is the same: the effects of assigning or clearing it come between the
 * choice and the button.
 *
 * ## No reason is asked for
 *
 * The server audits both changes against the administrator's account and keeps no reason, so there
 * is nowhere for one to go; the effects say so rather than offering a box whose words vanish. The
 * office role, below them, is different — the server keeps its reason — and is its own component,
 * `AccountOfficeRole` (`DL-173`).
 *
 * ## Not one's own role
 *
 * The server refuses a change to the caller's own role. The form is not offered for it, and says
 * another administrator can make it — a button certain to be refused is a promise the screen
 * cannot keep.
 */
@Component({
  selector: 'app-account-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccountInPerson, AccountNameCorrection, AccountOfficeRole, StatusBadge],
  templateUrl: './account-panel.html',
  styleUrl: './account-panel.scss',
})
export class AccountPanel {
  private readonly repository = inject(APP_ACCOUNT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = input.required<AppAccount>();
  /** The office directory, read once by the page and shared with the list. */
  readonly offices = input.required<ViewState<readonly Office[]>>();
  /** True for the signed-in administrator's own account. */
  readonly own = input(false);

  /** The account as the server answered after a change, so the list can be read again. */
  readonly changed = output<AppAccount>();

  protected readonly copy = ACCOUNTS_COPY.panel;
  protected readonly listCopy = ACCOUNTS_COPY.list;
  protected readonly catalog = ACCOUNT_ROLE_CATALOG;
  protected readonly roles = ACCOUNT_ROLES;
  protected readonly roleEffects = ROLE_CHANGE_EFFECTS;
  protected readonly roleAlways = ROLE_CHANGE_ALWAYS;
  protected readonly officeEffects = OFFICE_ASSIGNMENT_EFFECTS;

  protected readonly canChangeRole = this.permissions.can('user.change-role');
  protected readonly canAssignOffice = this.permissions.can('user.assign-office');

  protected readonly chosenRole = signal<AccountRole | null>(null);
  /** The office chosen in the picker: an id, `''` for none, or `null` before anything is chosen. */
  protected readonly chosenOffice = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** The live region's text: what the last change did, or why it was not made. */
  protected readonly outcome = signal('');

  protected readonly directory = computed(() => valueOf(this.offices()) ?? []);
  protected readonly takesAnOffice = computed(() => takesAnOffice(this.account()));

  protected readonly currentOfficeName = computed(() => {
    const officeId = this.account().officeId;
    return officeId === null ? null : this.nameOf(officeId);
  });

  /** The office change the picker describes, or `null` when it matches what the account has. */
  protected readonly officeChange = computed<{ readonly to: Office | null } | null>(() => {
    const chosen = this.chosenOffice();
    if (chosen === null || chosen === (this.account().officeId ?? '')) {
      return null;
    }
    return { to: this.directory().find((office) => office.id === chosen) ?? null };
  });

  private readonly accountId = computed(() => this.account().id);

  constructor() {
    // Another account opened in the same drawer must not inherit this one's choices or outcome.
    effect(() => {
      this.accountId();
      untracked(() => this.outcome.set(''));
    });
    // A changed account — this one, as the server answered — starts its choices afresh.
    effect(() => {
      this.account();
      untracked(() => {
        this.chosenRole.set(null);
        this.chosenOffice.set(null);
      });
    });
  }

  protected label(office: Office): string {
    return officeLabel(office);
  }

  protected chooseRole(role: AccountRole): void {
    this.chosenRole.set(role);
  }

  protected chooseOffice(event: Event): void {
    this.chosenOffice.set(event.target instanceof HTMLSelectElement ? event.target.value : null);
  }

  protected changeRole(): void {
    const role = this.chosenRole();
    if (role === null || role === this.account().role || this.own()) {
      return;
    }
    this.act(this.repository.changeRole(this.account().id, role), (account) =>
      this.copy.roleChanged(ACCOUNT_ROLE_CATALOG[account.role].label),
    );
  }

  protected assignOffice(): void {
    const change = this.officeChange();
    if (change === null) {
      return;
    }
    const to = change.to;
    this.act(this.repository.assignOffice(this.account().id, to === null ? null : to.id), () =>
      to === null ? this.copy.officeCleared : this.copy.officeAssigned(officeLabel(to)),
    );
  }

  private nameOf(officeId: OfficeId): string {
    const office = this.directory().find((candidate) => candidate.id === officeId);
    return office === undefined ? officeId : officeLabel(office);
  }

  private act(work: Observable<AppAccount>, done: (account: AppAccount) => string): void {
    this.busy.set(true);
    this.outcome.set('');
    work.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (account) => {
        this.busy.set(false);
        this.outcome.set(done(account));
        this.changed.emit(account);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.outcome.set(this.copy.notDone(failureReason(failure) ?? this.copy.failed));
      },
    });
  }
}
