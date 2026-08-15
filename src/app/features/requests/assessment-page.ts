import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  PROGRAM_REPOSITORY,
  ASSISTANCE_STATUS_TRANSITIONS,
  EMPTY_ADVISORY,
  REQUIREMENT_STATUS_CATALOG,
  RESIDENT_REPOSITORY,
  asId,
  assessmentReadiness,
  isValidFindings,
  nextStatuses,
  permissionForTransition,
  pesos,
  toAssessmentDraft,
  type AssessmentReadinessCode,
  type AssistanceRequest,
  type AssistanceRequestId,
  type AssistanceRequestStatus,
  type RequirementId,
  type RequirementStatus,
  type ResidentProfile,
} from '@domain/index';
import { AdvisoryPanel } from '@shared/intake/advisory-panel';
import { INTAKE_COPY } from '@shared/intake/intake.copy';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';
import { StatusTransition, type StatusTransitionRequest } from '@shared/cases/status-transition';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { PesoPipe } from '@shared/pipes/peso.pipe';

import { REQUESTS_COPY } from './requests.copy';

/**
 * The assessment workspace.
 *
 * Where a social worker turns a filed request into a case study. Three things
 * it is careful about:
 *
 *  - **A recommendation is not an approval.** The worker records findings and a
 *    recommended amount; approving is a separate move by a different role, and
 *    that separation is what `DL-08` exists to protect.
 *  - **The readiness list does not gate anything** (`DL-60`). It says what the
 *    office would normally have — a home visit, verified documents — and then
 *    lets the person decide, because a home visit is impossible for a household
 *    that has moved and a document can legitimately be waived. Software that
 *    refused the endorsement here would be denying an applicant on a checklist.
 *  - **The lifecycle move reuses `StatusTransition`** from TAB 10, which is why
 *    that control was built generic. Reason capture, permission intersection
 *    and the refusal to move without words are inherited, not re-implemented.
 */
@Component({
  selector: 'app-assessment-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdvisoryPanel,
    AsyncContent,
    DatePipe,
    PageHeader,
    PesoPipe,
    ResidentSummaryCard,
    RouterLink,
    StatusBadge,
    StatusTransition,
  ],
  templateUrl: './assessment-page.html',
  styleUrl: './assessment-page.scss',
})
export class AssessmentPage {
  private readonly requests = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly residents = inject(RESIDENT_REPOSITORY);
  private readonly programs = inject(PROGRAM_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);

  readonly id = input.required<string>();

  protected readonly copy = REQUESTS_COPY.assessment;
  protected readonly shared = INTAKE_COPY;
  protected readonly statusCatalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly transitions = ASSISTANCE_STATUS_TRANSITIONS;
  protected readonly requirementCatalog = REQUIREMENT_STATUS_CATALOG;

