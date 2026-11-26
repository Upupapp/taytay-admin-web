import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { Page, SortSpec } from '@domain/index';

import { DataTable, DENSE_FROM_COLUMNS } from './data-table';
import type { TableColumn } from './table-column';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
}

const COLUMNS: readonly TableColumn<Row>[] = [
  { key: 'name', header: 'Name', sortField: 'name', value: (row) => row.name },
  { key: 'amount', header: 'Amount', align: 'end', value: (row) => `${row.amount}` },
];

const ROWS: readonly Row[] = [
  { id: 'a', name: 'Aurora Mercado', amount: 8000 },
  { id: 'b', name: 'Reynaldo Bautista', amount: 6500 },
];

function page(overrides: Partial<Page<unknown>> = {}): Page<unknown> {
  return { items: [], page: 1, pageSize: 10, totalItems: 2, totalPages: 1, ...overrides };
}

async function render(
  inputs: Record<string, unknown> = {},
): Promise<ComponentFixture<DataTable<Row>>> {
  const fixture = TestBed.createComponent<DataTable<Row>>(DataTable);
  fixture.componentRef.setInput('caption', 'Test table');
  fixture.componentRef.setInput('columns', COLUMNS);
  fixture.componentRef.setInput('rows', ROWS);
  fixture.componentRef.setInput('rowKey', (row: Row) => row.id);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  await fixture.whenStable();
  return fixture;
}

