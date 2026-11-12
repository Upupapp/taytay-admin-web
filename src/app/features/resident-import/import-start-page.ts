import { formatDate } from '@angular/common';
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

import {
  IMPORT_FILE_LIMITS,
  RESIDENT_IMPORT_REPOSITORY,
  type CursorPage,
  type ResidentImportSummary,
} from '@domain/index';
import { DataFileField } from '@shared/media/data-file-field';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import { PageHeader } from '@shared/ui/page-header/page-header';
import type { TableColumn } from '@shared/ui/data-table/table-column';

import { ImportSteps } from './import-steps';
import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

const PAGE_SIZE = 20;

/**
 * Import citizens, step 1 (`DL-214`): choose a file, upload it for checking, and the imports
 * before it. Form pattern, from `households/household-form-page`.
 *
 * **Choosing a file sends nothing.** The limits stand before the picker, the effects before the
 * button, and only the button uploads. A file the API would refuse for its size or kind is refused
 * here first, and the screen says nothing was sent.
 */
@Component({
  selector: 'app-import-start-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataFileField, DataTable, ImportSteps, PageHeader, RouterLink],
  templateUrl: './import-start-page.html',
  styleUrl: './resident-import.scss',
})
export class ImportStartPage {
  private readonly repository = inject(RESIDENT_IMPORT_REPOSITORY);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  protected readonly copy = RESIDENT_IMPORT_COPY;
  protected readonly limits = IMPORT_FILE_LIMITS;

  protected readonly file = signal<File | null>(null);
  protected readonly problem = signal('');
  protected readonly sending = signal(false);

  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: ResidentImportSummary }>>('actionCell');

  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<ResidentImportSummary>[]>([]);
  protected readonly loadingMore = signal(false);

  protected readonly state = toSignal(
    toObservable(this.generation).pipe(
      tap(() => this.further.set([])),
      switchMap(() => toViewState(this.repository.list({ limit: PAGE_SIZE, cursor: null }))),
    ),
    { initialValue: LOADING as ViewState<CursorPage<ResidentImportSummary>> },
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

  protected readonly rowKey = (row: ResidentImportSummary): string => row.id;

  protected readonly columns = computed<readonly TableColumn<ResidentImportSummary>[]>(() => [
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
      value: (row) => this.copy.status[row.status],
    },
    {
      key: 'result',
      header: this.copy.recent.columnResult,
      value: (row) =>
        row.result === null
          ? this.copy.recent.pending
          : this.copy.recent.result(
              row.result.created,
              row.result.attached,
              row.result.skipped,
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
          void this.router.navigate(['/residents/import', created.id], {
            queryParams: { step: 'map' },
          });
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.problem.set(
            this.copy.upload.refused(failureReason(error) ?? this.copy.noAnswer),
          );
        },
      });
  }

  protected openLink(row: ResidentImportSummary): readonly string[] {
    return ['/residents/import', row.id];
  }

  protected openParams(row: ResidentImportSummary): Readonly<Record<string, string>> {
    return { step: row.status === 'committed' ? 'done' : 'map' };
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
    return formatDate(value, 'd MMM y', this.locale);
  }
}
