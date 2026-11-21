import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { SummaryColumn, SummarySection } from '@domain/index';

/** The shapes a report sheet draws besides plain bars. */
export type SheetChartKind = 'line' | 'pyramid' | 'funnel';

const WIDTH = 640;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Figure {
  readonly value: number | null;
  readonly text: string;
}

/**
 * A report sheet's line, pyramid or funnel (`DL-234`), drawn as inline SVG with every value printed
 * beside its mark, so the paper copy can be read without the table — and the table under it is
 * still the record. `aria-hidden`: the figures are read once, from the table.
 *
 * **It draws what the section states and computes nothing.** A withheld figure is not a zero
 * (`DL-105`): the line breaks there, the bar is not drawn, and the word "withheld" is printed where
 * the figure would be. The scale starts at zero, so a small change is not drawn as a large one.
 */
@Component({
  selector: 'app-sheet-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="sheet-chart"
      aria-hidden="true"
      focusable="false"
      width="100%"
      [attr.viewBox]="'0 0 ' + width + ' ' + height()"
      preserveAspectRatio="xMidYMin meet"
    >
      @switch (kind()) {
        @case ('line') {
          <line
            class="sheet-chart__axis"
            x1="40"
            [attr.y1]="lineBase"
            x2="620"
            [attr.y2]="lineBase"
          />
          @for (path of linePaths(); track $index) {
            <polyline class="sheet-chart__line" [attr.points]="path" />
          }
          @for (point of linePoints(); track point.key) {
            @if (point.y !== null) {
              <circle class="sheet-chart__dot" [attr.cx]="point.x" [attr.cy]="point.y" r="3.5" />
            }
            <text
              class="sheet-chart__figure"
              [class.sheet-chart__figure--withheld]="point.y === null"
              text-anchor="middle"
              [attr.x]="point.x"
              [attr.y]="(point.y ?? lineBase) - 9"
            >
              {{ point.text }}
            </text>
            <text
              class="sheet-chart__label"
              text-anchor="middle"
              [attr.x]="point.x"
              [attr.y]="lineBase + 18"
            >
              {{ point.label }}
            </text>
          }
        }
        @case ('pyramid') {
          <text class="sheet-chart__legend" text-anchor="end" x="250" y="14">
            {{ leftLabel() }}
          </text>
          <text class="sheet-chart__legend" x="390" y="14">{{ rightLabel() }}</text>
          @for (band of pyramid(); track band.key) {
            <text class="sheet-chart__label" text-anchor="middle" x="320" [attr.y]="band.y + 15">
              {{ band.label }}
            </text>
            @if (band.left.width > 0) {
              <rect
                class="sheet-chart__bar sheet-chart__bar--left"
                [attr.x]="250 - band.left.width"
                [attr.y]="band.y"
                [attr.width]="band.left.width"
                height="22"
                rx="3"
              />
            }
            <text
              class="sheet-chart__figure"
              [class.sheet-chart__figure--withheld]="band.left.value === null"
              text-anchor="end"
              [attr.x]="244 - band.left.width"
              [attr.y]="band.y + 15"
            >
              {{ band.left.text }}
            </text>
            @if (band.right.width > 0) {
              <rect
                class="sheet-chart__bar sheet-chart__bar--right"
                x="390"
                [attr.y]="band.y"
                [attr.width]="band.right.width"
                height="22"
                rx="3"
              />
            }
            <text
              class="sheet-chart__figure"
              [class.sheet-chart__figure--withheld]="band.right.value === null"
              [attr.x]="396 + band.right.width"
              [attr.y]="band.y + 15"
            >
              {{ band.right.text }}
            </text>
          }
        }
        @case ('funnel') {
          @for (step of funnel(); track step.key) {
            <text class="sheet-chart__label" x="0" [attr.y]="step.y + 17">{{ step.label }}</text>
            @if (step.width > 0) {
              <rect
                class="sheet-chart__bar sheet-chart__bar--0"
                [attr.x]="400 - step.width / 2"
                [attr.y]="step.y"
                [attr.width]="step.width"
                height="26"
                rx="3"
              />
            }
            <text
              class="sheet-chart__figure"
              [class.sheet-chart__figure--withheld]="step.value === null"
              [attr.x]="406 + step.width / 2"
              [attr.y]="step.y + 17"
            >
              {{ step.text }}
            </text>
          }
        }
      }
    </svg>
  `,
  styleUrl: './sheet-chart.scss',
})
export class SheetChart {
  readonly section = input.required<SummarySection<string>>();
  readonly kind = input.required<SheetChartKind>();
  /** Printed in place of a withheld figure. */
  readonly withheldLabel = input('withheld');

  protected readonly width = WIDTH;
  protected readonly lineBase = 170;

  protected readonly height = computed(() => {
    const rows = this.section().rows.length;
    switch (this.kind()) {
      case 'line':
        return 200;
      case 'pyramid':
        return 24 + rows * 30;
      case 'funnel':
        return rows * 36;
    }
  });

  protected readonly leftLabel = computed(() => this.column(0)?.label ?? '');
  protected readonly rightLabel = computed(() => this.column(1)?.label ?? '');

  /* ── Line ───────────────────────────────────────────────────────────── */

  protected readonly linePoints = computed(() => {
    const rows = this.section().rows;
    const figures = rows.map((row) => this.figure(row.key, 0));
    const top = Math.max(0, ...figures.map((figure) => figure.value ?? 0));
    const step = rows.length > 1 ? 580 / (rows.length - 1) : 0;
    return rows.map((row, index) => {
      const figure = figures[index] ?? { value: null, text: this.withheldLabel() };
      return {
        key: row.key,
        label: shortMonth(row.key, row.label),
        x: Math.round(40 + index * step),
        // The plot runs from the axis (170) to 40 at the largest figure; zero sits on the axis.
        y:
          figure.value === null
            ? null
            : this.lineBase - (top === 0 ? 0 : (figure.value / top) * 130),
        text: figure.text,
      };
    });
  });

  /** One polyline per unbroken run: a withheld point breaks the line rather than dipping to zero. */
  protected readonly linePaths = computed(() => {
    const paths: string[] = [];
    let run: string[] = [];
    for (const point of this.linePoints()) {
      if (point.y === null) {
        if (run.length > 1) paths.push(run.join(' '));
        run = [];
      } else {
        run.push(`${point.x},${point.y}`);
      }
    }
    if (run.length > 1) paths.push(run.join(' '));
    return paths;
  });

  /* ── Pyramid: the first column to the left, the second to the right ───── */

  protected readonly pyramid = computed(() => {
    const rows = this.section().rows;
    const sides = rows.map((row) => ({
      left: this.figure(row.key, 0),
      right: this.figure(row.key, 1),
    }));
    const top = Math.max(
      0,
      ...sides.flatMap((side) => [side.left.value ?? 0, side.right.value ?? 0]),
    );
    const width = (value: number | null): number =>
      value === null || top === 0 ? 0 : Math.max(1, (value / top) * 170);
    return rows.map((row, index) => {
      const side = sides[index] ?? { left: this.withheld(), right: this.withheld() };
      return {
        key: row.key,
        label: row.label,
        y: 24 + index * 30,
        left: { ...side.left, width: width(side.left.value) },
        right: { ...side.right, width: width(side.right.value) },
      };
    });
  });

  /* ── Funnel: each step centred, as wide as its share of the first ────── */

  protected readonly funnel = computed(() => {
    const rows = this.section().rows;
    const figures = rows.map((row) => this.figure(row.key, 0));
    const top = Math.max(0, ...figures.map((figure) => figure.value ?? 0));
    return rows.map((row, index) => {
      const figure = figures[index] ?? this.withheld();
      return {
        key: row.key,
        label: row.label,
        y: index * 36 + 4,
        value: figure.value,
        text: figure.text,
        width: figure.value === null || top === 0 ? 0 : Math.max(1, (figure.value / top) * 300),
      };
    });
  });

  private column(index: number): SummaryColumn | undefined {
    return this.section().columns[index];
  }

  private withheld(): Figure {
    return { value: null, text: this.withheldLabel() };
  }

  private figure(rowKey: string, columnIndex: number): Figure {
    const column = this.column(columnIndex);
    const row = this.section().rows.find((entry) => entry.key === rowKey);
    if (column === undefined || row === undefined) return this.withheld();
    const value = row.values[column.key];
    return typeof value === 'number' && row.withheld[column.key] === undefined
      ? { value, text: value.toLocaleString('en-PH') }
      : this.withheld();
  }
}

/** "2026-03" → "Mar"; any other key keeps its row's label. */
function shortMonth(key: string, label: string): string {
  const match = /^\d{4}-(\d{2})$/.exec(key);
  const month = match === null ? undefined : MONTHS[Number(match[1]) - 1];
  return month ?? label;
}