describe('DataTable', () => {
  it('renders a row per item using the column accessors', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(element.textContent).toContain('Aurora Mercado');
    expect(element.textContent).toContain('6500');
  });

  it('keeps a nowrap column on one line, and only that column', async () => {
    const columns: readonly TableColumn<Row>[] = [
      { key: 'name', header: 'Name', value: (row) => row.name },
      { key: 'phone', header: 'Number', value: () => '(02) 8000-0000', nowrap: true },
    ];
    const element = (await render({ columns })).nativeElement as HTMLElement;
    const cells = element.querySelectorAll('tbody tr:first-child td');
    expect(cells[0]?.classList.contains('table__cell--nowrap')).toBe(false);
    expect(cells[1]?.classList.contains('table__cell--nowrap')).toBe(true);
  });

  it('lets a wrapAnywhere column break its value anywhere, and only that column (DL-259)', async () => {
    const columns: readonly TableColumn<Row>[] = [
      { key: 'name', header: 'Name', value: (row) => row.name },
      {
        key: 'email',
        header: 'Email',
        value: () => 'aurora.mercado@example.com',
        wrapAnywhere: true,
      },
    ];
    const element = (await render({ columns })).nativeElement as HTMLElement;
    const cells = element.querySelectorAll('tbody tr:first-child td');
    expect(cells[0]?.classList.contains('table__cell--anywhere')).toBe(false);
    expect(cells[1]?.classList.contains('table__cell--anywhere')).toBe(true);
  });

  it('draws its cells closer once it has eight columns, and not before (DL-259)', async () => {
    const many = (count: number): readonly TableColumn<Row>[] =>
      Array.from({ length: count }, (_, index) => ({
        key: `c${index}`,
        header: `Column ${index}`,
        value: (row: Row) => row.name,
      }));
    expect(DENSE_FROM_COLUMNS).toBe(8);
    const seven = (await render({ columns: many(7) })).nativeElement as HTMLElement;
    expect(seven.querySelector('table')?.classList.contains('table--dense')).toBe(false);
    const eight = (await render({ columns: many(8) })).nativeElement as HTMLElement;
    expect(eight.querySelector('table')?.classList.contains('table--dense')).toBe(true);
  });

  it('shows no empty state when the read behind it failed, and does when it is truly empty (DL-270)', async () => {
    const failed = (await render({ rows: [], failed: true })).nativeElement as HTMLElement;
    expect(failed.querySelector('app-empty-state')).toBeNull();
    const empty = (await render({ rows: [] })).nativeElement as HTMLElement;
    expect(empty.querySelector('app-empty-state')).not.toBeNull();
  });

  it('renders an accessible caption', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('caption')?.textContent).toContain('Test table');
  });

  it('shows a skeleton and no rows while loading', async () => {
    const element = (await render({ loading: true })).nativeElement as HTMLElement;
    expect(element.querySelector('app-skeleton')).not.toBeNull();
    expect(element.querySelectorAll('tbody tr')).toHaveLength(0);
  });

  it('marks the table region busy while loading (DL-16 -> DL-25)', async () => {
    const loading = (await render({ loading: true })).nativeElement as HTMLElement;
    expect(loading.querySelector('.table-wrap')?.getAttribute('aria-busy')).toBe('true');

    const settled = (await render()).nativeElement as HTMLElement;
    expect(settled.querySelector('.table-wrap')?.getAttribute('aria-busy')).toBeNull();
  });

  it('shows the empty state only once loading has finished', async () => {
    const loading = (await render({ rows: [], loading: true })).nativeElement as HTMLElement;
    expect(loading.querySelector('app-empty-state')).toBeNull();

    const settled = (await render({ rows: [] })).nativeElement as HTMLElement;
    expect(settled.querySelector('app-empty-state')).not.toBeNull();
  });

  it('distinguishes an empty registry from filtered-out results', async () => {
    const fixture = await render({
      rows: [],
      emptyVariant: 'no-results',
      emptyHeading: 'No residents match those filters',
    });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('No residents match those filters');
    expect(element.querySelector('.empty--no-results')).not.toBeNull();
  });

  it('emits a sort request and flips direction on the active column', async () => {
    const fixture = await render({ sort: { field: 'name', direction: 'asc' } as SortSpec });
    const emitted: SortSpec[] = [];
    fixture.componentInstance.sortChanged.subscribe((sort) => emitted.push(sort));

    const button = (fixture.nativeElement as HTMLElement).querySelector('.table__sort');
    (button as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(emitted).toEqual([{ field: 'name', direction: 'desc' }]);
  });

  it('marks the sorted column for assistive technology', async () => {
    const fixture = await render({ sort: { field: 'name', direction: 'asc' } as SortSpec });
    const headers = (fixture.nativeElement as HTMLElement).querySelectorAll('th');
    expect(headers[0]?.getAttribute('aria-sort')).toBe('ascending');
    expect(headers[1]?.getAttribute('aria-sort')).toBeNull();
  });

  it('hides the pager when there is nothing to page', async () => {
    const fixture = await render({ page: page({ totalItems: 0, totalPages: 1 }) });
    expect((fixture.nativeElement as HTMLElement).querySelector('.pager')).toBeNull();
  });

  it('disables paging past either end', async () => {
    const fixture = await render({ page: page({ page: 1, totalPages: 3, totalItems: 23 }) });
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('.pager button');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('emits the target page number', async () => {
    const fixture = await render({ page: page({ page: 2, totalPages: 3, totalItems: 23 }) });
    const emitted: number[] = [];
    fixture.componentInstance.pageChanged.subscribe((value) => emitted.push(value));

    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('.pager button');
    (buttons[1] as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(emitted).toEqual([3]);
  });

  it('only emits row selection when the table is selectable', async () => {
    const fixture = await render();
    const emitted: Row[] = [];
    fixture.componentInstance.rowSelected.subscribe((row) => emitted.push(row));

    const firstRow = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    (firstRow as HTMLElement).click();
    await fixture.whenStable();
    expect(emitted).toHaveLength(0);

    fixture.componentRef.setInput('selectable', true);
    await fixture.whenStable();
    ((fixture.nativeElement as HTMLElement).querySelector('tbody tr') as HTMLElement).click();
    await fixture.whenStable();
    expect(emitted).toEqual([ROWS[0]]);
  });

  /* ── The phone layout (DL-227) ─────────────────────────────────────────── */

  it('gives each cell its column header, for a phone to print beside the value', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const cells = [...element.querySelectorAll('tbody tr:first-child td')];
    expect(cells.map((cell) => cell.getAttribute('data-label'))).toEqual(['Name', 'Amount']);
    // The label is drawn by CSS, so the cell's own text is only its value.
    expect(cells[0]?.textContent?.trim()).toBe('Aurora Mercado');
  });

  it('leaves a column with a hidden header (the row actions) unlabelled, across the row', async () => {
    const columns: readonly TableColumn<Row>[] = [
      { key: 'name', header: 'Name', value: (row) => row.name },
      { key: 'actions', header: 'Actions', hideHeader: true, value: () => 'Open' },
    ];
    const element = (await render({ columns })).nativeElement as HTMLElement;
    const cells = element.querySelectorAll('tbody tr:first-child td');
    expect(cells[0]?.getAttribute('data-label')).toBe('Name');
    expect(cells[1]?.hasAttribute('data-label')).toBe(false);
  });

  it('keeps its table roles explicit, so a stacked row is still read as a table row', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('table')?.getAttribute('role')).toBe('table');
    expect(element.querySelector('thead')?.getAttribute('role')).toBe('rowgroup');
    expect(element.querySelector('tbody')?.getAttribute('role')).toBe('rowgroup');
    expect(
      [...element.querySelectorAll('th')].every((th) => th.getAttribute('role') === 'columnheader'),
    ).toBe(true);
    expect(
      [...element.querySelectorAll('tbody tr')].every((tr) => tr.getAttribute('role') === 'row'),
    ).toBe(true);
    expect(
      [...element.querySelectorAll('td')].every((td) => td.getAttribute('role') === 'cell'),
    ).toBe(true);
    // A sortable header keeps its sort state for the sort buttons a phone shows above the rows.
    expect(element.querySelector('th')?.getAttribute('aria-sort')).toBe('none');
  });

  it('is no focusable region while the table fits its card', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const wrap = element.querySelector('.table-wrap') as HTMLElement;
    expect(wrap.hasAttribute('tabindex')).toBe(false);
    expect(wrap.hasAttribute('role')).toBe(false);
  });
});
