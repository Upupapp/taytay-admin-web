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
import { NotConnected } from '@core/access/not-connected';
import { ServedPorts } from '@core/access/served-ports';
import { SessionStore } from '@core/auth/session.store';
import {
  ageInYears,
  barangayName,
  isResidentFilterActive,
  isSensitiveSector,
  RESIDENT_AGE_GROUP_LABELS,
  RESIDENT_AGE_GROUPS,
  RESIDENT_REPOSITORY,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTOR_LABELS,
  VULNERABILITY_SECTORS,
  type CursorPage,
  type ResidentAgeGroup,
  type ResidentFilter,
  type ResidentView,
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

/** One page at a time from the server; the API's own default, and well under its ceiling. */
const PAGE_SIZE = 20;

/**
 * The registry list, and the reference implementation for list screens.
 *
 * Three properties carry the "large result sets stay usable" criterion, and none
 * of them are visible in a screenshot:
 *
 *  1. **The adapter pages.** Only one cursor page of rows is ever read and
 *     disclosed at a time, so the cost of the screen does not grow with the
 *     registry. "Show more" follows the cursor; the screen says how many are
 *     shown and whether more are available, never "page 1 of N" — the server
 *     sends no total, and a count nobody computed is a claim (`DL-161`, `DL-174`).
 *  2. **Typing is debounced and superseded.** A name typed across a large
 *     registry issues one query rather than one per keystroke, and `switchMap`
 *     discards the answer to a question the user has already moved past.
 *  3. **The URL is the filter.** Filter changes are navigations, so the back
 *     button works, a filtered list is a link, and a saved view is just a name
 *     for some parameters. The order is the server's: alphabetical by surname.
 */
@Component({
  selector: 'app-resident-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, HasPermissionDirective, NotConnected, PageHeader, RouterLink, SavedViewsBar],
  templateUrl: './resident-list-page.html',
  styleUrl: './resident-list-page.scss',
})
export class ResidentListPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The saved views are a secondary panel: the registry is the screen, and a row of named filters
   * beside it is not a reason to withhold it (`DL-175`). When the port is not served the bar is
   * never created — it would read the repository on creation — and a note stands in its place.
   */
  protected readonly servesSavedViews = inject(ServedPorts).serves('saved-view');

  protected readonly copy = RESIDENTS_COPY.list;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly ageGroups = RESIDENT_AGE_GROUPS;

  /**
   * A protected sector is offered as a filter only to a reader cleared for it: the list of who is a
   * VAWC survivor is the disclosure, and the server refuses the question without the grant (`DL-174`).
   */
  protected readonly sectors = computed<readonly VulnerabilitySector[]>(() =>
    VULNERABILITY_SECTORS.filter(
      (sector) =>
        !isSensitiveSector(sector) || this.session.permissions().has('request.view-sensitive'),
    ),
  );

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

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<ResidentView>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  /** Bumped by "Try again" to read the same filter again from its first page. */
  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ query: this.query(), generation: this.generation() }))).pipe(
      tap(({ query }) => {
        // Re-seeds the box on back, forward and on a saved-view chip, none of
        // which go through `onSearch`.
        this.searchText.set(query.filter.search ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      // Each keystroke's request supersedes the last, so a fast typist over a
      // large registry never waits on an answer they have moved past.
      switchMap(({ query }) =>
        toViewState(this.repository.list(query.filter, { limit: PAGE_SIZE, cursor: null })),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<ResidentView>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });
  protected readonly rows = computed<readonly ResidentView[]>(() => [
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
  protected readonly hasFilters = computed(() => isResidentFilterActive(this.filter()));
  protected readonly filterParams = computed(() => residentFilterParams(this.filter()));
  protected readonly currentUserId = computed(() => this.session.user()?.id ?? null);

  protected readonly rowKey = (view: ResidentView): string => view.resident.id;

  protected readonly columns = computed<readonly TableColumn<ResidentView>[]>(() => [
    { key: 'name', header: this.copy.columnResident, cell: this.nameCell() },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      value: (view) => barangayName(view.resident.address.barangayId),
    },
    {
      key: 'age',
      header: this.copy.columnAge,
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
    this.destroyRef.onDestroy(() => {
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

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  /** Follows the cursor one page further, for the filter the first page was read with. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter: ResidentFilter = this.filter();
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

function selectValue(event: Event): string | null {
  return (event.target as HTMLSelectElement).value || null;
}
