import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ColumnChart, type ColumnPoint } from './column-chart';

async function render(columns: readonly ColumnPoint[]): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(ColumnChart);
  fixture.componentRef.setInput('columns', columns);
  fixture.componentRef.setInput('caption', 'Per day');
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const column = (key: string, value: number | null): ColumnPoint => ({
  key,
  label: key.slice(0, 3),
  longLabel: key,
  value,
});

describe('ColumnChart (DL-232)', () => {
  it('is a real table: each column named in the head, its figure in the body', async () => {
    const element = await render([column('Monday', 2), column('Tuesday', 0)]);

    const heads = [...element.querySelectorAll('thead th')].map((th) =>
      th.querySelector('.visually-hidden')?.textContent?.trim(),
    );
    expect(heads).toEqual(['Monday', 'Tuesday']);
    const figures = [...element.querySelectorAll('tbody td')].map((td) => td.textContent?.trim());
    expect(figures).toEqual(['2', '0']);
  });

  it('marks the tallest column and draws no bar for a withheld figure (DL-105)', async () => {
    const element = await render([column('Monday', 4), column('Tuesday', null)]);

    expect(element.querySelectorAll('.column-chart__bar')).toHaveLength(1);
    expect(element.querySelector('.column-chart__bar--top')).not.toBeNull();
    expect(element.querySelector('tbody td:nth-child(2)')?.textContent?.trim()).toBe('Withheld');
  });
});
