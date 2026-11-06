import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap, type Observable } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  CATALOGUE_CODE_PATTERN,
  CATALOGUE_REASON_MAX_LENGTH,
  isAdoptable,
  isCatalogueReason,
  PROGRAM_REPOSITORY,
  REQUIREMENT_TEMPLATE_STATUS_CATALOG,
  TEMPLATE_DESCRIPTION_MAX_LENGTH,
  TEMPLATE_DOCUMENTS_MAX,
  TEMPLATE_NAME_MAX_LENGTH,
  TEMPLATE_NAME_MIN_LENGTH,
  templateProblems,
  toTemplateDraft,
  type RequirementTemplate,
  type RequirementTemplateDraft,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { refusalSentences } from './program-form';
import { PROGRAMS_COPY } from './programs.copy';
import {
  applyRequirementEdit,
  RequirementListEditor,
  type RequirementListEdit,
} from './requirement-list-editor';

/** What the editor beside the list is doing, if anything. */
type EditorMode =
  | { readonly kind: 'closed' }
  | { readonly kind: 'create' }
  | { readonly kind: 'change'; readonly template: RequirementTemplate }
  | { readonly kind: 'retire'; readonly template: RequirementTemplate };

const CLOSED: EditorMode = { kind: 'closed' };

function emptyTemplateDraft(): RequirementTemplateDraft {
  return { code: '', name: '', description: '', requirements: [] };
}

/**
 * The office's requirement templates: every one, retired ones included, with what each reaches
 * (`DL-67`, `DL-177`).
 *
 * A template is what several programmes ask applicants for, so every act on one says **what it
 * reaches before it is done** (`DL-124`): a change reaches the programmes that name the template
 * from that moment — the count is the server's, read with the list, never a tally kept here — and
 * retiring is one way, adopted by nobody new while those already naming it keep asking for its
 * documents. Every act asks why, and the button does nothing until somebody has said.
 *
 * A retired template stays listed: programmes may still name it, and a list without it would read
 * as though they asked for nothing.
 */
@Component({
  selector: 'app-requirement-templates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, DatePipe, PageHeader, RequirementListEditor, RouterLink, StatusBadge],
  templateUrl: './requirement-templates-page.html',
  // The form's layout is the new-programme form's; the list's own few classes are beside it.
  styleUrls: ['./program-form-page.scss', './requirement-templates-page.scss'],
})
export class RequirementTemplatesPage {
  private readonly repository = inject(PROGRAM_REPOSITORY);
  private readonly notifications = inject(NotificationStore);

