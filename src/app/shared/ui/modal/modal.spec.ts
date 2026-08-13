import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Drawer } from '../drawer/drawer';
import { Modal } from './modal';

@Component({
  imports: [Modal, Drawer],
  template: `
    <app-modal [(open)]="modalOpen" heading="Approve request" [dismissible]="dismissible()">
      <p modal-body id="modal-content">Confirm the grant amount.</p>
      <button modal-actions id="modal-confirm" type="button">Approve</button>
    </app-modal>

    <app-drawer [(open)]="drawerOpen" heading="Filter requests">
      <p drawer-body id="drawer-content">Filters go here.</p>
    </app-drawer>
  `,
})
class HostComponent {
  readonly modalOpen = signal(false);
  readonly drawerOpen = signal(false);
  readonly dismissible = signal(true);
}

async function host(): Promise<ComponentFixture<HostComponent>> {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(HostComponent);
  await fixture.whenStable();
  return fixture;
}

describe('Modal', () => {
  it('renders nothing while closed', async () => {
    const fixture = await host();
    expect((fixture.nativeElement as HTMLElement).querySelector('.modal')).toBeNull();
  });

  it('projects heading, body and actions when opened', async () => {
    const fixture = await host();
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.modal__heading')?.textContent).toContain('Approve request');
    expect(element.querySelector('#modal-content')).not.toBeNull();
    expect(element.querySelector('#modal-confirm')).not.toBeNull();
  });

  it('exposes dialog semantics', async () => {
    const fixture = await host();
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();

    const panel = (fixture.nativeElement as HTMLElement).querySelector('.modal__panel');
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(panel?.getAttribute('aria-label')).toBe('Approve request');
  });

  it('closes on backdrop click and writes back through the two-way binding', async () => {
    const fixture = await host();
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();

    const backdrop = (fixture.nativeElement as HTMLElement).querySelector('.modal__backdrop');
    (backdrop as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.modalOpen()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('.modal')).toBeNull();
  });

  it('closes on Escape', async () => {
    const fixture = await host();
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.modalOpen()).toBe(false);
  });

  it('stays open when it is not dismissible', async () => {
    const fixture = await host();
    fixture.componentInstance.dismissible.set(false);
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(fixture.componentInstance.modalOpen()).toBe(true);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.modal__close')).toBeNull();
  });

  it('locks page scrolling while open and restores it on close', async () => {
    const fixture = await host();
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.modalOpen.set(false);
    await fixture.whenStable();
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps scrolling locked while a second overlay is still open', async () => {
    const fixture = await host();
    fixture.componentInstance.drawerOpen.set(true);
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.modalOpen.set(false);
    await fixture.whenStable();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.drawerOpen.set(false);
    await fixture.whenStable();
    expect(document.body.style.overflow).toBe('');
  });
});

describe('Drawer', () => {
  it('projects its body when opened', async () => {
    const fixture = await host();
    fixture.componentInstance.drawerOpen.set(true);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.drawer__heading')?.textContent).toContain('Filter requests');
    expect(element.querySelector('#drawer-content')).not.toBeNull();
  });

  it('closes on backdrop click', async () => {
    const fixture = await host();
    fixture.componentInstance.drawerOpen.set(true);
    await fixture.whenStable();

    const backdrop = (fixture.nativeElement as HTMLElement).querySelector('.drawer__backdrop');
    (backdrop as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.componentInstance.drawerOpen()).toBe(false);
  });
});
