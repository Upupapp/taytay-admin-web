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
import { SessionStore } from '@core/auth/session.store';
import {
  BENEFICIARY_REPOSITORY,
  BENEFICIARY_ROLE_LABELS,
  BENEFICIARY_ROLES,
  PROGRAM_REPOSITORY,
  TAYTAY_BARANGAYS,
  barangayName,
  describeStanding,
  emptyPage,
  isBeneficiaryFilterActive,
  isPeriodReversed,
  type AssistanceProgram,
  type BeneficiaryRole,
  type BeneficiarySummary,
  type Page,
  type SortSpec,
} from '@domain/index';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { PesoPipe } from '@shared/pipes/peso.pipe';
import { RelativeTimePipe } from '@shared/pipes/relative-time.pipe';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SavedViewsBar } from '@shared/ui/saved-views/saved-views-bar';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { BENEFICIARIES_COPY } from './beneficiaries.copy';
import { beneficiaryFilterParams, readBeneficiaryQuery } from './beneficiary-query';


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
 */
@Component({
  selector: 'app-beneficiary-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTable,
    HasPermissionDirective,
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

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      tap((query) => this.searchText.set(query.filter.search ?? '')),
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<BeneficiarySummary>> },
  );

  /** Only to populate the programme filter; the list itself never needs it. */
  protected readonly programList = toSignal(this.programs.listActive(), {
    initialValue: [] as readonly AssistanceProgram[],
  });

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(
    () => valueOf(this.state()) ?? emptyPage<BeneficiarySummary>(),
  );
  protected readonly rows = computed(() => this.page().items);
  protected readonly filter = computed(() => this.query().filter);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => isBeneficiaryFilterActive(this.filter()));
  protected readonly filterParams = computed(() => beneficiaryFilterParams(this.filter()));
  protected readonly currentUserId = computed(() => this.session.user()?.id ?? null);
  /** Warned about rather than silently returning nothing (`isPeriodReversed`). */
  protected readonly periodReversed = computed(() => isPeriodReversed(this.filter()));

  protected readonly rowKey = (row: BeneficiarySummary): string => row.residentId;

  protected readonly columns = computed<readonly TableColumn<BeneficiarySummary>[]>(() => [
    { key: 'person', header: this.copy.columnPerson, sortField: 'name', cell: this.personCell() },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      sortField: 'barangay',
      value: (row) => barangayName(row.barangayId),
    },
    { key: 'standing', header: this.copy.columnStanding, cell: this.standingCell() },
    { key: 'programmes', header: this.copy.columnProgrammes, cell: this.programmesCell() },
    {
      key: 'events',
      header: this.copy.columnEvents,
      sortField: 'assistanceEventCount',
      align: 'end',
      width: '90px',
      value: (row) => String(row.assistanceEventCount),
    },
    {
      key: 'received',
      header: this.copy.columnReceived,
      sortField: 'totalReleased',
      align: 'end',
      cell: this.receivedCell(),
    },
    {
      key: 'last',
      header: this.copy.columnLast,
      sortField: 'lastAssistanceAt',
      cell: this.lastCell(),
    },
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

function inputValue(event: Event): string | null {
  return (event.target as HTMLInputElement).value || null;
}
