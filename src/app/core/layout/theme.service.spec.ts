import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { THEME_ATTRIBUTE, ThemeService } from './theme.service';

describe('ThemeService (DL-204)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    root = TestBed.inject(DOCUMENT).documentElement;
    root.removeAttribute(THEME_ATTRIBUTE);
  });

  afterEach(() => root.removeAttribute(THEME_ATTRIBUTE));

  it('follows the system by default, leaving the page with no theme attribute', () => {
    const theme = TestBed.inject(ThemeService);

    expect(theme.preference()).toBe('system');
    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
  });

  it('sets the attribute the stylesheet reads for an explicit choice', () => {
    const theme = TestBed.inject(ThemeService);

    theme.choose('dark');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(theme.preference()).toBe('dark');

    theme.choose('light');
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
  });

  it('removes the attribute again for System, so the media query decides', () => {
    const theme = TestBed.inject(ThemeService);

    theme.choose('dark');
    theme.choose('system');

    expect(root.hasAttribute(THEME_ATTRIBUTE)).toBe(false);
    expect(theme.preference()).toBe('system');
  });

  it('reports a theme the page already carries rather than claiming System', () => {
    root.setAttribute(THEME_ATTRIBUTE, 'dark');

    expect(TestBed.inject(ThemeService).preference()).toBe('dark');
  });

  it('ignores an attribute value the stylesheet does not know', () => {
    root.setAttribute(THEME_ATTRIBUTE, 'sepia');

    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });

  it('writes nothing to web storage: the choice lasts for the tab only', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');

    TestBed.inject(ThemeService).choose('dark');

    expect(local).not.toHaveBeenCalled();
    local.mockRestore();
  });
});
