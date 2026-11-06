import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';

import {
  RELEASE_REPOSITORY,
  RELEASE_STATUS_CATALOG,
  RELEASE_KIND_LABELS,
  isReleaseFilterActive,
  isReleaseOpen,
  isReleased,
  type CursorPage,
  type Release,
  type ReleaseFilter,
  type ReleaseStatus,
  type ReleaseKind,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { RELEASES_COPY } from './releases.copy';

/**
 * Read a cursor page at a time, newest prepared first, as the API pages it (`DL-161`). The buckets
 * sort what has been read, and the screen says when more exist rather than letting a bucket read
 * as complete.
 */
const PAGE_SIZE = 50;

/**
 * The release queue.
 *
 * Bucketed by **who has to act**, not by status alphabetically. The first
 * bucket is what the office got wrong — a wrong voucher, a payout it could not
 * make — because those are the ones where somebody is waiting on the office
 * rather than the other way round, and a queue sorted by status hides them
 * among everything else.
 */
@Component({
  selector: 'app-release-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, NgTemplateOutlet, PageHeader, PesoPipe, RouterLink, StatusBadge],
  templateUrl: './release-list-page.html',
  styleUrl: './release-list-page.scss',
})
export class ReleaseListPage {
  private readonly repository = inject(RELEASE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = RELEASES_COPY.list;
  protected readonly statusCatalog = RELEASE_STATUS_CATALOG;
  protected readonly statuses = Object.keys(RELEASE_STATUS_CATALOG) as ReleaseStatus[];
  protected readonly kinds: readonly ReleaseKind[] = ['money', 'in-kind'];

  /**
   * The URL is the filter (`DL-36`), so a dashboard figure, a bookmark and the back button all open
   * the list they name. Until `DL-185` the filters lived in signals and the URL was ignored.
   */
  private readonly url = toSignal(
    this.route.queryParamMap.pipe(map((params) => readReleaseQuery(params))),
    { initialValue: readReleaseQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly filter = computed<ReleaseFilter>(() => this.url().filter);
  /** What a dashboard figure asked for that this list cannot narrow by, said rather than dropped. */
  protected readonly notNarrowed = computed(() => this.url().notNarrowed);

  /** The box as typed; the URL takes it once typing settles (`DL-119`). */
  protected readonly searchText = signal(this.url().filter.search ?? '');

  /** Bumped by "Try again", to ask the same question again. */
  private readonly reloads = signal(0);

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<Release>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ filter: this.filter(), nonce: this.reloads() }))).pipe(
      tap(({ filter }) => {
        this.searchText.set(filter.search ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(({ filter }) =>
        toViewState(this.repository.list(filter, { limit: PAGE_SIZE, cursor: null })),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<Release>> },
  );

  protected readonly releases = computed<readonly Release[]>(() => [
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

  /** Follows the cursor one page further, for the filter the first page was read with. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter = this.filter();
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

  /** What the office itself must fix before anybody can be paid. */
  protected readonly needsOffice = computed(() =>
    this.releases().filter(
      (release) => release.status === 'needs-correction' || release.status === 'deferred',
    ),
  );

  protected readonly waiting = computed(() =>
    this.releases().filter(
      (release) => release.status === 'for-release' || release.status === 'scheduled',
    ),
  );

  protected readonly settled = computed(() =>
    this.releases().filter(
      (release) =>
        isReleased(release.status) || !isReleaseOpen(release.status) || release.status === 'unclaimed',
    ),
  );

  protected readonly hasAny = computed(() => this.releases().length > 0);
  protected readonly hasFilters = computed(
    () => isReleaseFilterActive(this.filter()) || this.notNarrowed().length > 0,
  );

  protected detailLink(release: Release): string {
    return `/releases/${release.id}`;
  }

  protected statusLabel(status: ReleaseStatus): string {
    return RELEASE_STATUS_CATALOG[status].label;
  }

  protected kindLabel(kind: ReleaseKind): string {
    return RELEASE_KIND_LABELS[kind];
  }

  /** "Try again" on a failed read: the same question asked again (`DL-185`). */
  protected retry(): void {
    this.reloads.update((value) => value + 1);
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

  /**
   * Debounced so typing a reference is one read rather than one per keystroke (`DL-119`). The other
   * filters are not: choosing from a dropdown is a single deliberate act and takes effect at once.
   */
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

  protected onKind(event: Event): void {
    this.patch({ kind: (event.target as HTMLSelectElement).value || null });
  }

  protected onOpenOnly(event: Event): void {
    this.patch({ open: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
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
 * A narrowing a dashboard figure carries that the release list cannot apply: the API's list reads
 * no barangay and no programme type (`DL-185`). Said on the screen rather than dropped, so a list
 * holding more than the figure counted never reads as the figure's own records.
 */
export type ReleaseNarrowingNotApplied = 'barangay' | 'category';

const RELEASE_STATUSES = Object.keys(RELEASE_STATUS_CATALOG) as readonly ReleaseStatus[];
const RELEASE_KINDS: readonly ReleaseKind[] = ['money', 'in-kind'];

/** The filter the list reads, from `q`, `status`, `kind` and `open`; anything else is not a filter. */
export function readReleaseQuery(params: ParamReader): {
  readonly filter: ReleaseFilter;
  readonly notNarrowed: readonly ReleaseNarrowingNotApplied[];
} {
  const filter: {
    search?: string;
    status?: ReleaseStatus;
    kind?: ReleaseKind;
    openOnly?: boolean;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }
  const status = RELEASE_STATUSES.find((value) => value === params.get('status'));
  if (status !== undefined) {
    filter.status = status;
  }
  const kind = RELEASE_KINDS.find((value) => value === params.get('kind'));
  if (kind !== undefined) {
    filter.kind = kind;
  }
  if (params.get('open') === 'true') {
    filter.openOnly = true;
  }
  const notNarrowed: ReleaseNarrowingNotApplied[] = [];
  if (params.get('barangay')) {
    notNarrowed.push('barangay');
  }
  if (params.get('category')) {
    notNarrowed.push('category');
  }
  return { filter, notNarrowed };
}
