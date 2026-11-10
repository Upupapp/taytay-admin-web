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
import { map, of, switchMap, tap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { PermissionService } from '@core/access/permission.service';
import {
  ASSISTANCE_REQUEST_REPOSITORY,
  ASSISTANCE_STATUS_CATALOG,
  asId,
  isWithheldFromReader,
  PROGRAM_CATEGORY_LABELS,
  TAYTAY_BARANGAYS,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestStatus,
  type BarangayId,
  type CursorPage,
  type ProgramCategory,
  type SocialWorker,
  type StaffUserId,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, ready, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';

import { REQUESTS_COPY } from './requests.copy';

/**
 * The statuses a filed request can be filtered by. `draft` is not among them: drafts are read as
 * their own question above the table, and the table holds filed requests only (`DL-63`).
 */
const STATUSES: readonly AssistanceRequestStatus[] = [
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

/** Every programme type, as the dashboard counts them. */
const PROGRAM_CATEGORIES = Object.keys(PROGRAM_CATEGORY_LABELS) as readonly ProgramCategory[];

const PAGE_SIZE = 20;
/** The most drafts read at once — the API's largest page. More is said in words, never hidden. */
const DRAFT_LIMIT = 50;

/**
 * The request list, with unfinished intakes held apart from it.
 *
 * A draft is not a request, and the screen says so: it has no control number,
 * nobody is waiting on an answer, and it sits in its own section above the
 * table rather than as another row in the office's workload. Mixing the two
 * would inflate every count the office reports (`DL-63`). The two are two
 * reads, because the office record lists them apart: drafts only when asked
 * for, filed requests otherwise (`DL-177`).
 *
 * Paged as the office record pages it: one cursor page at a time, newest filing
 * first, with "show more" following the cursor and the count said as "shown,
 * more available" — never "page 1 of N", because the server sends no total
 * (`DL-161`). The URL holds the filter and nothing else (`DL-36`).
 */
@Component({
  selector: 'app-request-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, HasPermissionDirective, Icon, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './request-list-page.html',
  styleUrl: './request-list-page.scss',
})
export class RequestListPage {
  private readonly repository = inject(ASSISTANCE_REQUEST_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionService);

  /**
   * A caseload (`assigned-cases`) reads the requests assigned to it and nothing else, whatever it
   * asks for (`DL-178`): its list is its caseload, and the office's unfinished intakes are not part
   * of it, so they are not asked for.
   */
  protected readonly isCaseload = computed(() => this.permissions.scope() === 'assigned-cases');

  /**
   * Narrowing by assignee reads the office's list of social workers, which is the assigners' — a
   * holder of `request.assess` who is not a caseload, such as the head reading a worker's caseload.
   */
  protected readonly filtersByAssignee = computed(
    () => this.permissions.has('request.assess') && !this.isCaseload(),
  );

  private readonly workerState = toSignal(
    toObservable(this.filtersByAssignee).pipe(
      switchMap((reads) =>
        reads
          ? toViewState(this.repository.listSocialWorkers())
          : of(ready([] as readonly SocialWorker[])),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly SocialWorker[]> },
  );

  protected readonly socialWorkers = computed(() => valueOf(this.workerState()) ?? []);
  protected readonly workersFailure = computed(() => {
    const state = this.workerState();
    return state.kind === 'error' ? state.message : null;
  });

  /**
   * Narrowing by barangay is offered only to an office-wide reader. An own-barangay reader's list is
   * already its barangay and any other is refused (403); a caseload reads its assignments whatever is
   * asked. Neither is offered a filter it cannot use (`CLAUDE.md` §5, data scope). A barangay in the
   * URL — a dashboard row — is still read, and the server decides.
   */
  protected readonly filtersByBarangay = computed(
    () => this.permissions.scope() === 'all-barangays',
  );
  protected readonly barangays = TAYTAY_BARANGAYS;
  /** Programme types narrow every reader's list alike: they are not a matter of data scope. */
  protected readonly categories = PROGRAM_CATEGORIES;
  protected readonly categoryLabels = PROGRAM_CATEGORY_LABELS;

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

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<AssistanceRequest>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  /** Bumped by "Try again" to read the same filter again from its first page. */
  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ query: this.query(), generation: this.generation() }))).pipe(
      tap(({ query }) => {
        this.searchText.set(query.filter.search ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(({ query }) =>
        toViewState(this.repository.list(query.filter, { limit: PAGE_SIZE, cursor: null })),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AssistanceRequest>> },
  );

  /**
   * Unfinished intakes, read as their own question rather than filtered out of the table. Held as
   * a view state, so a refusal is said where the drafts would be rather than breaking the screen.
   */
  protected readonly draftState = toSignal(
    toObservable(computed(() => ({ generation: this.generation(), caseload: this.isCaseload() }))).pipe(
      switchMap(({ caseload }) =>
        caseload
          ? of(ready<CursorPage<AssistanceRequest>>({ items: [], hasMore: false, nextCursor: null }))
          : toViewState(
              this.repository.list({ status: 'draft' }, { limit: DRAFT_LIMIT, cursor: null }),
            ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AssistanceRequest>> },
  );

  protected readonly drafts = computed(() => valueOf(this.draftState())?.items ?? []);
  protected readonly moreDrafts = computed(() => valueOf(this.draftState())?.hasMore === true);
  protected readonly draftFailure = computed(() => {
    const state = this.draftState();
    return state.kind === 'error' ? state.message : null;
  });

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });
  protected readonly rows = computed<readonly AssistanceRequest[]>(() => [
    ...(valueOf(this.state())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);
  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.state()) ?? null,
  );
  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });
  protected readonly filter = computed(() => this.query().filter);
  protected readonly hasFilters = computed(
    () =>
      (this.filter().search ?? '').length > 0 ||
      this.filter().status !== undefined ||
      this.filter().barangayId !== undefined ||
      this.filter().assignedTo !== undefined ||
      this.filter().openOnly === true ||
      this.filter().category !== undefined ||
      this.filter().owingDocument === true,
  );

  protected readonly rowKey = (request: AssistanceRequest): string => request.id;

  protected readonly columns = computed<readonly TableColumn<AssistanceRequest>[]>(() => [
    { key: 'reference', header: this.copy.columnReference, cell: this.referenceCell() },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      key: 'reason',
      header: this.copy.columnReason,
      value: (request) => this.reasonText(request),
    },
    {
      key: 'requested',
      header: this.copy.columnRequested,
      align: 'end',
      cell: this.amountCell(),
    },
  ]);

  /** Withheld says withheld; a blank would read as "no reason given" (`DL-38`). */
  protected reasonText(request: AssistanceRequest): string {
    if (isWithheldFromReader(request, 'reasonForRequest')) {
      return this.copy.withheld;
    }
    return request.reasonForRequest === '' ? this.copy.notGiven : request.reasonForRequest;
  }

  protected detailLink(request: AssistanceRequest): string {
    return `/assistance-requests/${request.id}`;
  }

  protected resumeLink(request: AssistanceRequest): string {
    return `/assistance-requests/${request.id}/edit`;
  }

  /* ── filter changes are navigations ─────────────────────────────────────── */

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
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

  protected onBarangay(event: Event): void {
    this.patch({ barangay: (event.target as HTMLSelectElement).value || null });
  }

  protected onAssignee(event: Event): void {
    this.patch({ assigned: (event.target as HTMLSelectElement).value || null });
  }

  protected onOpenOnly(event: Event): void {
    this.patch({ open: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected onCategory(event: Event): void {
    this.patch({ category: (event.target as HTMLSelectElement).value || null });
  }

  protected onOwing(event: Event): void {
    this.patch({
      missingRequirements: (event.target as HTMLInputElement).checked ? 'true' : null,
    });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  /** Follows the cursor one page further, for the filter the first page was read with. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter: AssistanceRequestFilter = this.filter();
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

/**
 * The filter, and nothing else: the server orders the list and pages it by cursor. A dashboard
 * figure's narrowings — programme type and "still owing a document" (`missingRequirements`) — are
 * applied like any other since the API reads them (`DL-186`), so the list holds exactly what the
 * figure counted.
 */
export function readRequestQuery(params: ParamReader): {
  readonly filter: AssistanceRequestFilter;
} {
  const filter: {
    search?: string;
    status?: AssistanceRequestStatus;
    barangayId?: BarangayId;
    assignedTo?: StaffUserId;
    openOnly?: boolean;
    category?: ProgramCategory;
    owingDocument?: boolean;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }
  const status = params.get('status');
  if (status && (STATUSES as readonly string[]).includes(status)) {
    filter.status = status as AssistanceRequestStatus;
  }
  const assigned = params.get('assigned')?.trim();
  if (assigned) {
    // A social worker's id, as the list of social workers gave it; the server refuses one it does
    // not know, and a caseload's list is its own whatever is sent (`DL-178`).
    filter.assignedTo = asId<StaffUserId>(assigned);
  }
  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((entry) => entry.id === barangay)) {
    filter.barangayId = asId<BarangayId>(barangay);
  }
  if (params.get('open') === 'true') {
    filter.openOnly = true;
  }
  const category = PROGRAM_CATEGORIES.find((value) => value === params.get('category'));
  if (category !== undefined) {
    filter.category = category;
  }
  if (params.get('missingRequirements') === 'true') {
    filter.owingDocument = true;
  }
  return { filter };
}
