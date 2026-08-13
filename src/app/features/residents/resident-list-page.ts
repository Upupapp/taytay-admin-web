import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  ageInYears,
  barangayName,
  DEFAULT_PAGE_SIZE,
  emptyPage,
  formatPersonNameListed,
  hasSensitiveSector,
  RESIDENT_REPOSITORY,
  TAYTAY_BARANGAYS,
  type BarangayId,
  type Page,
  type PageRequest,
  type Resident,
  type ResidentFilter,
  type ResidentSortField,
  type SortSpec,
} from '@domain/index';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import type { TableColumn } from '@shared/ui/data-table/table-column';

interface ResidentQuery {
  readonly filter: ResidentFilter;
  readonly page: PageRequest<ResidentSortField>;
}

/**
 * Beneficiary registry.
 *
 * Doubles as the reference implementation for list screens: repository token in,
 * `ViewState` out, `DataTable` for presentation, and masking driven by the
 * permission service rather than by the adapter.
 */
@Component({
  selector: 'app-resident-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, PageHeader],
  templateUrl: './resident-list-page.html',
  styleUrl: './resident-list-page.scss',
})
export class ResidentListPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly permissions = inject(PermissionService);

  protected readonly barangays = TAYTAY_BARANGAYS;

  private readonly sectorsCell =
    viewChild.required<TemplateRef<{ $implicit: Resident }>>('sectorsCell');

  private readonly query = signal<ResidentQuery>({
    filter: {},
    page: { page: 1, pageSize: DEFAULT_PAGE_SIZE, sort: { field: 'name', direction: 'asc' } },
  });

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) => toViewState(this.repository.list(query.filter, query.page))),
    ),
    { initialValue: LOADING as ViewState<Page<Resident>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly page = computed(() => valueOf(this.state()) ?? emptyPage<Resident>());
  protected readonly rows = computed(() => this.page().items);
  protected readonly sort = computed<SortSpec | null>(() => this.query().page.sort ?? null);
  protected readonly hasFilters = computed(() => {
    const filter = this.query().filter;
    return Boolean(filter.search) || Boolean(filter.barangayId);
  });

  protected readonly rowKey = (resident: Resident): string => resident.id;

  protected readonly columns = computed<readonly TableColumn<Resident>[]>(() => [
    {
      key: 'name',
      header: 'Resident',
      sortField: 'name',
      value: (resident) => this.displayName(resident),
    },
    {
      key: 'barangay',
      header: 'Barangay',
      sortField: 'barangay',
      value: (resident) => barangayName(resident.address.barangayId),
    },
    {
      key: 'age',
      header: 'Age',
      align: 'end',
      width: '80px',
      value: (resident) => `${ageInYears(resident.birthDate)}`,
    },
    { key: 'sectors', header: 'Sectors', cell: this.sectorsCell() },
    {
      key: 'contact',
      header: 'Mobile',
      value: (resident) => resident.contact.mobile ?? '—',
    },
  ]);

  /**
   * Names of residents flagged under a sensitive sector are masked unless the
   * user is cleared to open such records. The adapter always returns the full
   * record; suppression is a presentation decision, and the API enforces its
   * own copy of this rule.
   */
  protected displayName(resident: Resident): string {
    const listed = formatPersonNameListed(resident.name);
    if (!hasSensitiveSector(resident) || this.permissions.has('request.view-sensitive')) {
      return listed;
    }
    return `${resident.name.last}, ${resident.name.first.charAt(0)}. (restricted)`;
  }

  protected sectorsOf(resident: Resident): readonly string[] {
    if (hasSensitiveSector(resident) && !this.permissions.has('request.view-sensitive')) {
      return ['restricted'];
    }
    return resident.sectors;
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.patchFilter({ search: value.length > 0 ? value : undefined });
  }

  protected onBarangayChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patchFilter({ barangayId: value ? (value as BarangayId) : undefined });
  }

  protected onSortChanged(sort: SortSpec): void {
    this.query.update((query) => ({
      filter: query.filter,
      page: { ...query.page, page: 1, sort: sort as SortSpec<ResidentSortField> },
    }));
  }

  protected onPageChanged(page: number): void {
    this.query.update((query) => ({ filter: query.filter, page: { ...query.page, page } }));
  }

  protected clearFilters(): void {
    this.query.update((query) => ({ filter: {}, page: { ...query.page, page: 1 } }));
  }

  private patchFilter(patch: Partial<ResidentFilter>): void {
    this.query.update((query) => ({
      filter: { ...query.filter, ...patch },
      page: { ...query.page, page: 1 },
    }));
  }
}
