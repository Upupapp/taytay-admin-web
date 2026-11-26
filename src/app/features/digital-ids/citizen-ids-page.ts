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
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import { EMPTY, map, switchMap, tap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import { NotConnected } from '@core/access/not-connected';
import { ServedPorts } from '@core/access/served-ports';
import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import { MenuReach } from '@core/navigation/menu-reach';
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
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { liveViewState, unlessPaged } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { Drawer } from '@shared/ui/drawer/drawer';
import { Icon } from '@shared/ui/icon/icon';
import { ListChangedNotice } from '@shared/ui/list-changed-notice/list-changed-notice';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { CardCheck } from './card-check';
import { CardPanel } from './card-panel';
import { CITIZEN_IDS_COPY } from './citizen-ids.copy';
import { VerifiedNoCard } from './verified-no-card';

/** One figure of the lifecycle row, and where it leads (`DL-273`), or `null` for text. */
interface LifecycleTally {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  /** The figure behind the list shown now, drawn filled. */
  readonly current: boolean;
  readonly link: {
    readonly route: string;
    readonly queryParams: Readonly<Record<string, string | null>>;
    /** Keep the list's search and barangay, as a tab does: a stage is counted under them. */
    readonly merge: boolean;
    readonly says: string;
  } | null;
}

const PAGE_SIZE = 20;

/**
 * The cards and the strip counted beside them, and the holders' names, which are their app
 * accounts' and change with `users` — a corrected name shows without waiting for a card (`DL-222`).
 */
export const CITIZEN_IDS_TOPICS: readonly LiveTopic[] = ['digital-ids', 'users'];

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
    ListChangedNotice,
    Modal,
    NgTemplateOutlet,
    PageHeader,
    RouterLink,
    StatusBadge,
    NotConnected,
    VerifiedNoCard,
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
  private readonly live = inject(LiveUpdates);

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
  /** A hint arrived while more than the first page was on screen (`DL-222`). */
  protected readonly listChanged = signal(false);

  /**
   * Read again quietly, counts and all, when a card changes (`DL-222`). An open card record holds
   * its own holder (`selected`), so a re-read beneath it leaves the drawer as it was.
   */
  protected readonly state = toSignal(
    toObservable(computed(() => ({ filter: this.filter(), generation: this.generation() }))).pipe(
      tap(({ filter }) => {
        this.searchText.set(filter.term ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
        this.listChanged.set(false);
      }),
      // Nobody without the grant is shown the list, so nobody without it asks for the cards.
      switchMap(({ filter }) =>
        this.canManage()
          ? liveViewState(
              () => this.repository.list({ limit: PAGE_SIZE, cursor: null }, filter),
              unlessPaged(
                this.live.changes(CITIZEN_IDS_TOPICS),
                () => this.further().length > 0 || this.loadingMore(),
                () => this.listChanged.set(true),
              ),
              this.live,
            )
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
  protected readonly funnel = computed(() => valueOf(this.state())?.funnel ?? null);
  private readonly reach = inject(MenuReach);

  /**
   * The lifecycle's figures, each the link to what it counts (`DL-273`): a card stage opens its own
   * tab under the list's other filters, which is what its count is taken under (`DL-212`); the
   * three app figures, counted for the whole app, open the account list or the review queue for a
   * reader the menu offers them, and are text for anybody else (rule 8). The account list has no
   * filter for residents only, so "Signed up" opens it whole and says so.
   */
  protected readonly tallies = computed<readonly LifecycleTally[]>(() => {
    const counts = this.counts();
    if (counts === null) return [];
    const words = this.copy.figureLinks;
    const opensAccounts = this.reach.canOpen('/users');
    const result: LifecycleTally[] = [];
    const funnel = this.funnel();
    if (funnel !== null) {
      result.push(
        {
          key: 'app-accounts',
          label: this.copy.funnel.appAccounts.label,
          value: funnel.appAccounts,
          hint: this.copy.funnel.appAccounts.hint,
          current: false,
          link: opensAccounts
            ? { route: '/users', queryParams: {}, merge: false, says: words.allAccounts }
            : null,
        },
        {
          key: 'pending',
          label: this.copy.funnel.pending.label,
          value: funnel.pendingVerification,
          hint:
            funnel.oldestPendingAt === null
              ? this.copy.funnel.pending.hint
              : this.copy.funnel.oldest(this.date(funnel.oldestPendingAt)),
          current: false,
          link: this.reach.canOpen('/verification')
            ? { route: '/verification', queryParams: {}, merge: false, says: words.reviewQueue }
            : null,
        },
        {
          key: 'verified',
          label: this.copy.funnel.verified.label,
          value: funnel.verified,
          hint: this.copy.funnel.verified.hint,
          current: this.noCardView(),
          link: opensAccounts
            ? {
                route: '/users',
                queryParams: { verification: 'verified' },
                merge: false,
                says: words.verifiedAccounts,
              }
            : null,
        },
      );
    }
    for (const status of this.statuses) {
      result.push({
        key: status,
        label: this.stageLabel(status),
        value: counts[status],
        hint: this.copy.stages[status].hint,
        current: this.filter().status === status && !this.noCardView(),
        link: {
          route: '/citizen-ids',
          queryParams: { status, view: null },
          merge: true,
          says: words.stageTab,
        },
      });
    }
    return result;
  });

  /** The no-card tab reads the account list, which only some adapter sets serve. */
  protected readonly servesAccounts = inject(ServedPorts).serves('app-account');

  /** The "Verified, no card" tab: accounts, read by their own list (`DL-232`). */
  protected readonly noCardView = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('view') === 'no-card')),
    { initialValue: this.route.snapshot.queryParamMap.get('view') === 'no-card' },
  );
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
    {
      key: 'verified',
      header: this.copy.columnVerified,
      value: (row) =>
        row.holder.verifiedAt === null ? this.copy.notVerified : this.date(row.holder.verifiedAt),
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

  protected date(value: string): string {
    return formatDisplayDate(value, 'date', this.locale) ?? '';
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
