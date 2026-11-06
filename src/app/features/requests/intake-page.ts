import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, of, switchMap } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { describeFailure, isApiFailure } from '@core/http/api-failure';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  REQUIREMENT_OBLIGATION_LABELS,
  type IntakeRequirementEntry,
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  EMPTY_ADVISORY,
  EMPTY_INTAKE_DRAFT,
  INTAKE_STEPS,
  OFFERED_INTAKE_CHANNELS,
  PROGRAM_REPOSITORY,
  RESIDENT_REPOSITORY,
  asId,
  asIsoDateTime,
  cautions,
  intakeProblems,
  isIntakeStep,
  isSaveableDraft,
  isValidAcknowledgement,
  needsAcknowledgement,
  nextStep,
  pesos,
  previousStep,
  problemsForStep,
  requirementEntriesFor,
  stepIndex,
  type AdvisoryAcknowledgement,
  type AssistanceProgram,
  type AssistanceRequest,
  type AssistanceRequestId,
  type AssistanceRequestStatus,
  type IntakeAdvisory,
  type IntakeChannel,
  type IntakeDraft,
  type IntakeProblem,
  type IntakeStep,
  type ProgramId,
  type ResidentId,
  type ResidentProfile,
  type ResidentView,
  membersOf,
} from '@domain/index';
import { AdvisoryPanel } from '@shared/intake/advisory-panel';
import { INTAKE_COPY } from '@shared/intake/intake.copy';
import { PersonPicker } from '@shared/residents/person-picker';
import { ResidentSummaryCard } from '@shared/residents/resident-summary-card';
import { LOADING, ready, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PesoPipe } from '@shared/pipes/peso.pipe';

import { REQUESTS_COPY } from './requests.copy';

/**
 * The intake flow.
 *
 * **Four steps, one route** (`DL-62`). The acceptance criterion is that a
 * trained encoder completes a common intake without excessive page changes, so
 * the steps are sections of a single page: the applicant's context is fetched
 * once when they are chosen and stays on screen through every later step, and
 * moving between steps costs nothing and loses nothing. The step is held in the
 * URL so a refresh, a browser Back and a link to a colleague all land where the
 * encoder was.
 *
 * The second criterion — previous resident and household context visible
 * without retyping — is met by reusing `ResidentRepository.getProfile`, the
 * aggregate TAB 07 already built for exactly this. Nothing on this screen
 * copies a household field into the request.
 *
 * The third — no automatic approval or denial — is why the advisory is a panel
 * of evidence and not a gate. A caution asks for a sentence before filing; it
 * never withholds the button (`DL-60`).
 */
