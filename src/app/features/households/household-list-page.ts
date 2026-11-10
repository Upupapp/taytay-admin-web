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
import { map, switchMap, tap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import {
  barangayName,
  HOUSEHOLD_BANDS,
  HOUSEHOLD_REPOSITORY,
  TAYTAY_BARANGAYS,
  type CursorPage,
  type HouseholdBand,
  type HouseholdFilter,
  type HouseholdSummary,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { VULNERABILITY_COPY } from '@shared/households/vulnerability.copy';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';

import { HOUSEHOLDS_COPY } from './households.copy';
import { isHouseholdFilterActive, readHouseholdQuery } from './household-query';

/** One page at a time from the server; the API's own default, and well under its ceiling. */
const PAGE_SIZE = 20;

/**
 * Households, filterable — the barangay-level view of who the office is carrying.
 *
 * The indicator column is the reason the screen exists and the thing most
 * likely to be misread, so the page says in words, above the table, that it
 * orders a list and decides nothing (`DL-42`). A band shown without that
 * sentence becomes a queue, and a queue becomes a rule.
 *
 * Paged as the resident registry is: one cursor page at a time, in the
 * server's order (reference number), with "show more" following the cursor and
 * the count said as "shown, more available" — never "page 1 of N", because the
 * server sends no total (`DL-161`).
 */
@Component({
  selector: 'app-household-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, HasPermissionDirective, Icon, PageHeader, RouterLink],
  templateUrl: './household-list-page.html',
  styleUrl: './household-list-page.scss',
})
export class HouseholdListPage {
  private readonly repository = inject(HOUSEHOLD_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

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

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<HouseholdSummary>[]>([]);
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
    { initialValue: LOADING as ViewState<CursorPage<HouseholdSummary>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });
  protected readonly rows = computed<readonly HouseholdSummary[]>(() => [
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
  protected readonly hasFilters = computed(() => isHouseholdFilterActive(this.filter()));

  protected readonly rowKey = (summary: HouseholdSummary): string => summary.household.id;

  protected readonly columns = computed<readonly TableColumn<HouseholdSummary>[]>(() => [
    { key: 'reference', header: this.copy.columnReference, cell: this.referenceCell() },
    { key: 'head', header: this.copy.columnHead, value: (summary) => summary.headName },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      value: (summary) => barangayName(summary.household.address.barangayId),
    },
    {
      key: 'size',
      header: this.copy.columnSize,
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
    // A pending keystroke must not navigate a screen that has already been left.
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

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  /** Follows the cursor one page further, for the filter the first page was read with. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter: HouseholdFilter = this.filter();
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

  /** A filter change starts the reading again from the first page. */
  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
