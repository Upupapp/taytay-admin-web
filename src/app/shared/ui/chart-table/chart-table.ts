import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface ChartRow {
  /** Stable identity for tracking. */
  readonly key: string;
  readonly label: string;
  /** The number the bar is drawn from. Must be comparable across rows. */
  readonly value: number;
  /** Formatted for display — e.g. a peso amount. Falls back to `value`. */
  readonly display?: string;
  /** Makes the row a drill-down into the records behind it. */
  readonly routerLink?: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

/**
 * A bar chart that **is** a data table, rather than a chart with a table bolted
 * beside it.
 *
 * The markup is a real `<table>` with a `<caption>`, header row and one row per
 * category. The bar is an `aria-hidden` span inside the label cell, sized by
 * percentage of the largest value. So:
 *
 *  - **Screen readers** get a properly structured table — the same numbers, in
 *    the same order, with no "chart not accessible" fallback to maintain.
 *  - **Keyboard users** tab through real links when rows drill down.
 *  - **Nothing is conveyed by colour alone**: every row states its label and its
 *    value as text, and the bar only repeats what the number already says.
 *
 * Keeping it as one artifact matters. A chart plus a separate accessible table
 * is two things that drift apart; the table stops being updated and quietly
 * starts lying to the people who depend on it most.
 */
@Component({
  selector: 'app-chart-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <table class="chart">
      <caption class="chart__caption">
        {{
          caption()
        }}
        @if (summary(); as text) {
          <span class="chart__summary">{{ text }}</span>
        }
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ labelHeader() }}</th>
          <th scope="col" class="chart__value-header">{{ valueHeader() }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.key) {
          <tr class="chart__row">
            <th scope="row" class="chart__label-cell">
              <!-- Decoration only. The value beside it carries the meaning. -->
              <span
                class="chart__bar"
                aria-hidden="true"
                [style.inline-size.%]="percentOf(row.value)"
              ></span>
              @if (row.routerLink) {
                <a
                  class="chart__link"
                  [routerLink]="row.routerLink"
                  [queryParams]="row.queryParams ?? {}"
                >
                  {{ row.label }}
                </a>
              } @else {
                <span class="chart__label">{{ row.label }}</span>
              }
            </th>
            <td class="chart__value">{{ row.display ?? row.value }}</td>
          </tr>
        } @empty {
          <tr>
            <td class="chart__empty" colspan="2">{{ emptyMessage() }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './chart-table.scss',
})
export class ChartTable {
  readonly caption = input.required<string>();
  readonly rows = input.required<readonly ChartRow[]>();

  readonly labelHeader = input('Category');
  readonly valueHeader = input('Count');
  readonly emptyMessage = input('Nothing to show for this filter.');
  /** Plain-language description of what the chart shows, read with the caption. */
  readonly summary = input<string | null>(null);

  private readonly largest = computed(() =>
    this.rows().reduce((max, row) => Math.max(max, row.value), 0),
  );

  /**
   * Bar width as a percentage of the largest row.
   *
   * A non-zero value always gets a visible sliver, so "small but present" never
   * looks identical to "none" — the distinction the eye is most likely to miss
   * and the one that matters most on a caseload.
   */
  protected percentOf(value: number): number {
    const max = this.largest();
    if (max <= 0 || value <= 0) {
      return 0;
    }
    return Math.max(2, Math.round((value / max) * 100));
  }
}
