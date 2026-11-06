import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PermissionService } from '@core/access/permission.service';
import { describeFailure, isApiFailure } from '@core/http/api-failure';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  HOUSEHOLD_REPOSITORY,
  isHouseholdCompositionError,
  parsePesos,
  TAYTAY_BARANGAYS,
  type BarangayId,
  type HouseholdDraft,
  type ResidentView,
} from '@domain/index';
import { PersonPicker } from '@shared/residents/person-picker';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { HOUSEHOLDS_COPY } from './households.copy';

/**
 * Registers a household: an address, and the resident who heads it there.
 *
 * Deliberately small. The head is the household's one member at registration; everybody else
 * joins from the household record, one change at a time with a reason, so the trail says who
 * added whom and why. The form says so **before** the button, where somebody deciding reads it.
 *
 * The income is typed in pesos and read into whole centavos by `parsePesos` — two integers, never
 * a decimal multiplied by a hundred. It is offered only to a role that may record means, as on a
 * resident: nobody records what they would not be shown.
 */
@Component({
  selector: 'app-household-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, PersonPicker, RouterLink],
  templateUrl: './household-form-page.html',
  styleUrl: './household-form-page.scss',
})
export class HouseholdFormPage {
  private readonly repository = inject(HOUSEHOLD_REPOSITORY);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  protected readonly copy = HOUSEHOLDS_COPY.create;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly mayRecordIncome = computed(() =>
    this.permissions.has('resident.view-sensitive'),
  );

  protected readonly barangayId = signal<BarangayId | null>(null);
  protected readonly purok = signal('');
  protected readonly street = signal('');
  protected readonly income = signal('');
  protected readonly isIndigent = signal(false);
  protected readonly head = signal<ResidentView | null>(null);

  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  /** The server's refusal, in its words. */
  protected readonly refusal = signal<string | null>(null);

  protected readonly incomeTyped = computed(() => this.income().trim().length > 0);
  protected readonly parsedIncome = computed(() =>
    this.incomeTyped() ? parsePesos(this.income()) : null,
  );
  protected readonly incomeInvalid = computed(
    () => this.incomeTyped() && this.parsedIncome() === null,
  );

  /** What is missing, in words, beside the button — never a disabled button with no reason. */
  protected readonly missing = computed(() => {
    const missing: string[] = [];
    if (this.barangayId() === null) {
      missing.push(this.copy.missingBarangay);
    }
    if (this.street().trim().length === 0) {
      missing.push(this.copy.missingStreet);
    }
    if (this.head() === null) {
      missing.push(this.copy.missingHead);
    }
    if (this.incomeInvalid()) {
      missing.push(this.copy.incomeInvalid);
    }
    return missing;
  });

  protected onBarangay(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.barangayId.set(TAYTAY_BARANGAYS.find((barangay) => barangay.id === value)?.id ?? null);
  }

  protected onPurok(event: Event): void {
    this.purok.set((event.target as HTMLInputElement).value);
  }

  protected onStreet(event: Event): void {
    this.street.set((event.target as HTMLInputElement).value);
  }

  protected onIncome(event: Event): void {
    this.income.set((event.target as HTMLInputElement).value);
  }

  protected onIndigent(event: Event): void {
    this.isIndigent.set((event.target as HTMLInputElement).checked);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    this.refusal.set(null);
    const barangayId = this.barangayId();
    const head = this.head();
    if (barangayId === null || head === null || this.missing().length > 0 || this.saving()) {
      return;
    }
    const purok = this.purok().trim();
    const draft: HouseholdDraft = {
      barangayId,
      purokOrSitio: purok.length > 0 ? purok : null,
      streetAddress: this.street().trim(),
      headResidentId: head.resident.id,
      monthlyIncome: this.mayRecordIncome() ? this.parsedIncome() : null,
      isIndigent: this.isIndigent(),
    };
    this.saving.set(true);
    this.repository.create(draft).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.notifications.success(this.copy.saved);
        void this.router.navigate(['/households', created.household.id]);
      },
      error: (failure: unknown) => {
        this.saving.set(false);
        this.refusal.set(this.describe(failure));
      },
    });
  }

  private describe(failure: unknown): string {
    if (isHouseholdCompositionError(failure)) {
      return failure.problems.map((problem) => HOUSEHOLDS_COPY.problem[problem.code]).join(' ');
    }
    if (failure instanceof Error) {
      return failure.message;
    }
    return isApiFailure(failure) ? describeFailure(failure) : this.copy.failed;
  }
}
