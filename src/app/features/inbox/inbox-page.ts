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
import { RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  OFFICE_INBOX_REPOSITORY,
  OFFICE_REPOSITORY,
  THREAD_STATUS_CATALOG,
  type CursorPage,
  type InboxListing,
  type OfficeThread,
} from '@domain/index';
import { officeDirectory } from '@shared/offices/office-directory';
import { liveViewState, unlessPaged } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { ListChangedNotice } from '@shared/ui/list-changed-notice/list-changed-notice';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { INBOX_COPY } from './inbox.copy';

/** One page at a time from the server; the API's own default, and well under its ceiling. */
const PAGE_SIZE = 20;

/** Conversations and their messages; both feed `threads` (`DL-222`). */
export const INBOX_TOPICS: readonly LiveTopic[] = ['threads'];

/**
 * The office inbox (`DL-168`): residents' conversations with an office, newest activity first.
 *
 * **Whose conversations is the server's call.** A staff account sees its own office's and an
 * administrator every office's; this screen offers no office filter, because a filter it applied
 * would be a scope the server does not enforce.
 *
 * **An empty answer is asked about before it is believed.** The server answers a staff account
 * with no office with an empty page, so the data layer says `no-office` in that case and this screen
 * says the account is not assigned — and who can fix it — instead of "no conversations".
 *
 * **What residents wrote is not in the list.** The subject is; the words are read by opening the
 * conversation (`OfficeThread`). **A browsable list, so a page at a time** (`DL-161`): "more are
 * available", never "page 1 of N".
 */
@Component({
  selector: 'app-inbox-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncContent,
    DataTable,
    DatePipe,
    Icon,
    ListChangedNotice,
    PageHeader,
    RouterLink,
    StatusBadge,
  ],
  templateUrl: './inbox-page.html',
  styleUrl: './inbox-page.scss',
})
export class InboxPage {
  private readonly repository = inject(OFFICE_INBOX_REPOSITORY);
  private readonly offices = inject(OFFICE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(LiveUpdates);

  protected readonly copy = INBOX_COPY.list;
  protected readonly noOffice = INBOX_COPY.noOffice;
  protected readonly catalog = THREAD_STATUS_CATALOG;

  private readonly subjectCell =
    viewChild.required<TemplateRef<{ $implicit: OfficeThread }>>('subjectCell');
  private readonly latestCell =
    viewChild.required<TemplateRef<{ $implicit: OfficeThread }>>('latestCell');
  private readonly officeCell =
    viewChild.required<TemplateRef<{ $implicit: OfficeThread }>>('officeCell');
  private readonly unreadCell =
    viewChild.required<TemplateRef<{ $implicit: OfficeThread }>>('unreadCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: OfficeThread }>>('statusCell');

  /** Bumped to read the inbox again — on "Try again". */
  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<OfficeThread>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  /** A hint arrived while more than the first page was on screen (`DL-222`). */
  protected readonly listChanged = signal(false);

  /**
   * A new message re-orders the inbox and moves its unread counts, so the first page is read again
   * quietly on a `threads` hint — a read, never a mark (`DL-222`). Once more pages are loaded the
   * hint is held and the notice offers the reload instead.
   */
  protected readonly first = toSignal(
    toObservable(this.generation).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
        this.listChanged.set(false);
      }),
      switchMap(() =>
        liveViewState(
          () => this.repository.list({ limit: PAGE_SIZE, cursor: null }),
          unlessPaged(
            this.live.changes(INBOX_TOPICS),
            () => this.further().length > 0 || this.loadingMore(),
            () => this.listChanged.set(true),
          ),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<InboxListing> },
  );

  private readonly directory = officeDirectory(this.offices.list());
  protected readonly officesUnnamed = this.directory.failed;

  protected readonly firstPage = computed<CursorPage<OfficeThread> | null>(() => {
    const listing = valueOf(this.first());
    return listing?.kind === 'threads' ? listing.page : null;
  });

  protected readonly rows = computed<readonly OfficeThread[]>(() => [
    ...(this.firstPage()?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);

  private readonly lastPage = computed(() => this.further().at(-1) ?? this.firstPage());

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  protected readonly rowKey = (thread: OfficeThread): string => thread.id;

  protected readonly columns = computed<readonly TableColumn<OfficeThread>[]>(() => [
    { key: 'subject', header: this.copy.columnSubject, cell: this.subjectCell() },
    {
      key: 'office',
      header: this.copy.columnOffice,
      value: (thread) => this.officeName(thread),
      cell: this.officeCell(),
    },
    { key: 'latest', header: this.copy.columnLatest, cell: this.latestCell() },
    {
      key: 'unread',
      header: this.copy.columnUnread,
      value: (thread) => this.copy.unread(thread.unreadCount),
      cell: this.unreadCell(),
    },
    { key: 'status', header: this.copy.columnStatus, cell: this.statusCell() },
  ]);

  protected officeName(thread: OfficeThread): string {
    return this.directory.name(thread.officeId, thread.officeSlug);
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
    this.loadingMore.set(true);
    this.moreFailed.set(false);

    this.repository
      .list({ limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (listing) => {
          // Read again meanwhile: this page continues a list nobody is looking at.
          if (generation === this.generation() && listing.kind === 'threads') {
            this.further.update((pages) => [...pages, listing.page]);
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
