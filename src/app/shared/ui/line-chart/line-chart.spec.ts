import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { curve, LineChart, type Drawn, type LinePoint } from './line-chart';

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

describe('the line never overshoots its points', () => {
  /** Each segment's control points, which bound the curve: within them, within the segment. */
  function segments(path: string): number[][] {
    return [...path.matchAll(/C([\d.\- ]+)/g)].map((match) =>
      (match[1] ?? '').trim().split(/\s+/).map(Number),
    );
  }

  const drawn = (ys: readonly number[]): Drawn[] =>
    ys.map((y, index) => ({ key: String(index), x: (index / (ys.length - 1)) * 100, y }));

  it('stays between each pair of points, so a count never dips below zero', () => {
    // SVG y: 100 is a count of zero. A fall to none and a rise from it are where Catmull–Rom dipped.
    const ys = [10, 100, 100, 20, 100, 60, 0, 100];
    const run = drawn(ys);
    const parts = segments(curve(run));
    expect(parts).toHaveLength(ys.length - 1);
    parts.forEach(([, c1y, , c2y], index) => {
      const low = Math.min(ys[index] ?? 0, ys[index + 1] ?? 0);
      const high = Math.max(ys[index] ?? 0, ys[index + 1] ?? 0);
      for (const y of [c1y ?? Number.NaN, c2y ?? Number.NaN]) {
        expect(y).toBeGreaterThanOrEqual(low - 0.01);
        expect(y).toBeLessThanOrEqual(high + 0.01);
      }
    });
  });

  it('draws two points as a straight line, and one as a single move', () => {
    expect(curve(drawn([100, 0]))).toBe('M0.00 100.00 C33.33 66.67 66.67 33.33 100.00 0.00');
    expect(curve([{ key: 'a', x: 0, y: 40 }])).toBe('M0.00 40.00');
  });
});

describe('LineChart with a second series (DL-248)', () => {
  it('draws it dashed, names it in a legend and gives it its own column', async () => {
    const fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput('points', [point('a', 2), point('b', 4)]);
    fixture.componentRef.setInput('compare', [point('a', 9), point('b', null)]);
    fixture.componentRef.setInput('compareHeader', 'Handed over');
    fixture.componentRef.setInput('caption', 'Requests and releases');
    fixture.componentRef.setInput('labelHeader', 'Week');
    fixture.componentRef.setInput('valueHeader', 'Requests');
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const rows = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()).join(' | '),
    );
    expect(rows).toEqual(['Week of a | 2 | 9', 'Week of b | 4 | Withheld']);
    expect(element.querySelector('.line-chart__legend')?.textContent).toContain('Handed over');
    expect(element.querySelectorAll('.line-chart__line--compare')).toHaveLength(1);
    // One scale for both lines: the larger series sets it.
    expect(element.querySelector('.line-chart__tick--top')?.textContent?.trim()).toBe('10');
  });
});

describe('LineChart, the latest figure and the axis on a narrow chart', () => {
  async function withCallout(values: readonly (number | null)[]): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput(
      'points',
      values.map((value, index) => point(String.fromCharCode(97 + index), value)),
    );
    fixture.componentRef.setInput('caption', 'Citizens on the registry');
    fixture.componentRef.setInput('labelHeader', 'Month');
    fixture.componentRef.setInput('valueHeader', 'Citizens');
    fixture.componentRef.setInput('callout', '241 now');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const place = (element: HTMLElement): string => {
    const callout = element.querySelector('.line-chart__callout');
    if (callout?.classList.contains('line-chart__callout--left')) return 'left';
    if (callout?.classList.contains('line-chart__callout--below')) return 'below';
    return callout === null ? 'none' : 'above';
  };

  it('keeps the callout inside the plot when the latest point is near the top', async () => {
    // Room above a low point; beside a point the line rose into; under one on a flat top.
    expect(place(await withCallout([200, 120, 60]))).toBe('above');
    expect(place(await withCallout([40, 120, 241]))).toBe('left');
    expect(place(await withCallout([238, 240, 241]))).toBe('below');
    expect(place(await withCallout([40, null, 241]))).toBe('left');
  });

  it('marks which labels a narrow chart keeps, counted back from the latest', async () => {
    const element = await withCallout([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const labels = [...element.querySelectorAll('.line-chart__label')];
    const kept = (hidden: string) =>
      labels.filter((label) => !label.classList.contains(hidden)).map((l) => l.textContent?.trim());

    expect(labels).toHaveLength(12);
    expect(kept('line-chart__label--narrow-hidden')).toEqual(['b', 'd', 'f', 'h', 'j', 'l']);
    expect(kept('line-chart__label--narrowest-hidden')).toEqual(['d', 'h', 'l']);
    // The table still states every month (DL-108).
    expect(element.querySelectorAll('tbody tr')).toHaveLength(12);
  });
});
