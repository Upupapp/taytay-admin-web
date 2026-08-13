import { TestBed } from '@angular/core/testing';

import { ASSISTANCE_STATUS_CATALOG, type AssistanceRequestStatus } from '@domain/index';

import { StatusBadge } from './status-badge';

async function render(status: AssistanceRequestStatus, labelOverride: string | null = null) {
  const fixture = TestBed.createComponent<StatusBadge<AssistanceRequestStatus>>(StatusBadge);
  fixture.componentRef.setInput('catalog', ASSISTANCE_STATUS_CATALOG);
  fixture.componentRef.setInput('status', status);
  fixture.componentRef.setInput('labelOverride', labelOverride);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('StatusBadge', () => {
  it('renders the catalog label', async () => {
    const element = await render('intake-review');
    expect(element.textContent).toContain('Intake review');
  });

  it('applies the tone from the catalog rather than a hard-coded colour', async () => {
    expect((await render('approved')).querySelector('.badge--success')).not.toBeNull();
    expect((await render('rejected')).querySelector('.badge--danger')).not.toBeNull();
    expect((await render('returned')).querySelector('.badge--warning')).not.toBeNull();
    expect((await render('draft')).querySelector('.badge--neutral')).not.toBeNull();
  });

  it('exposes the description as a tooltip', async () => {
    const badge = (await render('endorsed')).querySelector('.badge');
    expect(badge?.getAttribute('title')).toBe(ASSISTANCE_STATUS_CATALOG.endorsed.description);
  });

  it('honours a label override', async () => {
    const element = await render('scheduled', 'Scheduled (3)');
    expect(element.textContent).toContain('Scheduled (3)');
  });
});
