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
import { RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';

import {
  RELEASE_REPOSITORY,
  RELEASE_STATUS_CATALOG,
  RELEASE_KIND_LABELS,
  isReleaseOpen,
  isReleased,
  type CursorPage,
  type Release,
  type ReleaseFilter,
  type ReleaseStatus,
  type ReleaseKind,
} from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
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

  protected readonly copy = RELEASES_COPY.list;
  protected readonly statusCatalog = RELEASE_STATUS_CATALOG;
  protected readonly statuses = Object.keys(RELEASE_STATUS_CATALOG) as ReleaseStatus[];
  protected readonly kinds: readonly ReleaseKind[] = ['money', 'in-kind'];

  protected readonly search = signal('');
  protected readonly status = signal<ReleaseStatus | null>(null);
  protected readonly kind = signal<ReleaseKind | null>(null);
  protected readonly openOnly = signal(false);

  /**
   * The term the data layer actually sees.
   *
   * Debounced so typing a surname is one read rather than one per keystroke
   * (`DL-119`). The other filters are not debounced: choosing from a dropdown
   * is a single deliberate act and should take effect at once.
   */
  private readonly settledSearch = debouncedTerm(this.search);

  private readonly query = computed<ReleaseFilter>(() => ({
    ...(this.settledSearch() ? { search: this.settledSearch() } : {}),
    ...(this.status() ? { status: this.status() as ReleaseStatus } : {}),
    ...(this.kind() ? { kind: this.kind() as ReleaseKind } : {}),
    ...(this.openOnly() ? { openOnly: true } : {}),
  }));

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<Release>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap((filter) =>
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
    const filter = this.query();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list(filter, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The filter changed meanwhile: this page continues a list nobody is looking at.
          if (filter === this.query()) {
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
    () =>
      this.search().length > 0 ||
      this.status() !== null ||
      this.kind() !== null ||
      this.openOnly(),
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

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim());
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.status.set(value === '' ? null : (value as ReleaseStatus));
  }

  protected onKind(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.kind.set(value === '' ? null : (value as ReleaseKind));
  }

  protected onOpenOnly(event: Event): void {
    this.openOnly.set((event.target as HTMLInputElement).checked);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set(null);
    this.kind.set(null);
    this.openOnly.set(false);
  }
}
