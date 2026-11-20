import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One category: a label and one value per series, `null` where the figure is withheld. */
export interface BarChartRow {
  readonly key: string;
  readonly label: string;
  readonly values: readonly (number | null)[];
}

export interface BarChartSeries {
  readonly key: string;
  readonly label: string;
}

/** Room for a label beside its bars, as a share of the chart's width. */
const LABEL_SHARE = 32;
/** Room kept after the longest bar for the figure printed at its end. */
const FIGURE_SHARE = 12;
const BAR_HEIGHT = 12;
const BAR_GAP = 3;
const ROW_GAP = 10;
const LEGEND_HEIGHT = 24;
const LABEL_LIMIT = 30;

interface DrawnBar {
  readonly key: string;
  readonly series: number;
  readonly y: number;
  /** Width as a percentage of the chart; 0 for nothing and for a withheld figure. */
  readonly width: number;
  readonly figure: string;
  readonly withheld: boolean;
}

interface DrawnRow {
  readonly key: string;
  readonly label: string;
  readonly labelY: number;
  readonly bars: readonly DrawnBar[];
}

/**
 * A horizontal bar chart drawn as inline SVG, for a printed sheet (`DL-228`).
 *
 * **It is a picture of a table, never the record.** The whole drawing is `aria-hidden`: the table
 * printed beside it states every figure, so a screen reader reads the numbers once, in a table,
 * rather than twice. Each bar has its figure printed at its end, so the printed page can be checked
 * without a ruler, and a series is told by its legend and its place, never by colour alone.
 *
 * **A withheld figure is not a zero** (`DL-105`): it draws no bar and says "withheld" where the
 * figure would be. A zero draws no bar and says 0. The scale is the largest figure shown, and a
 * figure above zero always gets a visible sliver, so "small but present" never looks like "none".
 *
 * It computes nothing about the data: it draws what it is given. No charting library — the sheet
 * prints exactly what the browser draws.
 */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="bar-chart"
      aria-hidden="true"
      focusable="false"
      width="100%"
      [attr.height]="height()"
    >
      @if (series().length > 1) {
        @for (entry of series(); track entry.key; let index = $index) {
          <rect
            [attr.class]="'bar-chart__bar bar-chart__bar--' + index"
            [attr.x]="index * 30 + '%'"
            y="4"
            width="12"
            height="12"
            rx="3"
          />
          <text class="bar-chart__legend" [attr.x]="index * 30 + '%'" dx="18" y="14">
            {{ entry.label }}
          </text>
        }
      }
      @for (row of drawn(); track row.key) {
        <text class="bar-chart__label" x="0" [attr.y]="row.labelY">{{ row.label }}</text>
        @for (bar of row.bars; track bar.series) {
          @if (bar.width > 0) {
            <rect
              [attr.class]="'bar-chart__bar bar-chart__bar--' + bar.series"
              [attr.x]="labelShare + '%'"
              [attr.y]="bar.y"
              [attr.width]="bar.width + '%'"
              [attr.height]="barHeight"
              rx="3"
            />
          }
          <text
            class="bar-chart__figure"
            [class.bar-chart__figure--withheld]="bar.withheld"
            [attr.x]="labelShare + bar.width + '%'"
            dx="6"
            [attr.y]="bar.y + barHeight - 2"
          >
            {{ bar.figure }}
          </text>
        }
      }
    </svg>
  `,
  styleUrl: './bar-chart.scss',
})
export class BarChart {
  readonly series = input.required<readonly BarChartSeries[]>();
  readonly rows = input.required<readonly BarChartRow[]>();
  /** What a withheld figure says in place of a number. */
  readonly withheldLabel = input('withheld');
  /** How a figure is written at the end of its bar. */
  readonly format = input<(value: number) => string>((value) => value.toLocaleString('en-PH'));

  protected readonly labelShare = LABEL_SHARE;
  protected readonly barHeight = BAR_HEIGHT;

  private readonly top = computed(() => (this.series().length > 1 ? LEGEND_HEIGHT : 0));
  private readonly rowHeight = computed(
    () => this.series().length * (BAR_HEIGHT + BAR_GAP) - BAR_GAP + ROW_GAP,
  );

  protected readonly height = computed(() => this.top() + this.rows().length * this.rowHeight());

  private readonly largest = computed(() =>
    this.rows().reduce(
      (max, row) => row.values.reduce<number>((inner, value) => Math.max(inner, value ?? 0), max),
      0,
    ),
  );

  protected readonly drawn = computed<readonly DrawnRow[]>(() => {
    const span = 100 - LABEL_SHARE - FIGURE_SHARE;
    const largest = this.largest();
    const count = this.series().length;
    return this.rows().map((row, rowIndex) => {
      const y = this.top() + rowIndex * this.rowHeight();
      const bars: DrawnBar[] = [];
      for (let series = 0; series < count; series += 1) {
        const value = row.values[series] ?? null;
        const width =
          value === null || value <= 0 || largest <= 0
            ? 0
            : Math.max(0.5, Math.round((value / largest) * span * 10) / 10);
        bars.push({
          key: `${row.key}-${series}`,
          series,
          y: y + series * (BAR_HEIGHT + BAR_GAP),
          width,
          figure: value === null ? this.withheldLabel() : this.format()(value),
          withheld: value === null,
        });
      }
      const blockHeight = count * (BAR_HEIGHT + BAR_GAP) - BAR_GAP;
      return {
        key: row.key,
        label:
          row.label.length > LABEL_LIMIT ? `${row.label.slice(0, LABEL_LIMIT - 1)}…` : row.label,
        labelY: y + blockHeight / 2 + 4,
        bars,
      };
    });
  });
}
