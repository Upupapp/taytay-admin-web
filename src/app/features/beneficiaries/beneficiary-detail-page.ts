import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  BENEFICIARY_REPOSITORY,
  BENEFICIARY_ROLE_DESCRIPTIONS,
  BENEFICIARY_ROLE_LABELS,
  ENROLLMENT_EXIT_REASON_LABELS,
  ENROLLMENT_STATUS_CATALOG,
  IDENTITY_VERDICT_LABELS,
  PROGRAMME_MEMBERSHIP_NOT_RECORDED,
  asId,
  barangayName,
  byEnrollmentRecency,
  type BeneficiaryDetail,
  type BeneficiaryRole,
  type IdentityResolution,
  type ProgramEnrollment,
  type ResidentId,
} from '@domain/index';
import { AssistanceHistoryTimeline } from '@shared/beneficiaries/assistance-history-timeline';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { BENEFICIARIES_COPY } from './beneficiaries.copy';

/**
 * What the record assembles: the person, their household and families, the requests, payouts and
 * referrals of their history, the programmes it names, and the duplicate flag (`DL-222`).
 */
export const BENEFICIARY_DETAIL_TOPICS: readonly LiveTopic[] = [
  'beneficiaries',
  'residents',
  'households',
  'families',
  'assistance-requests',
  'releases',
  'referrals',
  'programs',
];

/** A reviewer's identity findings are kept beside the duplicate pairs, under the registry's topic. */
export const BENEFICIARY_FINDING_TOPICS: readonly LiveTopic[] = ['beneficiaries'];

/** What one finding says about the record it is read on (`DL-74`). */
export type FindingStanding = 'kept' | 'superseded' | 'distinct';

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
    DatePipe,
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
  private readonly live = inject(LiveUpdates);

  /** Bound from the route by `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly copy = BENEFICIARIES_COPY.detail;
  protected readonly enrollmentStatuses = ENROLLMENT_STATUS_CATALOG;
  protected readonly membershipNotRecorded = PROGRAMME_MEMBERSHIP_NOT_RECORDED;

  protected readonly state = toSignal(
    toObservable(computed(() => asId<ResidentId>(this.id()))).pipe(
      switchMap((id) =>
        liveViewState(
          () => this.repository.getByResidentId(id),
          this.live.changes(BENEFICIARY_DETAIL_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<BeneficiaryDetail | null> },
  );

  protected readonly record = computed(() => valueOf(this.state()) ?? null);

  /** "Try again" on the findings panel: the same question asked again. */
  private readonly findingReloads = signal(0);

  protected retryFindings(): void {
    this.findingReloads.update((value) => value + 1);
  }

  /**
   * What reviewers have recorded about this record and another (`DL-74`), newest first. A
   * superseded record leaves the list but stays readable by id, so it is here, where it is read,
   * that it says which record the office uses now (`DL-223`).
   */
  protected readonly findingsState = toSignal(
    toObservable(
      computed(() => ({ id: asId<ResidentId>(this.id()), nonce: this.findingReloads() })),
    ).pipe(
      switchMap((query) =>
        liveViewState(
          () => this.repository.resolutionsFor(query.id),
          this.live.changes(BENEFICIARY_FINDING_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly IdentityResolution[]> },
  );

  protected verdictLabel(finding: IdentityResolution): string {
    return IDENTITY_VERDICT_LABELS[finding.verdict];
  }

  /** Whether this record is the one kept, the one superseded, or one of two different people. */
  protected standingIn(finding: IdentityResolution): FindingStanding {
    if (finding.verdict === 'distinct-people') {
      return 'distinct';
    }
    return finding.supersededResidentId === asId<ResidentId>(this.id()) ? 'superseded' : 'kept';
  }

  /** The other record of the pair, opened by its own id; whether it is readable is the API's call. */
  protected otherRecord(finding: IdentityResolution): ResidentId {
    const here = asId<ResidentId>(this.id());
    const [first, second] = finding.pair;
    return first === here ? second : first;
  }

  /**
   * Whether the system of record holds programme membership at all. Where it does not, the panel
   * says so rather than "not enrolled", which would be a finding about the person (`DL-187`).
   */
  protected readonly membershipRecorded = computed(() => this.record()?.enrollments !== null);

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
    return enrollment.exit === null ? null : ENROLLMENT_EXIT_REASON_LABELS[enrollment.exit.reason];
  }

  protected barangayLabel(record: BeneficiaryDetail): string {
    return barangayName(record.resident.resident.address.barangayId);
  }
}
