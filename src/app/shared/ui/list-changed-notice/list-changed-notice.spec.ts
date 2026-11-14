import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { LIST_CHANGED_COPY, ListChangedNotice } from './list-changed-notice';

@Component({
  imports: [ListChangedNotice],
  template: `<app-list-changed-notice (reload)="reloads.set(reloads() + 1)" />`,
})
class Host {
  readonly reloads = signal(0);
}

describe('ListChangedNotice (DL-222)', () => {
  it('says the list changed and leaves the reload to the person', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain(LIST_CHANGED_COPY.message);
    const button = element.querySelector('button');
    expect(button?.textContent?.trim()).toBe(LIST_CHANGED_COPY.reload);

    button?.click();
    expect(fixture.componentInstance.reloads()).toBe(1);
  });

  it('is not announced: a list that changes by itself interrupts nobody', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });
});