@Component({
  selector: 'app-intake-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdvisoryPanel,
    DatePipe,
    PageHeader,
    PersonPicker,
    PesoPipe,
    ResidentSummaryCard,
    RouterLink,
  ],
  templateUrl: './intake-page.html',
  styleUrl: './intake-page.scss',
})
export class IntakePage {
  protected readonly membersOf = membersOf;
  private readonly requests = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly residents = inject(RESIDENT_REPOSITORY);
  private readonly programs = inject(PROGRAM_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Set when resuming a saved draft. */
  readonly id = input<string | undefined>(undefined);

  protected readonly copy = REQUESTS_COPY.intake;
  protected readonly shared = INTAKE_COPY;
  protected readonly steps = INTAKE_STEPS;
  protected readonly channels = OFFERED_INTAKE_CHANNELS;

  /* ── the working document ───────────────────────────────────────────────── */

  protected readonly draft = signal<IntakeDraft>(EMPTY_INTAKE_DRAFT);
  protected readonly chosen = signal<ResidentView | null>(null);
  protected readonly draftId = signal<AssistanceRequestId | null>(null);
  protected readonly submitting = signal(false);

  protected readonly step = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const value = params.get('step') ?? '';
        return isIntakeStep(value) ? value : 'person';
      }),
    ),
    { initialValue: 'person' as IntakeStep },
  );

  protected readonly stepNumber = computed(() => stepIndex(this.step()) + 1);
  protected readonly totalSteps = INTAKE_STEPS.length;

  /* ── context, read once ─────────────────────────────────────────────────── */

  protected readonly profile = toSignal(
    toObservable(computed(() => this.draft().residentId)).pipe(
      switchMap((residentId) =>
        residentId === null
          ? of(LOADING as ViewState<ResidentProfile | null>)
          : toViewState(this.residents.getProfile(residentId)),
      ),
    ),
    { initialValue: LOADING as ViewState<ResidentProfile | null> },
  );

  protected readonly context = computed(() => valueOf(this.profile()));

  protected readonly programList = toSignal(
    toViewState(this.programs.listActive()).pipe(
      map((state) => valueOf(state) ?? ([] as readonly AssistanceProgram[])),
    ),
    { initialValue: [] as readonly AssistanceProgram[] },
  );

  protected readonly programme = computed(
    () => this.programList().find((program) => program.id === this.draft().programId) ?? null,
  );

  /* ── the advisory ───────────────────────────────────────────────────────── */

  /** Bumped when the server says the check changed since it was read, so it is read again. */
  private readonly advisoryReads = signal(0);

  /**
   * Held as a view state, so a check that could not be read is said where the panel would be
   * rather than breaking the screen — and never shown as "nothing found".
   */
  private readonly advisoryState = toSignal(
    toObservable(
      computed(() => ({
        residentId: this.draft().residentId,
        programId: this.draft().programId,
        read: this.advisoryReads(),
      })),
    ).pipe(
      switchMap((query) =>
        query.residentId === null
          ? of(ready(EMPTY_ADVISORY))
          : toViewState(this.requests.advisoryFor(query.residentId, query.programId)),
      ),
    ),
    { initialValue: ready(EMPTY_ADVISORY) as ViewState<IntakeAdvisory> },
  );

  protected readonly advisory = computed(() => valueOf(this.advisoryState()) ?? EMPTY_ADVISORY);
  protected readonly advisoryFailure = computed(() => {
    const state = this.advisoryState();
    return state.kind === 'error' ? state.message : null;
  });

  protected readonly cautionList = computed(() => cautions(this.advisory()));
  protected readonly mustAcknowledge = computed(() => needsAcknowledgement(this.advisory()));

  protected readonly acknowledgementReason = signal('');
  protected readonly acknowledgementOk = computed(() =>
    isValidAcknowledgement(this.acknowledgementReason()),
  );

  /* ── what is missing ────────────────────────────────────────────────────── */

  protected readonly problems = computed<readonly IntakeProblem[]>(() =>
    intakeProblems(this.draft(), this.advisory(), this.acknowledgement()),
  );

  protected readonly canFile = computed(() => this.problems().length === 0 && !this.submitting());
  protected readonly canSave = computed(() => isSaveableDraft(this.draft()) && !this.submitting());

  protected problemsIn(step: IntakeStep): readonly IntakeProblem[] {
    return problemsForStep(this.problems(), step);
  }

  protected problemText(problem: IntakeProblem): string {
    return INTAKE_COPY.problem[problem.code];
  }

  /* ── resuming ───────────────────────────────────────────────────────────── */

  private readonly resumedState = toSignal(
    toObservable(computed(() => this.id())).pipe(
      switchMap((id) =>
        id === undefined
          ? of(ready(null))
          : toViewState(this.requests.getById(asId<AssistanceRequestId>(id))),
      ),
    ),
    { initialValue: ready(null) as ViewState<AssistanceRequest | null> },
  );

  /** Why the draft could not be read, said in place of a form that would start from nothing. */
  protected readonly resumeFailure = computed(() => {
    const state = this.resumedState();
    return state.kind === 'error' ? state.message : null;
  });

  /**
   * A draft whose words are withheld from this reader. Offering its form would be offering a save
   * the server refuses — and a save from a redacted copy would erase the reason that was withheld
   * (`DL-177`) — so the screen says so instead.
   */
  protected readonly withheldDraft = computed(() => {
    const request = valueOf(this.resumedState()) ?? null;
    return request !== null && request.status === 'draft' && request.withheld.length > 0;
  });

  /** The server's refusal in its own words, kept on screen beside the buttons it answers. */
  protected readonly refusal = signal<readonly string[]>([]);

  constructor() {
    // A resumed draft repopulates the form once, from the record. The screen
    // never keeps a second copy of the truth.
    toObservable(this.resumedState)
      .pipe(takeUntilDestroyed())
      .subscribe((state) => {
        const request = valueOf(state) ?? null;
        if (request === null || request.status !== 'draft' || request.withheld.length > 0) {
          return;
        }
        this.draftId.set(request.id);
        this.draft.set({
          residentId: request.residentId,
          // `''` is a draft that has not chosen a programme yet (`DL-63`).
          programId: request.programId.length === 0 ? null : request.programId,
          // Restored, not reset: the server keeps what it is sent, and re-saving a referral as a
          // walk-in would rewrite how the applicant reached the office (`DL-61`).
          channel: request.channel,
          referredBy: request.referredBy,
          reasonForRequest: request.reasonForRequest,
          requestedAmount: request.requestedAmount,
          requirements: request.requirements.map((requirement) => ({
            code: requirement.code,
            label: requirement.label,
            obligation: requirement.obligation,
            appliesWhen: requirement.appliesWhen,
            applicability: requirement.applicability,
            presented: requirement.status !== 'pending',
            waivedReason: requirement.status === 'waived' ? requirement.remarks : null,
          })),
        });
      });
  }

  /* ── step navigation is a query-param change, not a route change ────────── */

  protected goTo(step: IntakeStep): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected onNext(): void {
    const next = nextStep(this.step());
    if (next !== null) {
      this.goTo(next);
    }
  }

  protected onBack(): void {
    const previous = previousStep(this.step());
    if (previous !== null) {
      this.goTo(previous);
    }
  }

  /* ── field changes ──────────────────────────────────────────────────────── */

  protected onPersonChosen(view: ResidentView | null): void {
    this.chosen.set(view);
    this.patch({ residentId: view === null ? null : view.resident.id });
  }

  protected onChannel(event: Event): void {
    this.patch({ channel: (event.target as HTMLSelectElement).value as IntakeChannel });
  }

  protected onReferredBy(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.patch({ referredBy: value === '' ? null : value });
  }

  protected onProgramme(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const programId = value === '' ? null : asId<ProgramId>(value);
    const program = this.programList().find((candidate) => candidate.id === programId);
    // Choosing the programme is what brings its document list in; a programme
    // change replaces the list rather than merging two programmes' paperwork.
    this.patch({
      programId,
      requirements: program === undefined ? [] : requirementEntriesFor(program.requirements),
    });
  }

  protected onReason(event: Event): void {
    this.patch({ reasonForRequest: (event.target as HTMLTextAreaElement).value });
  }

  protected onAmount(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const amount = Number.parseFloat(raw);
    this.patch({
      requestedAmount: raw === '' || !Number.isFinite(amount) || amount < 0 ? null : pesos(amount),
    });
  }

  protected obligationLabel(entry: IntakeRequirementEntry): string {
    return REQUIREMENT_OBLIGATION_LABELS[entry.obligation];
  }

  protected onPresented(code: string, event: Event): void {
    const presented = (event.target as HTMLInputElement).checked;
    this.patch({
      requirements: this.draft().requirements.map((entry) =>
        entry.code === code ? { ...entry, presented } : entry,
      ),
    });
  }

  protected onWaive(code: string, event: Event): void {
    const waiving = (event.target as HTMLInputElement).checked;
    this.patch({
      requirements: this.draft().requirements.map((entry) =>
        entry.code === code ? { ...entry, waivedReason: waiving ? '' : null } : entry,
      ),
    });
  }

  protected onWaiveReason(code: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.patch({
      requirements: this.draft().requirements.map((entry) =>
        entry.code === code ? { ...entry, waivedReason: value } : entry,
      ),
    });
  }

  protected onAcknowledgement(event: Event): void {
    this.acknowledgementReason.set((event.target as HTMLTextAreaElement).value);
  }

  private patch(changes: Partial<IntakeDraft>): void {
    this.draft.update((current) => ({ ...current, ...changes }));
  }

  private acknowledgement(): AdvisoryAcknowledgement | null {
    if (!this.mustAcknowledge() || !this.acknowledgementOk()) {
      return null;
    }
    return {
      codes: this.cautionList().map((signal) => signal.code),
      reason: this.acknowledgementReason().trim(),
      actorId: this.session.user()?.id ?? null,
      actorName: this.session.user()?.displayName ?? 'Unknown',
      acknowledgedAt: asIsoDateTime(new Date()),
    };
  }

  /* ── saving and filing ──────────────────────────────────────────────────── */

  protected saveDraft(): void {
    if (!this.canSave()) {
      return;
    }
    this.submitting.set(true);
    this.refusal.set([]);
    this.requests.saveDraft(this.draft(), this.draftId()).subscribe({
      next: (saved) => {
        this.submitting.set(false);
        // Holding the id is what makes a second tap an update rather than a
        // second draft (`DL-63`).
        this.draftId.set(saved.id);
        this.notifications.success(this.copy.saved);
      },
      error: (failure: unknown) => this.fail(failure),
    });
  }

  protected file(): void {
    if (!this.canFile()) {
      return;
    }
    this.submitting.set(true);
    this.refusal.set([]);
    const acknowledgement = this.acknowledgement();

    this.requests.saveDraft(this.draft(), this.draftId()).subscribe({
      next: (saved) => {
        this.draftId.set(saved.id);
        this.requests.submitIntake(saved.id, acknowledgement).subscribe({
          next: (filed) => {
            this.submitting.set(false);
            this.notifications.success(this.copy.filed);
            void this.router.navigate(['/assistance-requests', filed.id]);
          },
          error: (failure: unknown) => this.fail(failure),
        });
      },
      error: (failure: unknown) => this.fail(failure),
    });
  }

  /**
   * The refusal in the server's words (`DL-177`): each sentence it sent, keyed by the console's own
   * intake problem codes, or its message when it sent none. A validation refusal raises no toast —
   * the form owns it — so without this the screen would say nothing at all.
   */
  private fail(failure: unknown): void {
    this.submitting.set(false);
    if (isApiFailure(failure)) {
      const sentences = Object.values(failure.details ?? {}).flat();
      this.refusal.set(sentences.length > 0 ? sentences : [describeFailure(failure)]);
      // The duplicate check changed since it was read: read it again, so the encoder answers
      // the check as it stands.
      if (failure.status === 409) {
        this.advisoryReads.update((n) => n + 1);
      }
      return;
    }
    const message = failure instanceof Error ? failure.message : this.copy.failed;
    this.refusal.set([message]);
    this.notifications.error(message);
  }

  /* ── formatting ─────────────────────────────────────────────────────────── */

  protected residentLink(residentId: ResidentId): string {
    return `/residents/${residentId}`;
  }

  /** Pesos in the box, centavos in the model. The conversion lives in one place. */
  protected amountInputValue(): string {
    const amount = this.draft().requestedAmount;
    return amount === null ? '' : String(amount.centavos / 100);
  }

  protected statusLabel(status: AssistanceRequestStatus): string {
    return ASSISTANCE_STATUS_CATALOG[status].label;
  }

  protected channelLabel(channel: IntakeChannel): string {
    return INTAKE_COPY.channelLabel[channel];
  }

  protected channelHint(channel: IntakeChannel): string {
    return INTAKE_COPY.channelHint[channel];
  }

  protected stepShort(step: IntakeStep): string {
    return INTAKE_COPY.stepShort[step];
  }

  protected stepLabel(step: IntakeStep): string {
    return INTAKE_COPY.stepLabel[step];
  }
}
