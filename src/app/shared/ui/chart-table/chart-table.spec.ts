import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ChartTable, summaryAfterCaption, type ChartRow } from './chart-table';

const ROWS: readonly ChartRow[] = [
  {
    key: 'a',
    label: 'Dolores',
    value: 12,
    routerLink: '/assistance-requests',
    queryParams: { barangay: 'brgy-dolores' },
  },
  { key: 'b', label: 'San Juan', value: 6 },
  { key: 'c', label: 'Muzon', value: 1 },
  { key: 'd', label: 'Santa Ana', value: 0 },
];

async function render(inputs: Record<string, unknown> = {}): Promise<ComponentFixture<ChartTable>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ChartTable);
  fixture.componentRef.setInput('caption', 'Requests by barangay');
  fixture.componentRef.setInput('rows', ROWS);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  await fixture.whenStable();
  return fixture;
}

describe('ChartTable is a real table, not a picture of one', () => {
  it('renders semantic table structure with a caption', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelector('table')).not.toBeNull();
    expect(element.querySelector('caption')?.textContent).toContain('Requests by barangay');
    expect(element.querySelectorAll('thead th')).toHaveLength(2);
    expect(element.querySelectorAll('tbody tr')).toHaveLength(ROWS.length);
  });

  it('scopes its headers so a screen reader can associate cells', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    for (const header of element.querySelectorAll('thead th')) {
      expect(header.getAttribute('scope')).toBe('col');
    }
    for (const rowHeader of element.querySelectorAll('tbody th')) {
      expect(rowHeader.getAttribute('scope')).toBe('row');
    }
  });

  it('states every value as text, so nothing rests on the bar alone', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const values = Array.from(element.querySelectorAll('.chart__value')).map((c) =>
      c.textContent?.trim(),
    );
    expect(values).toEqual(['12', '6', '1', '0']);
  });

  it('hides the bars from assistive technology', async () => {
    // The bar repeats the number; announcing it would be duplicate noise.
    const element = (await render()).nativeElement as HTMLElement;
    const bars = element.querySelectorAll('.chart__bar');
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('scales bars against the largest row', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const bars = Array.from(element.querySelectorAll<HTMLElement>('.chart__bar'));
    expect(bars[0]?.style.inlineSize).toBe('100%');
    expect(bars[1]?.style.inlineSize).toBe('50%');
  });

  it('never renders a non-zero row as an invisible bar', async () => {
    // 1 of 12 rounds to 8%, but even a 1-of-1000 row keeps a visible sliver:
    // "small but present" must not look identical to "none".
    const element = (await render()).nativeElement as HTMLElement;
    const bars = Array.from(element.querySelectorAll<HTMLElement>('.chart__bar'));
    expect(Number.parseInt(bars[2]?.style.inlineSize ?? '0', 10)).toBeGreaterThanOrEqual(2);
    // Zero really is zero.
    expect(bars[3]?.style.inlineSize).toBe('0%');
  });

  it('keeps a visible sliver for a tiny proportion', async () => {
    const fixture = await render({
      rows: [
        { key: 'big', label: 'Big', value: 1000 },
        { key: 'tiny', label: 'Tiny', value: 1 },
      ] as readonly ChartRow[],
    });
    const bars = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.chart__bar'),
    );
    expect(Number.parseInt(bars[1]?.style.inlineSize ?? '0', 10)).toBeGreaterThanOrEqual(2);
  });

  it('makes drill-down rows real links', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    const link = element.querySelector<HTMLAnchorElement>('.chart__link');
    expect(link?.tagName).toBe('A');
    expect(link?.getAttribute('href')).toContain('/assistance-requests');
    expect(link?.getAttribute('href')).toContain('barangay=brgy-dolores');
  });

  it('renders a plain label when a row has no drill-down', async () => {
    const element = (await render()).nativeElement as HTMLElement;
    expect(element.querySelectorAll('.chart__link')).toHaveLength(1);
    expect(element.querySelectorAll('.chart__label')).toHaveLength(3);
  });

  it('prefers a formatted display value when supplied', async () => {
    const fixture = await render({
      rows: [{ key: 'm', label: 'Medical', value: 8000, display: '₱8,000' }] as readonly ChartRow[],
    });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.chart__value')?.textContent,
    ).toContain('₱8,000');
  });

  it('says so when there is nothing to show', async () => {
    const fixture = await render({ rows: [] as readonly ChartRow[] });
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.chart__empty')?.textContent).toContain('Nothing to show');
    expect(element.querySelectorAll('.chart__row')).toHaveLength(0);
  });

  it('carries a plain-language summary alongside the caption', async () => {
    const fixture = await render({ summary: 'Select a row to open those requests.' });
    expect((fixture.nativeElement as HTMLElement).querySelector('caption')?.textContent).toContain(
      'Select a row to open those requests.',
    );
  });
});

describe('ChartTable says its caption once (DL-250)', () => {
  it('draws no track for a withheld row, which would read as a zero (DL-105)', async () => {
    const fixture = await render({
      rows: [
        ...ROWS,
        { key: 'e', label: 'Muzon', value: 0, display: 'Withheld', isWithheld: true },
      ],
    });
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');

    expect(rows[rows.length - 1]?.querySelector('.chart__track')).toBeNull();
    expect(rows[rows.length - 1]?.textContent).toContain('Withheld');
    expect(rows[rows.length - 2]?.querySelector('.chart__track')).not.toBeNull();
  });

  it('drops the caption a summary starts with, and keeps the rest of the sentence', async () => {
    const fixture = await render({
      summary: 'Requests by barangay: 19 in total. The largest shown is Dolores with 12 (63%).',
    });
    const caption = (fixture.nativeElement as HTMLElement).querySelector('caption');

    expect(caption?.querySelector('.chart__caption-title')?.textContent).toBe(
      'Requests by barangay',
    );
    expect(caption?.querySelector('.chart__summary')?.textContent).toBe(
      '19 in total. The largest shown is Dolores with 12 (63%).',
    );
  });

  it('leaves a summary that does not start with its caption as it is', () => {
    expect(summaryAfterCaption('Residents by sector', 'Residents by sector are counted.')).toBe(
      'Residents by sector are counted.',
    );
    expect(summaryAfterCaption('Residents', 'What residents says.')).toBe('What residents says.');
    expect(
      summaryAfterCaption('Residents by sector', 'Residents by sector: every row is zero.'),
    ).toBe('Every row is zero.');
    expect(summaryAfterCaption('Residents by sector', 'Residents by sector, active records.')).toBe(
      'Active records.',
    );
  });
});
