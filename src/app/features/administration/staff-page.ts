import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  GOVERNANCE_REPOSITORY,
  PROVISIONING_IS_NOT_BUILT,
  RESET_ACCESS_IS_NOT_BUILT,
  type StaffAccount,
} from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { ADMIN_COPY } from './administration.copy';

/**
 * The staff directory.
 *
 * Two things this screen does **not** do, and says so rather than implying it
 * with a disabled button: it cannot create an account, and it cannot reset
 * access. Both are administrator work outside this console (`DL-32`), and a
 * half-built invite form is worse than none — an administrator who fills one in
 * reasonably believes an account now exists.
 *
 * Deactivation is here, and it takes a reason. It is also the one act on this
 * screen with immediate effect on somebody else's session (`DL-116`).
 */
@Component({
  selector: 'app-staff-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, RouterLink],
  templateUrl: './staff-page.html',
  styleUrl: './staff-page.scss',
})
export class StaffPage {
  private readonly repository = inject(GOVERNANCE_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);

  protected readonly copy = ADMIN_COPY.staff;
  protected readonly provisioningNotice = PROVISIONING_IS_NOT_BUILT;
  protected readonly resetNotice = RESET_ACCESS_IS_NOT_BUILT;

  protected readonly search = signal('');

  /**
   * The term the data layer actually sees.
   *
   * Debounced so typing a surname is one read rather than one per keystroke
   * (`DL-119`). The other filters are not debounced: choosing from a dropdown
   * is a single deliberate act and should take effect at once.
   */
  private readonly settledSearch = debouncedTerm(this.search);
  protected readonly includeInactive = signal(false);
  private readonly reloads = signal(0);
  protected readonly saving = signal(false);

  protected readonly canManage = computed(() => this.permissions.has('staff.manage'));
  protected readonly canSeeAudit = computed(() => this.permissions.has('audit.view'));
  protected readonly canSeeGovernance = computed(() => this.permissions.has('settings.manage'));

  protected readonly state = toSignal(
    toObservable(this.reloads).pipe(switchMap(() => toViewState(this.repository.accounts()))),
    { initialValue: LOADING as ViewState<readonly StaffAccount[]> },
  );

  private readonly all = computed<readonly StaffAccount[]>(() => valueOf(this.state()) ?? []);

  protected readonly accounts = computed(() => {
    const term = this.settledSearch().toLocaleLowerCase();
    return this.all()
      .filter((account) => this.includeInactive() || account.isActive)
      .filter((account) => {
        if (term === '') {
          return true;
        }
        const haystack = [
          account.displayName,
          account.roleLabel,
          account.profile?.unit ?? '',
          account.profile?.employeeId ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase();
        return haystack.includes(term);
      });
  });

  protected readonly hasAny = computed(() => this.accounts().length > 0);

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onIncludeInactive(event: Event): void {
    this.includeInactive.set((event.target as HTMLInputElement).checked);
  }

  /* ── Turning an account on or off ───────────────────────────────────────── */

  protected readonly openAccountId = signal<string | null>(null);
  protected readonly reason = signal('');

  protected toggle(account: StaffAccount): void {
    this.openAccountId.update((current) =>
      current === account.staffId ? null : account.staffId,
    );
    this.reason.set('');
  }

  protected isOpen(account: StaffAccount): boolean {
    return this.openAccountId() === account.staffId;
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  protected readonly canSave = computed(
    () => this.reason().trim().length > 0 && !this.saving(),
  );

  protected async apply(account: StaffAccount): Promise<void> {
    if (!this.canSave()) {
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.repository.setAccountActive(
          account.staffId,
          !account.isActive,
          this.reason().trim(),
        ),
      );
      this.notifications.success(this.copy.statusChanged);
      this.openAccountId.set(null);
      this.reason.set('');
      this.reloads.update((value) => value + 1);
    } catch {
      this.notifications.error(this.copy.statusFailed);
    } finally {
      this.saving.set(false);
    }
  }
}
