import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { THEME_ATTRIBUTE, ThemeService } from '@core/layout/theme.service';

import { LAYOUT_COPY } from '../layout.copy';
import { ThemeSwitch } from './theme-switch';

describe('ThemeSwitch (DL-204)', () => {
  async function render() {
    TestBed.resetTestingModule();
    TestBed.inject(DOCUMENT).documentElement.removeAttribute(THEME_ATTRIBUTE);
    const fixture = TestBed.createComponent(ThemeSwitch);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const radios = [...element.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    return { fixture, element, radios };
  }

  afterEach(() => TestBed.inject(DOCUMENT).documentElement.removeAttribute(THEME_ATTRIBUTE));

  it('is a labelled group of three radio buttons, one name, in a fieldset', async () => {
    const { element, radios } = await render();

    expect(element.querySelector('fieldset > legend')?.textContent?.trim()).toBe(
      LAYOUT_COPY.themeLegend,
    );
    expect(radios.map((radio) => radio.closest('label')?.textContent?.trim())).toEqual([
      LAYOUT_COPY.themeSystem,
      LAYOUT_COPY.themeLight,
      LAYOUT_COPY.themeDark,
    ]);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
  });

  it('starts on System, which follows the computer', async () => {
    const { radios } = await render();

    expect(radios.map((radio) => radio.checked)).toEqual([true, false, false]);
  });

  it('applies a choice to the page and shows it as chosen', async () => {
    const { fixture, radios } = await render();
    const dark = radios[2];

    dark?.click();
    await fixture.whenStable();

    expect(TestBed.inject(DOCUMENT).documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(TestBed.inject(ThemeService).preference()).toBe('dark');
    expect(radios.map((radio) => radio.checked)).toEqual([false, false, true]);
  });

  it('says, beside the control, that the choice is not saved', async () => {
    const { element } = await render();
    const fieldset = element.querySelector('fieldset');
    const hint = element.querySelector(`#${fieldset?.getAttribute('aria-describedby') ?? 'none'}`);

    expect(hint?.textContent?.trim()).toBe(LAYOUT_COPY.themeHint);
  });

  it('is the design system’s tabs: one tab per radio, the chosen one active', async () => {
    const { fixture, element, radios } = await render();
    const tabs = [...element.querySelectorAll('.tabs.tabs--fill > label.tab')];

    expect(tabs.length).toBe(3);
    for (const [index, radio] of radios.entries()) {
      expect(radio.parentElement).toBe(tabs[index]);
      expect(radio.classList.contains('visually-hidden')).toBe(true);
    }
    expect(tabs.map((tab) => tab.classList.contains('tab--active'))).toEqual([true, false, false]);

    radios[1]?.click();
    await fixture.whenStable();

    expect(tabs.map((tab) => tab.classList.contains('tab--active'))).toEqual([false, true, false]);
  });
});
