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
  FAMILY_REPOSITORY,
  isFamilyFilterActive,
  TAYTAY_BARANGAYS,
  type FamilySummary,
  type Page,
  type SortSpec,
} from '@domain/index';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { FAMILIES_COPY } from './families.copy';
import { readFamilyQuery } from './family-query';

const SEARCH_DEBOUNCE_MS = 250;

/**
 * The family registry.
 *
 * The banner above the table is the screen's real work. Every reader arrives
 * assuming one household is one family, and the list is full of counter-
 * examples — two families at one address, a family with no address at all — so
 * the page says what it means before the reader has a chance to misread it
 * (`DL-47`).
 */
@Component({
  selector: 'app-family-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, PageHeader, RouterLink],
  templateUrl: './family-list-page.html',
  styleUrl: './family-list-page.scss',
})
export class FamilyListPage {
  private readonly repository = inject(FAMILY_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<FamilySummary>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<FamilySummary>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => isFamilyFilterActive(this.filter()));

  protected readonly rowKey = (summary: FamilySummary): string => summary.family.id;

  protected readonly columns = computed<readonly TableColumn<FamilySummary>[]>(() => [
    {
      key: 'reference',
      header: this.copy.columnReference,
      sortField: 'reference',
      cell: this.referenceCell(),
    },
    {
      key: 'name',
      header: this.copy.columnName,
      sortField: 'name',
      value: (summary) => summary.family.name,
    },
    { key: 'head', header: this.copy.columnHead, value: (summary) => summary.headName },
    { key: 'household', header: this.copy.columnHousehold, cell: this.householdCell() },
    {
      key: 'size',
      header: this.copy.columnSize,
      sortField: 'size',
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
