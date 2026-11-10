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
import { SessionStore } from '@core/auth/session.store';
import {
  BENEFICIARY_REPOSITORY,
  BENEFICIARY_ROLE_LABELS,
  BENEFICIARY_ROLES,
  PROGRAM_REPOSITORY,
  TAYTAY_BARANGAYS,
  barangayName,
  describeStanding,
  isBeneficiaryFilterActive,
  isPeriodReversed,
  type AssistanceProgram,
  type BeneficiaryFilter,
  type BeneficiaryRole,
  type BeneficiarySummary,
  type CursorPage,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SavedViewsBar } from '@shared/ui/saved-views/saved-views-bar';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';

import { BENEFICIARIES_COPY } from './beneficiaries.copy';
import { beneficiaryFilterParams, readBeneficiaryQuery } from './beneficiary-query';

/** One page at a time from the server, as on the resident registry. */
const PAGE_SIZE = 20;

/**
 * The beneficiary registry list.
 *
 * It answers a question the resident list cannot: not *who is on file* but
 * *what has this office actually done for them*. Standing, current programmes,
 * total received and last assistance are all derived from records, so a row
 * cannot claim something the history does not support.
 *
 * The duplicate flag is a **flag and nothing more**. Which other record it
 * resembles is not on this screen and is not in the payload that built it — a
 * list everybody scrolls past is the wrong place to disclose one person to
 * somebody looking for another (`DL-73`).
 *
 * It reads one cursor page at a time and "Show more" follows the cursor, as the
 * resident registry does: the screen says how many are shown and whether more
 * are available, never "page 1 of N", because the server sends no total
 * (`DL-161`). There is no sort — the order is the registry's, alphabetical
 * (`DL-187`).
 */
@Component({
  selector: 'app-beneficiary-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTable,
    HasPermissionDirective,
    Icon,
    PageHeader,
    PesoPipe,
    RelativeTimePipe,
    RouterLink,
    SavedViewsBar,
  ],
  templateUrl: './beneficiary-list-page.html',
  styleUrl: './beneficiary-list-page.scss',
})
export class BeneficiaryListPage {
  private readonly repository = inject(BENEFICIARY_REPOSITORY);
  private readonly programs = inject(PROGRAM_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = BENEFICIARIES_COPY.list;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly standings = BENEFICIARY_ROLES;

  private readonly personCell =
    viewChild.required<TemplateRef<{ $implicit: BeneficiarySummary }>>('personCell');
  private readonly standingCell =
    viewChild.required<TemplateRef<{ $implicit: BeneficiarySummary }>>('standingCell');
  private readonly programmesCell =
    viewChild.required<TemplateRef<{ $implicit: BeneficiarySummary }>>('programmesCell');
  private readonly receivedCell =
    viewChild.required<TemplateRef<{ $implicit: BeneficiarySummary }>>('receivedCell');
  private readonly lastCell =
    viewChild.required<TemplateRef<{ $implicit: BeneficiarySummary }>>('lastCell');

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(map((params) => readBeneficiaryQuery(params))),
    { initialValue: readBeneficiaryQuery(this.route.snapshot.queryParamMap) },
  );

  protected readonly searchText = signal(this.query().filter.search ?? '');

  /** Further pages of the reading the first page began; emptied whenever the filter changes. */
  private readonly further = signal<readonly CursorPage<BeneficiarySummary>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => {
        this.searchText.set(query.filter.search ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap((query) =>
        toViewState(this.repository.list(query.filter, { limit: PAGE_SIZE, cursor: null })),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<BeneficiarySummary>> },
  );

  /** Only to populate the programme filter; the list itself never needs it. */
  protected readonly programList = toSignal(this.programs.listActive(), {
    initialValue: [] as readonly AssistanceProgram[],
  });

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly rows = computed<readonly BeneficiarySummary[]>(() => [
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
  protected readonly hasFilters = computed(() => isBeneficiaryFilterActive(this.filter()));
  protected readonly filterParams = computed(() => beneficiaryFilterParams(this.filter()));
  protected readonly currentUserId = computed(() => this.session.user()?.id ?? null);
  /** Warned about rather than silently returning nothing (`isPeriodReversed`). */
  protected readonly periodReversed = computed(() => isPeriodReversed(this.filter()));

  protected readonly rowKey = (row: BeneficiarySummary): string => row.residentId;

  protected readonly columns = computed<readonly TableColumn<BeneficiarySummary>[]>(() => [
    { key: 'person', header: this.copy.columnPerson, cell: this.personCell() },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      value: (row) => barangayName(row.barangayId),
    },
    { key: 'standing', header: this.copy.columnStanding, cell: this.standingCell() },
    { key: 'programmes', header: this.copy.columnProgrammes, cell: this.programmesCell() },
    {
      key: 'events',
      header: this.copy.columnEvents,
      align: 'end',
      width: '90px',
      value: (row) => String(row.assistanceEventCount),
    },
    {
      key: 'received',
      header: this.copy.columnReceived,
      align: 'end',
      cell: this.receivedCell(),
    },
    { key: 'last', header: this.copy.columnLast, cell: this.lastCell() },
  ]);

  protected detailLink(row: BeneficiarySummary): string {
    return `/beneficiaries/${row.residentId}`;
  }

  protected standingLabel(role: BeneficiaryRole): string {
    return BENEFICIARY_ROLE_LABELS[role];
  }

  protected standingOf(row: BeneficiarySummary): string {
    return describeStanding(row.standing);
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

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchText.set(value);
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

  protected onProgramme(event: Event): void {
    this.patch({ programme: selectValue(event) });
  }

  protected onStanding(event: Event): void {
    this.patch({ standing: selectValue(event) });
  }

  protected onFrom(event: Event): void {
    this.patch({ from: inputValue(event) });
  }

  protected onTo(event: Event): void {
    this.patch({ to: inputValue(event) });
  }

  protected onOnlyDuplicates(event: Event): void {
    this.patch({ duplicates: (event.target as HTMLInputElement).checked ? 'true' : null });
  }

  protected clearFilters(): void {
    this.searchText.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  /** Follows the cursor one page further, for the filter the first page was read with. */
  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }
    const filter: BeneficiaryFilter = this.filter();
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

function inputValue(event: Event): string | null {
  return (event.target as HTMLInputElement).value || null;
}
