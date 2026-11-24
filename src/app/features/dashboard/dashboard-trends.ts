import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DayCount, WeekCount } from '@domain/index';
import { ColumnChart, type ColumnPoint } from '@shared/ui/column-chart/column-chart';
import { LineChart, type LinePoint } from '@shared/ui/line-chart/line-chart';

import { DASHBOARD_COPY } from './dashboard.copy';

const LOCALE = 'en-US';

/**
 * "Requests received": filed requests per Manila week, eight weeks, as the Main board draws them
 * (`DL-232`). This week's figure, how it moved on last week and the average over the eight weeks
 * shown are worked out from the eight figures the API sent — nothing else is assumed. Requests are
 * records, not people, so no figure here is withheld.
 *
 * For a reader who may open the releases, the releases handed over in the same weeks are the
 * second, dashed line (`DL-248`): what came in beside what went out, on one axis, each week in the
 * table with both figures.
 */
@Component({
  selector: 'app-dashboard-requests-trend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineChart],
  host: { class: 'trend', role: 'region', 'aria-labelledby': 'trend-heading' },
  template: `
    <div class="trend__head">
      <h2 id="trend-heading" class="trend__heading">
        {{ handedOver() ? copy.flowHeading : copy.trendHeading }}
      </h2>
      <p class="trend__lead">{{ handedOver() ? copy.flowLead : copy.trendLead }}</p>
    </div>
    <div class="trend__figures">
      <span class="trend__figure">{{ thisWeek() }}</span>
      <span class="trend__when">{{ copy.trendThisWeek }}</span>
      @if (change(); as change) {
        <span class="trend__chip trend__chip--gold">{{ copy.trendChange(change.value) }}</span>
      }
      @if (average(); as average) {
        <span class="trend__chip">{{ copy.trendAverage(average) }}</span>
      }
    </div>
    <app-line-chart
      class="trend__chart"
      [points]="points()"
      [caption]="handedOver() ? copy.flowCaption : copy.trendCaption"
      [labelHeader]="copy.trendWeekHeader"
      [valueHeader]="copy.trendCountHeader"
      [compare]="comparePoints()"
      [compareHeader]="copy.flowCompareHeader"
      [callout]="handedOver() ? '' : copy.trendCallout(thisWeek())"
      [sparseLabels]="true"
    />
  `,
  styleUrl: './dashboard-trends.scss',
})
export class DashboardRequestsTrend {
  readonly weeks = input.required<readonly WeekCount[]>();
  /** Releases handed over in the same weeks; `null` for a reader the release list refuses. */
  readonly handedOver = input<readonly WeekCount[] | null>(null);

  protected readonly copy = DASHBOARD_COPY;

  /** Matched to the request weeks by their Monday, so a missing week is withheld, never shifted. */
  protected readonly comparePoints = computed<readonly LinePoint[] | null>(() => {
    const handed = this.handedOver();
    if (handed === null) {
      return null;
    }
    const byWeek = new Map<string, number>(handed.map((week) => [week.weekStart, week.count]));
    return this.points().map((point) => ({ ...point, value: byWeek.get(point.key) ?? null }));
  });

  protected readonly thisWeek = computed(() => this.weeks().at(-1)?.count ?? 0);

  /** Wrapped so a change of zero still renders ("Same as last week"). */
  protected readonly change = computed(() => {
    const weeks = this.weeks();
    const last = weeks.at(-2);
    return last === undefined ? null : { value: this.thisWeek() - last.count };
  });

  protected readonly average = computed(() => {
    const weeks = this.weeks();
    if (weeks.length === 0) {
      return null;
    }
    const total = weeks.reduce((sum, week) => sum + week.count, 0);
    return (Math.round((total / weeks.length) * 10) / 10).toString();
  });

  protected readonly points = computed<readonly LinePoint[]>(() =>
    this.weeks().map((week) => ({
      key: week.weekStart,
      label: formatDate(week.weekStart, 'd MMM', LOCALE),
      longLabel: this.copy.trendWeekOf(formatDate(week.weekStart, 'd MMM y', LOCALE)),
      value: week.count,
    })),
  );
}

/** "Releases handed over": the last seven Manila days on the deep card, as the board draws it. */
@Component({
  selector: 'app-dashboard-handover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColumnChart],
  host: { class: 'handover', role: 'region', 'aria-labelledby': 'handover-heading' },
  template: `
    <div class="handover__head">
      <h2 id="handover-heading" class="handover__heading">{{ copy.handoverHeading }}</h2>
      <span class="handover__window">{{ copy.handoverWindow }}</span>
    </div>
    <div class="handover__body">
      <span class="handover__figure" aria-hidden="true">{{ total() }}</span>
      <span class="visually-hidden">{{ copy.handoverTotal(total()) }}</span>
      <app-column-chart
        class="handover__chart"
        tone="deep"
        [columns]="columns()"
        [caption]="copy.handoverCaption"
      />
    </div>
  `,
  styleUrl: './dashboard-trends.scss',
})
export class DashboardHandover {
  readonly days = input.required<readonly DayCount[]>();

  protected readonly copy = DASHBOARD_COPY;

  protected readonly total = computed(() => this.days().reduce((sum, day) => sum + day.count, 0));

  protected readonly columns = computed<readonly ColumnPoint[]>(() =>
    this.days().map((day) => ({
      key: day.date,
      label: formatDate(day.date, 'EEE', LOCALE),
      longLabel: formatDate(day.date, 'EEEE d MMMM y', LOCALE),
      value: day.count,
    })),
  );
}
