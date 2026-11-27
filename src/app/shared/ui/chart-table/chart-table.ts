import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

export interface ChartRow {
  /** Stable identity for tracking. */
  readonly key: string;
  readonly label: string;
  /** The number the bar is drawn from. Must be comparable across rows. */
  readonly value: number;
  /** Formatted for display — e.g. a peso amount. Falls back to `value`. */
  readonly display?: string;
  /**
   * Withheld as a small cell (`DL-105`): the row keeps its label and says so, and draws no track, as
   * an empty track would read as a zero (`DL-250`).
   */
  readonly isWithheld?: boolean;
  /** Makes the row a drill-down into the records behind it. */
  readonly routerLink?: string;
  readonly queryParams?: Readonly<Record<string, string>>;
}

/**
 * A summary sentence after its caption, without the caption it starts with. The API words a series'
 * summary as "Residents by sector: 1,236 people in total…", and read after a caption of "Residents by
 * sector" that names the chart twice, on screen and to a screen reader (`DL-250`). A summary that
 * does not start with its caption is returned unchanged.
 */
export function summaryAfterCaption(caption: string, summary: string): string {
  if (caption === '' || !summary.startsWith(caption)) return summary;
  const rest = /^\s*[:,]\s*(.+)$/su.exec(summary.slice(caption.length))?.[1];
  return rest === undefined ? summary : rest.charAt(0).toLocaleUpperCase('en-PH') + rest.slice(1);
}

/**
 * A bar chart that **is** a data table, rather than a chart with a table bolted
 * beside it.
 *
 * The markup is a real `<table>` with a `<caption>`, header row and one row per
 * category. The bar is an `aria-hidden` span inside the label cell, beside the
 * label as the console mock-ups draw it, sized by percentage of the largest
 * value. So:
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
        <span class="chart__caption-title">{{ caption() }}</span>
        @if (summaryText(); as text) {
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
              <span class="chart__label-row">
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
                <!-- The stacked layout draws the figure here, on the label's line and ending where
                     the bar ends (DL-295); the cell beside it still carries it for the table. -->
                @if (stacked) {
                  <span class="chart__figure" aria-hidden="true">{{
                    row.display ?? row.value
                  }}</span>
                }
                <!-- Decoration only. The value beside it carries the meaning. -->
                @if (!row.isWithheld) {
                  <span class="chart__track" aria-hidden="true">
                    <span
                      class="chart__bar"
                      aria-hidden="true"
                      [class.chart__bar--top]="isLargest(row.value)"
                      [style.inline-size.%]="percentOf(row.value)"
                    ></span>
                  </span>
                }
              </span>
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
  /** The stacked layout is the host's class, set once where the table is placed. */
  protected readonly stacked =
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.classList.contains(
      'chart-table--stacked',
    );

  readonly caption = input.required<string>();
  readonly rows = input.required<readonly ChartRow[]>();

  readonly labelHeader = input('Category');
  readonly valueHeader = input('Count');
  readonly emptyMessage = input('Nothing to show for this filter.');
  /** Plain-language description of what the chart shows, read with the caption. */
  readonly summary = input<string | null>(null);

  /** The summary without the caption it would otherwise repeat: see `summaryAfterCaption`. */
  protected readonly summaryText = computed(() => {
    const text = this.summary();
    return text === null ? null : summaryAfterCaption(this.caption(), text);
  });

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
  /**
   * The one largest row, which the stacked layout picks out in gold as the boards do. A tie picks
   * out none: gold on every row would single out nothing.
   */
  protected isLargest(value: number): boolean {
    const max = this.largest();
    return (
      value > 0 && value === max && this.rows().filter((row) => row.value === max).length === 1
    );
  }

  protected percentOf(value: number): number {
    const max = this.largest();
    if (max <= 0 || value <= 0) {
      return 0;
    }
    return Math.max(2, Math.round((value / max) * 100));
  }
}
