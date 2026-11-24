import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { summaryAfterCaption } from '../chart-table/chart-table';

/** One category of a donut: the same shape as a `ChartRow`, with a withheld figure said so. */
export interface DonutRow {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Formatted for display. Falls back to `value`. */
  readonly display?: string;
  /** Withheld as a small cell (`DL-105`): listed, never drawn. */
  readonly isWithheld?: boolean;
  readonly routerLink?: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

/** How many segment colours the tokens hold (`--chart-cat-1` …); beyond it they repeat. */
const SEGMENT_COLOURS = 5;
/** The ring's radius and the gap between two segments, in the SVG's own units. */
const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2.4;

interface LegendRow {
  readonly row: DonutRow;
  readonly figure: string;
  readonly share: string;
  /** 1 to SEGMENT_COLOURS for a drawn row; null for a withheld one, which has no segment. */
  readonly colour: number | null;
}

interface Segment {
  readonly key: string;
  readonly colour: number;
  readonly dash: string;
  readonly offset: number;
}

/** "32%", or "<1%" for a share too small to round to one. */
export function shareOf(value: number, total: number): string {
  if (total <= 0 || value <= 0) return '';
  const percent = (value / total) * 100;
  return percent < 1 ? '<1%' : `${Math.round(percent)}%`;
}

/**
 * A donut whose legend **is** the data table (`DL-108`, `DL-250`): a real `<table>` with a caption,
 * one row per category, largest first, with its count and its share of the total. The ring is
 * `aria-hidden` decoration that repeats the table, each segment in its own hue with a gap between
 * neighbours, and the legend names every one, so nothing rests on colour.
 *
 * The centre says the total; pointing at a segment, or pointing at or focusing a legend row, puts
 * that category there instead. A legend row is the one focus stop for its category (its drill-down
 * link, or the row itself): a segment inside a hidden graphic is no second tab stop for the same
 * figure. A withheld row keeps its label and says so, and is left out of the ring: a segment sized
 * by a hidden number would draw what was withheld (`DL-105`).
 */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="donut">
      <div class="donut__figure" aria-hidden="true">
        <svg class="donut__ring" viewBox="0 0 120 120" focusable="false">
          <circle class="donut__track" cx="60" cy="60" [attr.r]="radius" />
          @for (segment of segments(); track segment.key) {
            <circle
              class="donut__segment"
              [class]="'donut__segment donut__segment--' + segment.colour"
              [class.donut__segment--active]="active() === segment.key"
              [class.donut__segment--dim]="active() !== null && active() !== segment.key"
              cx="60"
              cy="60"
              [attr.r]="radius"
              [attr.stroke-dasharray]="segment.dash"
              [attr.stroke-dashoffset]="segment.offset"
              (mouseenter)="active.set(segment.key)"
              (mouseleave)="active.set(null)"
            />
          }
        </svg>
        <span class="donut__centre">
          <span class="donut__value">{{ centre().value }}</span>
          <span class="donut__label">{{ centre().label }}</span>
        </span>
      </div>

