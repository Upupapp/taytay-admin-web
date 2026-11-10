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
  FAMILY_REPOSITORY,
  isFamilyFilterActive,
  TAYTAY_BARANGAYS,
  type CursorPage,
  type FamilyFilter,
  type FamilySummary,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';

import { FAMILIES_COPY } from './families.copy';
import { readFamilyQuery } from './family-query';

/** One page at a time from the server; the API's own default, and well under its ceiling. */
const PAGE_SIZE = 20;

/**
 * The family registry.
 *
 * The banner above the table is the screen's real work. Every reader arrives
 * assuming one household is one family, and the list is full of counter-
 * examples — two families at one address, a family with no address at all — so
 * the page says what it means before the reader has a chance to misread it
 * (`DL-47`).
 *
 * Paged as the household register is: one cursor page at a time, in the
 * server's order (reference number), with "show more" following the cursor and
 * the count said as "shown, more available" — never "page 1 of N", because the
 * server sends no total (`DL-161`).
 */
@Component({
  selector: 'app-family-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, HasPermissionDirective, Icon, PageHeader, RouterLink],
  templateUrl: './family-list-page.html',
  styleUrl: './family-list-page.scss',
})
export class FamilyListPage {
  private readonly repository = inject(FAMILY_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = FAMILIES_COPY.list;
  protected readonly barangays = TAYTAY_BARANGAYS;

  private readonly referenceCell =
    viewChild.required<TemplateRef<{ $implicit: FamilySummary }>>('referenceCell');
  private readonly householdCell =
    viewChild.required<TemplateRef<{ $implicit: FamilySummary }>>('householdCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readFamilyQuery(params))),
    { initialValue: readFamilyQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<FamilySummary>[]>([]);
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
    { initialValue: LOADING as ViewState<CursorPage<FamilySummary>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });
  protected readonly rows = computed<readonly FamilySummary[]>(() => [
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
  protected readonly hasFilters = computed(() => isFamilyFilterActive(this.filter()));

  protected readonly rowKey = (summary: FamilySummary): string => summary.family.id;

  protected readonly columns = computed<readonly TableColumn<FamilySummary>[]>(() => [
    { key: 'reference', header: this.copy.columnReference, cell: this.referenceCell() },
    { key: 'name', header: this.copy.columnName, value: (summary) => summary.family.name },
    { key: 'head', header: this.copy.columnHead, value: (summary) => summary.headName },
    { key: 'household', header: this.copy.columnHousehold, cell: this.householdCell() },
    {
      key: 'size',
      header: this.copy.columnSize,
      align: 'end',
      width: '90px',
      value: (summary) => `${summary.memberCount}`,
    },
  ]);

  protected detailLink(summary: FamilySummary): string {
    return `/families/${summary.family.id}`;
  }

  protected householdLabel(summary: FamilySummary): string {
    if (summary.householdReference === null) {
      return this.copy.noHousehold;
    }
    const barangay = summary.barangayId === null ? null : barangayName(summary.barangayId);
    return barangay === null
      ? summary.householdReference
      : `${summary.householdReference} · ${barangay}`;
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
    this.searchTimer = setTimeout(
      () => this.patch({ q: value.trim() || null }),
      SEARCH_DEBOUNCE_MS,
    );
  }

  protected onBarangay(event: Event): void {
    this.patch({ barangay: (event.target as HTMLSelectElement).value || null });
  }

  protected onUnhoused(event: Event): void {
    this.patch({ unhoused: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected onDissolved(event: Event): void {
    this.patch({ dissolved: (event.target as HTMLInputElement).checked ? 'true' : null });
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
    const filter: FamilyFilter = this.filter();
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
