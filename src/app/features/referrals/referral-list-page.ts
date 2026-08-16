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
import {
  REFERRAL_DESTINATION_LABELS,
  REFERRAL_REPOSITORY,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_URGENCY_LABELS,
  emptyPage,
  isReferralFilterActive,
  isReferralOverdue,
  todayAsIsoDate,
  type Page,
  type Referral,
  type ReferralDestination,
  type ReferralStatus,
  type ReferralUrgency,
  type SortSpec,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { REFERRALS_COPY } from './referrals.copy';
import { readReferralQuery } from './referral-query';


/**
 * The referral queue.
 *
 * Overdue is **computed from the record**, not stored: a referral is overdue
 * when the office said it would chase by a date, that date has passed, and
 * nobody has heard back. A stored flag would need a nightly job to stay true
 * and would be wrong every morning until it ran.
 */
@Component({
  selector: 'app-referral-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, HasPermissionDirective, PageHeader, RouterLink, StatusBadge],
  templateUrl: './referral-list-page.html',
  styleUrl: './referral-list-page.scss',
})
export class ReferralListPage {
  private readonly repository = inject(REFERRAL_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = REFERRALS_COPY.list;
  protected readonly statusCatalog = REFERRAL_STATUS_CATALOG;
  protected readonly statuses = Object.keys(REFERRAL_STATUS_CATALOG) as ReferralStatus[];
  protected readonly destinations = Object.keys(
    REFERRAL_DESTINATION_LABELS,
  ) as ReferralDestination[];
  protected readonly urgencies = Object.keys(REFERRAL_URGENCY_LABELS) as ReferralUrgency[];

  private readonly referenceCell =
    viewChild.required<TemplateRef<{ $implicit: Referral }>>('referenceCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: Referral }>>('statusCell');
  private readonly followUpCell =
    viewChild.required<TemplateRef<{ $implicit: Referral }>>('followUpCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readReferralQuery(params))),
    { initialValue: readReferralQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<Referral>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<Referral>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => isReferralFilterActive(this.filter()));

  protected readonly rowKey = (referral: Referral): string => referral.id;

  protected readonly columns = computed<readonly TableColumn<Referral>[]>(() => [
    {
      key: 'reference',
      header: this.copy.columnReference,
      sortField: 'referredAt',
      cell: this.referenceCell(),
    },
    {
      key: 'destination',
      header: this.copy.columnDestination,
      value: (referral) => referral.destinationName,
    },
    { key: 'status', header: this.copy.columnStatus, sortField: 'status', cell: this.statusCell() },
    {
      key: 'urgency',
      header: this.copy.columnUrgency,
      sortField: 'urgency',
      width: '110px',
      value: (referral) => REFERRAL_URGENCY_LABELS[referral.urgency],
    },
    {
      key: 'followUp',
      header: this.copy.columnFollowUp,
      sortField: 'followUpOn',
      cell: this.followUpCell(),
    },
  ]);

  protected detailLink(referral: Referral): string {
    return `/referrals/${referral.id}`;
  }

  protected statusLabel(status: ReferralStatus): string {
    return REFERRAL_STATUS_CATALOG[status].label;
  }

  protected destinationLabel(destination: ReferralDestination): string {
    return REFERRAL_DESTINATION_LABELS[destination];
  }

  protected urgencyLabel(urgency: ReferralUrgency): string {
    return REFERRAL_URGENCY_LABELS[urgency];
  }

  protected isOverdue(referral: Referral): boolean {
    return isReferralOverdue(referral, todayAsIsoDate());
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
    this.searchTimer = setTimeout(() => this.patch({ q: value.trim() || null }), SEARCH_DEBOUNCE_MS);
  }

  protected onStatus(event: Event): void {
    this.patch({ status: selectValue(event) });
  }

  protected onDestination(event: Event): void {
    this.patch({ destination: selectValue(event) });
  }

  protected onUrgency(event: Event): void {
    this.patch({ urgency: selectValue(event) });
  }

  protected onOverdueOnly(event: Event): void {
    this.patch({ overdue: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected onOpenOnly(event: Event): void {
    this.patch({ open: (event.target as HTMLInputElement).checked ? 'true' : null });
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