      <table class="donut__legend">
        <caption class="donut__caption">
          {{
            caption()
          }}
          @if (summaryText(); as text) {
            <span class="donut__summary">{{ text }}</span>
          }
        </caption>
        <thead class="donut__head">
          <tr>
            <th scope="col">{{ labelHeader() }}</th>
            <th scope="col">{{ valueHeader() }}</th>
            <th scope="col">{{ shareHeader() }}</th>
          </tr>
        </thead>
        <tbody>
          @for (entry of legend(); track entry.row.key) {
            <tr
              class="donut__row"
              [class.donut__row--active]="active() === entry.row.key"
              (mouseenter)="active.set(entry.row.key)"
              (mouseleave)="active.set(null)"
              (focusin)="active.set(entry.row.key)"
              (focusout)="active.set(null)"
            >
              <th scope="row" class="donut__name">
                <span
                  class="donut__swatch"
                  [class]="
                    entry.colour === null
                      ? 'donut__swatch donut__swatch--none'
                      : 'donut__swatch donut__swatch--' + entry.colour
                  "
                  aria-hidden="true"
                ></span>
                @if (entry.row.routerLink) {
                  <a
                    class="donut__link"
                    [routerLink]="entry.row.routerLink"
                    [queryParams]="entry.row.queryParams ?? {}"
                    >{{ entry.row.label }}</a
                  >
                } @else if (entry.colour !== null) {
                  <!-- Focusable so a keyboard can put it in the centre, as a pointer can. -->
                  <span class="donut__link" tabindex="0">{{ entry.row.label }}</span>
                } @else {
                  <span>{{ entry.row.label }}</span>
                }
              </th>
              <td class="donut__count">{{ entry.figure }}</td>
              <td class="donut__share">{{ entry.share }}</td>
            </tr>
          } @empty {
            <tr>
              <td class="donut__empty" colspan="3">{{ emptyMessage() }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './donut-chart.scss',
})
export class DonutChart {
  readonly caption = input.required<string>();
  readonly rows = input.required<readonly DonutRow[]>();
  /** What every share is a share of, and what the centre says by default: the total before suppression. */
  readonly total = input.required<number>();
  /** The words under the total in the centre. */
  readonly totalLabel = input('In all');
  readonly summary = input<string | null>(null);
  readonly labelHeader = input('Category');
  readonly valueHeader = input('Count');
  readonly shareHeader = input('Share');
  readonly withheldLabel = input('Withheld');
  readonly emptyMessage = input('Nothing to show for this filter.');

  protected readonly radius = RADIUS;
  /** The category in the centre: the one pointed at or focused, or none for the total. */
  protected readonly active = signal<string | null>(null);

  /** The caption names the chart; the summary is read after it without repeating it. */
  protected readonly summaryText = computed(() => {
    const text = this.summary();
    return text === null ? null : summaryAfterCaption(this.caption(), text);
  });

  /**
   * Largest first; a withheld row after every figure and before a zero (it holds one person or more),
   * keeping its label; neither has a segment.
   */
  protected readonly legend = computed<readonly LegendRow[]>(() => {
    const rank = (row: DonutRow): number => (row.isWithheld === true ? 0.5 : row.value);
    let drawn = 0;
    return [...this.rows()]
      .sort((a, b) => rank(b) - rank(a))
      .map((row) => {
        const withheld = row.isWithheld === true;
        const colour = withheld || row.value <= 0 ? null : (drawn++ % SEGMENT_COLOURS) + 1;
        return {
          row,
          colour,
          figure: withheld
            ? this.withheldLabel()
            : (row.display ?? row.value.toLocaleString('en-PH')),
          share: withheld ? '' : shareOf(row.value, this.total()),
        };
      });
  });

  /** The ring over the drawn rows only, so no arc stands for a withheld figure. */
  protected readonly segments = computed<readonly Segment[]>(() => {
    const drawn = this.legend().filter((entry) => entry.colour !== null);
    const sum = drawn.reduce((total, entry) => total + entry.row.value, 0);
    if (sum <= 0) return [];
    const gap = drawn.length > 1 ? GAP : 0;
    let start = 0;
    return drawn.map((entry) => {
      const length = (entry.row.value / sum) * CIRCUMFERENCE;
      const segment = {
        key: entry.row.key,
        colour: entry.colour ?? 1,
        dash: `${Math.max(length - gap, 0.6)} ${CIRCUMFERENCE}`,
        offset: -start,
      };
      start += length;
      return segment;
    });
  });

  protected readonly centre = computed(() => {
    const key = this.active();
    const entry = key === null ? undefined : this.legend().find((item) => item.row.key === key);
    if (entry === undefined) {
      return { value: this.total().toLocaleString('en-PH'), label: this.totalLabel() };
    }
    return {
      value: entry.figure,
      label: entry.share === '' ? entry.row.label : `${entry.row.label} · ${entry.share}`,
    };
  });
}
