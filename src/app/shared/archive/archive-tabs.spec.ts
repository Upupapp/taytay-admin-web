import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { ArchiveTabs } from './archive-tabs';

async function tabs(
  url: string,
  inputs: Readonly<Record<string, unknown>>,
): Promise<{ fixture: ComponentFixture<ArchiveTabs>; links: HTMLAnchorElement[] }> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(ArchiveTabs);
  fixture.componentRef.setInput('label', 'Offices: in use or archived');
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, links: [...element.querySelectorAll<HTMLAnchorElement>('a')] };
}

describe('ArchiveTabs (DL-225)', () => {
  it('names the pair, and marks the list shown by words and aria-current, not colour alone', async () => {
    const { fixture, links } = await tabs('/?section=offices', { archived: false });

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe(
      'Offices: in use or archived',
    );
    expect(links.map((link) => link.textContent?.trim())).toEqual(['In use', 'Archived']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual(['true', null]);
    expect(links[0]?.classList).toContain('tab--active');
  });

  it('keeps the rest of the address, so a page’s own section survives the choice', async () => {
    const { links } = await tabs('/?section=offices&status=open', { archived: false });

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/?section=offices&status=open',
      '/?section=offices&status=open&archived=true',
    ]);
  });

  it('drops only its own parameter to go back to the records in use', async () => {
    const { links } = await tabs('/?section=offices&archived=true', { archived: true });

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/?section=offices',
      '/?section=offices&archived=true',
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'true']);
  });

  it('holds its choice in the parameter it is given, beside another list’s', async () => {
    const { links } = await tabs('/?archivedLinks=true', {
      archived: false,
      param: 'archivedBanners',
    });

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/?archivedLinks=true',
      '/?archivedLinks=true&archivedBanners=true',
    ]);
  });
});
