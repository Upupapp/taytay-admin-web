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

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { SessionStore } from '@core/auth/session.store';
import {
  ageInYears,
  barangayName,
  emptyPage,
  isResidentFilterActive,
  RESIDENT_AGE_GROUP_LABELS,
  RESIDENT_AGE_GROUPS,
  RESIDENT_REPOSITORY,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTOR_LABELS,
  VULNERABILITY_SECTORS,
  type Page,
  type ResidentAgeGroup,
  type ResidentView,
  type SortSpec,
  type VulnerabilitySector,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SavedViewsBar } from '@shared/ui/saved-views/saved-views-bar';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { RESIDENTS_COPY } from './residents.copy';
import { readResidentQuery, residentFilterParams } from './resident-query';


/**
 * The registry list, and the reference implementation for list screens.
 *
 * Three properties carry the "large result sets stay usable" criterion, and none
 * of them are visible in a screenshot:
 *
 *  1. **The adapter pages.** Only one page of rows is ever built, sorted and
 *     disclosed, so the cost of the screen does not grow with the registry.
 *  2. **Typing is debounced and superseded.** A name typed across a large
 *     registry issues one query rather than one per keystroke, and `switchMap`
 *     discards the answer to a question the user has already moved past.
 *  3. **The URL is the query.** Paging and sorting are navigations, so the back
 *     button works, a filtered list is a link, and a saved view is just a name
 *     for some parameters.
 */
@Component({
  selector: 'app-resident-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, HasPermissionDirective, PageHeader, RouterLink, SavedViewsBar],
  templateUrl: './resident-list-page.html',
  styleUrl: './resident-list-page.scss',
})
export class ResidentListPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = RESIDENTS_COPY.list;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly sectors = VULNERABILITY_SECTORS;
  protected readonly ageGroups = RESIDENT_AGE_GROUPS;

  private readonly sectorsCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('sectorsCell');
  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('nameCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readResidentQuery(params))),
    { initialValue: readResidentQuery(this.route.snapshot.queryParamMap) },
  );

  /**
   * Held separately from the URL so the input does not jump while it is being
   * typed in. The URL still wins: it seeds this and every other filter control.
   */
  protected readonly searchText = signal(this.query().filter.search ?? '');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      // Re-seeds the box on back, forward and on a saved-view chip, none of
      // which go through `onSearch`.
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      // Each keystroke's request supersedes the last, so a fast typist over a
      // large registry never waits on an answer they have moved past.
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<ResidentView>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<ResidentView>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => isResidentFilterActive(this.filter()));
  protected readonly filterParams = computed(() => residentFilterParams(this.filter()));
  protected readonly currentUserId = computed(() => this.session.user()?.id ?? null);

  protected readonly rowKey = (view: ResidentView): string => view.resident.id;

  protected readonly columns = computed<readonly TableColumn<ResidentView>[]>(() => [
    { key: 'name', header: this.copy.columnResident, sortField: 'name', cell: this.nameCell() },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      sortField: 'barangay',
      value: (view) => barangayName(view.resident.address.barangayId),
    },
    {
      key: 'age',
      header: this.copy.columnAge,
      sortField: 'birthDate',
      align: 'end',
      width: '80px',
      value: (view) => `${ageInYears(view.resident.birthDate)}`,
    },
    { key: 'sectors', header: this.copy.columnSectors, cell: this.sectorsCell() },
    {
      key: 'status',
      header: this.copy.columnStatus,
      width: '110px',
      value: (view) => (view.resident.isActive ? this.copy.active : this.copy.retired),
    },
  ]);

  protected detailLink(view: ResidentView): string {
    return `/residents/${view.resident.id}`;
  }

  protected sectorLabel(sector: VulnerabilitySector): string {
    return VULNERABILITY_SECTOR_LABELS[sector];
  }

  protected ageGroupLabel(group: ResidentAgeGroup): string {
    return RESIDENT_AGE_GROUP_LABELS[group];
  }

  /* ── filter changes are navigations ─────────────────────────────────────── */

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // A pending keystroke must not navigate a screen that has already been left.
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) {
        clearTimeout(this.searchTimer);
      }
    });
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    // Debounced here rather than in the stream, because each keystroke would
    // otherwise push a history entry as well as a query.
    if (this.searchTimer !== null) {
      clearTimeout(this.searchTimer);
    }
    this.searchTimer = setTimeout(() => {
      this.patch({ q: value.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onBarangay(event: Event): void {
    this.patch({ barangay: selectValue(event) });
  }

  protected onSector(event: Event): void {
    this.patch({ sector: selectValue(event) });
  }

  protected onAgeGroup(event: Event): void {
    this.patch({ ageGroup: selectValue(event) });
  }

  protected onIncludeInactive(event: Event): void {
    this.patch({ inactive: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected onSortChanged(sort: SortSpec): void {
    this.patch({ sort: sort.field, direction: sort.direction, page: null });
  }

  protected onPageChanged(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? String(page) : null },
      queryParamsHandling: 'merge',
    });
  }

  /** Any filter change resets to page 1: page 7 of a different question is nonsense. */
  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...changes, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}

function selectValue(event: Event): string | null {
  return (event.target as HTMLSelectElement).value || null;
}
