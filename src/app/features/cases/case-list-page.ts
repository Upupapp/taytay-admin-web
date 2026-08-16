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
  CASE_CATEGORIES,
  CASE_QUEUE_IDS,
  CASE_REPOSITORY,
  CASE_STATUS_CATALOG,
  emptyPage,
  isCaseFilterActive,
  TAYTAY_BARANGAYS,
  type CaseCategory,
  type CaseQueueId,
  type CaseStatus,
  type CaseSummary,
  type Page,
  type SortSpec,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { CASE_COPY } from '@shared/cases/case.copy';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { CASES_COPY } from './cases.copy';
import { readCaseQuery } from './case-query';


/**
 * The case list, read as a set of work queues.
 *
 * A queue is a link, not a mode: it lives in the URL beside the filters, so
 * "the overdue cases in Dolores" is something a supervisor can send to somebody
 * and something a refresh cannot lose. The counts come from the repository
 * under the same scope and filters as the list itself, so a badge and the page
 * it opens cannot disagree.
 */
@Component({
  selector: 'app-case-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, PageHeader, RouterLink, StatusBadge],
  templateUrl: './case-list-page.html',
  styleUrl: './case-list-page.scss',
})
export class CaseListPage {
  private readonly repository = inject(CASE_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = CASES_COPY.list;
  protected readonly shared = CASE_COPY;
  protected readonly statusCatalog = CASE_STATUS_CATALOG;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly categories = CASE_CATEGORIES;
  protected readonly queues = CASE_QUEUE_IDS;
  protected readonly statuses: readonly CaseStatus[] = [
    'intake',
    'assessment',
    'intervention',
    'monitoring',
    'on-hold',
    'referred-out',
    'closed',
  ];

  private readonly referenceCell =
    viewChild.required<TemplateRef<{ $implicit: CaseSummary }>>('referenceCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: CaseSummary }>>('statusCell');
  private readonly nextActionCell =
    viewChild.required<TemplateRef<{ $implicit: CaseSummary }>>('nextActionCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readCaseQuery(params))),
    { initialValue: readCaseQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<CaseSummary>> },
  );

  protected readonly counts = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) => toViewState(this.repository.queueCounts(query.filter))),
    ),
    { initialValue: LOADING as ViewState<readonly { queue: CaseQueueId; count: number }[]> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<CaseSummary>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly activeQueue = computed<CaseQueueId>(() => this.filter().queue ?? 'all');
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => isCaseFilterActive(this.filter()));

  protected readonly rowKey = (summary: CaseSummary): string => summary.record.id;

  protected readonly columns = computed<readonly TableColumn<CaseSummary>[]>(() => [
    {
      key: 'reference',
      header: this.copy.columnReference,
      sortField: 'reference',
      cell: this.referenceCell(),
    },
    {
      key: 'subject',
      header: this.copy.columnSubject,
      value: (summary) => summary.subject.listedName,
    },
    { key: 'status', header: this.copy.columnStatus, sortField: 'status', cell: this.statusCell() },
    {
      key: 'nextAction',
      header: this.copy.columnNextAction,
      sortField: 'nextAction',
      cell: this.nextActionCell(),
    },
    {
      key: 'assigned',
      header: this.copy.columnAssigned,
      value: (summary) => summary.assignedToName ?? this.copy.unassigned,
    },
  ]);

  protected countFor(queue: CaseQueueId): number | null {
    return valueOf(this.counts())?.find((entry) => entry.queue === queue)?.count ?? null;
  }

  protected queueLabel(queue: CaseQueueId): string {
    return CASE_COPY.queueLabel[queue];
  }

  protected queueDescription(queue: CaseQueueId): string {
    return CASE_COPY.queueDescription[queue];
  }

  protected categoryLabel(category: CaseCategory): string {
    return CASE_COPY.categoryLabel[category];
  }

  protected detailLink(summary: CaseSummary): string {
    return `/cases/${summary.record.id}`;
  }

  /** Words, not a colour: "9 days overdue" survives being read aloud. */
  protected nextActionLabel(summary: CaseSummary): string {
    const days = summary.facts.daysUntilNextAction;
    if (summary.nextAction === null || days === null) {
      return this.copy.noNextAction;
    }
    return days < 0 ? this.copy.overdueBy(Math.abs(days)) : this.copy.dueIn(days);
  }

  protected isOverdue(summary: CaseSummary): boolean {
    const days = summary.facts.daysUntilNextAction;
    return days !== null && days < 0;
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

  protected onQueue(queue: CaseQueueId): void {
    this.patch({ queue: queue === 'all' ? null : queue });
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

  protected onCategory(event: Event): void {
    this.patch({ category: (event.target as HTMLSelectElement).value || null });
  }

  protected onBarangay(event: Event): void {
    this.patch({ barangay: (event.target as HTMLSelectElement).value || null });
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
