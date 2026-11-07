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
  ISSUANCE_REFERENCE_INCOMPLETE,
  ISSUANCE_REPOSITORY,
  ISSUANCE_STATUS_CATALOG,
  ISSUANCE_STATUSES,
  ISSUANCE_TERMINAL_STATUSES,
  isOpenIssuanceStatus,
  oldestWaitingFirst,
  wholeIssuanceReference,
  type AppAccountId,
  type CursorPage,
  type IssuanceListFilter,
  type IssuanceQueueFilter,
  type IssuanceRequestSummary,
  type IssuanceType,
  type IssuanceTypeId,
} from '@domain/index';
import { readText } from '@shared/forms/form-values';
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

/**
 * What the URL asks the queue for. `?status=` absent is every open status; `?type=` absent is every
 * document; `?resident=` is one resident's requests. `?reference=` finds one request by its whole
 * number in whatever status it is, and the other narrowings stand aside while it does (`DL-186`).
 */
export interface IssuanceQueueQuery {
  readonly filter: IssuanceQueueFilter;
  /** As given in the URL; part of a number is refused by the read, never matched. */
  readonly reference: string | null;
}

export function readIssuanceQueueQuery(params: ParamMap): IssuanceQueueQuery {
  const status = ISSUANCE_STATUSES.find((candidate) => candidate === params.get('status')) ?? null;
  const type = params.get('type');
  const resident = params.get('resident')?.trim() ?? '';
  const reference = params.get('reference')?.trim() ?? '';
  const filter: IssuanceQueueFilter = {
    status,
    typeId: type === null || type === '' ? null : asId<IssuanceTypeId>(type),
    ...(resident === '' ? {} : { residentAccountId: asId<AppAccountId>(resident) }),
  };
  return { filter, reference: reference === '' ? null : reference };
}

/**
 * The filter a read pages through, or `null` when the open requests are read whole: a reference in
 * every status, or one ended status.
 */
function pagedFilter(query: IssuanceQueueQuery): IssuanceListFilter | null {
  if (query.reference !== null) {
    return { status: null, typeId: null, reference: query.reference };
  }
  const { status, typeId, residentAccountId } = query.filter;
  if (status === null || isOpenIssuanceStatus(status)) {
    return null;
  }
  return {
    status,
    typeId,
    ...(residentAccountId === undefined ? {} : { residentAccountId }),
  };
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
 * **Found by its whole number** (`DL-186`). A resident quotes the reference at the counter; the box
 * finds that one request in whatever status, inside the offices this account reads. Part of a number
 * is refused before it is sent, as the API refuses it. `?resident=` narrows the queue to one
 * resident's requests, which the request page links to.
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

  private readonly query = toSignal(this.route.queryParamMap.pipe(map(readIssuanceQueueQuery)), {
    initialValue: readIssuanceQueueQuery(this.route.snapshot.queryParamMap),
  });

  protected readonly filter = computed(() => this.query().filter);
  /** The whole number being looked up, or `null` for the queue (`DL-186`). */
  protected readonly reference = computed(() => this.query().reference);
  protected readonly forResident = computed(() => this.filter().residentAccountId !== undefined);

  /** The box as typed; the URL takes it only once it is a whole number. */
  protected readonly referenceText = signal(this.query().reference ?? '');
  protected readonly referenceProblem = signal<string | null>(null);

  protected readonly statusValue = computed(() => this.filter().status ?? 'open');
  protected readonly typeValue = computed(() => this.filter().typeId ?? '');
  protected readonly ended = computed(() => {
    const status = this.filter().status;
    return this.reference() !== null || (status !== null && !isOpenIssuanceStatus(status));
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
    toObservable(computed(() => ({ query: this.query(), generation: this.generation() }))).pipe(
      tap(({ query }) => {
        this.referenceText.set(query.reference ?? '');
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(({ query }) => toViewState(this.read(query))),
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

  protected readonly emptyMessage = computed(() => {
    if (this.reference() !== null) {
      return this.copy.emptyReference;
    }
    return this.filter().status === null ? this.copy.emptyOpen : this.copy.emptyOther;
  });

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

  protected onReferenceInput(event: Event): void {
    this.referenceText.set(readText(event));
  }

  /**
   * Looks a request up by its whole number, in any status. Part of one is said here and never sent:
   * the API matches the whole number only (`DL-186`).
   */
  protected findReference(): void {
    const reference = wholeIssuanceReference(this.referenceText());
    if (reference === null) {
      this.referenceProblem.set(ISSUANCE_REFERENCE_INCOMPLETE);
      return;
    }
    this.referenceProblem.set(null);
    this.referenceText.set(reference);
    this.navigate({ reference });
  }

  protected clearReference(): void {
    this.referenceText.set('');
    this.referenceProblem.set(null);
    this.navigate({ reference: null });
  }

  protected clearResident(): void {
    this.navigate({ resident: null });
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    const query = this.query();
    const paged = pagedFilter(query);
    if (cursor === null || paged === null || this.loadingMore()) {
      return;
    }

    const generation = this.generation();
    this.loadingMore.set(true);
    this.moreFailed.set(false);

    this.repository
      .list(paged, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The list was read again meanwhile; this page continues one nobody is looking at.
          if (generation === this.generation() && query === this.query()) {
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

  private read(query: IssuanceQueueQuery): Observable<QueueAnswer> {
    const paged = pagedFilter(query);
    if (paged !== null) {
      return this.repository
        .list(paged, { limit: PAGE_SIZE, cursor: null })
        .pipe(map((page) => ({ rows: page.items, page })));
    }
    return this.repository
      .waiting(query.filter)
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
