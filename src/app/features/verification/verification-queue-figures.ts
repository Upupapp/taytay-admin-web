import { formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { VerificationQueueStats } from '@domain/index';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';
import { ColumnChart, type ColumnPoint } from '@shared/ui/column-chart/column-chart';

import { QUEUE_FIGURES_COPY } from './verification.copy';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The review queue's four figures, as the VerificationQueue board draws them (`DL-232`): how many
 * wait, how long the oldest has, what was decided and sent in the last seven Manila days. Read from
 * the queue's own `meta.stats` beside every page, so it is never a count of the rows on screen
 * (`DL-161`). The approved and rejected split is said in words; the bar repeats it.
 */
@Component({
  selector: 'app-verification-queue-figures',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColumnChart, RouterLink],
  host: { class: 'queue-figures', role: 'region', '[attr.aria-label]': 'copy.label' },
  template: `
    <!-- The two figures about who waits open the waiting queue (DL-273); the two about the last
         seven days stay text, since no status of the list is a window of days. -->
    <a class="kpi queue-figures__tile" routerLink="/verification">
      <span class="queue-figures__label">{{ copy.awaiting }}</span>
      <span class="queue-figures__value">{{ stats().pending }}</span>
      <span class="queue-figures__hint">{{ copy.awaitingHint }}</span>
      <span class="visually-hidden">{{ copy.showWaiting }}</span>
    </a>
    <a class="kpi queue-figures__tile" routerLink="/verification">
      <span class="queue-figures__label">{{ copy.oldest }}</span>
      @if (oldest(); as oldest) {
        <span class="queue-figures__row">
          <span class="queue-figures__value">{{ oldest.days }}</span>
          <span class="queue-figures__unit">{{ copy.days(oldest.days) }}</span>
        </span>
        <span class="queue-figures__chip">{{ copy.sent(oldest.when) }}</span>
      } @else {
        <span class="queue-figures__value">0</span>
        <span class="queue-figures__hint">{{ copy.noneWaiting }}</span>
      }
      <span class="visually-hidden">{{ copy.showWaiting }}</span>
    </a>
    <div class="kpi queue-figures__tile">
      <span class="queue-figures__label">{{ copy.decided }}</span>
      <span class="queue-figures__value">{{ decidedTotal() }}</span>
      @if (decidedTotal() > 0) {
        <span class="queue-figures__split" aria-hidden="true">
          <span class="queue-figures__approved" [style.width.%]="approvedShare()"></span>
          <span class="queue-figures__rejected" [style.width.%]="100 - approvedShare()"></span>
        </span>
      }
      <span class="queue-figures__hint">{{
        copy.decidedSplit(stats().decided7d.approved, stats().decided7d.rejected)
      }}</span>
    </div>
    <div class="kpi queue-figures__tile">
      <span class="queue-figures__label">{{ copy.sentWeek }}</span>
      <span class="queue-figures__value">{{ sentTotal() }}</span>
      <app-column-chart [columns]="days()" [caption]="copy.sentCaption" [compact]="true" />
    </div>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));
      gap: var(--space-4);
      margin-block-end: var(--space-4);
    }

    .queue-figures__tile {
      gap: var(--space-1);
      padding: 18px 20px;
      border-radius: var(--r-card);
    }

    .queue-figures__label {
      color: var(--text2);
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
    }

    .queue-figures__value {
      color: var(--ink);
      font-family: var(--font-display);
      font-size: var(--fs-kpi);
      font-weight: var(--fw-medium);
      line-height: 1.05;
      letter-spacing: var(--ls-display);
      font-variant-numeric: tabular-nums;
    }

    .queue-figures__row {
      display: flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .queue-figures__unit {
      color: var(--muted);
      font-size: var(--fs-control);
    }

    .queue-figures__hint {
      color: var(--muted);
      font-size: var(--fs-xs);
    }

    .queue-figures__chip {
      align-self: flex-start;
      padding: 2px 10px;
      border-radius: var(--r-pill);
      background: var(--gold-tint);
      color: var(--gold-ink);
      font-size: var(--fs-xs);
      font-weight: var(--fw-semibold);
    }

    a.queue-figures__tile:is(:hover, :focus-visible) {
      .queue-figures__label,
      .queue-figures__value {
        color: var(--on-primary);
      }

      .queue-figures__unit,
      .queue-figures__hint {
        color: var(--on-deep-muted);
      }
    }

    .queue-figures__split {
      display: flex;
      gap: 2px;
      block-size: 8px;
      border-radius: var(--r-pill);
      overflow: hidden;
    }

    .queue-figures__approved {
      background: var(--bar);
    }

    .queue-figures__rejected {
      background: var(--red);
    }
  `,
})
export class VerificationQueueFigures {
  private readonly locale = inject(LOCALE_ID);

  readonly stats = input.required<VerificationQueueStats>();

  protected readonly copy = QUEUE_FIGURES_COPY;

  protected readonly oldest = computed(() => {
    const at = this.stats().oldestPendingAt;
    if (at === null) return null;
    return {
      days: Math.max(0, Math.floor((Date.now() - Date.parse(at)) / DAY_MS)),
      when: formatDisplayDate(at, 'date-time', this.locale) ?? '',
    };
  });

  protected readonly decidedTotal = computed(
    () => this.stats().decided7d.approved + this.stats().decided7d.rejected,
  );

  protected readonly approvedShare = computed(() => {
    const total = this.decidedTotal();
    return total === 0 ? 0 : (this.stats().decided7d.approved / total) * 100;
  });

  protected readonly sentTotal = computed(() =>
    this.stats().sentByDay.reduce((sum, day) => sum + day.count, 0),
  );

  protected readonly days = computed<readonly ColumnPoint[]>(() =>
    this.stats().sentByDay.map((day) => ({
      key: day.date,
      label: formatDate(day.date, 'EEE', 'en-US'),
      longLabel: formatDate(day.date, 'EEEE d MMMM y', 'en-US'),
      value: day.count,
    })),
  );
}
