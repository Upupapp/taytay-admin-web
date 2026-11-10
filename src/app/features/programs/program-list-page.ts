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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap, tap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import {
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_REPOSITORY,
  PROGRAM_STATUS_CATALOG,
  type AssistanceProgram,
  type CursorPage,
  type ProgramCategory,
  type ProgramFilter,
  type ProgramStatus,
  type ProgramUtilization,
  type ProgramUtilizationSummary,
} from '@domain/index';
import { PROGRAM_COPY } from '@shared/programs/program.copy';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';

import { PROGRAMS_COPY } from './programs.copy';

/** One row: the programme and how much it has been used. */
export interface CatalogRow {
  readonly program: AssistanceProgram;
  readonly utilization: ProgramUtilization | null;
}

/** The first page of the catalogue, and beside it every programme's utilization or why it is not read. */
interface CatalogReading {
  readonly page: CursorPage<AssistanceProgram>;
  readonly usage: ProgramUtilizationSummary;
}

const STATUSES: readonly ProgramStatus[] = ['draft', 'active', 'suspended', 'closed'];
const CATEGORIES = Object.keys(PROGRAM_CATEGORY_LABELS) as readonly ProgramCategory[];
const PAGE_SIZE = 20;

/**
 * The programme catalog.
 *
 * The banner is the screen's real work, on the same argument as the family
 * list: every reader arrives assuming everything the office hands out is the
 * office's to decide, and the table is full of counter-examples (`DL-65`). The
 * "Run by" column is read from each programme's responsibility record, never
 * from a condition in this component.
 *
 * Paged as the office record pages it: one cursor page at a time, by name, with
 * "show more" following the cursor and the count said as "shown, more
 * available" — never "page 1 of N", because the server sends no total
 * (`DL-161`, `DL-176`).
 *
 * Utilization is merged in here rather than fetched per row, so the list makes
 * two calls whatever its length. Where it cannot be read, its two columns go and
 * the sentence saying why stands above the table: a column of dashes would read
 * as "nothing handed over" (`DL-176`).
 */
@Component({
  selector: 'app-program-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, HasPermissionDirective, Icon, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './program-list-page.html',
  styleUrl: './program-list-page.scss',
})
export class ProgramListPage {
  private readonly repository = inject(PROGRAM_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<AssistanceProgram>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap((query) =>
        toViewState(
          combineLatest([
            this.repository.list(query.filter, { limit: PAGE_SIZE, cursor: null }),
            this.repository.utilizationSummary(),
          ]).pipe(map(([page, usage]): CatalogReading => ({ page, usage }))),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CatalogReading> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  private readonly reading = computed(() => valueOf(this.state()) ?? null);
  /** Why utilization was not read, or `null` when it was (or has not arrived yet). */
  protected readonly usageUnavailable = computed(() => {
    const usage = this.reading()?.usage ?? null;
    return usage !== null && usage.kind === 'unavailable' ? usage.because : null;
  });
  protected readonly rows = computed<readonly CatalogRow[]>(() => {
    const reading = this.reading();
    if (reading === null) {
      return [];
    }
    const usage = reading.usage.kind === 'read' ? reading.usage.rows : [];
    const byProgram = new Map(usage.map((entry) => [entry.programId, entry]));
    return [reading.page, ...this.further()]
      .flatMap((page) => page.items)
      .map((program) => ({ program, utilization: byProgram.get(program.id) ?? null }));
  });
  private readonly lastPage = computed(() => this.further().at(-1) ?? this.reading()?.page ?? null);
  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });
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
    ...(this.usageUnavailable() === null ? this.usageColumns() : []),
  ]);

  private usageColumns(): readonly TableColumn<CatalogRow>[] {
    return [
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
      {
        key: 'released',
        header: this.copy.columnReleased,
        align: 'end',
        cell: this.releasedCell(),
      },
    ];
  }

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

  /** Follows the cursor one page further, for the filter the first page was read with. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter: ProgramFilter = this.filter();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list(filter, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The filter changed meanwhile: this page continues a list nobody is looking at.
          if (filter === this.filter()) {
            this.further.update((pages) => [...pages, page]);
          }
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

/* ── The URL is the filter (`DL-36`) ───────────────────────────────────────── */

interface ParamReader {
  get(name: string): string | null;
}

export function readCatalogQuery(params: ParamReader): { readonly filter: ProgramFilter } {
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
  return { filter };
}
