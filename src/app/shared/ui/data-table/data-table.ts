import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { Page, SortDirection, SortSpec } from '@domain/index';

import { EmptyState, type EmptyStateVariant } from '../empty-state/empty-state';
import { Skeleton } from '../loading/skeleton';
import { columnText, type TableColumn } from './table-column';

/**
 * The shared table primitive.
 *
 * Deliberately presentational: it receives rows, columns and a page descriptor
 * and emits intent. It never fetches, so it is identical against mock and HTTP
 * adapters, and every list screen inherits the same sorting affordance,
 * loading skeleton, empty state and pager.
 */
@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, EmptyState, Skeleton],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
})
export class DataTable<TRow> {
  readonly columns = input.required<readonly TableColumn<TRow>[]>();
  readonly rows = input.required<readonly TRow[]>();
  /** Stable identity for each row. Required so selection survives re-sorting. */
  readonly rowKey = input.required<(row: TRow) => string>();

  readonly caption = input.required<string>();
  readonly loading = input(false);
  readonly page = input<Page<unknown> | null>(null);
  readonly sort = input<SortSpec | null>(null);
  readonly selectable = input(false);

  readonly emptyVariant = input<EmptyStateVariant>('empty');
  readonly emptyHeading = input('Nothing to show yet');
  readonly emptyMessage = input<string | null>(null);
  readonly emptyActionLabel = input<string | null>(null);

  readonly sortChanged = output<SortSpec>();
  readonly pageChanged = output<number>();
  readonly rowSelected = output<TRow>();
  readonly emptyActionSelected = output<void>();

  protected readonly isEmpty = computed(() => !this.loading() && this.rows().length === 0);

  protected readonly rangeLabel = computed(() => {
    const page = this.page();
    if (page === null || page.totalItems === 0) {
      return '';
    }
    const first = (page.page - 1) * page.pageSize + 1;
    const last = Math.min(page.page * page.pageSize, page.totalItems);
    return `${first}–${last} of ${page.totalItems}`;
  });

  protected readonly canGoBack = computed(() => (this.page()?.page ?? 1) > 1);
  protected readonly canGoForward = computed(() => {
    const page = this.page();
    return page !== null && page.page < page.totalPages;
  });

  protected text(column: TableColumn<TRow>, row: TRow): string {
    return columnText(column, row);
  }

  protected directionFor(column: TableColumn<TRow>): SortDirection | null {
    const sort = this.sort();
    return sort && sort.field === column.sortField ? sort.direction : null;
  }

  protected ariaSortFor(column: TableColumn<TRow>): 'ascending' | 'descending' | 'none' {
    const direction = this.directionFor(column);
    if (direction === null) {
      return 'none';
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  protected toggleSort(column: TableColumn<TRow>): void {
    const field = column.sortField;
    if (field === undefined) {
      return;
    }
    const current = this.directionFor(column);
    this.sortChanged.emit({ field, direction: current === 'asc' ? 'desc' : 'asc' });
  }

  protected goToPage(delta: number): void {
    const page = this.page();
    if (page === null) {
      return;
    }
    const target = page.page + delta;
    if (target >= 1 && target <= page.totalPages) {
      this.pageChanged.emit(target);
    }
  }

  protected selectRow(row: TRow): void {
    if (this.selectable()) {
      this.rowSelected.emit(row);
    }
  }
}
