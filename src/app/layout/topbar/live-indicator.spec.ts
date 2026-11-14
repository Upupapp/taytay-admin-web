import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { LiveUpdates, type LiveStatus } from '@core/live/live-updates';

import { LAYOUT_COPY } from '../layout.copy';
import { LiveIndicator } from './live-indicator';

function fakeLive(initial: LiveStatus) {
  const status = signal<LiveStatus>(initial);
  return {
    status,
    lastUpdatedAt: signal<Date | null>(null),
    refreshFailed: signal(false),
    pause: vi.fn(() => status.set('paused')),
    resume: vi.fn(() => status.set('live')),
    refreshNow: vi.fn(),
    forgetScreen: vi.fn(),
  };
}

async function render(initial: LiveStatus) {
  const live = fakeLive(initial);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      { provide: LiveUpdates, useValue: live },
    ],
  });
  const fixture = TestBed.createComponent(LiveIndicator);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return {
    live,
    fixture,
    element,
    toggle: () => element.querySelector<HTMLButtonElement>('.live__toggle'),
    described: () => element.querySelector('#live-state')?.textContent?.trim() ?? '',
  };
}

describe('LiveIndicator (DL-222, WCAG 2.2.2)', () => {
  it('is absent when live updates are off', async () => {
    const { element } = await render('off');
    expect(element.querySelector('button')).toBeNull();
  });

  it('is a toggle whose name never changes with its state', async () => {
    const { live, fixture, toggle } = await render('live');
    expect(toggle()?.getAttribute('aria-label')).toBe(LAYOUT_COPY.liveName);
    expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
    expect(toggle()?.textContent?.trim()).toBe(LAYOUT_COPY.liveLabel);

    toggle()?.click();
    await fixture.whenStable();
    expect(live.pause).toHaveBeenCalledTimes(1);
    expect(toggle()?.getAttribute('aria-pressed')).toBe('false');
    expect(toggle()?.getAttribute('aria-label')).toBe(LAYOUT_COPY.liveName);

    toggle()?.click();
    await fixture.whenStable();
    expect(live.resume).toHaveBeenCalledTimes(1);
    expect(toggle()?.getAttribute('aria-pressed')).toBe('true');
  });

  it('says where live updates stand in words, as the button’s description', async () => {
    const { live, fixture, toggle, described } = await render('idle');
    expect(toggle()?.getAttribute('aria-describedby')).toBe('live-state');
    expect(described()).toBe(LAYOUT_COPY.liveState.idle);

    live.status.set('polling');
    live.lastUpdatedAt.set(new Date(2026, 10, 15, 10, 32));
    await fixture.whenStable();
    // The locale's own short time; its space before AM may be a narrow one.
    expect(described()).toMatch(
      new RegExp(`^${LAYOUT_COPY.liveState.polling} · Updated 10:32\\sAM$`),
    );

    live.status.set('live');
    await fixture.whenStable();
    expect(described()).toMatch(/^Updated 10:32\sAM$/);
  });

  it('offers a refresh when a quiet re-read failed', async () => {
    const { live, fixture, element, described } = await render('live');
    live.refreshFailed.set(true);
    await fixture.whenStable();
    expect(described()).toContain(LAYOUT_COPY.liveRefreshFailed);

    const refresh = [...element.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === LAYOUT_COPY.liveRefreshNow,
    );
    refresh?.click();
    expect(live.refreshNow).toHaveBeenCalledTimes(1);
  });

  /** Updates that arrive by themselves must not interrupt anybody. */
  it('announces nothing', async () => {
    const { element } = await render('reconnecting');
    expect(element.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it('forgets the last screen’s read when the page changes', async () => {
    const { live } = await render('live');
    await TestBed.inject(Router).navigateByUrl('/elsewhere');
    expect(live.forgetScreen).toHaveBeenCalled();
  });
});
