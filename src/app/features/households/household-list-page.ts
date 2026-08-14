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
  barangayName,
  emptyPage,
  HOUSEHOLD_BANDS,
  HOUSEHOLD_REPOSITORY,
  TAYTAY_BARANGAYS,
  type HouseholdBand,
  type HouseholdSummary,
  type Page,
  type SortSpec,
} from '@domain/index';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { VULNERABILITY_COPY } from '@shared/households/vulnerability.copy';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { HOUSEHOLDS_COPY } from './households.copy';
import {
  householdFilterParams,
  isHouseholdFilterActive,
  readHouseholdQuery,
} from './household-query';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * Households, ordered and filterable — the barangay-level view of who the
 * office is carrying.
 *
 * The indicator column is the reason the screen exists and the thing most
 * likely to be misread, so the page says in words, above the table, that it
 * orders a list and decides nothing (`DL-42`). A band shown without that
 * sentence becomes a queue, and a queue becomes a rule.
 */
@Component({
  selector: 'app-household-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, PageHeader, RouterLink],
  templateUrl: './household-list-page.html',
  styleUrl: './household-list-page.scss',
})
export class HouseholdListPage {
  private readonly repository = inject(HOUSEHOLD_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = HOUSEHOLDS_COPY.list;
  protected readonly bandLabels = VULNERABILITY_COPY.bandLabel;
  protected readonly barangays = TAYTAY_BARANGAYS;
  /** `none` is every household, so it is not offered as a filter. */
  protected readonly bands = HOUSEHOLD_BANDS.filter((band) => band !== 'none');

  private readonly bandCell =
    viewChild.required<TemplateRef<{ $implicit: HouseholdSummary }>>('bandCell');
  private readonly referenceCell =
    viewChild.required<TemplateRef<{ $implicit: HouseholdSummary }>>('referenceCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readHouseholdQuery(params))),
    { initialValue: readHouseholdQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<HouseholdSummary>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<HouseholdSummary>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => isHouseholdFilterActive(this.filter()));
  protected readonly filterParams = computed(() => householdFilterParams(this.filter()));

  protected readonly rowKey = (summary: HouseholdSummary): string => summary.household.id;

  protected readonly columns = computed<readonly TableColumn<HouseholdSummary>[]>(() => [
    {
      key: 'reference',
      header: this.copy.columnReference,
      sortField: 'reference',
      cell: this.referenceCell(),
    },
    { key: 'head', header: this.copy.columnHead, value: (summary) => summary.headName },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      sortField: 'barangay',
      value: (summary) => barangayName(summary.household.address.barangayId),
    },
    {
      key: 'size',
      header: this.copy.columnSize,
      sortField: 'size',
      align: 'end',
      width: '90px',
      value: (summary) => `${summary.memberCount}`,
    },
    { key: 'band', header: this.copy.columnBand, cell: this.bandCell() },
  ]);

  protected detailLink(summary: HouseholdSummary): string {
    return `/households/${summary.household.id}`;
  }

  protected bandLabel(band: HouseholdBand): string {
    return this.bandLabels[band];
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
    this.searchTimer = setTimeout(() => {
      this.patch({ q: value.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onBarangay(event: Event): void {
    this.patch({ barangay: (event.target as HTMLSelectElement).value || null });
  }

  protected onBand(event: Event): void {
    this.patch({ band: (event.target as HTMLSelectElement).value || null });
  }

  protected onIndigent(event: Event): void {
    this.patch({ indigent: (event.target as HTMLInputElement).checked ? 'true' : null });
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
