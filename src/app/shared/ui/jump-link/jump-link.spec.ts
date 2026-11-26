import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { FigureTiles, type FigureTile } from '../figure-tiles/figure-tiles';
import { JumpLink } from './jump-link';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JumpLink],
  template: `
    <a class="tally" appJumpTo="payouts-heading">Released</a>
    <h2 id="payouts-heading">Payouts</h2>
  `,
})
class Host {}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FigureTiles],
  template: `<app-figure-tiles [tiles]="tiles" label="Figures" />
    <h2 id="list-heading">List</h2>`,
})
class TilesHost {
  readonly tiles: readonly FigureTile[] = [
    {
      key: 'open',
      label: 'Open',
      value: '4',
      hint: 'Either side may write.',
      dot: 'bar',
      link: { kind: 'route', route: '/inbox', queryParams: { status: 'open' }, says: 'Show these' },
    },
    {
      key: 'unread',
      label: 'Unread',
      value: '2',
      hint: 'Nobody here has read them.',
      dot: 'red',
      link: { kind: 'jump', target: 'list-heading', says: 'Go to the list' },
    },
    { key: 'closed', label: 'Closed', value: '9', hint: 'Ended.', dot: 'muted' },
  ];
}

function render<T>(type: new () => T): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(type);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('JumpLink (DL-273)', () => {
  it('moves focus to the heading it names, which leaves the tab order untouched', () => {
    const root = render(Host);
    const link = root.querySelector<HTMLAnchorElement>('a');
    expect(link?.getAttribute('href')).toMatch(/#payouts-heading$/);

    link?.click();

    const heading = root.querySelector('h2');
    expect(document.activeElement).toBe(heading);
    expect(heading?.getAttribute('tabindex')).toBe('-1');
  });

  it('leaves a modified click to the browser', () => {
    const root = render(Host);
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    root.querySelector('a')?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(root.querySelector('h2')?.hasAttribute('tabindex')).toBe(false);
  });
});

describe('FigureTiles — a figure with a link is the link, the whole cell (DL-273)', () => {
  it('draws a route, a jump and a plain figure, each cell once', () => {
    const root = render(TilesHost);
    const cells = [...root.querySelectorAll<HTMLElement>('.kpi-strip__cell')];
    expect(cells.map((cell) => cell.tagName)).toEqual(['A', 'A', 'DIV']);
    expect(cells[0]?.getAttribute('href')).toBe('/inbox?status=open');
    // The name holds the label and the figure the cell shows (WCAG 2.5.3), then where it leads.
    expect(cells[0]?.textContent?.replace(/\s+/g, ' ')).toMatch(/Open\s*4.*Show these/);
    expect(cells[1]?.getAttribute('href')).toMatch(/#list-heading$/);
    expect(cells[0]?.querySelector('a, button')).toBeNull();
  });
});
