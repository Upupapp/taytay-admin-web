import { TestBed } from '@angular/core/testing';

import { Icon } from './icon';
import { ICONS, type IconName } from './icons';

async function render(name: IconName, size?: number) {
  TestBed.configureTestingModule({ imports: [Icon] });
  const fixture = TestBed.createComponent(Icon);
  fixture.componentRef.setInput('name', name);
  if (size !== undefined) {
    fixture.componentRef.setInput('size', size);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Icon', () => {
  it('is hidden from assistive technology, so it never names a control', async () => {
    const host = await render('bell');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')?.getAttribute('focusable')).toBe('false');
  });

  it('draws the named path at the requested size', async () => {
    const host = await render('search', 20);
    const svg = host.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('20');
    expect(host.querySelector('path')?.getAttribute('d')).toBe(ICONS.search.d);
  });

  it('strokes a line icon and fills a solid one, both in the text colour', async () => {
    const line = (await render('bell')).querySelector('svg');
    expect(line?.getAttribute('fill')).toBe('none');
    expect(line?.getAttribute('stroke')).toBe('currentColor');

    TestBed.resetTestingModule();
    const solid = (await render('cloudOff')).querySelector('svg');
    expect(solid?.getAttribute('fill')).toBe('currentColor');
    expect(solid?.hasAttribute('stroke')).toBe(false);
  });
});
