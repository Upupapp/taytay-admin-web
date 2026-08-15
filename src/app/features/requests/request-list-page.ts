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
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';

import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  DEFAULT_PAGE_SIZE,
  emptyPage,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestSortField,
  type AssistanceRequestStatus,
  type Page,
  type PageRequest,
  type SortDirection,
  type SortSpec,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { REQUESTS_COPY } from './requests.copy';

const SEARCH_DEBOUNCE_MS = 250;

const STATUSES: readonly AssistanceRequestStatus[] = [
  'draft',
  'submitted',
  'intake-review',
  'returned',
  'assessment',
  'endorsed',
  'approved',
  'rejected',
  'scheduled',
  'released',
  'completed',
  'cancelled',
  'expired',
];

/**
 * The request list, with unfinished intakes held apart from it.
 *
 * A draft is not a request, and the screen says so: it has no control number,
 * nobody is waiting on an answer, and it sits in its own section above the
 * table rather than as another row in the office's workload. Mixing the two
 * would inflate every count the office reports (`DL-63`).
 */
@Component({
  selector: 'app-request-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './request-list-page.html',
  styleUrl: './request-list-page.scss',
})
export class RequestListPage {
  private readonly repository = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = REQUESTS_COPY.list;
  protected readonly statusCatalog = ASSISTANCE_STATUS_CATALOG;
  protected readonly statuses = STATUSES;

  private readonly referenceCell =
    viewChild.required<TemplateRef<{ $implicit: AssistanceRequest }>>('referenceCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: AssistanceRequest }>>('statusCell');
  private readonly amountCell =
    viewChild.required<TemplateRef<{ $implicit: AssistanceRequest }>>('amountCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readRequestQuery(params))),
    { initialValue: readRequestQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<AssistanceRequest>> },
  );

  /** Unfinished intakes, read as their own question rather than filtered out of the table. */
  protected readonly drafts = toSignal(
    toObservable(this.query).pipe(
      switchMap(() =>
        this.repository.list(
          { status: 'draft' },
          { page: 1, pageSize: 50, sort: { field: 'updatedAt', direction: 'desc' } },
        ),
      ),
      map((page) => page.items),
    ),
    { initialValue: [] as readonly AssistanceRequest[] },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<AssistanceRequest>());
  /** Drafts are shown above; repeating them in the table would double-count them. */
  protected readonly rows = computed(() =>
    this.page().items.filter((request) => request.status !== 'draft'),
  );
  protected readonly filter = computed(() => this.query().filter);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(
    () =>
      (this.filter().search ?? '').length > 0 ||
      this.filter().status !== undefined ||
      this.filter().openOnly === true,
  );

  protected readonly rowKey = (request: AssistanceRequest): string => request.id;

  protected readonly columns = computed<readonly TableColumn<AssistanceRequest>[]>(() => [
    {
      key: 'reference',
      header: this.copy.columnReference,
      sortField: 'referenceNumber',
      cell: this.referenceCell(),
    },
    {
      key: 'status',
      header: this.copy.columnStatus,
      sortField: 'status',
      cell: this.statusCell(),
    },
    {
      key: 'reason',
      header: this.copy.columnProgramme,
      value: (request) => request.reasonForRequest,
    },
    {
      key: 'requested',
      header: this.copy.columnRequested,
      align: 'end',
      cell: this.amountCell(),
    },
  ]);

  protected detailLink(request: AssistanceRequest): string {
    return `/assistance-requests/${request.id}`;
  }

  protected resumeLink(request: AssistanceRequest): string {
    return `/assistance-requests/${request.id}/edit`;
  }

  /* ── filter changes are navigations ─────────────────────────────────────── */

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
    });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(
      () => this.patch({ q: value.trim() || null }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  protected onStatus(event: Event): void {
    this.patch({ status: (event.target as HTMLSelectElement).value || null });
  }

  protected onOpenOnly(event: Event): void {
    this.patch({ open: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected onSortChanged(sort: SortSpec): void {
    this.patch({ sort: sort.field, direction: sort.direction });
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

/* ── The URL is the filter (`DL-36`) ───────────────────────────────────────── */

interface ParamReader {
  get(name: string): string | null;
}

const SORT_FIELDS: readonly AssistanceRequestSortField[] = [
  'referenceNumber',
  'status',
  'submittedAt',
  'updatedAt',
];

export function readRequestQuery(params: ParamReader): {
  readonly filter: AssistanceRequestFilter;
  readonly page: PageRequest<AssistanceRequestSortField>;
} {
  const filter: { search?: string; status?: AssistanceRequestStatus; openOnly?: boolean } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }
  const status = params.get('status');
  if (status && (STATUSES as readonly string[]).includes(status)) {
    filter.status = status as AssistanceRequestStatus;
  }
  if (params.get('open') === 'true') {
    filter.openOnly = true;
  }

  const pageNumber = Number.parseInt(params.get('page') ?? '', 10);
  const sortParam = params.get('sort');
  const field: AssistanceRequestSortField =
    sortParam && (SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as AssistanceRequestSortField)
      : 'submittedAt';
  const direction: SortDirection = params.get('direction') === 'asc' ? 'asc' : 'desc';

  return {
    filter,
    page: {
      page: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: { field, direction },
    },
  };
}
