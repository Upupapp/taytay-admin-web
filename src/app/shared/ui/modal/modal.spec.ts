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

describe('overlay focus trap (DL-16 -> DL-25)', () => {
  function tab(shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
    return event;
  }

  async function openModal() {
    const fixture = await host();
    fixture.componentInstance.modalOpen.set(true);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const focusable = Array.from(element.querySelectorAll<HTMLElement>('.modal__panel button'));
    return { fixture, element, focusable };
  }

  it('finds more than one focus stop to cycle between', async () => {
    const { focusable } = await openModal();
    // Close button + the projected action. If this ever drops to one the
    // wrap-around assertions below stop proving anything.
    expect(focusable.length).toBeGreaterThanOrEqual(2);
  });

  it('wraps forward from the last stop to the first', async () => {
    const { focusable } = await openModal();
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    last.focus();
    const event = tab();

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('wraps backward from the first stop to the last', async () => {
    const { focusable } = await openModal();
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    first.focus();
    const event = tab(true);

    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back when it has escaped to the page behind', async () => {
    const { element, focusable } = await openModal();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const event = tab();

    expect(event.defaultPrevented).toBe(true);
    expect(element.querySelector('.modal__panel')?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusable[0]);
    outside.remove();
  });

  it('does not interfere with Tab once the dialog is closed', async () => {
    const { fixture } = await openModal();
    fixture.componentInstance.modalOpen.set(false);
    await fixture.whenStable();

    const event = tab();
    expect(event.defaultPrevented).toBe(false);
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
