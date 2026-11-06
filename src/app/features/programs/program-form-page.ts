import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  ADMINISTERING_AGENCIES,
  CATALOGUE_REASON_MAX_LENGTH,
  DEFAULT_REVIEW_WINDOW,
  GUIDANCE_CODES,
  GUIDANCE_PROVENANCES,
  GUIDANCE_WEIGHTS,
  isAdoptable,
  isCatalogueReason,
  isNationalAgency,
  LGU_ROLES,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_REPOSITORY,
  PROGRAM_STATUS_CATALOG,
  programProblems,
  VULNERABILITY_SECTOR_LABELS,
  VULNERABILITY_SECTORS,
  WINDOW_PROVENANCES,
  type AdministeringAgency,
  type EligibilityGuideline,
  type LguRole,
  type ProgramCategory,
  type ProgramStatus,
  type RequirementTemplate,
  type ResponsibilitySource,
  type VulnerabilitySector,
  type WindowProvenance,
} from '@domain/index';
import { PROGRAM_COPY } from '@shared/programs/program.copy';
import { ResponsibilityNotice } from '@shared/programs/responsibility-notice';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { PageHeader } from '@shared/ui/page-header/page-header';

import {
  blankGuideline,
  emptyProgramForm,
  readDateInput,
  readProgramForm,
  refusalSentences,
  type ProgramFormValue,
} from './program-form';
import { PROGRAMS_COPY } from './programs.copy';
import {
  applyRequirementEdit,
  RequirementListEditor,
  type RequirementListEdit,
} from './requirement-list-editor';

/** The form fields held as typed text. */
type TextField =
  | 'name'
  | 'description'
  | 'legalBasis'
  | 'fundingSource'
  | 'maximumGrant'
  | 'minAge'
  | 'maxAge'
  | 'incomeCeiling'
  | 'residencyMonths'
  | 'eligibilityNotes'
  | 'lookbackMonths'
  | 'sameProgrammeDays'
  | 'windowBasis'
  | 'windowConfirmedOn';

const CATEGORIES = Object.keys(PROGRAM_CATEGORY_LABELS) as readonly ProgramCategory[];
const STATUSES = Object.keys(PROGRAM_STATUS_CATALOG) as readonly ProgramStatus[];

/**
 * Records a new programme in the office catalog (`DL-177`) — the whole record, not a name to be
 * filled in later: whose programme it is, what the office looks for, what it asks applicants for.
 *
 * The domain's rules are applied **while somebody types**, by the same functions the adapter and
 * the server apply (`programProblems`): a national programme recorded as one the municipality runs
 * is refused here, by the mock and by the API (`DL-65`). The form refuses to send while any rule
 * stands, and says which — never a silent, disabled button.
 *
 * What saving does is said **above** the button (`DL-124`): the version and its reason are kept
 * for good, and a programme is never deleted. The server's own refusal arrives in its own words.
 *
 * Like every catalog screen, it never branches on a particular programme (`DL-66`).
 */
@Component({
  selector: 'app-program-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RequirementListEditor, ResponsibilityNotice, RouterLink],
  templateUrl: './program-form-page.html',
  styleUrl: './program-form-page.scss',
})
export class ProgramFormPage {
  private readonly repository = inject(PROGRAM_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);

  protected readonly copy = PROGRAMS_COPY.form;
  protected readonly detailCopy = PROGRAMS_COPY.detail;
  protected readonly reasonCopy = PROGRAMS_COPY.reason;
  protected readonly shared = PROGRAM_COPY;
  protected readonly reasonMax = CATALOGUE_REASON_MAX_LENGTH;
  protected readonly categories = CATEGORIES;
  protected readonly categoryLabels = PROGRAM_CATEGORY_LABELS;
  protected readonly statuses = STATUSES;
  protected readonly statusCatalog = PROGRAM_STATUS_CATALOG;
  protected readonly agencies = ADMINISTERING_AGENCIES;
  protected readonly roles = LGU_ROLES;
  protected readonly sectors = VULNERABILITY_SECTORS;
  protected readonly sectorLabels = VULNERABILITY_SECTOR_LABELS;
  protected readonly guidanceCodes = GUIDANCE_CODES;
  protected readonly weights = GUIDANCE_WEIGHTS;
  protected readonly provenances = GUIDANCE_PROVENANCES;
  protected readonly windowProvenances = WINDOW_PROVENANCES;

