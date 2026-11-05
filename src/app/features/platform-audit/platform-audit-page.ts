import { DatePipe } from '@angular/common';
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
import { switchMap, tap } from 'rxjs';

import {
  describeAuditAction,
  PLATFORM_AUDIT_LIMITS,
  PLATFORM_AUDIT_REPOSITORY,
  type CursorPage,
  type PlatformAuditEntry,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { PLATFORM_AUDIT_COPY } from './platform-audit.copy';

/** The largest page the API serves. */
const PAGE_SIZE = 50;

/**
 * The Node API's audit trail (`audit.view`, `DL-171`): who did what to which record, and when.
 *
 * **Read-only, and only what a row holds.** The action in words where this console knows the code,
 * and the code as given either way; the actor and the record by their ids, as the API records them.
 * Nothing is looked up beside a row — no name, no email, no record — so reading the trail discloses
 * nothing the trail does not hold (`DL-114`). The page reads one port and no other.
 *
 * **A page at a time, newest first** (`DL-161`): "more available", never "of N".
 *
 * Not the governance audit page, which stays unserved (`DL-164`).
 */
@Component({
  selector: 'app-platform-audit-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, DatePipe, PageHeader],
  templateUrl: './platform-audit-page.html',
  styleUrl: './platform-audit-page.scss',
})
export class PlatformAuditPage {
  private readonly repository = inject(PLATFORM_AUDIT_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = PLATFORM_AUDIT_COPY;
  protected readonly limits = PLATFORM_AUDIT_LIMITS;

  private readonly whenCell =
    viewChild.required<TemplateRef<{ $implicit: PlatformAuditEntry }>>('whenCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: PlatformAuditEntry }>>('actionCell');
  private readonly actorCell =
    viewChild.required<TemplateRef<{ $implicit: PlatformAuditEntry }>>('actorCell');
  private readonly subjectCell =
    viewChild.required<TemplateRef<{ $implicit: PlatformAuditEntry }>>('subjectCell');

  /** Bumped to read the trail again, on "Try again" or "Read from the newest". */
  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<PlatformAuditEntry>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly first = toSignal(
    toObservable(this.generation).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(() => toViewState(this.repository.list({ limit: PAGE_SIZE, cursor: null }))),
    ),
    { initialValue: LOADING as ViewState<CursorPage<PlatformAuditEntry>> },
  );

  protected readonly rows = computed<readonly PlatformAuditEntry[]>(() => [
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

  protected readonly rowKey = (entry: PlatformAuditEntry): string => entry.id;

  protected readonly columns = computed<readonly TableColumn<PlatformAuditEntry>[]>(() => [
    { key: 'when', header: this.copy.columnWhen, cell: this.whenCell() },
    { key: 'action', header: this.copy.columnAction, cell: this.actionCell() },
    { key: 'actor', header: this.copy.columnActor, cell: this.actorCell() },
    { key: 'subject', header: this.copy.columnSubject, cell: this.subjectCell() },
  ]);

  protected describe(entry: PlatformAuditEntry): string {
    return describeAuditAction(entry.action) ?? this.copy.noWords;
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;

    const generation = this.generation();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list({ limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // Read again meanwhile: this page continues a list nobody is looking at.
          if (generation === this.generation()) {
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
}
