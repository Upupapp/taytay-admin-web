import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ScrollRegion } from './scroll-region';

@Component({
  imports: [ScrollRegion],
  template: `<div class="box" appScrollRegion="Payouts"><table></table></div>`,
})
class Host {}

/** jsdom lays nothing out: the box's widths and the observer are stood in for. */
class FakeResizeObserver {
  static readonly instances: FakeResizeObserver[] = [];
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  fire(): void {
    this.callback();
  }
}

function sizeBox(box: HTMLElement, scrollWidth: number, clientWidth: number): void {
  Object.defineProperty(box, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(box, 'clientWidth', { configurable: true, value: clientWidth });
}

describe('ScrollRegion (DL-227)', () => {
  beforeEach(() => {
    FakeResizeObserver.instances.length = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.box');
    if (box === null) {
      throw new Error('no box');
    }
    return { fixture, box };
  }

  it('adds no tab stop and no landmark while what it holds fits', async () => {
    const { box } = await render();
    expect(box.hasAttribute('tabindex')).toBe(false);
    expect(box.hasAttribute('role')).toBe(false);
    expect(box.hasAttribute('aria-label')).toBe(false);
  });

  it('becomes a focusable, labelled region once it scrolls, and stops being one after', async () => {
    const { fixture, box } = await render();
    const observer = FakeResizeObserver.instances[0];
    expect(observer?.observed).toContain(box);
    expect(observer?.observed).toContain(box.querySelector('table'));

    sizeBox(box, 900, 340);
    observer?.fire();
    await fixture.whenStable();
    expect(box.getAttribute('tabindex')).toBe('0');
    expect(box.getAttribute('role')).toBe('region');
    expect(box.getAttribute('aria-label')).toBe('Payouts');

    sizeBox(box, 340, 340);
    observer?.fire();
    await fixture.whenStable();
    expect(box.hasAttribute('tabindex')).toBe(false);
    expect(box.hasAttribute('role')).toBe(false);
  });

  it('stops observing when the box goes', async () => {
    const { fixture } = await render();
    fixture.destroy();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
  });
});