  protected readonly form = signal<ProgramFormValue>(emptyProgramForm());
  protected readonly reason = signal('');
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  /** The server's refusal, sentence by sentence, in its words. */
  protected readonly refusal = signal<readonly string[]>([]);

  /** Every template, so a retired one can be left out by the rule rather than by the server. */
  protected readonly templatesState = toSignal(toViewState(this.repository.listTemplates()), {
    initialValue: LOADING as ViewState<readonly RequirementTemplate[]>,
  });
  protected readonly templatesFailed = computed(() => this.templatesState().kind === 'error');
  /** No new programme adopts a retired template (`DL-177`), so none is offered. */
  protected readonly adoptable = computed(() =>
    (valueOf(this.templatesState()) ?? []).filter(isAdoptable),
  );
  protected readonly chosenTemplate = computed(
    () =>
      this.adoptable().find((template) => template.code === this.form().requirementTemplateCode) ??
      null,
  );

  protected readonly reading = computed(() => readProgramForm(this.form()));
  /** What the domain — and the adapter, and the server — would refuse, shown as it is typed. */
  protected readonly ruleProblems = computed(() => programProblems(this.reading().draft));
  protected readonly wouldMisrepresent = computed(() =>
    this.ruleProblems().some((problem) => problem.code === 'national-programme-claimed-as-owned'),
  );

  /** What the form itself cannot read, and a reason not yet given — said beside the button. */
  protected readonly missing = computed(() => {
    const lines = this.reading().fieldProblems.map(
      (problem) => PROGRAMS_COPY.fieldProblem[problem] ?? problem,
    );
    const reason = this.reason().trim();
    if (reason === '') {
      lines.push(this.reasonCopy.missing);
    } else if (!isCatalogueReason(reason)) {
      lines.push(this.reasonCopy.tooLong);
    }
    return lines;
  });

  protected problemText(code: string): string {
    return PROGRAMS_COPY.problem[code] ?? code;
  }

  /* ── typing ─────────────────────────────────────────────────────────────── */

  private patch(changes: Partial<ProgramFormValue>): void {
    this.form.update((form) => ({ ...form, ...changes }));
  }

  private valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected onText(field: TextField, event: Event): void {
    const value = this.valueOf(event);
    this.form.update((form) => ({ ...form, [field]: value }));
  }

  protected onCategory(event: Event): void {
    this.patch({ category: this.valueOf(event) as ProgramCategory });
  }

  protected onStatus(event: Event): void {
    this.patch({ status: this.valueOf(event) as ProgramStatus });
  }

  protected onSector(sector: VulnerabilitySector, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.form().requiredSectors.filter((entry) => entry !== sector);
    this.patch({ requiredSectors: checked ? [...current, sector] : current });
  }

  protected onAdministeredBy(event: Event): void {
    const administeredBy = this.valueOf(event) as AdministeringAgency;
    this.patch({ responsibility: { ...this.form().responsibility, administeredBy } });
  }

  protected onFundsHeldBy(event: Event): void {
    const fundsHeldBy = this.valueOf(event) as AdministeringAgency;
    this.patch({ responsibility: { ...this.form().responsibility, fundsHeldBy } });
  }

  protected onLguRole(event: Event): void {
    const lguRole = this.valueOf(event) as LguRole;
    this.patch({ responsibility: { ...this.form().responsibility, lguRole } });
  }

  protected onStatement(event: Event): void {
    const statement = this.valueOf(event);
    this.patch({ responsibility: { ...this.form().responsibility, statement } });
  }

  /**
   * "Runs it" is offered only for the municipality's own programme. It stays listed while it is
   * the value held, so the picker never shows a choice the record does not hold — and the
   * refusal beside it says why it cannot be saved (`DL-65`).
   */
  protected roleShown(role: LguRole): boolean {
    const responsibility = this.form().responsibility;
    return (
      !(role === 'owner' && isNationalAgency(responsibility.administeredBy)) ||
      responsibility.lguRole === role
    );
  }

