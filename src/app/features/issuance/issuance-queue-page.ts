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
import { ActivatedRoute, Router, RouterLink, type ParamMap } from '@angular/router';
import { map, switchMap, tap, type Observable } from 'rxjs';

import { HasPermissionDirective } from '@core/access/has-permission.directive';
import {
  asId,
  describeIssuanceWait,
  describeProcessingStandard,
  ISSUANCE_BOUNDARIES,
  ISSUANCE_OPEN_STATUSES,
  ISSUANCE_REPOSITORY,
  ISSUANCE_STATUS_CATALOG,
  ISSUANCE_STATUSES,
  ISSUANCE_TERMINAL_STATUSES,
  isOpenIssuanceStatus,
  oldestWaitingFirst,
  type CursorPage,
  type IssuanceQueueFilter,
  type IssuanceRequestSummary,
  type IssuanceType,
  type IssuanceTypeId,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { ISSUANCE_COPY } from './issuance.copy';

/** One page at a time for an ended status; the API's default. */
const PAGE_SIZE = 20;

/**
 * What the queue holds: every open request read whole (`page: null`), or the first page of an
 * ended status, with its cursor.
 */
interface QueueAnswer {
  readonly rows: readonly IssuanceRequestSummary[];
  readonly page: CursorPage<IssuanceRequestSummary> | null;
}

/** `?status=` absent is every open status; `?type=` absent is every document. */
function readFilter(params: ParamMap): IssuanceQueueFilter {
  const status = ISSUANCE_STATUSES.find((candidate) => candidate === params.get('status')) ?? null;
  const type = params.get('type');
  return { status, typeId: type === null || type === '' ? null : asId<IssuanceTypeId>(type) };
}

/**
 * Residents' document requests, as the issuing office works them (`DL-184`).
 *
 * **Oldest waiting first.** The queue opens on every request still being worked, ordered by how
 * long each has been in its status — whoever owes the next act, the office or the resident, is said
 * on the row. The server pages newest filed first, so the open requests are read **whole**
 * (`IssuanceRepository.waiting`) and refused past a ceiling rather than cut short (`DL-161`): the
 * page left off would be the oldest one.
 *
 * **Ended requests only grow**, so a status that has ended is browsed a page at a time in the
 * server's order, and the screen says more exist rather than a total nobody computed.
 *
 * **No deadline is invented** (`DL-101`). The waiting time is in calendar days; the office's own
 * standard is in working days, from its Citizen's Charter, and is shown beside it — never
 * subtracted from it, because this console holds no holiday calendar.
 */
@Component({
  selector: 'app-issuance-queue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, HasPermissionDirective, PageHeader, RouterLink, StatusBadge],
  templateUrl: './issuance-queue-page.html',
  styleUrl: './issuance-queue-page.scss',
})
export class IssuanceQueuePage {
  private readonly repository = inject(ISSUANCE_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = ISSUANCE_COPY.queue;
  protected readonly boundaries = ISSUANCE_BOUNDARIES;
  protected readonly catalog = ISSUANCE_STATUS_CATALOG;
  protected readonly openStatuses = ISSUANCE_OPEN_STATUSES;
  protected readonly endedStatuses = ISSUANCE_TERMINAL_STATUSES;

  /** Read once: the waiting times on screen are as of when the page opened. */
  private readonly now = new Date();

  private readonly referenceCell =
    viewChild.required<TemplateRef<{ $implicit: IssuanceRequestSummary }>>('referenceCell');
  private readonly documentCell =
    viewChild.required<TemplateRef<{ $implicit: IssuanceRequestSummary }>>('documentCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: IssuanceRequestSummary }>>('statusCell');

  protected readonly filter = toSignal(this.route.queryParamMap.pipe(map(readFilter)), {
    initialValue: readFilter(this.route.snapshot.queryParamMap),
  });

  protected readonly statusValue = computed(() => this.filter().status ?? 'open');
  protected readonly typeValue = computed(() => this.filter().typeId ?? '');
  protected readonly ended = computed(() => {
    const status = this.filter().status;
    return status !== null && !isOpenIssuanceStatus(status);
  });

  /** The catalogue residents choose from — every office's active types — for the type filter. */
  protected readonly types = toSignal(toViewState(this.repository.catalogue()), {
    initialValue: LOADING as ViewState<readonly IssuanceType[]>,
  });
  protected readonly typeOptions = computed(() => valueOf(this.types()) ?? []);
  private readonly standards = computed(
    () => new Map(this.typeOptions().map((type) => [type.id, type.processingDays])),
  );

  /** Bumped to read the queue again, on "Try again". */
  private readonly generation = signal(0);

  /** Pages after the first of an ended status, appended by "Show more". */
  private readonly further = signal<readonly CursorPage<IssuanceRequestSummary>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly first = toSignal(
    toObservable(computed(() => ({ filter: this.filter(), generation: this.generation() }))).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(({ filter }) => toViewState(this.read(filter))),
    ),
    { initialValue: LOADING as ViewState<QueueAnswer> },
  );

  protected readonly rows = computed<readonly IssuanceRequestSummary[]>(() => [
    ...(valueOf(this.first())?.rows ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);

  /** `null` when the list was read whole: there is no next page to speak of. */
  private readonly lastPage = computed(() => {
    const first = valueOf(this.first())?.page ?? null;
    return first === null ? null : (this.further().at(-1) ?? first);
  });

  protected readonly whole = computed(() => {
    const answer = valueOf(this.first());
    return answer !== null && answer.page === null;
  });

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  protected readonly emptyMessage = computed(() =>
    this.filter().status === null ? this.copy.emptyOpen : this.copy.emptyOther,
  );

  protected readonly rowKey = (request: IssuanceRequestSummary): string => request.id;

  protected readonly columns = computed<readonly TableColumn<IssuanceRequestSummary>[]>(() => [
    { key: 'reference', header: this.copy.columnReference, cell: this.referenceCell() },
    {
      key: 'resident',
      header: this.copy.columnResident,
      value: (request) => request.resident.name ?? this.copy.noName,
    },
    { key: 'document', header: this.copy.columnDocument, cell: this.documentCell() },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      key: 'waiting',
      header: this.copy.columnWaiting,
      value: (request) => describeIssuanceWait(request, this.now),
    },
    {
      key: 'standard',
      header: this.copy.columnStandard,
      value: (request) => this.standardFor(request),
    },
  ]);

  protected onStatus(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : 'open';
    this.navigate({ status: value === 'open' ? null : value });
  }

  protected onType(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
    this.navigate({ type: value === '' ? null : value });
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    const status = this.filter().status;
    if (cursor === null || status === null || this.loadingMore()) {
      return;
    }

    const generation = this.generation();
    const filter = this.filter();
    this.loadingMore.set(true);
    this.moreFailed.set(false);

    this.repository
      .list({ status, typeId: filter.typeId }, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The list was read again meanwhile; this page continues one nobody is looking at.
          if (generation === this.generation() && filter === this.filter()) {
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

  protected typeOptionLabel(type: IssuanceType): string {
    return `${type.name} — ${type.office.name}`;
  }

  private standardFor(request: IssuanceRequestSummary): string {
    const standards = this.standards();
    return standards.has(request.type.id)
      ? describeProcessingStandard(standards.get(request.type.id) ?? null)
      : '—';
  }

  private read(filter: IssuanceQueueFilter): Observable<QueueAnswer> {
    const status = filter.status;
    if (status !== null && !isOpenIssuanceStatus(status)) {
      return this.repository
        .list({ status, typeId: filter.typeId }, { limit: PAGE_SIZE, cursor: null })
        .pipe(map((page) => ({ rows: page.items, page })));
    }
    return this.repository
      .waiting(filter)
      .pipe(map((rows) => ({ rows: oldestWaitingFirst(rows), page: null })));
  }

  private navigate(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
