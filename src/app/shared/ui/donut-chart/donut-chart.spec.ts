import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DonutChart, shareOf, type DonutRow } from './donut-chart';

const ROWS: readonly DonutRow[] = [
  { key: 'muzon', label: 'Muzon', value: 110 },
  {
    key: 'san-juan',
    label: 'San Juan',
    value: 392,
    routerLink: '/residents',
    queryParams: { barangay: 'san-juan' },
  },
  { key: 'dolores', label: 'Dolores', value: 0, isWithheld: true, display: 'Withheld: too few' },
  { key: 'santa-ana', label: 'Santa Ana', value: 265 },
];

async function render(): Promise<ComponentFixture<DonutChart>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(DonutChart);
  fixture.componentRef.setInput('caption', 'Residents by barangay');
  fixture.componentRef.setInput('summary', 'Residents by barangay: 770 people in total.');
  fixture.componentRef.setInput('rows', ROWS);
  fixture.componentRef.setInput('total', 770);
  fixture.componentRef.setInput('totalLabel', 'residents in all');
  await fixture.whenStable();
  return fixture;
}

const centre = (element: HTMLElement): string =>
  [...(element.querySelector('.donut__centre')?.children ?? [])]
    .map((part) => part.textContent?.trim())
    .join(' ');

describe('DonutChart: the legend is the table, the ring repeats it (DL-108, DL-250)', () => {
  it('lists every row largest first with its count and share, a withheld one after them', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const rows = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()).join(' | '),
    );

    expect(element.querySelector('table caption')?.textContent).toContain('Residents by barangay');
    expect(element.querySelector('caption .donut__summary')?.textContent).toBe(
      '770 people in total.',
    );
    expect(element.querySelectorAll('thead th')).toHaveLength(3);
    expect(rows).toEqual([
      'San Juan | 392 | 51%',
      'Santa Ana | 265 | 34%',
      'Muzon | 110 | 14%',
      'Dolores | Withheld | ',
    ]);
  });

  it('draws a segment for each figure and none for a withheld row, hidden from assistive technology', async () => {
    const element = (await render()).nativeElement as HTMLElement;

    expect(element.querySelector('.donut__figure')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelectorAll('.donut__segment')).toHaveLength(3);
    expect(element.querySelector('.donut__swatch--none')).not.toBeNull();
  });

  it('says the total in the centre, and the row focused or pointed at instead', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    expect(centre(element)).toBe('770 residents in all');

    element
      .querySelector<HTMLAnchorElement>('a.donut__link')
      ?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await fixture.whenStable();
    expect(centre(element)).toBe('392 San Juan · 51%');

    element
      .querySelector('a.donut__link')
      ?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    element.querySelectorAll('.donut__segment')[2]?.dispatchEvent(new MouseEvent('mouseenter'));
    await fixture.whenStable();
    expect(centre(element)).toBe('110 Muzon · 14%');
  });

  it('gives a row without a link a focus stop of its own, and a withheld row none', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const focusable = [...element.querySelectorAll('tbody a, tbody [tabindex="0"]')].map((node) =>
      node.textContent?.trim(),
    );

    expect(focusable).toEqual(['San Juan', 'Santa Ana', 'Muzon']);
  });

  it('words a share too small to round as under one per cent', () => {
    expect(shareOf(1, 1236)).toBe('<1%');
    expect(shareOf(392, 1236)).toBe('32%');
    expect(shareOf(0, 1236)).toBe('');
    expect(shareOf(3, 0)).toBe('');
  });
});
