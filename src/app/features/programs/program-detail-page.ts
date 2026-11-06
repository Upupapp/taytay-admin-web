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
import { Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  REQUIREMENT_OBLIGATION_LABELS,
  ADMINISTERING_AGENCIES,
  CATALOGUE_REASON_MAX_LENGTH,
  DEFAULT_REVIEW_WINDOW,
  LGU_ROLES,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_REPOSITORY,
  PROGRAM_STATUS_CATALOG,
  asId,
  awaitsConfirmation,
  isCatalogueReason,
  isFromTemplate,
  isNationalAgency,
  pesos,
  programProblems,
  resolveRequirements,
  reviewWindowFor,
  toProgramDraft,
  type AdministeringAgency,
  type AssistanceProgram,
  type EligibilityGuideline,
  type LguRole,
  type ProgramDraft,
  type ProgramId,
  type ProgramRequirement,
  type ProgramStatus,
  type ProgramUtilizationReading,
  type RequirementTemplate,
} from '@domain/index';
import { PROGRAM_COPY } from '@shared/programs/program.copy';
import { ResponsibilityNotice } from '@shared/programs/responsibility-notice';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { PesoPipe } from '@shared/pipes/peso.pipe';

import { refusalSentences } from './program-form';
import { PROGRAMS_COPY } from './programs.copy';

/** Everything the screen needs, read together so the parts cannot disagree. */
export interface ProgramView {
  readonly program: AssistanceProgram;
  readonly templates: readonly RequirementTemplate[];
  /** Or why it could not be read: never a zero standing in for an answer (`DL-176`). */
  readonly utilization: ProgramUtilizationReading;
}

/**
 * One programme: what it asks for, who runs it, and how much it is used.
 *
 * The whole screen is a renderer. Guidance is a list of records, the documents
 * are a template plus additions, the review window is a policy object and the
 * responsibility statement is a field — so a policy change is an edit to data
 * and this component does not move (`DL-66`). There is no `if (program.code ===
 * …)` anywhere in it, and `tools/check-programs.mjs` fails the build if one
 * appears.
 *
 * The edit form refuses, before the adapter does, the combination that would
 * misrepresent the office: a national programme recorded as one the
 * municipality runs (`DL-65`). It asks why, and says before the button that the
 * version and its reason are kept for good (`DL-124`, `DL-177`).
 */
