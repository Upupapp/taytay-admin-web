import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One point of a series: where it sits on the axis, and its figure, `null` when withheld. */
export interface LinePoint {
  readonly key: string;
  /** Under the axis, short: "5 Oct", "Nov". */
  readonly label: string;
  /** In the table, whole: "Week of 5 Oct 2026". */
  readonly longLabel: string;
  readonly value: number | null;
}

export interface Drawn {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

interface AxisLabel {
  readonly key: string;
  readonly text: string;
  readonly x: number;
  readonly shift: number;
  readonly last: boolean;
}

/**
 * A series over time drawn as a line with its area, as the boards draw one (`DL-232`).
 *
 * **The drawing is a picture of a table.** It is `aria-hidden`, and the table beside it — visually
 * hidden, read by a screen reader — states every point with its whole label, so the figures are
 * read once, in a table, and never from a shape.
 *
 * **A withheld point is not a zero** (`DL-105`): the line breaks there rather than dipping to the
 * axis, no dot is drawn, and the table says the figure was withheld. The scale is the largest
 * figure shown, rounded up to an even number so the middle line is a whole one. It computes
 * nothing about the data: it draws what it is given.
 *
 * **A second series** (`compare`, same keys in the same order) is drawn dashed in its own colour
 * with square dots, so the two lines are told apart by shape as well as colour (WCAG 1.4.1), named
 * in a legend, and given its own column in the table.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="line-chart">
      @if (compare(); as second) {
        <div class="line-chart__legend" aria-hidden="true">
          <span class="line-chart__key"
            ><span class="line-chart__swatch"></span>{{ valueHeader() }}</span
          >
          <span class="line-chart__key"
            ><span class="line-chart__swatch line-chart__swatch--compare"></span
            >{{ compareHeader() }}</span
          >
        </div>
      }
      <div class="line-chart__plot" aria-hidden="true">
        <span class="line-chart__grid line-chart__grid--top"></span>
        <span class="line-chart__grid line-chart__grid--middle"></span>
        <span class="line-chart__grid line-chart__grid--base"></span>
        <span class="line-chart__tick line-chart__tick--top">{{ scale() }}</span>
        <span class="line-chart__tick line-chart__tick--middle">{{ scale() / 2 }}</span>
        <span class="line-chart__tick line-chart__tick--base">0</span>
        <svg
          class="line-chart__svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          focusable="false"
        >
          @for (path of areas(); track $index) {
            <path class="line-chart__area" [attr.d]="path" />
          }
          @for (path of lines(); track $index) {
            <path class="line-chart__line" [attr.d]="path" vector-effect="non-scaling-stroke" />
          }
          @for (path of compareLines(); track $index) {
            <path
              class="line-chart__line line-chart__line--compare"
              [attr.d]="path"
              vector-effect="non-scaling-stroke"
            />
          }
        </svg>
        @for (dot of compareDots(); track dot.key) {
          <span
            class="line-chart__dot line-chart__dot--compare"
            [style.left.%]="dot.x"
            [style.top.%]="dot.y"
          ></span>
        }
        @for (dot of dots(); track dot.key) {
          <span class="line-chart__dot" [style.left.%]="dot.x" [style.top.%]="dot.y"></span>
        }
        @if (last(); as point) {
          <span class="line-chart__drop" [style.left.%]="point.x" [style.top.%]="point.y"></span>
          <span class="line-chart__now" [style.left.%]="point.x" [style.top.%]="point.y"></span>
          @if (callout()) {
            <span class="line-chart__callout" [style.left.%]="point.x" [style.top.%]="point.y">
              {{ callout() }}
            </span>
          }
        }
      </div>
      <div class="line-chart__axis" aria-hidden="true">
        @for (label of axis(); track label.key) {
          <span
            class="line-chart__label"
            [class.line-chart__label--last]="label.last"
            [style.left.%]="label.x"
            [style.transform]="'translateX(' + label.shift + '%)'"
            >{{ label.text }}</span
          >
        }
      </div>
      <!-- Hidden in a block: a table is as wide as its cells whatever its own width says, and a
           visually hidden table with a long caption widened the page (DL-248). -->
      <div class="visually-hidden">
        <table>
          <caption>
            {{
              caption()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">{{ labelHeader() }}</th>
              <th scope="col">{{ valueHeader() }}</th>
              @if (compare()) {
                <th scope="col">{{ compareHeader() }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (point of points(); track point.key; let i = $index) {
              <tr>
                <th scope="row">{{ point.longLabel }}</th>
                <td>{{ point.value === null ? withheldLabel() : point.value }}</td>
                @if (compare(); as second) {
                  <td>{{ shown(second[i]?.value ?? null) }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </figure>
  `,
  styleUrl: './line-chart.scss',
})
export class LineChart {
  readonly points = input.required<readonly LinePoint[]>();
  readonly caption = input.required<string>();
  readonly labelHeader = input.required<string>();
  readonly valueHeader = input.required<string>();
  /** Said beside the latest point ("14 requests"); nothing when empty. */
  readonly callout = input('');
  readonly withheldLabel = input('Withheld');
  /** Every other axis label, as the board does when the labels would crowd. */
  readonly sparseLabels = input(false);
  /** A second series over the same keys, in the same order; `null` draws one line. */
  readonly compare = input<readonly LinePoint[] | null>(null);
  /** The second series' name: its legend entry and its column in the table. */
  readonly compareHeader = input('');

  protected readonly scale = computed(() => {
    const all = [...this.points(), ...(this.compare() ?? [])];
    const largest = all.reduce((max, point) => Math.max(max, point.value ?? 0), 0);
    return Math.max(2, Math.ceil(largest / 2) * 2);
  });

