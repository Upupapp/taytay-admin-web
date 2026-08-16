import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

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
  type FieldVisit,
  type VisitPurpose,
  type VisitStatus,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { VISITS_COPY } from './visits.copy';

/**
 * The list is grouped by day rather than paged, so it fetches a working
 * horizon in one call. A municipal office does not schedule more visits than
 * this in a planning window, and the cap is stated rather than implicit.
 */
const LIST_LIMIT = 200;

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

  protected readonly copy = VISITS_COPY.list;
  protected readonly statusCatalog = VISIT_STATUS_CATALOG;
  protected readonly statuses = Object.keys(VISIT_STATUS_CATALOG) as VisitStatus[];
  protected readonly purposes = VISIT_PURPOSES;

  protected readonly onlyMine = signal(false);
  protected readonly search = signal('');
  protected readonly status = signal<VisitStatus | null>(null);
  protected readonly purpose = signal<VisitPurpose | null>(null);
  protected readonly overdueOnly = signal(false);

  private readonly query = computed(() => ({
    mine: this.onlyMine(),
    filter: {
      ...(this.search() ? { search: this.search() } : {}),
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
  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) =>
        toViewState(
          query.mine
            ? this.repository.mine(query.filter)
            : this.repository
                .list(query.filter, { page: 1, pageSize: LIST_LIMIT })
                .pipe(map((page) => page.items)),
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly FieldVisit[]> },
  );

  protected readonly visits = computed<readonly FieldVisit[]>(() => valueOf(this.state()) ?? []);

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