@Component({
  selector: 'app-program-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DatePipe,
    PageHeader,
    PesoPipe,
    ResponsibilityNotice,
    RouterLink,
    StatusBadge,
  ],
  templateUrl: './program-detail-page.html',
  styleUrl: './program-detail-page.scss',
})
export class ProgramDetailPage {
  private readonly repository = inject(PROGRAM_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly copy = PROGRAMS_COPY.detail;
  protected readonly reasonCopy = PROGRAMS_COPY.reason;
  protected readonly reasonMax = CATALOGUE_REASON_MAX_LENGTH;
  protected readonly shared = PROGRAM_COPY;
  protected readonly statusCatalog = PROGRAM_STATUS_CATALOG;
  protected readonly agencies = ADMINISTERING_AGENCIES;
  protected readonly roles = LGU_ROLES;
  protected readonly statuses: readonly ProgramStatus[] = [
    'draft',
    'active',
    'suspended',
    'closed',
  ];

  private readonly reloads = signal(0);
  protected readonly submitting = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ id: this.id(), nonce: this.reloads() }))).pipe(
      switchMap((query) =>
        toViewState(
          this.repository
            .getById(asId<ProgramId>(query.id))
            .pipe(
              switchMap((program) =>
                program === null
                  ? of(null)
                  : combineLatest([
                      this.repository.listRequirementTemplates(program.id),
                      this.repository.utilizationFor(program.id),
                    ]).pipe(
                      switchMap(([templates, utilization]) =>
                        of<ProgramView>({ program, templates, utilization }),
                      ),
                    ),
              ),
            ),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<ProgramView | null> },
  );

  protected readonly view = computed(() => valueOf(this.state()) ?? null);
  protected readonly canManage = computed(() => this.permissions.has('program.manage'));

  /* ── reading ────────────────────────────────────────────────────────────── */

  protected template(view: ProgramView): RequirementTemplate | null {
    return (
      view.templates.find((entry) => entry.code === view.program.requirementTemplateCode) ?? null
    );
  }

  /** The template's documents plus the programme's own, resolved by the domain. */
  protected documents(view: ProgramView): readonly ProgramRequirement[] {
    return resolveRequirements(this.template(view), view.program.requirements);
  }

  protected obligationLabel(requirement: ProgramRequirement): string {
    return REQUIREMENT_OBLIGATION_LABELS[requirement.obligation];
  }

  protected fromTemplate(view: ProgramView, code: string): boolean {
    return isFromTemplate(this.template(view), code);
  }

  protected window(view: ProgramView) {
    return reviewWindowFor(view.program.reviewWindow);
  }

  protected windowIsDefault(view: ProgramView): boolean {
    return view.program.reviewWindow === null;
  }

  protected windowPending(view: ProgramView): boolean {
    return awaitsConfirmation(this.window(view));
  }

  protected weightLabel(guideline: EligibilityGuideline): string {
    return PROGRAM_COPY.weightLabel[guideline.weight];
  }

  protected guidanceCodeLabel(guideline: EligibilityGuideline): string {
    return PROGRAM_COPY.guidanceCodeLabel[guideline.code];
  }

  protected provenanceLabel(guideline: EligibilityGuideline): string {
    return PROGRAM_COPY.provenanceLabel[guideline.provenance];
  }

  protected categoryLabel(view: ProgramView): string {
    return PROGRAM_CATEGORY_LABELS[view.program.category];
  }

  protected windowProvenanceLabel(view: ProgramView): string {
    return PROGRAM_COPY.windowProvenanceLabel[this.window(view).provenance];
  }

  protected defaultWindow = DEFAULT_REVIEW_WINDOW;

  /* ── editing ────────────────────────────────────────────────────────────── */

  protected readonly editing = signal(false);
  protected readonly draft = signal<ProgramDraft | null>(null);
  protected readonly reason = signal('');
  protected readonly attempted = signal(false);
  /** The server's refusal, sentence by sentence, in its words. */
  protected readonly refusal = signal<readonly string[]>([]);

  constructor() {
    // The form is filled from the record when editing opens, and left alone
    // afterwards so a reload cannot wipe what somebody is typing.
    effect(() => {
      const view = this.view();
      if (view !== null && this.editing() && this.draft() === null) {
        this.draft.set(toProgramDraft(view.program));
      }
    });
  }

  protected startEditing(): void {
    this.draft.set(null);
    this.reason.set('');
    this.attempted.set(false);
    this.refusal.set([]);
    this.editing.set(true);
  }

  protected cancelEditing(): void {
    this.editing.set(false);
    this.draft.set(null);
  }

  /**
   * What the domain would refuse, shown while the user types rather than after
   * they save. The adapter and the server apply the same rules regardless, to
   * the record as it would stand — so a rule broken in a part this form does not
   * edit is said here too, rather than met as a refusal after saving.
   */
  protected readonly responsibilityIssues = computed(() => {
    const draft = this.draft();
    return draft === null ? [] : programProblems(draft);
  });

  protected readonly wouldMisrepresent = computed(() =>
    this.responsibilityIssues().some(
      (problem) => problem.code === 'national-programme-claimed-as-owned',
    ),
  );

  /** A reason not yet given, said beside the button rather than as a disabled one. */
  protected readonly missing = computed(() => {
    const reason = this.reason().trim();
    if (reason === '') {
      return [this.reasonCopy.missing];
    }
    return isCatalogueReason(reason) ? [] : [this.reasonCopy.tooLong];
  });

  /** Closing dates the programme's end; moving away from closed clears it — said before saving. */
  protected statusConsequence(view: ProgramView, draft: ProgramDraft): string | null {
    if (draft.status === 'closed' && view.program.status !== 'closed') {
      return this.copy.closing;
    }
    if (draft.status !== 'closed' && view.program.status === 'closed') {
      return this.copy.reopening;
    }
    return null;
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected problemText(code: string): string {
    return PROGRAMS_COPY.problem[code] ?? code;
  }

  protected patch(changes: Partial<ProgramDraft>): void {
    this.draft.update((current) => (current === null ? current : { ...current, ...changes }));
  }

  protected onName(event: Event): void {
    this.patch({ name: (event.target as HTMLInputElement).value });
  }

  protected onDescription(event: Event): void {
    this.patch({ description: (event.target as HTMLTextAreaElement).value });
  }

  protected onStatus(event: Event): void {
    this.patch({ status: (event.target as HTMLSelectElement).value as ProgramStatus });
  }

  protected onFunding(event: Event): void {
    this.patch({ fundingSource: (event.target as HTMLInputElement).value });
  }

  protected onLegalBasis(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.patch({ legalBasis: value === '' ? null : value });
  }

  protected onMaximum(event: Event): void {
    const raw = (event.target as HTMLInputElement).value.trim();
    const amount = Number.parseFloat(raw);
    this.patch({
      maximumGrant: raw === '' || !Number.isFinite(amount) || amount < 0 ? null : pesos(amount),
    });
  }

  protected onAdministeredBy(event: Event): void {
    const administeredBy = (event.target as HTMLSelectElement).value as AdministeringAgency;
    const current = this.draft();
    if (current === null) {
      return;
    }
    this.patch({ responsibility: { ...current.responsibility, administeredBy } });
  }

  protected onFundsHeldBy(event: Event): void {
    const fundsHeldBy = (event.target as HTMLSelectElement).value as AdministeringAgency;
    const current = this.draft();
    if (current === null) {
      return;
    }
    this.patch({ responsibility: { ...current.responsibility, fundsHeldBy } });
  }

  protected onLguRole(event: Event): void {
    const lguRole = (event.target as HTMLSelectElement).value as LguRole;
    const current = this.draft();
    if (current === null) {
      return;
    }
    this.patch({ responsibility: { ...current.responsibility, lguRole } });
  }

  protected onStatement(event: Event): void {
    const statement = (event.target as HTMLTextAreaElement).value;
    const current = this.draft();
    if (current === null) {
      return;
    }
    this.patch({ responsibility: { ...current.responsibility, statement } });
  }

  /** Offered only where the domain would accept it, and refused there anyway. */
  protected roleAvailable(role: LguRole): boolean {
    const draft = this.draft();
    if (draft === null) {
      return true;
    }
    return !(role === 'owner' && isNationalAgency(draft.responsibility.administeredBy));
  }

  protected agencyLabel(agency: AdministeringAgency): string {
    return PROGRAM_COPY.agencyLabel[agency];
  }

  protected roleLabel(role: LguRole): string {
    return PROGRAM_COPY.roleLabel[role];
  }

  protected maximumValue(): string {
    const amount = this.draft()?.maximumGrant;
    return amount === null || amount === undefined ? '' : String(amount.centavos / 100);
  }

  protected save(): void {
    this.attempted.set(true);
    this.refusal.set([]);
    const draft = this.draft();
    if (
      draft === null ||
      this.responsibilityIssues().length > 0 ||
      this.missing().length > 0 ||
      this.submitting()
    ) {
      return;
    }
    this.submitting.set(true);
    this.repository.save(draft, asId<ProgramId>(this.id()), this.reason().trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.editing.set(false);
        this.draft.set(null);
        this.notifications.success(this.copy.saved);
        this.reloads.update((value) => value + 1);
      },
      error: (failure: unknown) => {
        this.submitting.set(false);
        this.refusal.set(refusalSentences(failure, this.copy.failed));
      },
    });
  }

  protected back(): void {
    void this.router.navigate(['/programs']);
  }
}