  private readonly placed = computed(() => place(this.points(), this.scale()));

  /** Unbroken runs of shown points: a withheld point splits the line. */
  private readonly runs = computed(() => runsOf(this.placed()));

  private readonly comparePlaced = computed(() => place(this.compare() ?? [], this.scale()));

  protected readonly lines = computed(() => this.runs().map(curve));

  protected readonly compareLines = computed(() => runsOf(this.comparePlaced()).map(curve));

  protected readonly compareDots = computed(() =>
    this.comparePlaced().filter((point): point is Drawn => point !== null),
  );

  protected shown(value: number | null): string {
    return value === null ? this.withheldLabel() : String(value);
  }

  protected readonly areas = computed(() =>
    this.runs()
      .filter((run) => run.length > 1)
      .map((run) => {
        const first = run[0];
        const final = run[run.length - 1];
        return first === undefined || final === undefined
          ? ''
          : `${curve(run)} L${fix(final.x)} 100 L${fix(first.x)} 100 Z`;
      }),
  );

  protected readonly last = computed(() => {
    const placed = this.placed();
    return placed[placed.length - 1] ?? null;
  });

  protected readonly dots = computed(() => {
    const placed = this.placed();
    return placed.slice(0, -1).filter((point): point is Drawn => point !== null);
  });

  protected readonly axis = computed<readonly AxisLabel[]>(() => {
    const points = this.points();
    const span = Math.max(points.length - 1, 1);
    const sparse = this.sparseLabels();
    return points.map((point, index) => {
      const last = index === points.length - 1;
      return {
        key: point.key,
        // Every other label counted back from the latest, so the last two never crowd.
        text: sparse && (points.length - 1 - index) % 2 === 1 ? '' : point.label,
        x: (index / span) * 100,
        shift: index === 0 ? 0 : last ? -100 : -50,
        last,
      };
    });
  });
}

function place(points: readonly LinePoint[], scale: number): readonly (Drawn | null)[] {
  const span = Math.max(points.length - 1, 1);
  return points.map((point, index) =>
    point.value === null
      ? null
      : { key: point.key, x: (index / span) * 100, y: 100 - (point.value / scale) * 100 },
  );
}

function runsOf(placed: readonly (Drawn | null)[]): readonly Drawn[][] {
  const runs: Drawn[][] = [];
  let current: Drawn[] = [];
  for (const point of placed) {
    if (point === null) {
      if (current.length > 0) {
        runs.push(current);
      }
      current = [];
    } else {
      current.push(point);
    }
  }
  if (current.length > 0) {
    runs.push(current);
  }
  return runs;
}

function fix(value: number): string {
  return value.toFixed(2);
}

/**
 * A smooth path through the points that never overshoots them: monotone cubic interpolation
 * (Fritsch–Carlson, the rule d3's `curveMonotoneX` follows). Between two points the line stays
 * between their two values, so a count never dips below zero after a fall to none, and never peaks
 * above a figure nobody recorded. The Catmull–Rom curve the board drew did both.
 */
export function curve(run: readonly Drawn[]): string {
  const start = run[0];
  if (start === undefined) {
    return '';
  }
  let path = `M${fix(start.x)} ${fix(start.y)}`;
  const tangents = monotoneTangents(run);
  for (let i = 0; i < run.length - 1; i++) {
    const p1 = run[i];
    const p2 = run[i + 1];
    if (p1 === undefined || p2 === undefined) {
      continue;
    }
    const third = (p2.x - p1.x) / 3;
    path +=
      ` C${fix(p1.x + third)} ${fix(p1.y + (tangents[i] ?? 0) * third)}` +
      ` ${fix(p2.x - third)} ${fix(p2.y - (tangents[i + 1] ?? 0) * third)}` +
      ` ${fix(p2.x)} ${fix(p2.y)}`;
  }
  return path;
}

/** The slope at each point: zero at a peak, a trough or a flat, and never steep enough to overshoot. */
function monotoneTangents(run: readonly Drawn[]): readonly number[] {
  const widths: number[] = [];
  const secants: number[] = [];
  for (let i = 0; i < run.length - 1; i++) {
    const p1 = run[i];
    const p2 = run[i + 1];
    const width = p1 === undefined || p2 === undefined ? 0 : p2.x - p1.x;
    widths.push(width);
    secants.push(p1 === undefined || p2 === undefined || width === 0 ? 0 : (p2.y - p1.y) / width);
  }
  if (secants.length === 0) {
    return [0];
  }
  const tangents: number[] = [];
  for (let i = 1; i < run.length - 1; i++) {
    const before = secants[i - 1] ?? 0;
    const after = secants[i] ?? 0;
    const h0 = widths[i - 1] ?? 0;
    const h1 = widths[i] ?? 0;
    if (before * after <= 0 || h0 + h1 === 0) {
      tangents[i] = 0;
      continue;
    }
    const weighted = (before * h1 + after * h0) / (h0 + h1);
    tangents[i] =
      (Math.sign(before) + Math.sign(after)) *
      Math.min(Math.abs(before), Math.abs(after), 0.5 * Math.abs(weighted));
  }
  const firstSecant = secants[0] ?? 0;
  const lastSecant = secants[secants.length - 1] ?? 0;
  if (run.length === 2) {
    return [firstSecant, firstSecant];
  }
  // At either end, the one-sided estimate d3 uses: between the secant and one and a half times it.
  tangents[0] = (3 * firstSecant - (tangents[1] ?? 0)) / 2;
  tangents[run.length - 1] = (3 * lastSecant - (tangents[run.length - 2] ?? 0)) / 2;
  return tangents;
}
