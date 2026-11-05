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
import { filter, switchMap, take } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  APP_ACCOUNT_REPOSITORY,
  ASSIGNABLE_OFFICE_ROLES,
  BARANGAY_SCOPED_ROLE,
  OFFICE_ROLE_ALWAYS,
  OFFICE_ROLE_EFFECTS,
  OFFICE_ROLE_REASON_MAX,
  officeRoleChangeProblems,
  ROLE_DEFINITIONS,
  takesAnOfficeRole,
  type AccountBarangay,
  type AppAccount,
  type BarangayId,
  type OfficeRoleChange,
  type StaffRole,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { IDLE, toViewState, valueOf, type ViewState } from '@shared/state/view-state';

import { ACCOUNTS_COPY } from './accounts.copy';

/** A role to give, or `'none'` to take the office role away. */
type OfficeRoleChoice = StaffRole | 'none';

/**
 * The office role of one staff account (`DL-173`): which of the MSWDO's jobs it does, and so which
 * casework permissions the server grants it on `/me`.
 *
 * ## Unlike the role and the office, this one asks why
 *
 * The server keeps a reason with every office role change, in a history nobody edits, because who
 * may approve assistance or release money is a decision somebody answers for. So this section has
 * a reason box, and the two above it still do not: their changes keep none.
 *
 * ## What it does, before it is done
 *
 * Choosing a role shows what the server will do — the role's description and scope from
 * `ROLE_DEFINITIONS` (the office-facing reference the server's own table is tested against), then
 * `OFFICE_ROLE_EFFECTS` and `OFFICE_ROLE_ALWAYS` — and only then the reason and the one button.
 *
 * ## What it does not offer
 *
 * `system-administrator` (the server keeps it for the administrator account role), an office role
 * on an account that is not staff, and a change to the reader's own account — each one the server
 * refuses, so each one is said rather than offered.
 */
@Component({
  selector: 'app-account-office-role',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './account-office-role.html',
  // The panel's layout, so this section reads as one more block of it.
  styleUrl: './account-panel.scss',
})
export class AccountOfficeRole {
  private readonly repository = inject(APP_ACCOUNT_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = input.required<AppAccount>();
  /** True for the signed-in administrator's own account. */
  readonly own = input(false);

  /** The account as the server answered after a change. */
  readonly changed = output<AppAccount>();
  /**
   * What the last change did, or why it was not made, for the panel's live region to say. One
   * region per panel: a second, here, would be one more voice in a console that keeps them rare.
   */
  readonly announced = output<string>();

  protected readonly copy = ACCOUNTS_COPY.officeRole;
  protected readonly roles = ASSIGNABLE_OFFICE_ROLES;
  protected readonly effects = OFFICE_ROLE_EFFECTS;
  protected readonly always = OFFICE_ROLE_ALWAYS;
  protected readonly reasonMax = OFFICE_ROLE_REASON_MAX;
  protected readonly barangayRole = BARANGAY_SCOPED_ROLE;

  // The server guards this route as it guards the account role; one key, one decision.
  protected readonly canChange = this.permissions.can('user.change-role');

  protected readonly chosen = signal<OfficeRoleChoice | null>(null);
  protected readonly barangay = signal<BarangayId | null>(null);
  protected readonly reason = signal('');
  /** Problems are said once somebody tries to save, not while they are still typing. */
  protected readonly attempted = signal(false);
  protected readonly busy = signal(false);

  protected readonly current = computed(() => this.account().officeRole);
  protected readonly takesOne = computed(() => takesAnOfficeRole(this.account()));

  /*
   * The barangays are read only when a barangay link is in question: most accounts opened here are
   * residents, and asking the server for a list nobody will see is a request with no reader.
   */
  private readonly needsBarangays = computed(
    () => this.chosen() === BARANGAY_SCOPED_ROLE || this.current() === BARANGAY_SCOPED_ROLE,
  );
  protected readonly barangays = toSignal(
    toObservable(this.needsBarangays).pipe(
      filter((needed) => needed),
      take(1),
      switchMap(() => toViewState(this.repository.barangays())),
    ),
    { initialValue: IDLE as ViewState<readonly AccountBarangay[]> },
  );

  protected readonly barangayOptions = computed(() => valueOf(this.barangays()) ?? []);

  protected readonly currentBarangay = computed(() => {
    const scoped = this.account().scopeBarangayId;
    if (scoped === null) {
      return null;
    }
    const found = this.barangayOptions().find((candidate) => candidate.id === scoped);
    return found === undefined ? this.copy.confinedUnnamed : this.copy.confinedTo(found.name);
  });

  protected readonly change = computed<OfficeRoleChange | null>(() => {
    const choice = this.chosen();
    if (choice === null) {
      return null;
    }
    const role = choice === 'none' ? null : choice;
    return {
      role,
      barangayId: role === BARANGAY_SCOPED_ROLE ? this.barangay() : null,
      reason: this.reason(),
    };
  });

  protected readonly problems = computed(() => {
    const change = this.change();
    return change === null ? [] : officeRoleChangeProblems(change);
  });

  constructor() {
    // A changed account — this one, as the server answered — starts its choices afresh.
    effect(() => {
      this.account();
      untracked(() => {
        this.chosen.set(null);
        this.barangay.set(null);
        this.reason.set('');
        this.attempted.set(false);
      });
    });
  }

  protected label(role: StaffRole): string {
    return ROLE_DEFINITIONS[role].label;
  }

  protected description(role: StaffRole): string {
    return ROLE_DEFINITIONS[role].description;
  }

  protected scopeOf(role: StaffRole): string {
    return this.copy.scope[ROLE_DEFINITIONS[role].scope];
  }

  protected choose(choice: OfficeRoleChoice): void {
    this.chosen.set(choice);
    this.attempted.set(false);
    if (choice !== BARANGAY_SCOPED_ROLE) {
      this.barangay.set(null);
    }
  }

  protected chooseBarangay(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    const found = this.barangayOptions().find((candidate) => candidate.id === value);
    this.barangay.set(found === undefined ? null : found.id);
  }

  protected typeReason(event: Event): void {
    this.reason.set(event.target instanceof HTMLTextAreaElement ? event.target.value : '');
  }

  protected save(): void {
    const change = this.change();
    if (change === null || this.own() || !this.takesOne()) {
      return;
    }
    this.attempted.set(true);
    if (this.problems().length > 0) {
      return;
    }
    this.busy.set(true);
    this.announced.emit('');
    this.repository
      .assignOfficeRole(this.account().id, change)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (account) => {
          this.busy.set(false);
          const role = account.officeRole;
          this.announced.emit(role === null ? this.copy.cleared : this.copy.saved(this.label(role)));
          this.changed.emit(account);
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.announced.emit(this.copy.notDone(failureReason(failure) ?? this.copy.failed));
        },
      });
  }
}
