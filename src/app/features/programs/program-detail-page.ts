import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  REQUIREMENT_OBLIGATION_LABELS,
  DEFAULT_REVIEW_WINDOW,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_REPOSITORY,
  PROGRAM_STATUS_CATALOG,
  asId,
  awaitsConfirmation,
  isFromTemplate,
  resolveRequirements,
  reviewWindowFor,
  type AssistanceProgram,
  type EligibilityGuideline,
  type ProgramId,
  type ProgramRequirement,
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
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly copy = PROGRAMS_COPY.detail;
  protected readonly shared = PROGRAM_COPY;
  protected readonly statusCatalog = PROGRAM_STATUS_CATALOG;

  private readonly reloads = signal(0);

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

  protected back(): void {
    void this.router.navigate(['/programs']);
  }
}
