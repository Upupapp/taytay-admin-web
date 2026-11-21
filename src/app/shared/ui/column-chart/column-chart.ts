import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** One column: its short label under the bar, its whole label for a screen reader, its figure. */
export interface ColumnPoint {
  readonly key: string;
  /** Under the bar: "Mon", "5". */
  readonly label: string;
  /** Read by a screen reader: "Monday 5 October". */
  readonly longLabel: string;
  /** `null` when withheld (`DL-105`): no bar, and the cell says so. */
  readonly value: number | null;
}

interface DrawnColumn extends ColumnPoint {
  /** Bar height as a share of the cell, room kept above for the figure; 0 is a stub. */
  readonly height: number;
  readonly top: boolean;
}

/**
 * A few figures side by side as columns — the boards' "last 7 days" — drawn **as a real table**
 * (`DL-232`): the head row names each column and the body row holds its figure with its bar, so a
 * screen reader reads a table of figures and the bar is decoration on a cell. On screen the names
 * sit under the bars.
 *
 * `tone="deep"` draws it on a deep panel (the dashboard's handover card), the tallest column in
 * gold; `compact` drops the figures and the labels from sight and keeps them for a screen reader
 * (a KPI tile's spark of bars). A withheld figure draws no bar; a zero draws a stub.
 */
@Component({
  selector: 'app-column-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.column-chart--deep]': "tone() === 'deep'",
    '[class.column-chart--compact]': 'compact()',
  },
  template: `
    <table class="column-chart">
      <caption class="visually-hidden">
        {{
          caption()
        }}
      </caption>
      <!-- The names head their columns for a screen reader and sit under the bars on screen. -->
      <thead class="column-chart__names">
        <tr>
          @for (column of drawn(); track column.key) {
            <th scope="col" class="column-chart__label">
              <span aria-hidden="true">{{ column.label }}</span>
              <span class="visually-hidden">{{ column.longLabel }}</span>
            </th>
          }
        </tr>
      </thead>
      <tbody>
        <tr>
          @for (column of drawn(); track column.key) {
            <td class="column-chart__cell">
              <span class="column-chart__stack">
                <span class="column-chart__figure" [class.column-chart__figure--top]="column.top">
                  {{ column.value === null ? withheldLabel() : column.value }}
                </span>
                @if (column.value !== null) {
                  <span
                    class="column-chart__bar"
                    [class.column-chart__bar--top]="column.top"
                    [style.height.%]="column.height"
                    aria-hidden="true"
                  ></span>
                }
              </span>
            </td>
          }
        </tr>
      </tbody>
    </table>
  `,
  styleUrl: './column-chart.scss',
})
export class ColumnChart {
  readonly columns = input.required<readonly ColumnPoint[]>();
  readonly caption = input.required<string>();
  readonly tone = input<'plain' | 'deep'>('plain');
  readonly compact = input(false);
  readonly withheldLabel = input('Withheld');

  protected readonly drawn = computed<readonly DrawnColumn[]>(() => {
    const columns = this.columns();
    const largest = columns.reduce((max, column) => Math.max(max, column.value ?? 0), 0);
    return columns.map((column) => ({
      ...column,
      height:
        largest === 0 || column.value === null
          ? 0
          : (column.value / largest) * (this.compact() ? 100 : 70),
      top: largest > 0 && column.value === largest,
    }));
  });
}
