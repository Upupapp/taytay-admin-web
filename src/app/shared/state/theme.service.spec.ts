import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { THEME_ATTRIBUTE, ThemeService } from './theme.service';

describe('ThemeService (DL-204, DL-207)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    root = TestBed.inject(DOCUMENT).documentElement;
    root.removeAttribute(THEME_ATTRIBUTE);
  });

  afterEach(() => root.removeAttribute(THEME_ATTRIBUTE));

  it('opens light, leaving the page with no theme attribute, whatever the computer is set to', () => {
    const theme = TestBed.inject(ThemeService);

    expect(theme.theme()).toBe('light');
    expect(theme.isDark()).toBe(false);
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('sets the attribute the stylesheet reads for dark, and removes it for light', () => {
    const theme = TestBed.inject(ThemeService);

    theme.choose('dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(theme.isDark()).toBe(true);

    theme.choose('light');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(theme.theme()).toBe('light');
  });

  it('switches between the two with toggle()', () => {
    const theme = TestBed.inject(ThemeService);

    theme.toggle();
    expect(theme.theme()).toBe('dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');

    theme.toggle();
    expect(theme.theme()).toBe('light');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('reports a dark theme the page already carries', () => {
    root.setAttribute(THEME_ATTRIBUTE, 'dark');

    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });

  it('treats an attribute value the stylesheet does not know as light', () => {
    root.setAttribute(THEME_ATTRIBUTE, 'sepia');

    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });

  it('writes nothing to web storage: the choice lasts for the tab only', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    TestBed.inject(ThemeService).toggle();

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
