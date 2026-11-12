import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { formatDate } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import { EMPTY, map, switchMap, tap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  DIGITAL_ID_LIST_STATUSES,
  DIGITAL_ID_REPOSITORY,
  DIGITAL_ID_STATUS_CATALOG,
  isDigitalIdListNarrowed,
  TAYTAY_BARANGAYS,
  type AppAccount,
  type DigitalIdListFilter,
  type DigitalIdListing,
  type DigitalIdListPage,
  type DigitalIdListStatus,
} from '@domain/index';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { Drawer } from '@shared/ui/drawer/drawer';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { CardCheck } from './card-check';
import { CardPanel } from './card-panel';
import { CITIZEN_IDS_COPY } from './citizen-ids.copy';

const PAGE_SIZE = 20;

/** The account a row's card belongs to, as much of it as the card record needs. */
type CardHolderRef = Pick<AppAccount, 'id' | 'name' | 'email'>;

/**
 * The Citizen IDs list (`DL-212`): every card the municipality has issued, a page at a time, with
 * where the cards stand above it. List pattern, from `residents/resident-list-page`.
 *
 * **The URL is the filter** (status, search, barangay), as on the registry, so a tab is a link.
 * The strip's counts come with each page, under the same filter less its status, so choosing a tab
 * never empties the strip; nothing is counted here.
 *
 * **A row opens the card's record**, the same panel the accounts page opens, read again from the
 * server by the holder's account rather than built from the row.
 */
@Component({
  selector: 'app-citizen-ids-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CardCheck,
    CardPanel,
    DataTable,
    Drawer,
    Icon,
    InitialsPipe,
    Modal,
    PageHeader,
    RouterLink,
    StatusBadge,
  ],
  templateUrl: './citizen-ids-page.html',
  styleUrl: './citizen-ids-page.scss',
})
export class CitizenIdsPage {
  private readonly repository = inject(DIGITAL_ID_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly permissions = inject(PermissionService);

  protected readonly copy = CITIZEN_IDS_COPY;
  protected readonly catalog = DIGITAL_ID_STATUS_CATALOG;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly statuses = DIGITAL_ID_LIST_STATUSES;
  protected readonly canCheck = this.permissions.can('digital-id.verify');
  protected readonly canManage = this.permissions.can('digital-id.manage');

  private readonly holderCell =
    viewChild.required<TemplateRef<{ $implicit: DigitalIdListing }>>('holderCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: DigitalIdListing }>>('statusCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: DigitalIdListing }>>('actionCell');

  protected readonly filter = toSignal(this.route.queryParamMap.pipe(map(readFilter)), {
    initialValue: readFilter(this.route.snapshot.queryParamMap),
  });

  protected readonly searchText = signal(this.filter().term ?? '');
  private readonly further = signal<readonly DigitalIdListPage[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ filter: this.filter(), generation: this.generation() }))).pipe(
      tap(({ filter }) => {
        this.searchText.set(filter.term ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      // Nobody without the grant is shown the list, so nobody without it asks for the cards.
      switchMap(({ filter }) =>
        this.canManage()
          ? toViewState(this.repository.list({ limit: PAGE_SIZE, cursor: null }, filter))
          : EMPTY,
      ),
    ),
    { initialValue: LOADING as ViewState<DigitalIdListPage> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });
  /** The strip counts the first page's answer: every page of one reading counts the same filter. */
  protected readonly counts = computed(() => valueOf(this.state())?.counts ?? null);
  protected readonly rows = computed<readonly DigitalIdListing[]>(() => [
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
  protected readonly narrowed = computed(
    () => isDigitalIdListNarrowed(this.filter()) || this.filter().status !== undefined,
  );

  protected readonly rowKey = (row: DigitalIdListing): string => row.id;

  protected readonly columns = computed<readonly TableColumn<DigitalIdListing>[]>(() => [
    { key: 'holder', header: this.copy.columnResident, cell: this.holderCell() },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      value: (row) => row.holder.barangayName ?? this.copy.noBarangay,
    },
    { key: 'number', header: this.copy.columnNumber, value: (row) => row.number },
    {
      key: 'issued',
      header: this.copy.columnIssued,
      value: (row) => this.date(row.issuedAt),
    },
    {
      key: 'expires',
      header: this.copy.columnExpires,
      value: (row) => this.date(row.expiresAt),
    },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      key: 'action',
      header: this.copy.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly checking = signal(false);
  protected readonly selected = signal<CardHolderRef | null>(null);

  private readonly locale = inject(LOCALE_ID);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }

  protected stageLabel(status: DigitalIdListStatus): string {
    return this.copy.stages[status].label;
  }

  protected nameOf(row: DigitalIdListing): string {
    return row.holder.name ?? this.copy.closedHolder;
  }

  protected open(row: DigitalIdListing): void {
    this.selected.set({ id: row.holder.account, name: row.holder.name, email: null });
  }

  protected closeRecord(): void {
    this.selected.set(null);
    // What an act on the card changed is read again, with the counts beside it.
    this.retry();
  }

  /* ── filter changes are navigations ─────────────────────────────────────── */

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.patch({ q: value.trim() || null });
    }, SEARCH_DEBOUNCE_MS);
  }

  protected onBarangay(event: Event): void {
    this.patch({ barangay: (event.target as HTMLSelectElement).value || null });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;

    const filter = this.filter();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list({ limit: PAGE_SIZE, cursor }, filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (filter === this.filter()) this.further.update((pages) => [...pages, page]);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private date(value: string): string {
    return formatDate(value, 'd MMM y', this.locale);
  }
}

/** The list's filter from the URL; a value the API would not understand is dropped, not sent. */
function readFilter(params: ParamMap): DigitalIdListFilter {
  const status = DIGITAL_ID_LIST_STATUSES.find((candidate) => candidate === params.get('status'));
  const term = params.get('q')?.trim() ?? '';
  const barangay = TAYTAY_BARANGAYS.find((candidate) => candidate.id === params.get('barangay'));

  return {
    ...(status === undefined ? {} : { status }),
    ...(term === '' ? {} : { term }),
    ...(barangay === undefined ? {} : { barangayId: barangay.id }),
  };
}
