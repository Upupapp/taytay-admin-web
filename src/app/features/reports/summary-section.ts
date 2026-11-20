import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  centavos,
  describePesos,
  summaryChartColumns,
  type SummaryCell,
  type SummaryColumn,
  type SummaryMeasure,
  type SummaryRow,
  type SummarySection,
  type SummaryTile,
} from '@domain/index';
import { BarChart, type BarChartRow } from '@shared/ui/bar-chart/bar-chart';
import { ScrollRegion } from '@shared/ui/scroll-region/scroll-region';

import { SUMMARY_REPORT_COPY } from './summary-report.copy';

/**
 * One lettered section of the summary report's sheet (`DL-228`): its heading and note, the tiles
 * of section A, a chart, and the table.
 *
 * **The table is the record; the chart is a picture of it.** The chart is `aria-hidden` and draws
 * only what the table states. A withheld cell reads "Withheld" with its reason, in the table and on
 * the chart, never as a zero (`DL-105`); the totals row is the server's, taken before anything was
 * withheld, under the server's own label. Nothing here adds a column up.
 *
 * A section the reader may not count (the digital IDs, for a reader of no ID register) says so in
 * the server's sentence instead of drawing an empty table, which would read as "none".
 */
@Component({
  selector: 'app-summary-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BarChart, ScrollRegion],
  template: `
    @let part = section();
    <section class="sheet-section" [attr.aria-labelledby]="headingId()">
      <h3 class="sheet-section__heading" [id]="headingId()">{{ part.letter }}. {{ part.title }}</h3>
      @if (!part.available) {
        <p class="sheet-section__unavailable">
          <strong>{{ copy.notCounted }}.</strong> {{ part.unavailableReason }}
        </p>
      } @else {
        @if (part.note) {
          <p class="sheet-section__note">{{ part.note }}</p>
        }

        @if (part.tiles.length > 0) {
          <dl class="sheet-tiles">
            @for (tile of part.tiles; track tile.key) {
              <div class="sheet-tiles__tile">
                <dt class="sheet-tiles__label">{{ tile.label }}</dt>
                <dd class="sheet-tiles__value">{{ tileValue(tile) }}</dd>
                <dd class="sheet-tiles__hint">
                  {{ tile.withheld ? copy.withheldReasons[tile.withheld] : tile.hint }}
                </dd>
              </div>
            }
          </dl>
        }

        @if (chartRows().length > 0) {
          <app-bar-chart
            class="sheet-section__chart"
            [series]="chartSeries()"
            [rows]="chartRows()"
            [withheldLabel]="copy.chartWithheld"
          />
        }

        @if (part.columns.length > 0) {
          <div class="table-scroll sheet-section__table" [appScrollRegion]="captionText()">
            <table class="simple-table">
              <caption class="visually-hidden">
                {{
                  captionText()
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{{ copy.category }}</th>
                  @for (column of part.columns; track column.key) {
                    <th scope="col" [class.simple-table__num]="isNumeric(column)">
                      {{ column.label }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of part.rows; track row.key) {
                  <tr>
                    <th scope="row">{{ row.label }}</th>
                    @for (column of part.columns; track column.key) {
                      <td [class.simple-table__num]="isNumeric(column)">
                        @if (row.withheld[column.key]; as reason) {
                          <span class="sheet-withheld">{{ copy.withheld }}</span>
                          <span class="sheet-withheld__reason">{{
                            copy.withheldReasons[reason]
                          }}</span>
                        } @else {
                          {{ cellText(row, column) }}
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
              @if (part.totals; as totals) {
                <tfoot>
                  <tr class="sheet-section__totals">
                    <th scope="row">{{ part.totalsLabel ?? '' }}</th>
                    @for (column of part.columns; track column.key) {
                      <td [class.simple-table__num]="isNumeric(column)">
                        {{ totalText(totals[column.key], column.measure) }}
                      </td>
                    }
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        }

        @if (part.suppressionNotice) {
          <p class="sheet-section__suppression" role="note">{{ part.suppressionNotice }}</p>
        }
      }
    </section>
  `,
  styleUrl: './summary-section.scss',
})
export class SummarySectionView {
  readonly section = input.required<SummarySection>();

  protected readonly copy = SUMMARY_REPORT_COPY;

  protected readonly headingId = computed(() => `summary-section-${this.section().key}`);
  protected readonly captionText = computed(
    () => `${this.section().letter}. ${this.section().title}`,
  );

  private readonly chartColumns = computed(() => summaryChartColumns(this.section()));

  protected readonly chartSeries = computed(() =>
    this.chartColumns().map((column) => ({ key: column.key, label: column.label })),
  );

  protected readonly chartRows = computed<readonly BarChartRow[]>(() => {
    const columns = this.chartColumns();
    if (columns.length === 0) return [];
    return this.section().rows.map((row) => ({
      key: row.key,
      label: row.label,
      values: columns.map((column) => {
        const value = row.values[column.key];
        return typeof value === 'number' && row.withheld[column.key] === undefined ? value : null;
      }),
    }));
  });

  protected isNumeric(column: SummaryColumn): boolean {
    return this.section().rows.every((row) => typeof row.values[column.key] !== 'string');
  }

  protected tileValue(tile: SummaryTile): string {
    return tile.value === null ? this.copy.withheld : format(tile.value, tile.measure);
  }

  protected cellText(row: SummaryRow, column: SummaryColumn): string {
    const value: SummaryCell | undefined = row.values[column.key];
    if (value === null || value === undefined) return this.copy.withheld;
    if (typeof value === 'string') return this.copy.waitingOn[value] ?? value;
    return format(value, column.measure);
  }

  protected totalText(value: number | undefined, measure: SummaryMeasure): string {
    return value === undefined ? '' : format(value, measure);
  }
}

function format(value: number, measure: SummaryMeasure): string {
  switch (measure) {
    case 'centavos':
      return describePesos(centavos(value));
    case 'percent':
      return `${value}%`;
    case 'days':
      return SUMMARY_REPORT_COPY.daysSuffix(value.toLocaleString('en-PH'));
    case 'records':
    case 'people':
      return value.toLocaleString('en-PH');
  }
}