  protected readonly copy = PROGRAMS_COPY.templates;
  protected readonly reasonCopy = PROGRAMS_COPY.reason;
  protected readonly detailCopy = PROGRAMS_COPY.detail;
  protected readonly statusCatalog = REQUIREMENT_TEMPLATE_STATUS_CATALOG;
  protected readonly reasonMax = CATALOGUE_REASON_MAX_LENGTH;

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: RequirementTemplate }>>('nameCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: RequirementTemplate }>>('statusCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: RequirementTemplate }>>('actionsCell');

  private readonly reloads = signal(0);
  protected readonly state = toSignal(
    toObservable(this.reloads).pipe(switchMap(() => toViewState(this.repository.listTemplates()))),
    { initialValue: LOADING as ViewState<readonly RequirementTemplate[]> },
  );
  protected readonly templates = computed(() => valueOf(this.state()) ?? []);
  protected readonly loadFailed = computed(() => this.state().kind === 'error');

  protected readonly rowKey = (template: RequirementTemplate): string => template.code;
  protected readonly columns = computed<readonly TableColumn<RequirementTemplate>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      key: 'documents',
      header: this.copy.columnDocuments,
      align: 'end',
      value: (template) => String(template.requirements.length),
    },
    {
      key: 'programmes',
      header: this.copy.columnProgrammes,
      value: (template) => this.copy.programmes(template.programCount),
    },
    { key: 'actions', header: this.copy.columnActions, cell: this.actionsCell() },
  ]);

  /* ── the editor ─────────────────────────────────────────────────────────── */

  protected readonly mode = signal<EditorMode>(CLOSED);
  protected readonly draft = signal<RequirementTemplateDraft>(emptyTemplateDraft());
  protected readonly reason = signal('');
  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  protected readonly refusal = signal<readonly string[]>([]);

  /** The template being changed or retired, or `null` while recording a new one. */
  protected readonly subject = computed(() => {
    const mode = this.mode();
    return mode.kind === 'change' || mode.kind === 'retire' ? mode.template : null;
  });

  /** What the server refuses in the documents, shown while they are written. */
  protected readonly documentProblems = computed(() => {
    const mode = this.mode().kind;
    return mode === 'create' || mode === 'change' ? templateProblems(this.draft()) : [];
  });

  /** What the form cannot send, and a reason not yet given — said beside the button. */
  protected readonly missing = computed(() => {
    const kind = this.mode().kind;
    const lines: string[] = [];
    if (kind === 'create' || kind === 'change') {
      const draft = this.draft();
      if (kind === 'create' && !CATALOGUE_CODE_PATTERN.test(draft.code.trim())) {
        lines.push(this.copy.codeProblem);
      }
      const name = draft.name.trim().length;
      if (name < TEMPLATE_NAME_MIN_LENGTH || name > TEMPLATE_NAME_MAX_LENGTH) {
        lines.push(this.copy.nameProblem);
      }
      if (draft.description.trim().length > TEMPLATE_DESCRIPTION_MAX_LENGTH) {
        lines.push(this.copy.descriptionProblem);
      }
      if (draft.requirements.length > TEMPLATE_DOCUMENTS_MAX) {
        lines.push(this.copy.tooManyProblem);
      }
      if (draft.requirements.some((entry) => !CATALOGUE_CODE_PATTERN.test(entry.code.trim()))) {
        lines.push(this.copy.documentCodeProblem);
      }
    }
    const reason = this.reason().trim();
    if (reason === '') {
      lines.push(this.reasonCopy.missing);
    } else if (!isCatalogueReason(reason)) {
      lines.push(this.reasonCopy.tooLong);
    }
    return lines;
  });

  protected isActive(template: RequirementTemplate): boolean {
    return isAdoptable(template);
  }

  protected problemText(code: string): string {
    return PROGRAMS_COPY.problem[code] ?? code;
  }

  protected startCreating(): void {
    this.open({ kind: 'create' }, emptyTemplateDraft());
  }

  protected startChanging(template: RequirementTemplate): void {
    this.open({ kind: 'change', template }, toTemplateDraft(template));
  }

  protected startRetiring(template: RequirementTemplate): void {
    this.open({ kind: 'retire', template }, toTemplateDraft(template));
  }

  protected close(): void {
    this.mode.set(CLOSED);
  }

  private open(mode: EditorMode, draft: RequirementTemplateDraft): void {
    this.mode.set(mode);
    this.draft.set(draft);
    this.reason.set('');
    this.attempted.set(false);
    this.refusal.set([]);
  }

  private valueOf(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected onCode(event: Event): void {
    // Read only when recording: a template's code never changes afterwards.
    if (this.mode().kind !== 'create') {
      return;
    }
    const code = this.valueOf(event);
    this.draft.update((draft) => ({ ...draft, code }));
  }

  protected onName(event: Event): void {
    const name = this.valueOf(event);
    this.draft.update((draft) => ({ ...draft, name }));
  }

  protected onDescription(event: Event): void {
    const description = this.valueOf(event);
    this.draft.update((draft) => ({ ...draft, description }));
  }

  protected onRequirementEdit(edit: RequirementListEdit): void {
    // Circumstances belong to a conditional document only; the editor clears them on a change of
    // obligation, and the blank ones are sent as none.
    this.draft.update((draft) => ({
      ...draft,
      requirements: applyRequirementEdit(draft.requirements, edit),
    }));
  }

  protected onReason(event: Event): void {
    this.reason.set(this.valueOf(event));
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    this.refusal.set([]);
    const mode = this.mode();
    if (
      mode.kind === 'closed' ||
      this.documentProblems().length > 0 ||
      this.missing().length > 0 ||
      this.saving()
    ) {
      return;
    }
    const { act, done } = this.actFor(mode, this.reason().trim());
    this.saving.set(true);
    act.subscribe({
      next: () => {
        this.saving.set(false);
        this.mode.set(CLOSED);
        this.notifications.success(done);
        this.reloads.update((value) => value + 1);
      },
      error: (failure: unknown) => {
        this.saving.set(false);
        this.refusal.set(refusalSentences(failure, this.copy.failed));
      },
    });
  }

  private actFor(
    mode: Exclude<EditorMode, { readonly kind: 'closed' }>,
    reason: string,
  ): { readonly act: Observable<RequirementTemplate>; readonly done: string } {
    switch (mode.kind) {
      case 'create':
        return {
          act: this.repository.saveTemplate(this.composed(), null, reason),
          done: this.copy.created,
        };
      case 'change':
        return {
          act: this.repository.saveTemplate(this.composed(), mode.template.code, reason),
          done: this.copy.changed,
        };
      case 'retire':
        return {
          act: this.repository.retireTemplate(mode.template.code, reason),
          done: this.copy.retired,
        };
    }
  }

  /** The draft as it is sent: trimmed, and circumstances only where a document is conditional. */
  private composed(): RequirementTemplateDraft {
    const draft = this.draft();
    return {
      code: draft.code.trim(),
      name: draft.name.trim(),
      description: draft.description.trim(),
      requirements: draft.requirements.map((requirement) => {
        const appliesWhen = (requirement.appliesWhen ?? '').trim();
        const notes = (requirement.notes ?? '').trim();
        return {
          code: requirement.code.trim(),
          label: requirement.label.trim(),
          obligation: requirement.obligation,
          appliesWhen:
            requirement.obligation === 'conditional' && appliesWhen !== '' ? appliesWhen : null,
          notes: notes === '' ? null : notes,
        };
      }),
    };
  }
}
