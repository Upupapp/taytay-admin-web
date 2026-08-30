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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';

import {
  DEFAULT_PAGE_SIZE,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_REPOSITORY,
  PROGRAM_STATUS_CATALOG,
  emptyPage,
  type AssistanceProgram,
  type Page,
  type ProgramCategory,
  type ProgramFilter,
  type ProgramStatus,
  type ProgramUtilization,
} from '@domain/index';
import { PROGRAM_COPY } from '@shared/programs/program.copy';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { PROGRAMS_COPY } from './programs.copy';

/** One row: the programme and how much it has been used. */
export interface CatalogRow {
  readonly program: AssistanceProgram;
  readonly utilization: ProgramUtilization | null;
}

const STATUSES: readonly ProgramStatus[] = ['draft', 'active', 'suspended', 'closed'];
const CATEGORIES = Object.keys(PROGRAM_CATEGORY_LABELS) as readonly ProgramCategory[];

/**
 * The programme catalog.
 *
 * The banner is the screen's real work, on the same argument as the family
 * list: every reader arrives assuming everything the office hands out is the
 * office's to decide, and the table is full of counter-examples (`DL-65`). The
 * "Run by" column is read from each programme's responsibility record, never
 * from a condition in this component.
 *
 * Utilization is merged in here rather than fetched per row, so the list makes
 * two calls whatever its length.
 */
@Component({
  selector: 'app-program-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './program-list-page.html',
  styleUrl: './program-list-page.scss',
})
export class ProgramListPage {
  private readonly repository = inject(PROGRAM_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = PROGRAMS_COPY.list;
  protected readonly shared = PROGRAM_COPY;
  protected readonly statusCatalog = PROGRAM_STATUS_CATALOG;
  protected readonly statuses = STATUSES;
  protected readonly categories = CATEGORIES;

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: CatalogRow }>>('nameCell');
  private readonly runCell = viewChild.required<TemplateRef<{ $implicit: CatalogRow }>>('runCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: CatalogRow }>>('statusCell');
  private readonly releasedCell =
    viewChild.required<TemplateRef<{ $implicit: CatalogRow }>>('releasedCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readCatalogQuery(params))),
    { initialValue: readCatalogQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) =>
        toViewState(
          combineLatest([
            this.repository.list(query.filter, { page: query.page, pageSize: DEFAULT_PAGE_SIZE }),
            this.repository.utilizationSummary(),
          ]).pipe(map(([page, usage]) => merge(page, usage))),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<Page<CatalogRow>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<CatalogRow>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly hasFilters = computed(
    () =>
      (this.filter().search ?? '').length > 0 ||
      this.filter().category !== undefined ||
      this.filter().status !== undefined,
  );

  protected readonly rowKey = (row: CatalogRow): string => row.program.id;

  protected readonly columns = computed<readonly TableColumn<CatalogRow>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    { key: 'run', header: this.copy.columnRun, cell: this.runCell() },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      /*
       * Releases, not requests filed. The office record reports what a programme delivered and
       * carries no count of what was asked of it (`DL-159`) — and a withheld cell prints the em
       * dash rather than a zero, because "too few to report" is not "none" (`DL-105`).
       */
      key: 'releases',
      header: this.copy.columnUsage,
      align: 'end',
      width: '90px',
      value: (row) =>
        row.utilization === null || row.utilization.releaseCount === null
          ? '—'
          : String(row.utilization.releaseCount),
    },
    { key: 'released', header: this.copy.columnReleased, align: 'end', cell: this.releasedCell() },
  ]);

  protected detailLink(row: CatalogRow): string {
    return `/programs/${row.program.id}`;
  }

  /** Read from the record. A national programme says so wherever it appears. */
  protected runByLabel(row: CatalogRow): string {
    return PROGRAM_COPY.agencyLabel[row.program.responsibility.administeredBy];
  }

  protected roleLabel(row: CatalogRow): string {
    return PROGRAM_COPY.roleLabel[row.program.responsibility.lguRole];
  }

  protected categoryLabel(category: ProgramCategory): string {
    return PROGRAM_CATEGORY_LABELS[category];
  }

  /* ── filters are navigations ────────────────────────────────────────────── */

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    this.patch({ q: value.trim() || null });
  }

  protected onCategory(event: Event): void {
    this.patch({ category: (event.target as HTMLSelectElement).value || null });
  }

  protected onStatus(event: Event): void {
    this.patch({ status: (event.target as HTMLSelectElement).value || null });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected onPageChanged(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? String(page) : null },
      queryParamsHandling: 'merge',
    });
  }

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...changes, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function merge(
  page: Page<AssistanceProgram>,
  usage: readonly ProgramUtilization[],
): Page<CatalogRow> {
  const byProgram = new Map(usage.map((entry) => [entry.programId, entry]));
  return {
    ...page,
    items: page.items.map((program) => ({
      program,
      utilization: byProgram.get(program.id) ?? null,
    })),
  };
}

/* ── The URL is the filter (`DL-36`) ───────────────────────────────────────── */

interface ParamReader {
  get(name: string): string | null;
}

export function readCatalogQuery(params: ParamReader): {
  readonly filter: ProgramFilter;
  readonly page: number;
} {
  const filter: { search?: string; category?: ProgramCategory; status?: ProgramStatus } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }
  const category = params.get('category');
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    filter.category = category as ProgramCategory;
  }
  const status = params.get('status');
  if (status && (STATUSES as readonly string[]).includes(status)) {
    filter.status = status as ProgramStatus;
  }

  const page = Number.parseInt(params.get('page') ?? '', 10);
  return { filter, page: Number.isInteger(page) && page > 0 ? page : 1 };
}
