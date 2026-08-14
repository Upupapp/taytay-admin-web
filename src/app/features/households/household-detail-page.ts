import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  asId,
  barangayName,
  HOUSEHOLD_REPOSITORY,
  HOUSEHOLD_ROLE_LABELS,
  isHouseholdCompositionError,
  isValidCorrectionReason,
  type FactorState,
  type HouseholdDetail,
  type HouseholdId,
  type HouseholdMemberView,
  type VulnerabilityFactorCode,
} from '@domain/index';
import { LOADING, toViewState, type ViewState } from '@shared/state/view-state';
import {
  VulnerabilitySnapshotPanel,
  type FactorCorrectionRequest,
} from '@shared/households/vulnerability-snapshot';
import { VULNERABILITY_COPY } from '@shared/households/vulnerability.copy';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';

import { HOUSEHOLDS_COPY } from './households.copy';
import { HouseholdMemberEditor, type MembershipSubmission } from './household-member-editor';

/**
 * One household: who is in it, what the indicators say, and what anybody has
 * done to the record.
 *
 * The three panels are deliberately in that order. Composition first, because
 * every indicator is computed from it and an indicator argued over a wrong
 * member list is an argument about nothing. Then the snapshot, with its
 * working. Then the trail, so a correction and the reason for it can be read
 * side by side with what it replaced.
 */
@Component({
  selector: 'app-household-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DatePipe,
    HasPermissionDirective,
    HouseholdMemberEditor,
    Modal,
    PageHeader,
    PesoPipe,
    ResidentSummaryCard,
    RouterLink,
    VulnerabilitySnapshotPanel,
  ],
  templateUrl: './household-detail-page.html',
  styleUrl: './household-detail-page.scss',
})
export class HouseholdDetailPage {
  private readonly repository = inject(HOUSEHOLD_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);

  readonly id = input.required<string>();

  protected readonly copy = HOUSEHOLDS_COPY.detail;
  protected readonly memberCopy = HOUSEHOLDS_COPY.members;
  protected readonly correctionCopy = HOUSEHOLDS_COPY.correction;
  protected readonly factorLabels = VULNERABILITY_COPY.factorLabel;
  protected readonly stateLabels = VULNERABILITY_COPY.stateLabel;
  protected readonly correctableStates = HOUSEHOLDS_COPY.correctableStates;

  private readonly editor = viewChild(HouseholdMemberEditor);

  private readonly reloads = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.repository.getById(asId<HouseholdId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<HouseholdDetail | null> },
  );

  protected readonly canCorrect = computed(() =>
    this.permissions.has('household.correct-vulnerability'),
  );

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);

  /* ── correction dialogue ────────────────────────────────────────────────── */

  protected readonly correcting = signal<VulnerabilityFactorCode | null>(null);
  protected readonly clearing = signal<VulnerabilityFactorCode | null>(null);
  protected readonly correctionState = signal<FactorState>('present');
  protected readonly correctionReason = signal('');

  protected readonly correctionOpen = computed(() => this.correcting() !== null);
  protected readonly clearingOpen = computed(() => this.clearing() !== null);
  protected readonly reasonAcceptable = computed(() =>
    isValidCorrectionReason(this.correctionReason()),
  );

  protected readonly correctionHeading = computed(() => {
    const code = this.correcting() ?? this.clearing();
    return code === null ? this.correctionCopy.heading : this.factorLabels[code];
  });

  /* ── formatting ─────────────────────────────────────────────────────────── */

  protected barangay(detail: HouseholdDetail): string {
    return barangayName(detail.household.address.barangayId);
  }

  protected roleLabel(member: HouseholdMemberView): string {
    return HOUSEHOLD_ROLE_LABELS[member.role];
  }

  protected memberLink(member: HouseholdMemberView): string {
    return `/residents/${member.view.resident.id}`;
  }

  protected stateLabel(state: FactorState): string {
    return this.stateLabels[state];
  }

  /* ── membership ─────────────────────────────────────────────────────────── */

  protected toggleEditing(): void {
    this.editing.update((editing) => !editing);
  }

  protected onMembershipSubmitted(submission: MembershipSubmission): void {
    this.saving.set(true);
    this.repository
      .changeMembership(asId<HouseholdId>(this.id()), submission.changes, submission.reason)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editor()?.accept();
          this.notifications.success(this.memberCopy.saved);
          this.reloads.update((value) => value + 1);
        },
        error: (failure: unknown) => {
          this.saving.set(false);
          // A composition refusal names the rules it broke; anything else gets
          // its own message. Neither ever names another household's records.
          this.notifications.error(
            isHouseholdCompositionError(failure)
              ? failure.problems.map((problem) => HOUSEHOLDS_COPY.problem[problem.code]).join(' ')
              : failure instanceof Error
                ? failure.message
                : 'That change could not be saved.',
          );
        },
      });
  }

  /* ── corrections ────────────────────────────────────────────────────────── */

  protected askCorrect(request: FactorCorrectionRequest): void {
    this.correctionReason.set('');
    // Pre-set to the opposite of what the records say: a correction that agreed
    // with the computation would not be a correction.
    this.correctionState.set(request.factor.state === 'present' ? 'absent' : 'present');
    this.correcting.set(request.code);
  }

  protected askClear(request: FactorCorrectionRequest): void {
    this.correctionReason.set('');
    this.clearing.set(request.code);
  }

  protected onCorrectionState(event: Event): void {
    this.correctionState.set((event.target as HTMLSelectElement).value as FactorState);
  }

  protected onCorrectionReason(event: Event): void {
    this.correctionReason.set((event.target as HTMLInputElement).value);
  }

  protected cancelCorrection(): void {
    this.correcting.set(null);
    this.clearing.set(null);
  }

  protected confirmCorrection(): void {
    const code = this.correcting();
    if (code === null || !this.reasonAcceptable()) {
      return;
    }
    this.repository
      .correctFactor(
        asId<HouseholdId>(this.id()),
        code,
        this.correctionState(),
        this.correctionReason(),
      )
      .subscribe({
        next: () => {
          this.correcting.set(null);
          this.notifications.success(this.correctionCopy.saved);
          this.reloads.update((value) => value + 1);
        },
        error: (failure: unknown) => this.fail(failure),
      });
  }

  protected confirmClear(): void {
    const code = this.clearing();
    if (code === null || !this.reasonAcceptable()) {
      return;
    }
    this.repository
      .clearCorrection(asId<HouseholdId>(this.id()), code, this.correctionReason())
      .subscribe({
        next: () => {
          this.clearing.set(null);
          this.notifications.success(this.correctionCopy.cleared);
          this.reloads.update((value) => value + 1);
        },
        error: (failure: unknown) => this.fail(failure),
      });
  }

  private fail(failure: unknown): void {
    this.correcting.set(null);
    this.clearing.set(null);
    this.notifications.error(
      failure instanceof Error ? failure.message : 'That correction could not be saved.',
    );
  }
}
