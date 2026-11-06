import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';
import { firstValueFrom, of, switchMap, filter, tap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { describeFailure, isApiFailure } from '@core/http/api-failure';
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
  ASSIGNMENT_NEEDS_REASON,
  PROTECTED_FILE_REFUSAL,
  PROTECTED_WRITE_REFUSAL,
  REQUEST_NOTE_MAX_LENGTH,
  isTerminalAssistanceStatus,
  type CaseNoteSensitivity,
  type RequestNote,
  type SocialWorker,
  type SocialWorkerAssessment,
  type StaffUserId,
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  PROGRAM_REPOSITORY,
  ASSISTANCE_STATUS_TRANSITIONS,
  PAYOUT_RECORDED_STATUSES,
  EMPTY_ADVISORY,
  REQUIREMENT_STATUS_CATALOG,
  RESIDENT_REPOSITORY,
  asId,
  assessmentReadiness,
  isValidFindings,
  nextStatuses,
  permissionForTransition,
  pesos,
  documentRequestProblems,
  asIsoDate,
  DOCUMENT_REQUEST_CHANNELS,
  DOCUMENT_REQUEST_CHANNEL_LABELS,
  DOCUMENT_REQUEST_STATE_LABELS,
  type DocumentRequest,
  type DocumentRequestChannel,
  type DocumentRequestDraft,
  type DocumentRequestId,
  type IsoDate,
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
  type IntakeAdvisory,
  type RequestWithheldField,
  type StatusChange,
  isWithheldFromReader,
  type RequirementId,
  type RequirementStatus,
  type ResidentProfile,
  type AssistanceProgram,
  type DocumentVersionDraft,
  uploadPercent as percentOf,
} from '@domain/index';
import { ObjectUrls } from '@shared/media/object-urls';
import { DocumentPanel } from '@shared/requirements/document-panel';
import { REQUIREMENTS_COPY } from '@shared/requirements/requirements.copy';
import { AdvisoryPanel } from '@shared/intake/advisory-panel';
import { INTAKE_COPY } from '@shared/intake/intake.copy';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';
import { StatusTransition, type StatusTransitionRequest } from '@shared/cases/status-transition';
import { LOADING, ready, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
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
 *
 * Since casework phase 2b (`DL-178`) every section is served: assignment for
 * assessment, the form and the case study, the document review, recording and
 * opening a file, what the applicant was asked to bring, and the notes. Each
 * read is held as a view state, so one that fails says so in its own section
 * and the rest of the record stands.
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

  /**
   * The applicant's picture, read fresh rather than copied onto the request.
   *
   * Not asked for on behalf of a caseload: the server refuses the resident registry to an
   * `assigned-cases` account (`DL-174`, `DL-178`), and a refusal there takes the reader off this
   * page. Held as a view state, so a registry that cannot be read is said in place — the request
   * itself stays readable either way.
   */
  protected readonly readsRegistry = computed(
    () => this.permissions.scope() !== 'assigned-cases' && this.permissions.has('resident.view'),
  );

  private readonly profileState = toSignal(
    toObservable(
      computed(() => ({ residentId: this.request()?.residentId ?? null, reads: this.readsRegistry() })),
    ).pipe(
      switchMap(({ residentId, reads }) =>
        residentId === null || !reads
          ? of(ready(null))
          : toViewState(this.residents.getProfile(residentId)),
      ),
    ),
    { initialValue: ready(null) as ViewState<ResidentProfile | null> },
  );

  protected readonly profile = computed(() => valueOf(this.profileState()) ?? null);
  protected readonly profileFailure = computed(() => {
    const state = this.profileState();
    return state.kind === 'error' ? state.message : null;
  });

  /**
   * The duplicate check reads one named person's whole assistance history, so it is the filers'
   * (`request.create`, `DL-60`) and is not asked for on anybody else's behalf: the API would refuse
   * it, and a refusal there takes the reader off this page. A caseload is refused it too, whatever
   * it holds: it reads one person's whole history, beyond the requests assigned to it (`DL-178`).
   */
  protected readonly readsAdvisory = computed(
    () => this.permissions.has('request.create') && this.permissions.scope() !== 'assigned-cases',
  );

  /** Held as a view state, so a check that could not be read is said in place, never as "nothing found". */
  private readonly advisoryState = toSignal(
    toObservable(
      computed(() => ({ request: this.request(), reads: this.readsAdvisory() })),
    ).pipe(
      switchMap(({ request, reads }) =>
        request === null || !reads
          ? of(ready(EMPTY_ADVISORY))
          : // The request exists here, so the check is read for it, not counting it against itself.
            toViewState(this.requests.advisoryForCase(request.id)),
      ),
    ),
    { initialValue: ready(EMPTY_ADVISORY) as ViewState<IntakeAdvisory> },
  );

  protected readonly advisory = computed(() => valueOf(this.advisoryState()) ?? EMPTY_ADVISORY);
  protected readonly advisoryFailure = computed(() => {
    const state = this.advisoryState();
    return state.kind === 'error' ? state.message : null;
  });

  protected readonly canAssess = computed(() => this.permissions.has('request.assess'));
  protected readonly canReviewDocuments = computed(() => this.permissions.has('request.intake'));

  /* ── who may do what here ────────────────────────────────────────────────
   *
   * Every act below is hidden from a reader the server would refuse, and the reason is said once in
   * its place. That is usability, never protection — the server refuses independently (`CLAUDE.md`
   * rule 4) — but it matters more than usual here: the console answers any `403` by leaving the page
   * for the forbidden screen, so an act offered to somebody the server refuses takes them away from
   * the record they were working on.
   */

  /** A caseload (`assigned-cases`) works the requests assigned to it and reads nothing beyond them. */
  protected readonly isCaseload = computed(() => this.permissions.scope() === 'assigned-cases');

  /**
   * Nobody adds to what they may not read (`DL-178`): on a protected request read without
   * `request.view-sensitive`, every addition is refused by the server, so none is offered.
   */
  protected uncleared(request: AssistanceRequest): boolean {
    return request.isProtected && isWithheldFromReader(request, 'reasonForRequest');
  }

  /** Reviewing, ruling, recording, asking and assigning are for a filed request that is not over. */
  protected workable(request: AssistanceRequest): boolean {
    return (
      request.referenceNumber !== '' &&
      !isTerminalAssistanceStatus(request.status) &&
      !this.uncleared(request)
    );
  }

  protected readonly protectedWriteRefusal = PROTECTED_WRITE_REFUSAL;
  protected readonly protectedFileRefusal = PROTECTED_FILE_REFUSAL;

  /* ── assignment for assessment (DL-178) ──────────────────────────────────
   *
   * Assigning reads the office's whole list of social workers, so it is the assigners' — holders of
   * `request.assess` who are not themselves a caseload. The history is everybody's who can read the
   * request: who handed it over, to whom, when and why, or "withheld" where the reason is.
   */
  protected readonly canAssign = computed(
    () => this.permissions.has('request.assess') && !this.isCaseload(),
  );

  private readonly workerState = toSignal(
    toObservable(this.canAssign).pipe(
      switchMap((assigns) =>
        assigns
          ? toViewState(this.requests.listSocialWorkers())
          : of(ready([] as readonly SocialWorker[])),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly SocialWorker[]> },
  );

  protected readonly socialWorkers = computed(() => valueOf(this.workerState()) ?? []);
  protected readonly workersUnavailable = computed(() => {
    const state = this.workerState();
    return state.kind === 'error' ? state.message : null;
  });

  protected readonly assignee = signal('');
  protected readonly assignReason = signal('');
  protected readonly assignProblem = signal<string | null>(null);

  protected assigneeName(request: AssistanceRequest): string | null {
    if (request.assignedTo === null) {
      return null;
    }
    const latest = [...request.assignments]
      .reverse()
      .find((assignment) => assignment.assigneeId === request.assignedTo);
    return latest?.assigneeName ?? this.copy.assignedUnnamed;
  }

  protected onAssignee(event: Event): void {
    this.assignee.set((event.target as HTMLSelectElement).value);
  }

  protected onAssignReason(event: Event): void {
    this.assignReason.set((event.target as HTMLInputElement).value);
  }

  protected onNoteBody(event: Event): void {
    this.noteBody.set((event.target as HTMLTextAreaElement).value);
  }

  /** Only a tier this reader is offered is taken; anything else reads as routine. */
  protected onNoteSensitivity(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.noteSensitivity.set(this.noteSensitivities().find((tier) => tier === value) ?? 'routine');
  }

  protected assign(): void {
    const assigneeId = this.assignee();
    const reason = this.assignReason().trim();
    if (assigneeId === '') {
      this.assignProblem.set(this.copy.assignChooseWorker);
      return;
    }
    if (reason === '') {
      this.assignProblem.set(ASSIGNMENT_NEEDS_REASON);
      return;
    }
    this.assignProblem.set(null);
    this.run(
      this.requests.assignForAssessment(
        asId<AssistanceRequestId>(this.id()),
        asId<StaffUserId>(assigneeId),
        reason,
      ),
      this.copy.assigned,
      () => {
        this.assignee.set('');
        this.assignReason.set('');
      },
    );
  }

  /* ── notes (DL-58, DL-178) ───────────────────────────────────────────────
   *
   * Listed whole, newest first, a withheld body said as withheld and the entry still there. Adding
   * one is `case.note`; the protected tier is offered only to a holder of
   * `case-note.view-protected`, because nobody writes a note they could not then read.
   */
  private readonly noteReloads = signal(0);
  private readonly noteState = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.noteReloads() }))).pipe(
      switchMap(({ id }) => toViewState(this.requests.listNotes(asId<AssistanceRequestId>(id)))),
    ),
    { initialValue: LOADING as ViewState<readonly RequestNote[]> },
  );

  protected readonly notesView = computed(() => this.noteState());
  protected readonly notesList = computed(() => valueOf(this.noteState()) ?? []);
  protected readonly canNote = computed(() => this.permissions.has('case.note'));
  protected readonly noteSensitivities = computed((): readonly CaseNoteSensitivity[] =>
    this.permissions.has('case-note.view-protected') ? ['routine', 'protected'] : ['routine'],
  );
  protected readonly noteBody = signal('');
  protected readonly noteSensitivity = signal<CaseNoteSensitivity>('routine');
  protected readonly noteProblem = signal<string | null>(null);
  protected readonly noteMax = REQUEST_NOTE_MAX_LENGTH;

  protected addNote(): void {
    const body = this.noteBody().trim();
    if (body === '') {
      this.noteProblem.set(this.copy.noteEmpty);
      return;
    }
    if (body.length > REQUEST_NOTE_MAX_LENGTH) {
      this.noteProblem.set(this.copy.noteTooLong(REQUEST_NOTE_MAX_LENGTH));
      return;
    }
    this.noteProblem.set(null);
    this.run(
      this.requests.addNote(asId<AssistanceRequestId>(this.id()), {
        sensitivity: this.noteSensitivity(),
        body,
      }),
      this.copy.noteAdded,
      () => {
        this.noteBody.set('');
        this.noteSensitivity.set('routine');
        this.noteReloads.update((n) => n + 1);
      },
    );
  }


  protected permittedMoves(status: AssistanceRequestStatus): readonly AssistanceRequestStatus[] {
    return nextStatuses(ASSISTANCE_STATUS_TRANSITIONS, status).filter(
      (to) =>
        !PAYOUT_RECORDED_STATUSES.includes(to) && this.permissions.has(permissionForTransition(to)),
    );
  }

  /** An approved request's payout is prepared on the release, by whoever schedules payouts. */
  protected canPrepareRelease(status: AssistanceRequestStatus): boolean {
    return (
      (status === 'approved' || status === 'scheduled') && this.permissions.has('release.schedule')
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
  private readonly templateState = toSignal(
    toObservable(this.canAssess).pipe(
      switchMap((assesses) =>
        assesses
          ? toViewState(this.requests.listAssessmentTemplates())
          : of(ready([] as readonly AssessmentTemplate[])),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly AssessmentTemplate[]> },
  );

  protected readonly templates = computed(() => valueOf(this.templateState()) ?? []);

  /**
   * Why the case study cannot be written here — said in place of the whole form (`DL-177`). Where
   * the assessment is not connected, a form whose save goes nowhere is worse than none: whoever
   * fills it in reasonably believes the office record now holds it (`DL-32`).
   */
  protected readonly studyUnavailable = computed(() => {
    const state = this.templateState();
    return state.kind === 'error' ? state.message : null;
  });

  protected readonly chosenTemplate = signal<string>('');
  protected readonly openAssessment = signal<OpenAssessment | null>(null);
  /** Set when the server answered with an assessment already open from another form. */
  protected readonly alreadyOpenFrom = signal<string | null>(null);
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
        // One assessment is open per request, whichever form it came from: the server answers with
        // it rather than opening a second, and the screen says which form that is.
        this.alreadyOpenFrom.set(
          assessment.templateCode === code ? null : this.templateLabel(assessment.templateCode),
        );
        this.submitting.set(false);
      },
      error: (error: unknown) => this.failed(error),
    });
  }

  protected templateLabel(code: string): string {
    return this.templates().find((candidate) => candidate.code === code)?.label ?? code;
  }

  protected recommendationLabel(assessment: SocialWorkerAssessment): string {
    return assessment.recommendation === null
      ? this.copy.noRecommendation
      : ASSESSMENT_RECOMMENDATION_LABELS[assessment.recommendation];
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
      error: (error: unknown) => this.failed(error),
    });
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.objectUrls.revokeAll());

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

  private readonly programState = toSignal(toViewState(this.programs.listActive()), {
    initialValue: LOADING as ViewState<readonly AssistanceProgram[]>,
  });

  protected programmeName(request: AssistanceRequest): string {
    const programs = valueOf(this.programState()) ?? [];
    return (
      programs.find((program) => program.id === request.programId)?.name ?? this.copy.unknownProgramme
    );
  }

  /** Withheld by the data layer from this reader — said as withheld, never as a blank (`DL-38`). */
  protected withheld(request: AssistanceRequest, field: RequestWithheldField): boolean {
    return isWithheldFromReader(request, field);
  }

  protected channelLabel(request: AssistanceRequest): string {
    return INTAKE_COPY.channelLabel[request.channel];
  }

  protected moveLabel(change: StatusChange): string {
    const to = ASSISTANCE_STATUS_CATALOG[change.to].label;
    return change.from === null ? to : `${ASSISTANCE_STATUS_CATALOG[change.from].label} → ${to}`;
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
      // The completed study is the request's now; the form it was written on is closed.
      () => {
        this.openAssessment.set(null);
        this.alreadyOpenFrom.set(null);
      },
    );
  }

  /* ── documents ──────────────────────────────────────────────────────────── */

  /* ── asking the applicant for a document ─────────────────────────────────
   *
   * The office already records what it verified. This records what it **asked for**, which is the
   * half that fails an applicant when it is missing: they are asked again on their next visit by a
   * different clerk, and if they say they were never told, the office has nothing to check.
   *
   * Every method here existed, mapped and routed, and was reachable from no screen (`DL-151`).
   */

  /**
   * What the applicant was asked to bring, read through its own list. Where that list cannot be
   * read, asking and withdrawing are not offered and the reason is said once, in place: an empty
   * "nothing asked for" would assert something about the applicant nobody checked. The rest of the
   * document review does not depend on it and stands.
   */
  private readonly documentState = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap(({ id }) =>
        toViewState(this.requests.listDocumentRequests(asId<AssistanceRequestId>(id))),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly DocumentRequest[]> },
  );

  protected readonly documentRequests = computed(() => valueOf(this.documentState()) ?? []);
  protected readonly documentWorkUnavailable = computed(() => {
    const state = this.documentState();
    return state.kind === 'error' ? state.message : null;
  });

  /** Open first — what the applicant still owes is what a clerk needs to see. */
  protected requestsFor(requirementId: RequirementId): readonly DocumentRequest[] {
    return this.documentRequests()
      .filter((entry) => entry.requirementId === requirementId)
      .slice()
      .sort((a, b) => Number(b.state === 'open') - Number(a.state === 'open'));
  }

  protected readonly channels = DOCUMENT_REQUEST_CHANNELS;
  protected readonly channelLabels = DOCUMENT_REQUEST_CHANNEL_LABELS;
  protected readonly requestStateLabels = DOCUMENT_REQUEST_STATE_LABELS;

  protected readonly askingFor = signal<RequirementId | null>(null);
  protected readonly askChannel = signal<DocumentRequestChannel>('in-person');
  protected readonly askMessage = signal('');
  protected readonly askNeededBy = signal<string>('');

  protected readonly askProblems = computed(() => {
    const requirementId = this.askingFor();
    if (requirementId === null) {
      return [];
    }
    return documentRequestProblems(this.askDraft(requirementId), this.todayIso());
  });

  private askDraft(requirementId: RequirementId): DocumentRequestDraft {
    const neededBy = this.askNeededBy().trim();
    return {
      requirementId,
      channel: this.askChannel(),
      message: this.askMessage(),
      // Blank means nobody set a deadline, which is a different record from a date in the past.
      neededBy: neededBy === '' ? null : asIsoDate(neededBy),
    };
  }

  private todayIso(): IsoDate {
    return asIsoDate(new Date().toISOString().slice(0, 10));
  }

  protected openAsk(requirementId: RequirementId): void {
    this.askingFor.set(requirementId);
    this.askChannel.set('in-person');
    this.askMessage.set('');
    this.askNeededBy.set('');
  }

  protected closeAsk(): void {
    this.askingFor.set(null);
  }

  protected sendAsk(): void {
    const requirementId = this.askingFor();
    if (requirementId === null || this.askProblems().length > 0 || this.submitting()) {
      return;
    }
    this.run(
      this.requests.requestDocument(
        asId<AssistanceRequestId>(this.id()),
        this.askDraft(requirementId),
      ),
      this.documentCopy.requestSent,
      () => this.closeAsk(),
    );
  }

  protected readonly withdrawing = signal<DocumentRequestId | null>(null);
  protected readonly withdrawReason = signal('');

  protected openWithdraw(requestId: DocumentRequestId): void {
    this.withdrawing.set(requestId);
    this.withdrawReason.set('');
  }

  protected closeWithdraw(): void {
    this.withdrawing.set(null);
  }

  protected confirmWithdraw(): void {
    const requestId = this.withdrawing();
    if (requestId === null || this.withdrawReason().trim() === '' || this.submitting()) {
      return;
    }
    this.run(
      this.requests.withdrawDocumentRequest(
        asId<AssistanceRequestId>(this.id()),
        requestId,
        this.withdrawReason().trim(),
      ),
      this.documentCopy.requestWithdrawn,
      () => this.closeWithdraw(),
    );
  }

  protected readonly remarksFor = signal<Record<string, string>>({});

  protected onRemarks(requirementId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.remarksFor.update((current) => ({ ...current, [requirementId]: value }));
  }

  protected remarksValue(requirementId: string): string {
    return this.remarksFor()[requirementId] ?? '';
  }

  /** Where the applicant must be told why, a review carries words — as the server requires. */
  protected readonly reviewProblem = signal<{ readonly requirementId: string; readonly message: string } | null>(
    null,
  );

  protected review(requirementId: RequirementId, status: RequirementStatus): void {
    const remarks = this.remarksValue(requirementId).trim();
    const needsWords = this.copy.reviewNeedsWords[status];
    if (remarks === '' && needsWords !== null) {
      this.reviewProblem.set({ requirementId, message: needsWords });
      return;
    }
    this.reviewProblem.set(null);
    this.run(
      this.requests.reviewRequirement(
        asId<AssistanceRequestId>(this.id()),
        requirementId,
        status,
        remarks === '' ? null : remarks,
      ),
      this.copy.reviewed,
      () => this.remarksFor.update((current) => ({ ...current, [requirementId]: '' })),
    );
  }

  protected reviewProblemFor(requirementId: RequirementId): string | null {
    const problem = this.reviewProblem();
    return problem !== null && problem.requirementId === requirementId ? problem.message : null;
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

  /** A ruling is somebody's, at a time; the record says whose and when where it can. */
  protected rulingWhen(requirement: SubmittedRequirement): string | null {
    return requirement.applicabilityDecidedAt;
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
      this.copy.ruled,
      () => this.applicabilityReasons.update((current) => ({ ...current, [requirementId]: '' })),
    );
  }

  /**
   * Asks the data layer for permission to open a file, then shows what the
   * reader is about to see and waits.
   *
   * Two steps rather than one because the warning has to be true: it names the
   * file and says whether the record is protected, and only the server knows
   * that. A warning composed client-side from a guess would be reassuring
   * exactly when it should not be. The warning shown is the grant's, word for
   * word.
   */
  protected askToOpen(requirementId: RequirementId, versionId: DocumentVersionId): void {
    this.fileReady.set(null);
    this.requests
      .openDocument(asId<AssistanceRequestId>(this.id()), requirementId, versionId)
      .subscribe({
        next: (grant) => this.pendingAccess.set(grant),
        error: (error: unknown) => this.failed(error, this.accessCopy.failed),
      });
  }

  protected cancelOpen(): void {
    this.pendingAccess.set(null);
    this.fileReady.set(null);
    this.objectUrls.revokeAll();
  }

  /** The bytes, once fetched: an address in this tab only, given back when the dialog closes. */
  protected readonly fileReady = signal<{ readonly url: string; readonly fileName: string } | null>(
    null,
  );
  protected readonly fetchingFile = signal(false);
  private readonly objectUrls = new ObjectUrls();

  /**
   * Confirms the open: exchanges the grant for the file, once.
   *
   * The bytes become an object URL only this tab can read, offered as a link carrying the file's
   * name, and revoked when the dialog closes or the page is left. Nothing is said to have opened
   * until the bytes have arrived (`DL-22`).
   */
  protected confirmOpen(): void {
    const grant = this.pendingAccess();
    if (grant === null || this.fetchingFile()) {
      return;
    }
    this.fetchingFile.set(true);
    this.requests.readDocumentFile(grant).subscribe({
      next: (bytes) => {
        this.fetchingFile.set(false);
        this.objectUrls.revokeAll();
        this.fileReady.set({ url: this.objectUrls.make(bytes), fileName: grant.fileName });
      },
      error: (error: unknown) => {
        this.fetchingFile.set(false);
        this.pendingAccess.set(null);
        this.failed(error, this.accessCopy.failed);
      },
    });
  }

  /** Whether this reader is offered "Open" at all on this request. */
  protected opensFiles(request: AssistanceRequest): boolean {
    return this.canDownloadDocuments() && !this.uncleared(request);
  }

  /* ── the lifecycle move ─────────────────────────────────────────────────── */

  protected onTransition(event: StatusTransitionRequest<AssistanceRequestStatus>): void {
    this.run(
      this.requests.changeStatus(asId<AssistanceRequestId>(this.id()), event.to, event.reason),
      this.copy.moved,
    );
  }

  /**
   * Generic over what the call returns.
   *
   * It was typed to `changeStatus`'s observable, which meant every other act had to be cast into
   * shape at the call site. A cast to make a helper accept a caller is a helper that was too
   * narrow, and `CLAUDE.md` §2.2 forbids reaching for one to get past the type system.
   *
   * `kept` runs only once the server has kept the act — a form is cleared after a save, never
   * before one that might fail and leave the words nowhere.
   */
  private run<T>(call: Observable<T>, message: string, kept?: () => void): void {
    this.submitting.set(true);
    call.subscribe({
      next: () => {
        this.submitting.set(false);
        this.notifications.success(message);
        kept?.();
        this.reloads.update((value) => value + 1);
      },
      error: (failure: unknown) => this.failed(failure),
    });
  }

  /**
   * A refusal in its own words, said once. A conflict or a refusal has already been said, in the
   * server's words, by the HTTP layer; a validation refusal is left to the screen, so it is said
   * here; anything raised in the console says its own sentence.
   */
  private failed(failure: unknown, fallback: string = this.copy.failed): void {
    this.submitting.set(false);
    if (isApiFailure(failure)) {
      if (failure.status === 422 || failure.code === 'VALIDATION_FAILED') {
        this.notifications.error(describeFailure(failure));
      }
      return;
    }
    this.notifications.error(failure instanceof Error ? failure.message : fallback);
  }
}
