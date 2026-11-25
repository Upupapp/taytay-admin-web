import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { PageHeader } from './page-header';

@Component({
  imports: [PageHeader],
  template: `
    <app-page-header title="Citizen registry" subtitle="Every citizen on file.">
      <a page-actions href="/new" class="btn btn--primary">Register a resident</a>
    </app-page-header>
    <app-page-header showTitle title="RL-2026-000001" subtitle="Cash" />
    <app-page-header title="Home screen" lead="Residents see this in the Taytay app." />
    <app-page-header title="Solo parents">
      <nav page-start aria-label="Sector pages"><a href="/pwd">PWD</a></nav>
      <button page-actions type="button" class="btn btn--primary">Add a solo parent</button>
    </app-page-header>
  `,
})
class Host {}

describe('PageHeader (DL-246)', () => {
  const headers = () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-page-header'));
  };

  it('keeps a page name as the one h1, read but not drawn, without its description', () => {
    const [page] = headers();
    const headings = page?.querySelectorAll('h1');
    expect(headings?.length).toBe(1);
    expect(headings?.[0]?.textContent?.trim()).toBe('Citizen registry');
    expect(headings?.[0]?.classList).toContain('visually-hidden');
    expect(page?.textContent).not.toContain('Every citizen on file.');
    expect(page?.querySelector('.page-header__actions a')?.textContent).toContain(
      'Register a resident',
    );
  });

  it('draws a heading that is data, with its subtitle', () => {
    const record = headers()[1];
    const heading = record?.querySelector('h1');
    expect(heading?.textContent?.trim()).toBe('RL-2026-000001');
    expect(heading?.classList).not.toContain('visually-hidden');
    expect(record?.querySelector('.page-header__subtitle')?.textContent).toBe('Cash');
  });

  it('draws a lead the page owes its reader while the title stays hidden', () => {
    const owed = headers()[2];
    expect(owed?.querySelector('h1')?.classList).toContain('visually-hidden');
    expect(owed?.querySelector('.page-header__lead')?.textContent).toBe(
      'Residents see this in the Taytay app.',
    );
  });

  it('sets the tabs at the start of the action row, the action after them (DL-253)', () => {
    const tabbed = headers()[3];
    const row = tabbed?.querySelector('.page-header');
    const start = row?.querySelector(':scope > .page-header__start');
    const actions = row?.querySelector(':scope > .page-header__actions');
    expect(start?.querySelector('nav')?.textContent).toContain('PWD');
    expect(actions?.textContent).toContain('Add a solo parent');
    const follows =
      start && actions
        ? start.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0;
    expect(follows).toBeGreaterThan(0);
  });

  it('leaves the start of the row empty when a page has no tabs', () => {
    const [page] = headers();
    expect(page?.querySelector('.page-header__start')?.childElementCount).toBe(0);
  });
});
