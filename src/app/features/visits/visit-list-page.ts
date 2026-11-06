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
import { map, switchMap, tap } from 'rxjs';

import {
  FIELD_VISIT_REPOSITORY,
  VISIT_PURPOSE_LABELS,
  VISIT_PURPOSES,
  VISIT_STATUS_CATALOG,
  groupVisitsByDay,
  isDueToday,
  isVisitOverdue,
  isUpcoming,
  todayAsIsoDate,
  type CursorPage,
  type FieldVisit,
  type FieldVisitFilter,
  type VisitPurpose,
  type VisitStatus,
} from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { VISITS_COPY } from './visits.copy';

/**
 * Read a cursor page at a time in the API's order — what is still owed first, soonest first, then
 * what is over, latest first (`DL-181`). The buckets sort what has been read, and the screen says
 * when more exist rather than letting a bucket read as complete (`DL-161`). "My visits" is read
 * whole, or not at all.
 */
const PAGE_SIZE = 50;

/**
 * The visit list, grouped by day.
 *
 * Grouped rather than paged because the question a worker asks is "what am I
 * doing today, and what did I miss?" — which a page-2-of-4 table answers badly.
 *
 * "Past its date" says the office is late, not the household. A visit is
 * scheduled by staff and made by staff; the family has not failed to do
 * anything.
 */
@Component({
  selector: 'app-visit-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, NgTemplateOutlet, PageHeader, RouterLink, StatusBadge],
  templateUrl: './visit-list-page.html',
  styleUrl: './visit-list-page.scss',
})
export class VisitListPage {
  private readonly repository = inject(FIELD_VISIT_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = VISITS_COPY.list;
  protected readonly statusCatalog = VISIT_STATUS_CATALOG;
  protected readonly statuses = Object.keys(VISIT_STATUS_CATALOG) as VisitStatus[];
  protected readonly purposes = VISIT_PURPOSES;

  protected readonly onlyMine = signal(false);
  protected readonly search = signal('');

  /**
   * The term the data layer actually sees.
   *
   * Debounced so typing a surname is one read rather than one per keystroke
   * (`DL-119`). The other filters are not debounced: choosing from a dropdown
   * is a single deliberate act and should take effect at once.
   */
  private readonly settledSearch = debouncedTerm(this.search);
  protected readonly status = signal<VisitStatus | null>(null);
  protected readonly purpose = signal<VisitPurpose | null>(null);
  protected readonly overdueOnly = signal(false);

  private readonly query = computed<{ readonly mine: boolean; readonly filter: FieldVisitFilter }>(() => ({
    mine: this.onlyMine(),
    filter: {
      ...(this.settledSearch() ? { search: this.settledSearch() } : {}),
      ...(this.status() ? { status: this.status() as VisitStatus } : {}),
      ...(this.purpose() ? { purpose: this.purpose() as VisitPurpose } : {}),
      ...(this.overdueOnly() ? { overdueOnly: true } : {}),
    },
  }));

  /**
   * Both sources are normalised to a plain list before they reach the view.
   *
   * `mine` returns a collection and `list` a page; a union of the two would put
   * the shape difference in the template, where every bucket would have to know
   * about it.
   */
  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<FieldVisit>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap((query) =>
        toViewState<CursorPage<FieldVisit>>(
          query.mine
            ? this.repository
                .mine(query.filter)
                .pipe(map((items) => ({ items, hasMore: false, nextCursor: null })))
            : this.repository.list(query.filter, { limit: PAGE_SIZE, cursor: null }),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<FieldVisit>> },
  );

  protected readonly visits = computed<readonly FieldVisit[]>(() => [
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
    const query = this.query();
    if (cursor === null || this.loadingMore() || query.mine) {
      return;
    }
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list(query.filter, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The filter changed meanwhile: this page continues a list nobody is looking at.
          if (query === this.query()) {
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

  private readonly today = computed(() => todayAsIsoDate());

  /** The three buckets a worker plans from, computed rather than filtered by hand. */
  protected readonly overdue = computed(() =>
    this.visits().filter((visit) => isVisitOverdue(visit, this.today())),
  );
  protected readonly dueToday = computed(() =>
    this.visits().filter((visit) => isDueToday(visit, this.today())),
  );
  protected readonly upcoming = computed(() =>
    this.visits().filter((visit) => isUpcoming(visit, this.today())),
  );
  protected readonly closed = computed(() =>
    this.visits().filter((visit) => visit.status !== 'scheduled'),
  );

  protected readonly closedByDay = computed(() => groupVisitsByDay(this.closed()));
  protected readonly hasAny = computed(() => this.visits().length > 0);

  protected readonly hasFilters = computed(
    () =>
      this.search().length > 0 ||
      this.status() !== null ||
      this.purpose() !== null ||
      this.overdueOnly(),
  );

  protected detailLink(visit: FieldVisit): string {
    return `/visits/${visit.id}`;
  }

  protected purposeLabel(purpose: VisitPurpose): string {
    return VISIT_PURPOSE_LABELS[purpose];
  }

  protected statusLabel(status: VisitStatus): string {
    return VISIT_STATUS_CATALOG[status].label;
  }

  protected onScope(mine: boolean): void {
    this.onlyMine.set(mine);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim());
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.status.set(value === '' ? null : (value as VisitStatus));
  }

  protected onPurpose(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.purpose.set(value === '' ? null : (value as VisitPurpose));
  }

  protected onOverdueOnly(event: Event): void {
    this.overdueOnly.set((event.target as HTMLInputElement).checked);
  }

  protected clearFilters(): void {
    this.search.set('');
    this.status.set(null);
    this.purpose.set(null);
    this.overdueOnly.set(false);
  }
}
