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
import { switchMap, tap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  SECTOR_APPLICATION_REPOSITORY,
  SECTOR_APPLICATION_STATUS_CATALOG,
  SECTOR_APPLICATION_STATUSES,
  type CursorPage,
  type SectorApplication,
  type SectorApplicationStatus,
} from '@domain/index';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { liveViewState, unlessPaged } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import { ListChangedNotice } from '@shared/ui/list-changed-notice/list-changed-notice';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { SectorApplicationReview } from './sector-application-review';
import { SECTOR_APPLICATIONS_COPY } from './sector-applications.copy';

const PAGE_SIZE = 20;

/** The queue's rows are the applications and nothing else (`DL-222`). */
export const SECTOR_APPLICATIONS_TOPICS: readonly LiveTopic[] = ['sector-applications'];

/**
 * Sector applications from the residents' app (`DL-215`). Inbox pattern, as the verification queue:
 * a list a page at a time, waiting first and oldest first, and one application reviewed in a
 * centred dialog. A decision reads the list again, so the row moves out of "Waiting".
 */
@Component({
  selector: 'app-sector-applications-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DataTable,
    ListChangedNotice,
    Modal,
    PageHeader,
    SectorApplicationReview,
    StatusBadge,
  ],
  templateUrl: './sector-applications-page.html',
  styleUrl: './sector-applications.scss',
})
export class SectorApplicationsPage {
  private readonly repository = inject(SECTOR_APPLICATION_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly live = inject(LiveUpdates);

  protected readonly copy = SECTOR_APPLICATIONS_COPY;
  protected readonly catalog = SECTOR_APPLICATION_STATUS_CATALOG;
  protected readonly statuses = SECTOR_APPLICATION_STATUSES;

  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: SectorApplication }>>('statusCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: SectorApplication }>>('actionCell');

  protected readonly status = signal<SectorApplicationStatus>('pending');
  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<SectorApplication>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  /** A hint arrived while more than the first page was on screen (`DL-222`). */
  protected readonly listChanged = signal(false);

  /**
   * A new application or a colleague's decision re-reads the first page quietly, unless more is
   * loaded (`DL-222`). The review dialog holds its own application in `selected`, so a re-read
   * neither closes it nor changes what is being reviewed.
   */
  protected readonly first = toSignal(
    toObservable(computed(() => ({ status: this.status(), generation: this.generation() }))).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.listChanged.set(false);
      }),
      switchMap(({ status }) =>
        liveViewState(
          () => this.repository.list({ limit: PAGE_SIZE, cursor: null }, status),
          unlessPaged(
            this.live.changes(SECTOR_APPLICATIONS_TOPICS),
            () => this.further().length > 0 || this.loadingMore(),
            () => this.listChanged.set(true),
          ),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<SectorApplication>> },
  );

  protected readonly rows = computed<readonly SectorApplication[]>(() => [
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

  protected readonly rowKey = (row: SectorApplication): string => row.id;

  protected readonly columns = computed<readonly TableColumn<SectorApplication>[]>(() => [
    {
      key: 'applicant',
      header: this.copy.columnApplicant,
      value: (row) => row.applicant.name ?? this.copy.noName,
    },
    {
      key: 'barangay',
      header: this.copy.columnBarangay,
      value: (row) => row.applicant.barangayName ?? this.copy.noBarangay,
    },
    {
      key: 'sector',
      header: this.copy.columnSector,
      value: (row) => this.copy.sectors[row.sector],
    },
    {
      key: 'submitted',
      header: this.copy.columnSubmitted,
      value: (row) => formatDisplayDate(row.submittedAt, 'date-time', this.locale) ?? '',
    },
    {
      key: 'proofs',
      header: this.copy.columnProofs,
      align: 'end',
      value: (row) => String(row.proofCount),
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

  protected readonly selected = signal<SectorApplication | null>(null);

  protected reviewLabel(row: SectorApplication): string {
    return this.copy.reviewLabel(
      row.applicant.name ?? this.copy.noName,
      this.copy.sectors[row.sector],
    );
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const status = SECTOR_APPLICATION_STATUSES.find((candidate) => candidate === value);
    if (status !== undefined) this.status.set(status);
  }

  protected open(row: SectorApplication): void {
    this.selected.set(row);
  }

  protected close(): void {
    this.selected.set(null);
  }

  /** A decision stands on the server; the list is read again so the row leaves "Waiting". */
  protected onDecided(answer: SectorApplication): void {
    this.selected.set(answer);
    this.reload();
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;
    const status = this.status();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list({ limit: PAGE_SIZE, cursor }, status)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (status === this.status()) this.further.update((pages) => [...pages, page]);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }
}
