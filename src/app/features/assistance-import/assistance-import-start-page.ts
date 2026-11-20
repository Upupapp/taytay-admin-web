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
import { Router, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  ASSISTANCE_IMPORT_REPOSITORY,
  canWithdrawAssistanceImport,
  IMPORT_FILE_LIMITS,
  type AssistanceImportSummary,
  type CursorPage,
} from '@domain/index';
import { ImportSteps } from '@shared/imports/import-steps';
import { ImportTemplateDownload } from '@shared/imports/import-template-download';
import { DataFileField } from '@shared/media/data-file-field';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { liveViewState, unlessPaged } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { ListChangedNotice } from '@shared/ui/list-changed-notice/list-changed-notice';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { ASSISTANCE_IMPORT_COPY } from './assistance-import.copy';
import { AssistanceImportWithdraw } from './assistance-import-withdraw';

const PAGE_SIZE = 20;

/** The earlier imports, and what became of each once committed or withdrawn (`DL-222`). */
export const ASSISTANCE_IMPORT_LIST_TOPICS: readonly LiveTopic[] = ['imports'];

/**
 * Import past assistance, step 1 (`DL-228`): the template, choose a file, upload it for checking,
 * and the imports before it — each committed one withdrawable with a reason. The citizen import's
 * form pattern (`DL-214`).
 *
 * **Choosing a file sends nothing.** The limits stand before the picker, the effects before the
 * button, and only the button uploads.
 */
@Component({
  selector: 'app-assistance-import-start-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AssistanceImportWithdraw,
    DataFileField,
    DataTable,
    ImportSteps,
    ImportTemplateDownload,
    ListChangedNotice,
    PageHeader,
    RouterLink,
  ],
  templateUrl: './assistance-import-start-page.html',
  styleUrl: './assistance-import.scss',
})
export class AssistanceImportStartPage {
  private readonly repository = inject(ASSISTANCE_IMPORT_REPOSITORY);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly live = inject(LiveUpdates);

  protected readonly copy = ASSISTANCE_IMPORT_COPY;
  protected readonly limits = IMPORT_FILE_LIMITS;
  protected readonly template = () => this.repository.template();
  protected readonly canWithdraw = canWithdrawAssistanceImport;

  protected readonly file = signal<File | null>(null);
  protected readonly problem = signal('');
  protected readonly sending = signal(false);
  /** The import whose withdrawal is being confirmed. */
  protected readonly withdrawing = signal<AssistanceImportSummary | null>(null);

  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: AssistanceImportSummary }>>('actionCell');

  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<AssistanceImportSummary>[]>([]);
  protected readonly loadingMore = signal(false);
  /** A hint arrived while more than the first page was on screen (`DL-222`). */
  protected readonly listChanged = signal(false);

  /**
   * Only the list of earlier imports is live (`DL-222`): a hint re-reads its first page quietly,
   * unless more is loaded. The upload form above it keeps its own signals and re-reads nothing.
   */
  protected readonly state = toSignal(
    toObservable(this.generation).pipe(
      tap(() => {
        this.further.set([]);
        this.listChanged.set(false);
      }),
      switchMap(() =>
        liveViewState(
          () => this.repository.list({ limit: PAGE_SIZE, cursor: null }),
          unlessPaged(
            this.live.changes(ASSISTANCE_IMPORT_LIST_TOPICS),
            () => this.further().length > 0 || this.loadingMore(),
            () => this.listChanged.set(true),
          ),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<AssistanceImportSummary>> },
  );

  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });
  protected readonly rows = computed(() => [
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

  protected readonly rowKey = (row: AssistanceImportSummary): string => row.id;

  protected readonly columns = computed<readonly TableColumn<AssistanceImportSummary>[]>(() => [
    {
      key: 'file',
      header: this.copy.recent.columnFile,
      value: (row) => `${row.fileName} · ${this.when(row.createdAt)}`,
    },
    {
      key: 'by',
      header: this.copy.recent.columnBy,
      value: (row) => row.createdBy ?? this.copy.recent.unknownPerson,
    },
    {
      key: 'rows',
      header: this.copy.recent.columnRows,
      align: 'end',
      value: (row) => String(row.rowCount),
    },
    {
      key: 'status',
      header: this.copy.recent.columnStatus,
      value: (row) =>
        row.withdrawal === null
          ? this.copy.status[row.status]
          : `${this.copy.withdrawn.line(
              this.when(row.withdrawal.at),
              row.withdrawal.by ?? this.copy.unknownPerson,
            )} ${this.copy.withdrawn.reason(row.withdrawal.reason)}`,
    },
    {
      key: 'result',
      header: this.copy.recent.columnResult,
      value: (row) =>
        row.result === null
          ? this.copy.recent.pending
          : this.copy.recent.result(
              row.result.imported,
              row.result.skipped,
              row.result.duplicates,
              row.result.errors,
            ),
    },
    {
      key: 'action',
      header: this.copy.recent.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected size(file: File): string {
    return file.size < 1024 * 1024
      ? `${Math.max(1, Math.round(file.size / 1024))} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** The shared field has already refused what the API would refuse, and said so. */
  protected chose(file: File | null): void {
    this.problem.set('');
    this.file.set(file);
  }

  protected upload(): void {
    const file = this.file();
    if (file === null) {
      this.problem.set(this.copy.upload.none);
      return;
    }
    if (this.sending()) return;
    this.sending.set(true);
    this.problem.set('');
    this.repository
      .upload(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (created) => {
          this.sending.set(false);
          void this.router.navigate(['/assistance-requests/import', created.id], {
            queryParams: { step: 'map' },
          });
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.problem.set(this.copy.upload.refused(failureReason(error) ?? this.copy.noAnswer));
        },
      });
  }

  protected openLink(row: AssistanceImportSummary): readonly string[] {
    return ['/assistance-requests/import', row.id];
  }

  protected openParams(row: AssistanceImportSummary): Readonly<Record<string, string>> {
    return { step: row.status === 'open' ? 'map' : 'done' };
  }

  /** The withdrawal answered: the list is read again for the import as the server now holds it. */
  protected withdrawn(): void {
    this.withdrawing.set(null);
    this.retry();
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.repository
      .list({ limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.further.update((pages) => [...pages, page]);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  private when(value: string): string {
    return formatDisplayDate(value, 'date', this.locale) ?? '';
  }
}