  protected setSource(index: number, changes: Partial<ResponsibilitySource>): void {
    const responsibility = this.form().responsibility;
    this.patch({
      responsibility: {
        ...responsibility,
        sources: responsibility.sources.map((source, at) =>
          at === index ? { ...source, ...changes } : source,
        ),
      },
    });
  }

  protected onSourceText(index: number, field: 'title' | 'url', event: Event): void {
    const value = this.valueOf(event);
    this.setSource(index, field === 'title' ? { title: value } : { url: value });
  }

  protected onSourceVerified(index: number, event: Event): void {
    this.setSource(index, { verifiedOn: readDateInput(this.valueOf(event)) });
  }

  protected addSource(): void {
    const responsibility = this.form().responsibility;
    this.patch({
      responsibility: {
        ...responsibility,
        sources: [...responsibility.sources, { title: '', url: '', verifiedOn: null }],
      },
    });
  }

  protected removeSource(index: number): void {
    const responsibility = this.form().responsibility;
    this.patch({
      responsibility: {
        ...responsibility,
        sources: responsibility.sources.filter((_, at) => at !== index),
      },
    });
  }

  protected setGuideline(index: number, changes: Partial<EligibilityGuideline>): void {
    this.patch({
      guidance: this.form().guidance.map((guideline, at) =>
        at === index ? { ...guideline, ...changes } : guideline,
      ),
    });
  }

  protected onGuidelineCode(index: number, event: Event): void {
    this.setGuideline(index, { code: this.valueOf(event) as EligibilityGuideline['code'] });
  }

  protected onGuidelineWeight(index: number, event: Event): void {
    this.setGuideline(index, { weight: this.valueOf(event) as EligibilityGuideline['weight'] });
  }

  protected onGuidelineProvenance(index: number, event: Event): void {
    this.setGuideline(index, {
      provenance: this.valueOf(event) as EligibilityGuideline['provenance'],
    });
  }

  protected onGuidelineText(index: number, field: 'statement' | 'basis', event: Event): void {
    const value = this.valueOf(event);
    this.setGuideline(index, field === 'statement' ? { statement: value } : { basis: value });
  }

  protected onGuidelineSource(index: number, event: Event): void {
    this.setGuideline(index, { sourceUrl: this.valueOf(event) });
  }

  protected onGuidelineVerified(index: number, event: Event): void {
    this.setGuideline(index, { verifiedOn: readDateInput(this.valueOf(event)) });
  }

  protected addGuideline(): void {
    this.patch({ guidance: [...this.form().guidance, blankGuideline()] });
  }

  protected removeGuideline(index: number): void {
    this.patch({ guidance: this.form().guidance.filter((_, at) => at !== index) });
  }

  protected onTemplate(event: Event): void {
    const code = this.valueOf(event);
    this.patch({ requirementTemplateCode: code === '' ? null : code });
  }

  protected onRequirementEdit(edit: RequirementListEdit): void {
    this.form.update((form) => ({
      ...form,
      requirements: applyRequirementEdit(form.requirements, edit),
    }));
  }

  protected onOwnWindow(event: Event): void {
    const ownWindow = (event.target as HTMLInputElement).checked;
    const form = this.form();
    // Started from the office default, said to be unconfirmed until somebody records otherwise.
    this.patch({
      ownWindow,
      lookbackMonths: form.lookbackMonths || String(DEFAULT_REVIEW_WINDOW.lookbackMonths),
      sameProgrammeDays: form.sameProgrammeDays || String(DEFAULT_REVIEW_WINDOW.sameProgrammeDays),
    });
  }

  protected onWindowProvenance(event: Event): void {
    this.patch({ windowProvenance: this.valueOf(event) as WindowProvenance });
  }

  protected onReason(event: Event): void {
    this.reason.set(this.valueOf(event));
  }

  /* ── recording ──────────────────────────────────────────────────────────── */

  protected submit(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    this.refusal.set([]);
    if (this.ruleProblems().length > 0 || this.missing().length > 0 || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.repository.save(this.reading().draft, null, this.reason().trim()).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.notifications.success(this.copy.saved);
        void this.router.navigate(['/programs', created.id]);
      },
      error: (failure: unknown) => {
        this.saving.set(false);
        this.refusal.set(refusalSentences(failure, this.copy.failed));
      },
    });
  }
}
