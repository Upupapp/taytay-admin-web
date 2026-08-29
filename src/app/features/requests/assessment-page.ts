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
import { firstValueFrom, of, switchMap, filter, tap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  CONDITIONAL_APPLICABILITY_LABELS,
  REQUIREMENT_OBLIGATION_LABELS,
  awaitsApplicabilityDecision,
  describeCompletion,
  summariseRequirements,
  type ConditionalApplicability,
  type DocumentAccessGrant,
  type DocumentVersionId,
  type SubmittedRequirement,
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
  ASSESSMENT_RECOMMENDATIONS,
  ASSESSMENT_RECOMMENDATION_LABELS,
  assessmentProblems as assessmentProblemsFor,
  unansweredRequired,
  type AssessmentRecommendation,
  type AssessmentTemplate,
  type OpenAssessment,
  type AssessmentReadinessCode,
  type AssistanceRequest,
  type AssistanceRequestId,
  type AssistanceRequestStatus,
  type RequirementId,
  type RequirementStatus,
  type ResidentProfile,
  type DocumentVersionDraft,
  uploadPercent as percentOf,
} from '@domain/index';
import { DocumentPanel } from '@shared/requirements/document-panel';
import { REQUIREMENTS_COPY } from '@shared/requirements/requirements.copy';
import { AdvisoryPanel } from '@shared/intake/advisory-panel';
import { INTAKE_COPY } from '@shared/intake/intake.copy';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';
import { StatusTransition, type StatusTransitionRequest } from '@shared/cases/status-transition';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
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
    DocumentPanel,
    DatePipe,
    Modal,
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
  protected readonly recommendation = signal<AssessmentRecommendation>('insufficient-information');
  protected readonly recommendationChoices = ASSESSMENT_RECOMMENDATIONS;
  protected readonly recommendationLabels = ASSESSMENT_RECOMMENDATION_LABELS;
  protected readonly reason = signal('');
  private hydrated = false;

  /* ── the form the office asks ────────────────────────────────────────────
   *
   * An assessment is opened *from* a published template and pins its version at that moment, so
   * the catalogue is read before anything can be opened. The templates are marked
   * `placeholder-pending-lgu-approval` and the screen says so — the `DL-68`/`DL-105` pattern: a
   * provisional instrument states that it is provisional until somebody records the check.
   */
  protected readonly templates = toSignal(this.requests.listAssessmentTemplates(), {
    initialValue: [] as readonly AssessmentTemplate[],
  });

  protected readonly chosenTemplate = signal<string>('');
  protected readonly openAssessment = signal<OpenAssessment | null>(null);
  protected readonly answers = signal<Record<string, string | null>>({});

  protected readonly template = computed(
    () =>
      this.templates().find((candidate) => candidate.code === this.openAssessment()?.templateCode) ??
      null,
  );

  /**
   * The required questions still unanswered, named in the form's own words.
   *
   * The server refuses to complete without them, and it is right to. But a save that fails after
   * the findings are written tells the assessor nothing about where to go back to, so they are
   * named here before the button is pressed. This states; it does not decide — the server checks
   * the same thing again inside its own transaction, which is where the guarantee lives.
   */
  protected readonly unanswered = computed(() => {
    const template = this.template();
    return template === null ? [] : unansweredRequired(template, this.answers());
  });

  protected readonly assessmentProblems = computed(() =>
    assessmentProblemsFor({
      findings: this.findings(),
      recommendedAmount: null,
      homeVisitConducted: this.homeVisit(),
      recommendation: this.recommendation(),
      reason: this.reason(),
    }),
  );

  protected openForm(): void {
    const code = this.chosenTemplate();
    if (code === '' || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.requests.openAssessment(asId<AssistanceRequestId>(this.id()), code).subscribe({
      next: (assessment) => {
        this.openAssessment.set(assessment);
        this.answers.set({ ...assessment.answers });
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        this.notifications.error(error instanceof Error ? error.message : this.copy.failed);
        this.submitting.set(false);
      },
    });
  }

  protected onAnswer(code: string, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const value = target.value;
    // '' is recorded as null: "asked and left blank" rather than an empty answer nobody typed.
    this.answers.update((current) => ({ ...current, [code]: value === '' ? null : value }));
  }

  protected saveAnswers(): void {
    if (this.openAssessment() === null || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.requests.answerAssessment(asId<AssistanceRequestId>(this.id()), this.answers()).subscribe({
      next: (assessment) => {
        this.openAssessment.set(assessment);
        this.answers.set({ ...assessment.answers });
        this.notifications.success(this.copy.answersSaved);
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        this.notifications.error(error instanceof Error ? error.message : this.copy.failed);
        this.submitting.set(false);
      },
    });
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

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
      this.recommendation.set(draft.recommendation);
      this.reason.set(draft.reason ?? '');
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
  /**
   * The button is disabled by what is *missing*, and every reason is on screen beside it.
   *
   * A disabled control with no stated cause is the thing `DL-60` and `DL-98` both refuse in their
   * own domains: software that declines and does not say why. Here the causes are the form's
   * unanswered required questions and a refusal with no reason — both of which the server would
   * refuse anyway, so nothing is invented, only said earlier.
   */
  protected readonly canSaveStudy = computed(
    () =>
      this.findingsOk() &&
      !this.submitting() &&
      this.openAssessment() !== null &&
      this.unanswered().length === 0 &&
      this.assessmentProblems().length === 0,
  );

  protected onFindings(event: Event): void {
    this.findings.set((event.target as HTMLTextAreaElement).value);
  }

  protected onRecommendation(event: Event): void {
    this.recommendation.set((event.target as HTMLSelectElement).value as AssessmentRecommendation);
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
        recommendation: this.recommendation(),
        reason: this.reason().trim() === '' ? null : this.reason().trim(),
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

  /* ── documents (TAB 14) ─────────────────────────────────────────────────── */

  protected readonly documentCopy = REQUIREMENTS_COPY.checklist;
  protected readonly accessCopy = REQUIREMENTS_COPY.access;

  /** Reading a file is its own grant, never implied by reviewing the checklist. */
  protected readonly canDownloadDocuments = computed(() =>
    this.permissions.has('document.download'),
  );

  /**
   * Recording a document is a **separate** grant from reading one.
   *
   * A clerk who receives paper at the counter may need to record it without being able to open
   * what is already held, and an auditor may read everything and record nothing. Hiding the
   * control is usability; the server refuses independently (`CLAUDE.md` rule 4).
   */
  protected readonly canRecordDocuments = computed(() => this.permissions.has('document.record'));

  /** Set while an upload is in flight, so the panel's button cannot be pressed twice. */
  protected readonly uploading = signal(false);

  /** Whole percent while bytes are moving, `null` when nothing is in flight. */
  protected readonly uploadPercent = signal<number | null>(null);

  private readonly applicabilityReasons = signal<Readonly<Record<string, string>>>({});

  /** The grant awaiting confirmation. A file never opens without a deliberate second act. */
  protected readonly pendingAccess = signal<DocumentAccessGrant | null>(null);

  /**
   * Records a version against one requirement.
   *
   * The bytes go over multipart through `FileTransport`; this screen never sees the transport, it
   * hands the port a draft carrying the file. A refusal the office's own rule could have predicted
   * — too large, wrong type — has already been shown by the panel before anything was sent.
   */
  protected async recordDocument(
    request: AssistanceRequest,
    requirementId: RequirementId,
    draft: DocumentVersionDraft,
  ): Promise<void> {
    if (this.uploading()) {
      return;
    }

    this.uploading.set(true);
    this.uploadPercent.set(0);

    try {
      /*
       * Every emission is read, not just the last.
       *
       * `lastValueFrom` would give the result and throw the progress away, which is what the
       * adapter used to do — and a 9 MB scan on a barangay connection then shows one unchanging
       * label for as long as it takes.
       */
      await firstValueFrom(
        this.requests
          .recordDocument(asId<AssistanceRequestId>(request.id), requirementId, draft)
          .pipe(
            tap((progress) => this.uploadPercent.set(percentOf(progress))),
            filter((progress) => progress.kind === 'done'),
          ),
      );
      this.notifications.success(this.documentCopy.recorded);
      this.reloads.update((n) => n + 1);
    } catch (failure: unknown) {
      /*
       * Named plainly, and never as "saved".
       *
       * `DL-87`'s doctrine: a failed send must say that nothing was kept. A document the office
       * believes it holds, and does not, is the failure this whole append-only model exists to
       * make impossible.
       */
      this.notifications.error(
        failure instanceof Error ? failure.message : this.documentCopy.notRecorded,
      );
    } finally {
      this.uploading.set(false);
      this.uploadPercent.set(null);
    }
  }

  protected obligationLabel(requirement: SubmittedRequirement): string {
    return REQUIREMENT_OBLIGATION_LABELS[requirement.obligation];
  }

  protected applicabilityLabel(requirement: SubmittedRequirement): string {
    return CONDITIONAL_APPLICABILITY_LABELS[requirement.applicability];
  }

  protected needsApplicabilityDecision(requirement: SubmittedRequirement): boolean {
    return awaitsApplicabilityDecision(requirement.obligation, requirement.applicability);
  }

  protected completionSummary(request: AssistanceRequest): string {
    return describeCompletion(summariseRequirements(request.requirements));
  }

  protected applicabilityReason(requirementId: RequirementId): string {
    return this.applicabilityReasons()[requirementId] ?? '';
  }

  protected onApplicabilityReason(requirementId: RequirementId, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.applicabilityReasons.update((current) => ({ ...current, [requirementId]: value }));
  }

  /** A ruling either way is consequential, so both need a reason before they can be made. */
  protected canDecide(requirementId: RequirementId): boolean {
    return this.applicabilityReason(requirementId).trim().length > 0;
  }

  protected decide(requirementId: RequirementId, applicability: ConditionalApplicability): void {
    const reason = this.applicabilityReason(requirementId).trim();
    if (reason === '') {
      return;
    }
    this.run(
      this.requests.decideApplicability(
        asId<AssistanceRequestId>(this.id()),
        requirementId,
        applicability,
        reason,
      ),
      this.copy.studySaved,
    );
  }

  /**
   * Asks the data layer for permission to open a file, then shows what the
   * reader is about to see and waits.
   *
   * Two steps rather than one because the warning has to be true: it names the
   * file and says whether the record is protected, and only the server knows
   * that. A warning composed client-side from a guess would be reassuring
   * exactly when it should not be.
   */
  protected askToOpen(requirementId: RequirementId, versionId: DocumentVersionId): void {
    this.requests
      .openDocument(asId<AssistanceRequestId>(this.id()), requirementId, versionId)
      .subscribe({
        next: (grant) => this.pendingAccess.set(grant),
        error: () => this.notifications.error(this.accessCopy.denied),
      });
  }

  protected cancelOpen(): void {
    this.pendingAccess.set(null);
  }

  /**
   * Confirms the open.
   *
   * There is no backend to stream bytes from in this build, so this reports
   * what would happen rather than pretending a file arrived. Saying "opened" for
   * something that did not open is the kind of false success `DL-22` exists to
   * prevent.
   */
  protected confirmOpen(): void {
    const grant = this.pendingAccess();
    if (grant === null) {
      return;
    }
    this.pendingAccess.set(null);
    this.notifications.info(grant.fileName, grant.warning);
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
