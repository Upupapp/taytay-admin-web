import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  VERIFICATION_REPOSITORY,
  type AddedMonth,
  type VerificationQueueStats,
} from '@domain/index';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { ColumnChart, type ColumnPoint } from '@shared/ui/column-chart/column-chart';
import { LineChart, type LinePoint } from '@shared/ui/line-chart/line-chart';

import { REGISTRY_HEALTH_COPY } from './registry-health.copy';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Added to the registry" (`DL-249`): the people on the registry now, by the month their record was
 * added — typed in at the office, the solid line, or created by an imported list, the dashed one.
 * Each cell is a count of people the server may have withheld (`DL-105`): the line breaks there and
 * the table says "Withheld", never a zero. A difference of two registry totals is not used, because
 * it could state a figure the server withheld.
 */
@Component({
  selector: 'app-registry-additions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChart],
  template: `
    <div class="registry-panel__head">
      <h2 id="registry-additions" class="registry-panel__title">{{ copy.addedHeading }}</h2>
      <span class="registry-panel__aside">{{ copy.addedWindow }}</span>
    </div>
    <app-line-chart
      [points]="office()"
      [compare]="imported()"
      [caption]="copy.addedCaption"
      [labelHeader]="copy.addedMonthHeader"
      [valueHeader]="copy.addedOffice"
      [compareHeader]="copy.addedImported"
      [withheldLabel]="copy.withheld"
      [sparseLabels]="true"
    />
    @if (withheldMonths(); as words) {
      <p class="registry-panel__note">{{ copy.addedWithheld(words) }}</p>
    }
    <p class="registry-panel__note">{{ copy.addedNote }}</p>
  `,
  styleUrl: './registry-panels.scss',
})
export class RegistryAdditions {
  readonly months = input.required<readonly AddedMonth[]>();

  protected readonly copy = REGISTRY_HEALTH_COPY;

  protected readonly office = computed(() => this.line((entry) => entry.office.value));

  protected readonly imported = computed(() => this.line((entry) => entry.imported.value));

  /** The months a line breaks, said in words beside the drawing: a gap is not a zero (`DL-105`). */
  protected readonly withheldMonths = computed(() => {
    const said: string[] = [];
    for (const entry of this.months()) {
      const month = formatDate(`${entry.month}-01`, 'MMM y', 'en-US');
      if (entry.office.withheld) {
        said.push(this.copy.addedWithheldOffice(month));
      }
      if (entry.imported.withheld) {
        said.push(this.copy.addedWithheldImported(month));
      }
    }
    return said.length === 0 ? null : said.join('; ');
  });

  private line(value: (entry: AddedMonth) => number | null): readonly LinePoint[] {
    return this.months().map((entry) => ({
      key: entry.month,
      label: formatDate(`${entry.month}-01`, 'MMM', 'en-US'),
      longLabel: formatDate(`${entry.month}-01`, 'MMMM y', 'en-US'),
      value: value(entry),
    }));
  }
}

/** What the review-queue panel re-reads on: an ID review sent or decided. */
export const REVIEW_QUEUE_TOPICS: readonly LiveTopic[] = ['verification'];

/**
 * "ID review queue" (`DL-249`): the queue's own figures (`meta.stats`, backend ADR 0006) — how many
 * wait, how long the oldest has waited, what was decided and sent in the last seven days. For a
 * reader who reviews IDs; the page decides. Counts of requests for the reader who opens each one, so
 * nothing is withheld; no name is read out of the page it rides on.
 */
@Component({
  selector: 'app-registry-review-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, ColumnChart, RouterLink],
  template: `
    <div class="registry-panel__head">
      <h2 id="registry-review-queue" class="registry-panel__title">{{ copy.queueHeading }}</h2>
      <a class="registry-panel__link" routerLink="/verification">{{ copy.queueLink }}</a>
    </div>
    <app-async-content
      [state]="state()"
      [content]="figures"
      [skeletonLines]="3"
      [errorHeading]="copy.queueError"
      [retryLabel]="copy.queueRetry"
      (retryRequested)="retry()"
    />
    <ng-template #figures let-stats>
      <dl class="review-queue">
        <div class="review-queue__item">
          <dt>{{ copy.queueWaiting }}</dt>
          <dd class="review-queue__value">{{ stats.pending }}</dd>
        </div>
        <div class="review-queue__item">
          <dt>{{ copy.queueOldest }}</dt>
          <dd class="review-queue__value">{{ oldest(stats) }}</dd>
        </div>
        <div class="review-queue__item">
          <dt>{{ copy.queueDecided }}</dt>
          <dd class="review-queue__value review-queue__value--words">
            {{ copy.queueDecidedValue(stats.decided7d.approved, stats.decided7d.rejected) }}
          </dd>
        </div>
      </dl>
      <p class="review-queue__chart-title">{{ copy.queueSentCaption }}</p>
      <app-column-chart [columns]="sent(stats)" [caption]="copy.queueSentCaption" />
      <p class="registry-panel__note">{{ copy.queueNote }}</p>
    </ng-template>
  `,
  styleUrls: ['./registry-panels.scss'],
  styles: `
    .review-queue {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
      margin: 0 0 var(--space-3);
    }

    @media (width <= 700px) {
      .review-queue {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    /* The label on top, the figure at the foot, so the figures line up however the labels wrap. */
    .review-queue__item {
      display: grid;
      align-content: space-between;
      gap: var(--space-1);
      padding: 10px var(--space-3);
      border-radius: var(--r-field);
      background: var(--soft2);
    }

    app-column-chart {
      display: block;
      margin-block-end: var(--space-3);
    }

    .review-queue__chart-title {
      margin: 0;
      font-size: var(--fs-xs);
      color: var(--muted);
    }

    .review-queue__item dt {
      font-size: var(--fs-xs);
      color: var(--muted);
    }

    .review-queue__value {
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--fs-title-sm);
      font-weight: var(--fw-semibold);
      color: var(--ink);
    }

    .review-queue__value--words {
      font-family: inherit;
      font-size: var(--fs-sm);
    }
  `,
})
export class RegistryReviewQueue {
  private readonly repository = inject(VERIFICATION_REPOSITORY);
  private readonly live = inject(LiveUpdates);

  protected readonly copy = REGISTRY_HEALTH_COPY;

  private readonly generation = signal(0);

  protected readonly state = toSignal(
    toObservable(this.generation).pipe(
      switchMap(() =>
        liveViewState(
          // The queue's figures ride on its first page; one row is asked for and never shown.
          () =>
            this.repository
              .list({ status: 'pending' }, { limit: 1, cursor: null })
              .pipe(map((page) => page.stats)),
          this.live.changes(REVIEW_QUEUE_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<VerificationQueueStats> },
  );

  protected retry(): void {
    this.generation.update((n) => n + 1);
  }

  /** A wait in days from the server's timestamp: no review standard is set, so never "overdue". */
  protected oldest(stats: VerificationQueueStats): string {
    if (stats.oldestPendingAt === null) {
      return this.copy.queueNoneWaiting;
    }
    const days = Math.max(0, Math.floor((Date.now() - Date.parse(stats.oldestPendingAt)) / DAY_MS));
    return this.copy.queueDays(days);
  }

  protected sent(stats: VerificationQueueStats): readonly ColumnPoint[] {
    return stats.sentByDay.map((day) => ({
      key: day.date,
      label: formatDate(day.date, 'EEE', 'en-US'),
      longLabel: formatDate(day.date, 'EEEE d MMMM y', 'en-US'),
      value: day.count,
    }));
  }
}
