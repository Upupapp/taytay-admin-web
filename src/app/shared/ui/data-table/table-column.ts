import type { TemplateRef } from '@angular/core';

export type ColumnAlign = 'start' | 'end';

/**
 * Declarative column definition.
 *
 * A column supplies either a plain `value` accessor (the common case, which
 * keeps the row markup out of feature templates) or a `cell` template for rich
 * content such as a status badge or an action menu.
 */
export interface TableColumn<TRow> {
  readonly key: string;
  readonly header: string;
  readonly value?: (row: TRow) => string;
  readonly cell?: TemplateRef<{ $implicit: TRow }>;
  /** Field name sent back through `sortChanged`. Omit to make the column fixed. */
  readonly sortField?: string;
  readonly align?: ColumnAlign;
  /** Any CSS width value, e.g. `'160px'` or `'20%'`. */
  readonly width?: string;
  /** Hides the header text visually but keeps it for screen readers. */
  readonly hideHeader?: boolean;
}

export function columnText<TRow>(column: TableColumn<TRow>, row: TRow): string {
  return column.value ? column.value(row) : '';
}
