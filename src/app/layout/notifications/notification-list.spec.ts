import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { NotificationStore } from '@core/notifications/notification.store';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type SignInOutcome,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { NotificationList } from './notification-list';
import { NotificationPopover } from './notification-popover';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  firebaseWebApiKey: null,
  mockLatencyMs: 0,
  enableDevTools: false,
};

function staffRepository(role: StaffRole): StaffRepository {
  const user: StaffUser = {
    id: asId<StaffUserId>('staff-head'),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId: null,
    additionalPermissions: [],
    isActive: true,
    lastSignInAt: null,
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['createdAt'],
      createdBy: null,
      updatedAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['updatedAt'],
      updatedBy: null,
    },
  };
  const authenticated = toAuthenticatedUser(user);
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated),
    signOut: (): Observable<void> => of(undefined),
  };
}

@Component({ template: 'stub' })
class StubPage {}

async function openDrawerList(
  role: StaffRole = 'mswdo-head',
): Promise<ComponentFixture<NotificationList>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: StubPage }]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(role) },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  TestBed.inject(NotificationStore).refresh();
  const fixture = TestBed.createComponent(NotificationList);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const items = (fixture: ComponentFixture<unknown>) =>
  html(fixture).querySelectorAll('.inbox__item').length;

describe('the notification drawer’s quick filters (DL-291)', () => {
  it('narrows to unread notices with the Unread tab, and says how many are shown', async () => {
    const fixture = await openDrawerList();
    const store = TestBed.inject(NotificationStore);
    const total = store.inbox().length;
    expect(total).toBeGreaterThan(0);
    expect(items(fixture)).toBe(total);

    const unread = [...html(fixture).querySelectorAll<HTMLButtonElement>('.inbox__tabs .tab')][1];
    unread?.click();
    await fixture.whenStable();

    expect(items(fixture)).toBe(store.unreadCount());
    expect(unread?.getAttribute('aria-pressed')).toBe('true');
    expect(html(fixture).textContent).toContain(`Showing ${store.unreadCount()} of ${total}.`);
  });

  it('narrows to one category, offering only the categories the inbox holds', async () => {
    const fixture = await openDrawerList();
    const select = html(fixture).querySelector<HTMLSelectElement>('.inbox__category select');
    const first = select?.options[1];
    expect(first).toBeDefined();
    if (!select || !first) return;

    select.value = first.value;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const count = Number(/\((\d+)\)/.exec(first.textContent ?? '')?.[1]);
    expect(items(fixture)).toBe(count);
  });

  it('keeps its filters on one row, saying the count to a screen reader only (DL-296)', async () => {
    const fixture = await openDrawerList();
    const filters = html(fixture).querySelector('.inbox__filters');
    expect(filters?.querySelector('.inbox__category .visually-hidden')?.textContent).toContain(
      'Category',
    );
    expect(filters?.querySelector('[role="status"]')?.classList).toContain('visually-hidden');
    expect(filters?.querySelector('a')).toBeNull();
  });
});

describe('the bell’s notifications drop from the bell (DL-293)', () => {
  async function openPopover(): Promise<{
    fixture: ComponentFixture<NotificationPopover>;
    bell: HTMLButtonElement;
    closes: () => number;
  }> {
    await openDrawerList();
    const bell = document.createElement('button');
    document.body.append(bell);
    const fixture = TestBed.createComponent(NotificationPopover);
    fixture.componentRef.setInput('anchor', bell);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
    document.body.append(fixture.nativeElement as HTMLElement);
    await fixture.whenStable();
    return { fixture, bell, closes: () => closed };
  }

  it('is a labelled dialog with the full page one press away', async () => {
    const { fixture } = await openPopover();
    const panel = html(fixture).querySelector('[role="dialog"]');
    expect(panel?.getAttribute('aria-labelledby')).toBe('notification-popover-heading');
    expect(html(fixture).querySelector('.popover__all')?.getAttribute('href')).toBe(
      '/notifications',
    );
    expect(html(fixture).querySelector('app-notification-list')).not.toBeNull();
  });

  it('closes on a press outside, but not on a press inside or on the bell', async () => {
    const { fixture, bell, closes } = await openPopover();
    html(fixture)
      .querySelector('.popover__heading')
      ?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    bell.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(closes()).toBe(0);

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(closes()).toBe(1);
  });

  it('closes on Escape and hands focus back to the bell', async () => {
    const { bell, closes } = await openPopover();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closes()).toBe(1);
    expect(document.activeElement).toBe(bell);
  });
});
