import { DatePipe, formatDate } from '@angular/common';
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
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';

import {
  DEFAULT_VERIFICATION_FILTER,
  ID_DOCUMENT_TYPE_LABELS,
  VERIFICATION_REPOSITORY,
  VERIFICATION_STATUS_CATALOG,
  VERIFICATION_STATUSES,
  type CursorPage,
  type VerificationFilter,
  type VerificationRequest,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { VerificationReview } from './verification-review';
import { VERIFICATION_COPY } from './verification.copy';

/** One request at a time from the server; the API's own default, and well under its ceiling. */
const PAGE_SIZE = 20;

/** `?status=` absent is the waiting queue; `all` is every status. Anything else reads as absent. */
function readFilter(params: ParamMap): VerificationFilter {
  const raw = params.get('status');
  if (raw === 'all') {
    return { status: null };
  }
  return { status: VERIFICATION_STATUSES.find((status) => status === raw) ?? 'pending' };
}

/**
 * The residents' ID verification queue (`DL-167`).
 *
 * **Pending first**: the queue opens on what is waiting, and the other statuses are a choice away,
 * kept in the URL like every list's filters. The server orders each status newest first and offers
 * no other order, so the screen says so rather than implying a fairness it cannot provide.
 *
 * **A browsable list, so a page at a time** (`DL-161`). The server sends cursors and no total, so the
 * screen says how many it shows and whether more are available — never "page 1 of N", which would
 * assert a number nobody computed. "Show more" appends the next page.
 *
 * **There is no record to open by address.** The API has no read of one verification request, so a
 * review opens in a drawer beside the list (`Drawer`: context while keeping one's place) rather than
 * at a route a reload could not answer. After a decision the queue is read again from the server,
 * never patched: a colleague may have decided others meanwhile.
 */
@Component({
  selector: 'app-verification-queue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, DatePipe, Drawer, PageHeader, StatusBadge, VerificationReview],
  templateUrl: './verification-queue-page.html',
  styleUrl: './verification-queue-page.scss',
})
export class VerificationQueuePage {
  private readonly repository = inject(VERIFICATION_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  protected readonly copy = VERIFICATION_COPY.queue;
  protected readonly catalog = VERIFICATION_STATUS_CATALOG;
  protected readonly statuses = VERIFICATION_STATUSES;

  private readonly submittedCell =
    viewChild.required<TemplateRef<{ $implicit: VerificationRequest }>>('submittedCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: VerificationRequest }>>('statusCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: VerificationRequest }>>('actionCell');

  protected readonly filter = toSignal(this.route.queryParamMap.pipe(map(readFilter)), {
    initialValue: readFilter(this.route.snapshot.queryParamMap),
  });

  /** The select's value: the status, or `all`. */
  protected readonly filterValue = computed(() => this.filter().status ?? 'all');

  /** Bumped to read the queue again — after a decision, or on "Try again". */
  private readonly generation = signal(0);

  /** Pages after the first, appended by "Show more"; emptied whenever the first is read again. */
  private readonly further = signal<readonly CursorPage<VerificationRequest>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly first = toSignal(
    toObservable(computed(() => ({ filter: this.filter(), generation: this.generation() }))).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(({ filter }) =>
        toViewState(this.repository.list(filter, { limit: PAGE_SIZE, cursor: null })),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<VerificationRequest>> },
  );

  protected readonly rows = computed<readonly VerificationRequest[]>(() => [
    ...(valueOf(this.first())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);

  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.first()) ?? null,
  );

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  protected readonly emptyMessage = computed(() =>
    this.filter().status === DEFAULT_VERIFICATION_FILTER.status
      ? this.copy.emptyPending
      : this.copy.emptyOther,
  );

  protected readonly rowKey = (request: VerificationRequest): string => request.id;

  protected readonly columns = computed<readonly TableColumn<VerificationRequest>[]>(() => [
    { key: 'submitted', header: this.copy.columnSubmitted, cell: this.submittedCell() },
    {
      key: 'id-type',
      header: this.copy.columnId,
      value: (request) => ID_DOCUMENT_TYPE_LABELS[request.idType],
    },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
    {
      key: 'review',
      header: this.copy.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly selected = signal<VerificationRequest | null>(null);

  protected onFilter(event: Event): void {
    const value = event.target instanceof HTMLSelectElement ? event.target.value : 'pending';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: value === DEFAULT_VERIFICATION_FILTER.status ? null : value },
      queryParamsHandling: 'merge',
    });
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) {
      return;
    }

    const generation = this.generation();
    const filter = this.filter();
    this.loadingMore.set(true);
    this.moreFailed.set(false);

    this.repository
      .list(filter, { limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // The queue was read again meanwhile; this page continues a list nobody is looking at.
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

  protected open(request: VerificationRequest): void {
    this.selected.set(request);
  }

  protected close(): void {
    this.selected.set(null);
  }

  /** Keeps the decided request in the drawer, and reads the queue again from the server. */
  protected onDecided(request: VerificationRequest): void {
    this.selected.set(request);
    this.reload();
  }

  protected reviewLabel(request: VerificationRequest): string {
    return this.copy.reviewLabel(formatDate(request.submittedAt, 'd MMM y, HH:mm', this.locale));
  }
}
