import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LineChart, type LinePoint } from './line-chart';

async function render(points: readonly LinePoint[]): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(LineChart);
  fixture.componentRef.setInput('points', points);
  fixture.componentRef.setInput('caption', 'Requests per week');
  fixture.componentRef.setInput('labelHeader', 'Week');
  fixture.componentRef.setInput('valueHeader', 'Requests');
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const point = (key: string, value: number | null): LinePoint => ({
  key,
  label: key,
  longLabel: `Week of ${key}`,
  value,
});

describe('LineChart (DL-232)', () => {
  it('hides the drawing and states every point in a table', async () => {
    const element = await render([point('a', 3), point('b', 5), point('c', 0)]);

    expect(element.querySelector('.line-chart__plot')?.getAttribute('aria-hidden')).toBe('true');
    const cells = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()).join(' | '),
    );
    expect(cells).toEqual(['Week of a | 3', 'Week of b | 5', 'Week of c | 0']);
    expect(element.querySelector('caption')?.textContent?.trim()).toBe('Requests per week');
  });

  it('breaks the line at a withheld point and says so — never a zero (DL-105)', async () => {
    const element = await render([point('a', 6), point('b', null), point('c', 7), point('d', 8)]);

    expect(element.querySelectorAll('.line-chart__line')).toHaveLength(2);
    expect(element.querySelector('tbody tr:nth-child(2) td')?.textContent?.trim()).toBe('Withheld');
    // One open dot for each shown point but the last, which is marked on its own.
    expect(element.querySelectorAll('.line-chart__dot')).toHaveLength(2);
  });

  it('scales to an even number above the largest figure', async () => {
    const element = await render([point('a', 3), point('b', 7)]);

    expect(element.querySelector('.line-chart__tick--top')?.textContent?.trim()).toBe('8');
    expect(element.querySelector('.line-chart__tick--middle')?.textContent?.trim()).toBe('4');
  });
});
