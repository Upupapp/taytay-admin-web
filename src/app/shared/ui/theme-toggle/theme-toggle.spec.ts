import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { THEME_ATTRIBUTE } from '../../state/theme.service';
import { THEME_TOGGLE_COPY, ThemeToggle } from './theme-toggle';

describe('ThemeToggle (DL-207)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    root = TestBed.inject(DOCUMENT).documentElement;
    root.removeAttribute(THEME_ATTRIBUTE);
  });

  afterEach(() => root.removeAttribute(THEME_ATTRIBUTE));

  async function render() {
    const fixture = TestBed.createComponent(ThemeToggle);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('button');
    return { fixture, element, button };
  }

  it('is one real button, not pressed, while the console opens light', async () => {
    const { element, button } = await render();

    expect(element.querySelectorAll('button')).toHaveLength(1);
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(button?.textContent?.trim()).toBe(THEME_TOGGLE_COPY.label);
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('turns dark mode on and off, keeping its name while its state changes', async () => {
    const { fixture, button } = await render();

    button?.click();
    await fixture.whenStable();
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(button?.textContent?.trim()).toBe(THEME_TOGGLE_COPY.label);

    button?.click();
    await fixture.whenStable();
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('keeps its icon out of the accessible name', async () => {
    const { button } = await render();
    const icon = button?.querySelector('app-icon');

    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelector('svg')).not.toBeNull();
  });
});
