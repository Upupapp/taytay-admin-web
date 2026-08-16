import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom, of, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  DISCLOSURE_BASIS_LABELS,
  REFERRAL_DESTINATION_LABELS,
  REFERRAL_REPOSITORY,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_STATUS_TRANSITIONS,
  REFERRAL_URGENCY_LABELS,
  SHARED_FIELD_LABELS,
  asId,
  asIsoDate,
  isReferralOverdue,
  nextStatuses,
  todayAsIsoDate,
  type Referral,
  type ReferralId,
  type ReferralStatus,
  type ReferralSummarySheet,
  type SharedFieldChoice,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { REFERRALS_COPY } from './referrals.copy';

/**
 * One referral, and the sheet the receiving office will see.
 *
 * The summary is fetched from the data layer rather than composed here. That is
 * the point of `summaryFor`: the screen must not be able to assemble a sheet
 * from a fuller record it happens to hold, because that is exactly how a field
 * nobody authorised ends up on a page that gets printed (`DL-81`).
 */
@Component({
  selector: 'app-referral-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, RouterLink, StatusBadge],
  templateUrl: './referral-detail-page.html',
  styleUrl: './referral-detail-page.scss',
})
export class ReferralDetailPage {
  private readonly repository = inject(REFERRAL_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);

  readonly id = input.required<string>();

  protected readonly copy = REFERRALS_COPY.detail;
  protected readonly statusCatalog = REFERRAL_STATUS_CATALOG;

  private readonly reloads = signal(0);
  protected readonly saving = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<ReferralId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<Referral | null> },
  );

  protected readonly referral = computed(() => valueOf(this.state()) ?? null);

  /** Composed by the data layer from the recorded plan, never by this screen. */
  protected readonly summary = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => this.repository.summaryFor(asId<ReferralId>(query.id))),
    ),
    { initialValue: null as ReferralSummarySheet | null },
  );

  protected readonly canManage = computed(() => this.permissions.has('referral.manage'));

  protected readonly outcomeText = signal('');
  protected readonly outcomeStatus = signal<ReferralStatus>('served');
  protected readonly noteText = signal('');
  protected readonly rescheduleDate = signal('');
  protected readonly rescheduleReason = signal('');

  protected outcomeStatuses(referral: Referral): readonly ReferralStatus[] {
    return nextStatuses(REFERRAL_STATUS_TRANSITIONS, referral.status).filter(
      (status) => status !== 'sent',
    );
  }

  protected isOverdue(referral: Referral): boolean {
    return isReferralOverdue(referral, todayAsIsoDate());
  }

  protected destinationLabel(referral: Referral): string {
    return REFERRAL_DESTINATION_LABELS[referral.destination];
  }

  protected urgencyLabel(referral: Referral): string {
    return REFERRAL_URGENCY_LABELS[referral.urgency];
  }

  protected basisLabel(referral: Referral): string {
    return referral.disclosure === null
      ? ''
      : DISCLOSURE_BASIS_LABELS[referral.disclosure.authority.basis];
  }

  protected fieldLabel(choice: SharedFieldChoice): string {
    return SHARED_FIELD_LABELS[choice.field];
  }

  /* ── recorded acts ──────────────────────────────────────────────────────── */

  protected onOutcome(event: Event): void {
    this.outcomeText.set((event.target as HTMLTextAreaElement).value);
  }

  protected onOutcomeStatus(event: Event): void {
    this.outcomeStatus.set((event.target as HTMLSelectElement).value as ReferralStatus);
  }

  protected onNote(event: Event): void {
    this.noteText.set((event.target as HTMLTextAreaElement).value);
  }

  protected onRescheduleDate(event: Event): void {
    this.rescheduleDate.set((event.target as HTMLInputElement).value);
  }

  protected onRescheduleReason(event: Event): void {
    this.rescheduleReason.set((event.target as HTMLInputElement).value);
  }

  protected readonly canRecordOutcome = computed(
    () => this.outcomeText().trim().length > 0 && !this.saving(),
  );
  protected readonly canAddNote = computed(
    () => this.noteText().trim().length > 0 && !this.saving(),
  );
  protected readonly canReschedule = computed(
    () =>
      this.rescheduleDate().length > 0 &&
      this.rescheduleReason().trim().length > 0 &&
      !this.saving(),
  );

  protected async recordOutcome(): Promise<void> {
    if (!this.canRecordOutcome()) {
      return;
    }
    await this.run(
      this.repository.recordOutcome(
        asId<ReferralId>(this.id()),
        this.outcomeText(),
        this.outcomeStatus(),
      ),
      this.copy.outcomeSaved,
      () => this.outcomeText.set(''),
    );
  }

  protected async addNote(): Promise<void> {
    if (!this.canAddNote()) {
      return;
    }
    await this.run(
      this.repository.addNote(asId<ReferralId>(this.id()), this.noteText()),
      this.copy.noteSaved,
      () => this.noteText.set(''),
    );
  }

  protected async reschedule(): Promise<void> {
    if (!this.canReschedule()) {
      return;
    }
    await this.run(
      this.repository.reschedule(
        asId<ReferralId>(this.id()),
        asIsoDate(this.rescheduleDate()),
        this.rescheduleReason(),
      ),
      this.copy.rescheduleSaved,
      () => {
        this.rescheduleDate.set('');
        this.rescheduleReason.set('');
      },
    );
  }

  /** Prints the sheet. The browser's own dialog; nothing is transmitted here. */
  protected print(): void {
    globalThis.print?.();
  }

  private async run(
    call: ReturnType<typeof this.repository.addNote>,
    message: string,
    onSuccess: () => void,
  ): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(call);
      onSuccess();
      this.notifications.success(message);
      this.reloads.update((value) => value + 1);
    } catch {
      // Reported rather than swallowed: a worker who believes they recorded an
      // outcome that was refused will not come back to it.
      this.notifications.error(this.copy.failed);
    } finally {
      this.saving.set(false);
    }
  }

  protected readonly noSummary = computed(() => this.summary() === null);
  protected readonly emptyStream = of(null);
}
