import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import { NotConnected } from '@core/access/not-connected';
import { SessionStore } from '@core/auth/session.store';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  RESIDENT_REPOSITORY,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTOR_LABELS,
  type CursorPage,
  type ResidentFilter,
  type ResidentView,
  type VulnerabilitySector,
} from '@domain/index';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { PersonPicker } from '@shared/residents/person-picker';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { residentColumns } from './resident-columns';
import { readResidentFilter } from './resident-query';
import {
  RESIDENTS_COPY,
  SECTOR_PAGE_SECTORS,
  SECTOR_PAGES,
  type SectorPageSector,
} from './residents.copy';

const PAGE_SIZE = 20;

/** What the dialog is doing: adding somebody to the sector, or ending one person's membership. */
type SectorAct = { readonly kind: 'add' } | { readonly kind: 'end'; readonly view: ResidentView };

/**
 * One statutory sector's members — senior citizens, persons with disability, solo parents — as a
 * list (`DL-210`, the CitizenSector mock-ups).
 *
 * **The list is the registry, narrowed.** It reads `RESIDENT_REPOSITORY.list` with the page's sector
 * fixed, in the server's order, a cursor page at a time, with the registry's columns. Search and
 * barangay live in the URL like the registry's; the sector is the route's, never a parameter a
 * reader could change into a protected one.
 *
 * **Adding and ending are recorded acts with a reason** (`recordSector`, `endSector`): what was
 * checked — a Senior Citizen ID, a PWD card — is the evidence the membership rests on, and the
 * server keeps it in the sector's history. The dialog says so before its button.
 *
 * **What the API does not send is named, not drawn.** The count tiles, the "needs attention" cards
 * and the sector's own fields (ID number, validity, social pension, disability type) need fields
 * `GET /office/residents` does not have; each panel says so in its place.
 */
@Component({
  selector: 'app-sector-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DataTable,
    HasPermissionDirective,
    Icon,
    InitialsPipe,
    Modal,
    NotConnected,
    PageHeader,
    PersonPicker,
    RouterLink,
  ],
  templateUrl: './sector-page.html',
  styleUrls: ['./resident-list-page.scss', './sector-page.scss'],
})
export class SectorPage {
  private readonly repository = inject(RESIDENT_REPOSITORY);
  private readonly session = inject(SessionStore);
  private readonly notifications = inject(NotificationStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** From the route's data: each of the three pages is its own literal route. */
  readonly sector = input.required<SectorPageSector>();

  protected readonly copy = RESIDENTS_COPY.sector;
  protected readonly listCopy = RESIDENTS_COPY.list;
  protected readonly pages = SECTOR_PAGES;
  protected readonly order = SECTOR_PAGE_SECTORS;
  protected readonly barangays = TAYTAY_BARANGAYS;
  protected readonly page = computed(() => SECTOR_PAGES[this.sector()]);

  protected readonly canChange = computed(() => this.session.permissions().has('resident.update'));

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('nameCell');
  private readonly sectorsCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('sectorsCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('statusCell');
  private readonly endCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('endCell');

  /** Search and barangay from the URL; the sector is always the page's own. */
  private readonly urlFilter = toSignal(
    this.route.queryParamMap.pipe(map((params) => readResidentFilter(params))),
    { initialValue: readResidentFilter(this.route.snapshot.queryParamMap) },
  );
  protected readonly filter = computed<ResidentFilter>(() => {
    const { search, barangayId } = this.urlFilter();
    return {
      ...(search === undefined ? {} : { search }),
      ...(barangayId === undefined ? {} : { barangayId }),
      sector: this.sector(),
    };
  });
  protected readonly hasFilters = computed(() => {
    const { search, barangayId } = this.urlFilter();
    return search !== undefined || barangayId !== undefined;
  });

  protected readonly searchText = signal(this.urlFilter().search ?? '');
  private readonly further = signal<readonly CursorPage<ResidentView>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ filter: this.filter(), generation: this.generation() }))).pipe(
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
    { initialValue: LOADING as ViewState<CursorPage<ResidentView>> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');
  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });
  protected readonly rows = computed<readonly ResidentView[]>(() => [
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

  protected readonly rowKey = (view: ResidentView): string => view.resident.id;

  protected readonly columns = computed<readonly TableColumn<ResidentView>[]>(() => [
    ...residentColumns(this.listCopy, {
      name: this.nameCell(),
      sectors: this.sectorsCell(),
      status: this.statusCell(),
    }),
    ...(this.canChange()
      ? [{ key: 'end', header: this.copy.columnEnd, hideHeader: true, cell: this.endCell() }]
      : []),
  ]);

  /* ── the add / end dialog ───────────────────────────────────────────────── */

  protected readonly act = signal<SectorAct | null>(null);
  protected readonly chosen = signal<ResidentView | null>(null);
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly problem = signal<string | null>(null);

  protected readonly dialogHeading = computed(() => {
    const act = this.act();
    if (act === null) {
      return '';
    }
    return act.kind === 'add'
      ? this.copy.addHeading(this.page().phrase)
      : this.copy.endHeading(act.view.listedName, this.page().phrase);
  });

  protected detailLink(view: ResidentView): string {
    return `/residents/${view.resident.id}`;
  }

  protected sectorLabel(sector: VulnerabilitySector): string {
    return VULNERABILITY_SECTOR_LABELS[sector];
  }

  protected openAdd(): void {
    this.open({ kind: 'add' });
  }

  protected openEnd(view: ResidentView): void {
    this.open({ kind: 'end', view });
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.act.set(null);
    }
  }

  /** The one place a sector is recorded or ended: after the effects, with a reason. */
  protected commit(): void {
    const act = this.act();
    const reason = this.reason().trim();
    if (act === null || this.busy()) {
      return;
    }
    const person = act.kind === 'add' ? this.chosen() : act.view;
    if (person === null) {
      this.problem.set(this.copy.needPerson);
      return;
    }
    if (reason.length === 0) {
      this.problem.set(this.copy.needReason);
      return;
    }
    const sector = this.sector();
    const call =
      act.kind === 'add'
        ? this.repository.recordSector(person.resident.id, sector, reason)
        : this.repository.endSector(person.resident.id, sector, reason);
    this.busy.set(true);
    this.problem.set(null);
    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false);
        this.act.set(null);
        this.notifications.success(
          act.kind === 'add'
            ? this.copy.added(person.listedName, this.page().phrase)
            : this.copy.ended(person.listedName, this.page().phrase),
        );
        // Read again from the server rather than patched: what is listed is what the API holds.
        this.generation.update((n) => n + 1);
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.problem.set(failureReason(failure) ?? this.copy.failed);
      },
    });
  }

  private open(act: SectorAct): void {
    this.chosen.set(null);
    this.reason.set('');
    this.problem.set(null);
    this.act.set(act);
  }

  /* ── filters, paging ────────────────────────────────────────────────────── */

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

  private patch(changes: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
