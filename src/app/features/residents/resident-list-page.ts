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
import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  barangayName,
  isResidentFilterActive,
  isSensitiveSector,
  REGISTRY_APP_STANDING_CATALOG,
  registryAppStanding,
  RESIDENT_AGE_GROUP_LABELS,
  RESIDENT_AGE_GROUPS,
  RESIDENT_REPOSITORY,
  SEX_LABELS,
  SEXES,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTOR_LABELS,
  VULNERABILITY_SECTORS,
  type CursorPage,
  type ResidentAgeGroup,
  type RegistryAppAccount,
  type RegistryAppStanding,
  type ResidentFilter,
  type ResidentSummary,
  type ResidentView,
  type Sex,
  type VulnerabilitySector,
} from '@domain/index';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { liveViewState, unlessPaged } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { ListChangedNotice } from '@shared/ui/list-changed-notice/list-changed-notice';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SavedViewsBar } from '@shared/ui/saved-views/saved-views-bar';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { registryColumns, residentColumns, sectorChipClass } from './resident-columns';
import { RESIDENTS_COPY } from './residents.copy';
import { readResidentQuery, residentFilterParams } from './resident-query';

/** One page at a time from the server; the API's own default, and well under its ceiling. */
const PAGE_SIZE = 20;

/** The registry's rows are residents and nothing else (`DL-222`). */
export const RESIDENT_LIST_TOPICS: readonly LiveTopic[] = ['residents'];

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
  imports: [
    DataTable,
    HasPermissionDirective,
    Icon,
    InitialsPipe,
    ListChangedNotice,
    NotConnected,
    PageHeader,
    RouterLink,
    SavedViewsBar,
    StatusBadge,
  ],
  templateUrl: './resident-list-page.html',
  styleUrl: './resident-list-page.scss',
})
export class ResidentListPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(LiveUpdates);

  /**
   * The saved views are a secondary panel: the registry is the screen, and a row of named filters
   * beside it is not a reason to withhold it (`DL-175`). When the port is not served the bar is
   * never created — it would read the repository on creation — and a note stands in its place.
   */
  protected readonly servesSavedViews = inject(ServedPorts).serves('saved-view');

  protected readonly copy = RESIDENTS_COPY.list;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly ageGroups = RESIDENT_AGE_GROUPS;
  protected readonly sexes = SEXES;

  /**
   * The sector filter's options, in the domain's order. A protected sector is offered only to a reader cleared
   * for it: the list of who is a VAWC survivor is the disclosure, and the server refuses the
   * question without the grant (`DL-174`).
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
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('statusCell');
  private readonly appCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('appCell');

  protected readonly appCatalog = REGISTRY_APP_STANDING_CATALOG;

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
  /** A hint arrived while more than the first page was on screen (`DL-222`). */
  protected readonly listChanged = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ query: this.query(), generation: this.generation() }))).pipe(
      tap(({ query }) => {
        // Re-seeds the box on back, forward and on a saved-view chip, none of
        // which go through `onSearch`.
        this.searchText.set(query.filter.search ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
        this.listChanged.set(false);
      }),
      // Each keystroke's request supersedes the last, so a fast typist over a
      // large registry never waits on an answer they have moved past. A hint
      // re-reads the first page quietly, unless somebody has loaded more of it.
      switchMap(({ query }) =>
        liveViewState(
          () => this.repository.list(query.filter, { limit: PAGE_SIZE, cursor: null }),
          unlessPaged(
            this.live.changes(RESIDENT_LIST_TOPICS),
            () => this.further().length > 0 || this.loadingMore(),
            () => this.listChanged.set(true),
          ),
          this.live,
        ),
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

  protected readonly columns = computed<readonly TableColumn<ResidentView>[]>(() => {
    const [name, barangay, age, sectors, status] = residentColumns(this.copy, {
      name: this.nameCell(),
      sectors: this.sectorsCell(),
      status: this.statusCell(),
    });
    return [
      ...(name === undefined ? [] : [name]),
      ...(barangay === undefined ? [] : [{ ...barangay, cell: this.barangayCell() }]),
      ...[age, sectors].filter(
        (column): column is TableColumn<ResidentView> => column !== undefined,
      ),
      ...registryColumns(this.copy, { app: this.appCell() }),
      ...(status === undefined ? [] : [status]),
    ];
  });

  private readonly barangayCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('barangayCell');

  /**
   * A count on each sector option, from the registry summary under the same barangay, age group and
   * sex as the list (`DL-232`); a withheld count says so, and nothing is shown until it is read.
   */
  private readonly sectorSummary = toSignal(
    toObservable(
      computed(() => {
        const filter = this.filter();
        return {
          ...(filter.barangayId === undefined ? {} : { barangayId: filter.barangayId }),
          ...(filter.ageGroup === undefined ? {} : { ageGroup: filter.ageGroup }),
          ...(filter.sex === undefined ? {} : { sex: filter.sex }),
        };
      }),
    ).pipe(
      switchMap((filter) =>
        // Counts in the options: a failed re-read keeps them, and the list reports for the page.
        liveViewState(
          () => this.repository.summary(filter),
          this.live.changes(RESIDENT_LIST_TOPICS),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<ResidentSummary> },
  );

  /** The sector's count, `null` before the summary is read (or when it could not be). */
  private sectorCount(sector: VulnerabilitySector): string | null {
    const summary = valueOf(this.sectorSummary());
    if (summary === null) return null;
    const row = summary.bySector.rows.find((candidate) => candidate.key === sector);
    if (row === undefined) return null;
    return row.isWithheld ? this.copy.withheld : row.value.toLocaleString('en-PH');
  }

  protected appStanding(account: RegistryAppAccount | null): RegistryAppStanding {
    return registryAppStanding(account);
  }

  protected barangayLabel(view: ResidentView): string {
    return barangayName(view.resident.address.barangayId);
  }

  /** Birth date and sex under the name, as the registry board writes them. */
  protected nameMeta(view: ResidentView): string {
    const born = formatDisplayDate(view.resident.birthDate);
    return [born === null ? '' : this.copy.born(born), SEX_LABELS[view.resident.sex]]
      .filter((part) => part !== '')
      .join(' · ');
  }

  protected detailLink(view: ResidentView): string {
    return `/residents/${view.resident.id}`;
  }

  protected readonly sectorChip = sectorChipClass;

  protected sectorLabel(sector: VulnerabilitySector): string {
    return VULNERABILITY_SECTOR_LABELS[sector];
  }

  /** The option's short label with its count, "Senior citizens (12)"; the table keeps the full one. */
  protected sectorOption(sector: VulnerabilitySector): string {
    return this.copy.sectorOption(this.copy.sectorOptions[sector], this.sectorCount(sector));
  }

  protected ageGroupLabel(group: ResidentAgeGroup): string {
    return RESIDENT_AGE_GROUP_LABELS[group];
  }

  protected sexLabel(sex: Sex): string {
    return SEX_LABELS[sex];
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

  protected onAgeGroup(event: Event): void {
    this.patch({ ageGroup: selectValue(event) });
  }

  protected onSex(event: Event): void {
    this.patch({ sex: selectValue(event) });
  }

  protected onSector(event: Event): void {
    this.patch({ sector: selectValue(event) });
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

  /** The person's reload after a held hint: the same filter, from its first page. */
  protected reloadList(): void {
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
