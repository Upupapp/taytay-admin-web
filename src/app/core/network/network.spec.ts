import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ConnectionBanner } from '@shared/ui/connection-banner/connection-banner';

import {
  NetworkStatus,
  OFFLINE_ACTION_REFUSED,
  OFFLINE_NOTICE,
  RECONNECTED_NOTICE,
} from './network-status';

function goOffline(): void {
  window.dispatchEvent(new Event('offline'));
}

function goOnline(): void {
  window.dispatchEvent(new Event('online'));
}

async function render(): Promise<{
  fixture: ComponentFixture<ConnectionBanner>;
  element: HTMLElement;
  status: NetworkStatus;
}> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({});
  const status = TestBed.inject(NetworkStatus);
  const fixture = TestBed.createComponent(ConnectionBanner);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement, status };
}

/* ── Criterion: no misleading "saved" state during network failure ────────── */

describe('what the office is told when the connection drops', () => {
  it('never promises that work will be sent later', async () => {
    // Nothing is queued (`DL-118`). Saying otherwise is how a caseworker closes
    // a tab believing a request was filed.
    for (const notice of [OFFLINE_NOTICE, RECONNECTED_NOTICE, OFFLINE_ACTION_REFUSED]) {
      expect(notice).not.toMatch(/will be sent|will be saved|we.ll retry|queued for/i);
    }
  });

  it('says outright that nothing is being held in the background', async () => {
    expect(OFFLINE_NOTICE).toContain('nothing is being held in the background');
    expect(OFFLINE_ACTION_REFUSED).toContain('Nothing was queued');
  });

  it('tells the officer to check anything they tried to save', async () => {
    expect(RECONNECTED_NOTICE).toContain('was not kept');
    expect(RECONNECTED_NOTICE).toContain('enter it again');
  });
});

describe('the connection banner', () => {
  it('shows nothing while the connection is up', async () => {
    const { element } = await render();
    expect(element.querySelector('.connection')).toBeNull();
  });

  it('warns as soon as the connection drops', async () => {
    const { fixture, element } = await render();

    goOffline();
    fixture.detectChanges();

    const banner = element.querySelector('.connection--offline');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('nothing is being held in the background');
  });

  it('announces politely rather than interrupting', async () => {
    const { fixture, element } = await render();

    goOffline();
    fixture.detectChanges();

    // Losing a connection is a condition of the device, not an error in the
    // page. `alert` would cut across somebody reading a case note.
    expect(element.querySelector('.connection')?.getAttribute('role')).toBe('status');
    expect(element.innerHTML).not.toContain('role="alert"');
  });

  it('says the state in a word, so colour is never the only carrier', async () => {
    const { fixture, element } = await render();

    goOffline();
    fixture.detectChanges();

    expect(element.querySelector('.connection__label')?.textContent?.trim()).toBe('Offline');
  });

  it('keeps warning after the connection returns, until somebody dismisses it', async () => {
    const { fixture, element } = await render();

    goOffline();
    fixture.detectChanges();
    goOnline();
    fixture.detectChanges();

    // The message says work was *not* kept — exactly the message that must
    // survive somebody looking away. It is dismissed by a person, never a timer.
    const restored = element.querySelector('.connection--restored');
    expect(restored).not.toBeNull();
    expect(restored?.textContent).toContain('was not kept');

    element.querySelector<HTMLElement>('.connection__dismiss')?.click();
    fixture.detectChanges();
    expect(element.querySelector('.connection')).toBeNull();
  });

  it('does not show a restored notice when the connection never dropped', async () => {
    const { fixture, element } = await render();

    goOnline();
    fixture.detectChanges();

    expect(element.querySelector('.connection--restored')).toBeNull();
  });
});

describe('the network service', () => {
  it('records that a drop happened, so the warning can outlive it', async () => {
    const { status } = await render();

    expect(status.hasDropped()).toBe(false);
    goOffline();
    expect(status.isOnline()).toBe(false);
    expect(status.hasDropped()).toBe(true);

    goOnline();
    expect(status.isOnline()).toBe(true);
    // Still true: the officer has not been told yet.
    expect(status.hasDropped()).toBe(true);
  });

  it('clears the drop only when acknowledged', async () => {
    const { status } = await render();

    goOffline();
    goOnline();
    status.acknowledgeDrop();

    expect(status.hasDropped()).toBe(false);
  });
});
