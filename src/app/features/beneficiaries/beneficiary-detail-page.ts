import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import {
  BENEFICIARY_REPOSITORY,
  BENEFICIARY_ROLE_DESCRIPTIONS,
  BENEFICIARY_ROLE_LABELS,
  ENROLLMENT_EXIT_REASON_LABELS,
  ENROLLMENT_STATUS_CATALOG,
  asId,
  barangayName,
  byEnrollmentRecency,
  type BeneficiaryDetail,
  type BeneficiaryRole,
  type ProgramEnrollment,
  type ResidentId,
} from '@domain/index';
import { AssistanceHistoryTimeline } from '@shared/beneficiaries/assistance-history-timeline';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { BENEFICIARIES_COPY } from './beneficiaries.copy';

/**
 * One person's whole record with this office.
 *
 * The page is a **projection of the resident record**, not a second profile of
 * the same person (`DL-71`): its route parameter is a `ResidentId`, and every
 * link out of it leads back to the same canonical identity.
 *
 * Standing is shown with the counts it was derived from, because a badge saying
 * "Recipient" that a caseworker cannot check is a claim rather than a fact.
 */
@Component({
  selector: 'app-beneficiary-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistanceHistoryTimeline,
    AsyncContent,
    PageHeader,
    PesoPipe,
    RouterLink,
    StatusBadge,
  ],
  templateUrl: './beneficiary-detail-page.html',
  styleUrl: './beneficiary-detail-page.scss',
})
export class BeneficiaryDetailPage {
  private readonly repository = inject(BENEFICIARY_REPOSITORY);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly copy = BENEFICIARIES_COPY.detail;
  protected readonly enrollmentStatuses = ENROLLMENT_STATUS_CATALOG;

  protected readonly state = toSignal(
    toObservable(computed(() => asId<ResidentId>(this.id()))).pipe(
      switchMap((id) => toViewState(this.repository.getByResidentId(id))),
    ),
    { initialValue: LOADING as ViewState<BeneficiaryDetail | null> },
  );

  protected readonly record = computed(() => valueOf(this.state()) ?? null);

  /** Standing enrollments first, then most recent — past ones are kept, not hidden. */
  protected readonly enrollments = computed(() =>
    [...(this.record()?.enrollments ?? [])].sort(byEnrollmentRecency),
  );

  protected roleLabel(role: BeneficiaryRole): string {
    return BENEFICIARY_ROLE_LABELS[role];
  }

  protected roleDescription(role: BeneficiaryRole): string {
    return BENEFICIARY_ROLE_DESCRIPTIONS[role];
  }

  protected exitReasonLabel(enrollment: ProgramEnrollment): string | null {
    return enrollment.exit === null
      ? null
      : ENROLLMENT_EXIT_REASON_LABELS[enrollment.exit.reason];
  }

  protected barangayLabel(record: BeneficiaryDetail): string {
    return barangayName(record.resident.resident.address.barangayId);
  }
}
