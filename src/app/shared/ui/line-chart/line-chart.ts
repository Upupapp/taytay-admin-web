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

interface Drawn {
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

/** How much the curve bends between two points; the board's own value. */
const TENSION = 0.18;

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
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="line-chart">
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
        </svg>
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
      <table class="visually-hidden">
        <caption>
          {{
            caption()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">{{ labelHeader() }}</th>
            <th scope="col">{{ valueHeader() }}</th>
          </tr>
        </thead>
        <tbody>
          @for (point of points(); track point.key) {
            <tr>
              <th scope="row">{{ point.longLabel }}</th>
              <td>{{ point.value === null ? withheldLabel() : point.value }}</td>
            </tr>
          }
        </tbody>
      </table>
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

  protected readonly scale = computed(() => {
    const largest = this.points().reduce((max, point) => Math.max(max, point.value ?? 0), 0);
    return Math.max(2, Math.ceil(largest / 2) * 2);
  });

  private readonly placed = computed<readonly (Drawn | null)[]>(() => {
    const points = this.points();
    const span = Math.max(points.length - 1, 1);
    const scale = this.scale();
    return points.map((point, index) =>
      point.value === null
        ? null
        : { key: point.key, x: (index / span) * 100, y: 100 - (point.value / scale) * 100 },
    );
  });

  /** Unbroken runs of shown points: a withheld point splits the line. */
  private readonly runs = computed(() => {
    const runs: Drawn[][] = [];
    let current: Drawn[] = [];
    for (const point of this.placed()) {
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
  });

  protected readonly lines = computed(() => this.runs().map(curve));

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

function fix(value: number): string {
  return value.toFixed(2);
}

/** A smooth path through the points (Catmull–Rom, as the board draws it). */
function curve(run: readonly Drawn[]): string {
  const at = (index: number): Drawn | undefined =>
    run[Math.min(Math.max(index, 0), run.length - 1)];
  const start = run[0];
  if (start === undefined) {
    return '';
  }
  let path = `M${fix(start.x)} ${fix(start.y)}`;
  for (let i = 0; i < run.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    if (p0 === undefined || p1 === undefined || p2 === undefined || p3 === undefined) {
      continue;
    }
    path +=
      ` C${fix(p1.x + (p2.x - p0.x) * TENSION)} ${fix(p1.y + (p2.y - p0.y) * TENSION)}` +
      ` ${fix(p2.x - (p3.x - p1.x) * TENSION)} ${fix(p2.y - (p3.y - p1.y) * TENSION)}` +
      ` ${fix(p2.x)} ${fix(p2.y)}`;
  }
  return path;
}
