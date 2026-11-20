import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { BarChart, type BarChartRow, type BarChartSeries } from './bar-chart';

async function render(
  series: readonly BarChartSeries[],
  rows: readonly BarChartRow[],
): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(BarChart);
  fixture.componentRef.setInput('series', series);
  fixture.componentRef.setInput('rows', rows);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const ONE: readonly BarChartSeries[] = [{ key: 'persons', label: 'Persons' }];

describe('BarChart (DL-228)', () => {
  it('is a picture of a table: hidden from assistive technology', async () => {
    const element = await render(ONE, [{ key: 'a', label: 'Adults', values: [6] }]);

    expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('prints the figure at the end of every bar', async () => {
    const element = await render(ONE, [
      { key: 'a', label: 'Adults', values: [1200] },
      { key: 's', label: 'Seniors', values: [5] },
    ]);
    const figures = [...element.querySelectorAll('.bar-chart__figure')].map((node) =>
      node.textContent?.trim(),
    );

    expect(figures).toEqual(['1,200', '5']);
    expect(element.querySelectorAll('rect.bar-chart__bar')).toHaveLength(2);
  });

  it('draws no bar for a withheld figure and says "withheld" — never a zero (DL-105)', async () => {
    const element = await render(ONE, [
      { key: 'f', label: 'Female', values: [7] },
      { key: 'm', label: 'Male', values: [null] },
    ]);
    const figures = [...element.querySelectorAll('.bar-chart__figure')];

    expect(element.querySelectorAll('rect.bar-chart__bar')).toHaveLength(1);
    expect(figures[1]?.textContent?.trim()).toBe('withheld');
    expect(figures[1]?.classList.contains('bar-chart__figure--withheld')).toBe(true);
    expect(figures.some((node) => node.textContent?.trim() === '0')).toBe(false);
  });

  it('draws no bar for a zero but still prints 0', async () => {
    const element = await render(ONE, [
      { key: 'c', label: 'Children', values: [0] },
      { key: 'a', label: 'Adults', values: [6] },
    ]);

    expect(element.querySelectorAll('rect.bar-chart__bar')).toHaveLength(1);
    expect(element.querySelector('.bar-chart__figure')?.textContent?.trim()).toBe('0');
  });

  it('names two series in a legend, so a series is never told by colour alone', async () => {
    const element = await render(
      [
        { key: 'received', label: 'Received' },
        { key: 'served', label: 'Served' },
      ],
      [{ key: 'nov', label: 'November 2026', values: [6, 4] }],
    );
    const legend = [...element.querySelectorAll('.bar-chart__legend')].map((node) =>
      node.textContent?.trim(),
    );

    expect(legend).toEqual(['Received', 'Served']);
    // Two legend swatches and two bars.
    expect(element.querySelectorAll('rect.bar-chart__bar--1')).toHaveLength(2);
  });
});
