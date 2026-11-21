import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  DIGITAL_ID_REPOSITORY,
  type AppAccountId,
  type CursorPage,
  type DigitalIdEvent,
} from '@domain/index';
import { DisplayDatePipe } from '@shared/pipes/display-date.pipe';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';

import { DIGITAL_IDS_COPY } from './digital-ids.copy';

const PAGE_SIZE = 10;

/** A card's history changes when it is issued, replaced, suspended, revoked or checked. */
export const CARD_HISTORY_TOPICS: readonly LiveTopic[] = ['digital-ids'];

/**
 * A holder's card history (`DL-232`): the audit rows on every card the account was issued, newest
 * first, as the trail recorded them — what was done, when, and by which staff account. Keyed on the
 * person, because a reissue makes a new card. An action the console has no word for is shown in
 * the trail's own word rather than dropped.
 */
@Component({
  selector: 'app-card-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DisplayDatePipe],
  template: `
    @switch (state().kind) {
      @case ('error') {
        <p class="status-line" role="alert">{{ copy.historyFailed }}</p>
        <button type="button" class="btn btn--small" (click)="retry()">{{ copy.retry }}</button>
      }
      @case ('ready') {
        @if (rows().length === 0) {
          <p class="status-line">{{ copy.historyEmpty }}</p>
        } @else {
          <ol class="card-history">
            @for (row of rows(); track row.id) {
              <li class="card-history__row">
                <span class="card-history__act">{{ label(row.action) }}</span>
                <span class="card-history__meta">
                  <time [attr.datetime]="row.at">{{ row.at | displayDate: 'date-time' }}</time>
                  @if (row.actorName; as actor) {
                    · {{ actor }}
                  }
                </span>
              </li>
            }
          </ol>
          @if (hasMore()) {
            <button
              type="button"
              class="btn btn--small"
              [disabled]="loadingMore()"
              (click)="more()"
            >
              {{ loadingMore() ? copy.historyLoading : copy.historyMore }}
            </button>
          }
          @if (moreFailed()) {
            <p class="status-line" role="alert">{{ copy.historyMoreFailed }}</p>
          }
        }
      }
      @default {
        <p class="status-line" aria-busy="true">{{ copy.historyLoading }}</p>
      }
    }
  `,
  styles: `
    .card-history {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .card-history__row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-block-end: var(--space-2);
      border-block-end: 1px solid var(--line);
    }

    .card-history__act {
      color: var(--ink);
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
    }

    .card-history__meta {
      color: var(--muted);
      font-size: var(--fs-xs);
    }
  `,
})
export class CardHistory {
  private readonly repository = inject(DIGITAL_ID_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly destroyRef = inject(DestroyRef);

  readonly account = input.required<AppAccountId>();

  protected readonly copy = DIGITAL_IDS_COPY.panel;

  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<DigitalIdEvent>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ account: this.account(), generation: this.generation() }))).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
      }),
      switchMap(({ account }) =>
        liveViewState(
          () => this.repository.cardHistory(account, { limit: PAGE_SIZE, cursor: null }),
          this.live.changes(CARD_HISTORY_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<CursorPage<DigitalIdEvent>> },
  );

  protected readonly rows = computed<readonly DigitalIdEvent[]>(() => [
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

  protected label(action: string): string {
    const words: Readonly<Record<string, string>> = this.copy.historyActions;
    return words[action] ?? action;
  }

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  protected more(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;
    const generation = this.generation();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .cardHistory(this.account(), { limit: PAGE_SIZE, cursor })
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
