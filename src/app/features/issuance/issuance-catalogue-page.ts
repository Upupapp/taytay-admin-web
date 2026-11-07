import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import {
  catalogueReasonProblem,
  describeProcessingStandard,
  ISSUANCE_BOUNDARIES,
  ISSUANCE_REPOSITORY,
  ISSUANCE_TYPE_LIMITS,
  OFFICE_REPOSITORY,
  RETIRE_EFFECTS,
  type IssuanceType,
} from '@domain/index';
import { officeDirectory } from '@shared/offices/office-directory';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { IssuanceTypeEditor } from './issuance-type-editor';
import { ISSUANCE_COPY } from './issuance.copy';

/** What the drawer holds: a new type, or the one being changed. */
type Editing = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly type: IssuanceType };

/**
 * The office's catalogue of documents it issues to residents (`DL-184`).
 *
 * Every type the office keeps, retired ones included, read whole — the server answers it in one
 * list, and an office keeps at most fifty active. Adding and changing happen in a drawer beside the
 * list; each takes a reason the server keeps with the change.
 *
 * **Retiring is one-way**, so it is the one act behind a confirmation, and the confirmation says
 * what it does — residents can no longer choose it, filed requests continue, nothing brings it back
 * — **before** the button, with a reason that is kept. A retired type is listed, never hidden: an
 * office that cannot see what it retired re-adds it under a slightly different name.
 */
@Component({
  selector: 'app-issuance-catalogue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DataTable,
    DatePipe,
    Drawer,
    IssuanceTypeEditor,
    Modal,
    PageHeader,
    PesoPipe,
    RouterLink,
  ],
  templateUrl: './issuance-catalogue-page.html',
  styleUrl: './issuance-catalogue-page.scss',
})
export class IssuanceCataloguePage {
  private readonly repository = inject(ISSUANCE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = ISSUANCE_COPY.catalogue;
  protected readonly boundaries = ISSUANCE_BOUNDARIES;
  protected readonly retireEffects = RETIRE_EFFECTS;
  protected readonly reasonLimit = ISSUANCE_TYPE_LIMITS.reason.maximum;

  /** For an administrator's choice of office; staff add for their own without it. */
  protected readonly directory = officeDirectory(inject(OFFICE_REPOSITORY).list());

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: IssuanceType }>>('nameCell');
  private readonly feeCell =
    viewChild.required<TemplateRef<{ $implicit: IssuanceType }>>('feeCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: IssuanceType }>>('statusCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: IssuanceType }>>('actionCell');

  /** Bumped to read the catalogue again — after every act, and on "Try again". */
  private readonly generation = signal(0);

  protected readonly types = toSignal(
    toObservable(this.generation).pipe(switchMap(() => toViewState(this.repository.officeTypes()))),
    { initialValue: LOADING as ViewState<readonly IssuanceType[]> },
  );

  protected readonly rows = computed(() => valueOf(this.types()) ?? []);
  protected readonly rowKey = (type: IssuanceType): string => type.id;

  protected readonly columns = computed<readonly TableColumn<IssuanceType>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    { key: 'office', header: this.copy.columnOffice, value: (type) => type.office.name },
    { key: 'fee', header: this.copy.columnFee, cell: this.feeCell() },
    {
      key: 'standard',
      header: this.copy.columnStandard,
      value: (type) => describeProcessingStandard(type.processingDays),
    },
    {
      key: 'requirements',
      header: this.copy.columnRequirements,
      value: (type) => this.copy.requirementCount(type.requirements.length),
    },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      key: 'act',
      header: this.copy.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<Editing | null>(null);
  protected readonly editingType = computed(() => {
    const editing = this.editing();
    return editing?.kind === 'edit' ? editing.type : null;
  });
  protected readonly drawerHeading = computed(() => {
    const type = this.editingType();
    return type === null ? this.copy.drawerNew : this.copy.drawerEdit(type.name);
  });

  protected readonly retiring = signal<IssuanceType | null>(null);
  protected readonly retireReason = signal('');
  protected readonly retireBusy = signal(false);
  protected readonly retireProblem = signal('');
  protected readonly retireReasonOk = computed(
    () => catalogueReasonProblem(this.retireReason()) === null,
  );

  /** The live region's text: what the last act did. */
  protected readonly outcome = signal('');

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected add(): void {
    this.outcome.set('');
    this.editing.set({ kind: 'new' });
  }

  protected edit(type: IssuanceType): void {
    this.outcome.set('');
    this.editing.set({ kind: 'edit', type });
  }

  protected closeEditor(): void {
    this.editing.set(null);
  }

  protected onSaved(type: IssuanceType): void {
    this.editing.set(null);
    this.outcome.set(`${type.name}: ${this.copy.saved}`);
    this.reload();
  }

  protected askToRetire(type: IssuanceType): void {
    this.outcome.set('');
    this.retireReason.set('');
    this.retireProblem.set('');
    this.retiring.set(type);
  }

  protected cancelRetire(): void {
    this.retiring.set(null);
  }

  protected onRetireReason(event: Event): void {
    this.retireReason.set(event.target instanceof HTMLTextAreaElement ? event.target.value : '');
  }

  protected confirmRetire(): void {
    const type = this.retiring();
    if (type === null || !this.retireReasonOk() || this.retireBusy()) {
      return;
    }
    this.retireBusy.set(true);
    this.retireProblem.set('');
    this.repository
      .retireType(type.id, this.retireReason())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (retired) => {
          this.retireBusy.set(false);
          this.retiring.set(null);
          this.outcome.set(this.copy.retiredOutcome(retired.name));
          this.reload();
        },
        error: (failure: unknown) => {
          this.retireBusy.set(false);
          this.retireProblem.set(this.copy.notSaved(failureReason(failure) ?? this.copy.failed));
        },
      });
  }
}