  private readonly reloads = signal(0);
  protected readonly submitting = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) => toViewState(this.requests.getById(asId<AssistanceRequestId>(query.id)))),
    ),
    { initialValue: LOADING as ViewState<AssistanceRequest | null> },
  );

  protected readonly request = computed(() => valueOf(this.state()) ?? null);

  /** The applicant's picture, read fresh rather than copied onto the request. */
  protected readonly profile = toSignal(
    toObservable(computed(() => this.request()?.residentId ?? null)).pipe(
      switchMap((residentId) =>
        residentId === null ? of(null) : this.residents.getProfile(residentId),
      ),
    ),
    { initialValue: null as ResidentProfile | null },
  );

  protected readonly advisory = toSignal(
    toObservable(this.request).pipe(
      switchMap((request) =>
        request === null
          ? of(EMPTY_ADVISORY)
          : this.requests.advisoryFor(request.residentId, request.programId),
      ),
    ),
    { initialValue: EMPTY_ADVISORY },
  );

  protected readonly canAssess = computed(() => this.permissions.has('request.assess'));
  protected readonly canReviewDocuments = computed(() => this.permissions.has('request.intake'));

  protected permittedMoves(status: AssistanceRequestStatus): readonly AssistanceRequestStatus[] {
    return nextStatuses(ASSISTANCE_STATUS_TRANSITIONS, status).filter((to) =>
      this.permissions.has(permissionForTransition(to)),
    );
  }

  protected readiness(request: AssistanceRequest): readonly AssessmentReadinessCode[] {
    return assessmentReadiness(request);
  }

  protected readinessText(code: AssessmentReadinessCode): string {
    return INTAKE_COPY.readiness[code];
  }

  /* ── the case study ─────────────────────────────────────────────────────── */

  protected readonly findings = signal('');
  protected readonly homeVisit = signal(false);
  protected readonly recommended = signal<number | null>(null);
  private hydrated = false;

  constructor() {
    // Fills the form from the record once, then leaves the worker's typing
    // alone: a reload after saving must not wipe an edit in progress.
    effect(() => {
      const request = this.request();
      if (request === null || this.hydrated) {
        return;
      }
      this.hydrated = true;
      const draft = toAssessmentDraft(request);
      this.findings.set(draft.findings);
      this.homeVisit.set(draft.homeVisitConducted);
      this.recommended.set(
        draft.recommendedAmount === null ? null : draft.recommendedAmount.centavos / 100,
      );
    });
  }

  protected readonly programList = toSignal(this.programs.listActive(), { initialValue: [] });

  protected programmeName(request: AssistanceRequest): string {
    return (
      this.programList().find((program) => program.id === request.programId)?.name ??
      'Unknown programme'
    );
  }

  protected readonly findingsOk = computed(() => isValidFindings(this.findings()));
  protected readonly canSaveStudy = computed(() => this.findingsOk() && !this.submitting());

  protected onFindings(event: Event): void {
    this.findings.set((event.target as HTMLTextAreaElement).value);
  }

  protected onHomeVisit(event: Event): void {
    this.homeVisit.set((event.target as HTMLInputElement).checked);
  }

  protected onRecommended(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const amount = Number.parseFloat(raw);
    this.recommended.set(raw === '' || !Number.isFinite(amount) || amount < 0 ? null : amount);
  }

  protected recommendedValue(): string {
    const amount = this.recommended();
    return amount === null ? '' : String(amount);
  }

  protected saveStudy(): void {
    if (!this.canSaveStudy()) {
      return;
    }
    const amount = this.recommended();
    this.run(
      this.requests.recordAssessment(asId<AssistanceRequestId>(this.id()), {
        findings: this.findings().trim(),
        recommendedAmount: amount === null ? null : pesos(amount),
        homeVisitConducted: this.homeVisit(),
      }),
      this.copy.studySaved,
    );
  }

  /* ── documents ──────────────────────────────────────────────────────────── */

  protected readonly remarksFor = signal<Record<string, string>>({});

  protected onRemarks(requirementId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.remarksFor.update((current) => ({ ...current, [requirementId]: value }));
  }

  protected remarksValue(requirementId: string): string {
    return this.remarksFor()[requirementId] ?? '';
  }

  protected review(requirementId: RequirementId, status: RequirementStatus): void {
    const remarks = this.remarksValue(requirementId).trim();
    this.run(
      this.requests.reviewRequirement(
        asId<AssistanceRequestId>(this.id()),
        requirementId,
        status,
        remarks === '' ? null : remarks,
      ),
      this.copy.studySaved,
    );
  }

  /* ── the lifecycle move ─────────────────────────────────────────────────── */

  protected onTransition(event: StatusTransitionRequest<AssistanceRequestStatus>): void {
    this.run(
      this.requests.changeStatus(asId<AssistanceRequestId>(this.id()), event.to, event.reason),
      this.copy.moved,
    );
  }

  private run(call: ReturnType<typeof this.requests.changeStatus>, message: string): void {
    this.submitting.set(true);
    call.subscribe({
      next: () => {
        this.submitting.set(false);
        this.notifications.success(message);
        this.reloads.update((value) => value + 1);
      },
      error: (failure: unknown) => {
        this.submitting.set(false);
        this.notifications.error(failure instanceof Error ? failure.message : this.copy.failed);
      },
    });
  }
}
