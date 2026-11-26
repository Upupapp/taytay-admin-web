import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  APP_ACCOUNT_REPOSITORY,
  type AppAccount,
  type AppAccountListPage,
  type CursorPage,
} from '@domain/index';
import { InitialsPipe } from '@shared/pipes/initials.pipe';
import { liveViewState, unlessPaged } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { ListChangedNotice } from '@shared/ui/list-changed-notice/list-changed-notice';

import { CITIZEN_IDS_COPY } from './citizen-ids.copy';

const PAGE_SIZE = 20;

/** Accounts change as residents are verified; a card issued takes one off the list. */
export const VERIFIED_NO_CARD_TOPICS: readonly LiveTopic[] = ['users', 'digital-ids'];

type Holder = Pick<AppAccount, 'id' | 'name' | 'email'>;

/**
 * "Verified, no card" on Citizen IDs (`DL-232`): the open resident accounts the office verified
 * that hold no active or suspended card, read from `GET admin/users?verification_status=verified
 * &card=none` a page at a time — accounts, not cards, so never rows of the card list. "Issue a card"
 * opens the same card record the list opens, where the issue act and its effects are said first.
 */
@Component({
  selector: 'app-verified-no-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataTable, InitialsPipe, ListChangedNotice],
  template: `
    <section
      class="card card--panel card--padded stack citizen-ids__panel"
      aria-labelledby="citizen-ids-no-card"
    >
      <div class="citizen-ids__panel-head">
        <h2 id="citizen-ids-no-card" class="section-title">{{ copy.caption }}</h2>
      </div>
      <p class="status-line">{{ copy.lead }}</p>

      @if (failure(); as message) {
        <div class="callout callout--danger" role="alert">
          <p>{{ copy.error }} {{ message }}</p>
          <button type="button" class="btn" (click)="retry()">{{ page.tryAgain }}</button>
        </div>
      }
      @if (listChanged()) {
        <app-list-changed-notice (reload)="retry()" />
      }

      <app-data-table
        class="data-table--framed"
        [caption]="copy.caption"
        [columns]="columns()"
        [rows]="rows()"
        [rowKey]="rowKey"
        [loading]="state().kind === 'loading'"
        [failed]="failure() !== null"
        emptyVariant="empty"
        [emptyHeading]="copy.emptyHeading"
        [emptyMessage]="copy.emptyMessage"
      />

      @if (rows().length > 0) {
        <div class="list-more">
          <p class="status-line" role="status">
            {{ copy.shown(rows().length) }} {{ hasMore() ? page.moreAvailable : copy.noMore }}
          </p>
          @if (hasMore()) {
            <button type="button" class="btn" [disabled]="loadingMore()" (click)="showMore()">
              {{ loadingMore() ? page.loadingMore : page.showMore }}
            </button>
          }
          @if (moreFailed()) {
            <p class="callout callout--danger" role="alert">{{ copy.moreFailed }}</p>
          }
        </div>
      }
    </section>

    <ng-template #nameCell let-row>
      <span class="citizen-ids__who">
        <span class="avatar" aria-hidden="true">{{ row.name ?? row.email ?? '?' | initials }}</span>
        {{ row.name ?? copy.noName }}
      </span>
    </ng-template>

    <ng-template #issueCell let-row>
      <button
        type="button"
        class="btn btn--small btn--primary"
        [attr.aria-label]="copy.issueLabel(row.name ?? row.email ?? copy.noName)"
        (click)="issue.emit({ id: row.id, name: row.name, email: row.email })"
      >
        {{ copy.issue }}
      </button>
    </ng-template>
  `,
})
export class VerifiedNoCard {
  private readonly accounts = inject(APP_ACCOUNT_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly destroyRef = inject(DestroyRef);

  /** The account to open the card record for, where the issue act is. */
  readonly issue = output<Holder>();

  protected readonly copy = CITIZEN_IDS_COPY.noCard;
  protected readonly page = CITIZEN_IDS_COPY;

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: AppAccount }>>('nameCell');
  private readonly issueCell =
    viewChild.required<TemplateRef<{ $implicit: AppAccount }>>('issueCell');

  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<AppAccount>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);
  protected readonly listChanged = signal(false);

  protected readonly state = toSignal(
    toObservable(this.generation).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
        this.listChanged.set(false);
      }),
      switchMap(() =>
        liveViewState(
          () =>
            this.accounts.list(
              { limit: PAGE_SIZE, cursor: null },
              { verificationStatus: 'verified', card: 'none' },
            ),
          unlessPaged(
            this.live.changes(VERIFIED_NO_CARD_TOPICS),
            () => this.further().length > 0 || this.loadingMore(),
            () => this.listChanged.set(true),
          ),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<AppAccountListPage> },
  );

  protected readonly failure = computed(() => {
    const state = this.state();
    return state.kind === 'error' ? state.message : null;
  });

  protected readonly rows = computed<readonly AppAccount[]>(() => [
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

  protected readonly rowKey = (row: AppAccount): string => row.id;

  protected readonly columns = computed<readonly TableColumn<AppAccount>[]>(() => [
    { key: 'name', header: this.copy.columnResident, cell: this.nameCell() },
    {
      key: 'email',
      header: this.copy.columnEmail,
      value: (row) => row.email ?? this.copy.noEmail,
    },
    {
      key: 'action',
      header: this.copy.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.issueCell(),
    },
  ]);

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;
    const generation = this.generation();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.accounts
      .list({ limit: PAGE_SIZE, cursor }, { verificationStatus: 'verified', card: 'none' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
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
