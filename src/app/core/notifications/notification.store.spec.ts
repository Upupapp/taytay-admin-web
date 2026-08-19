import { TestBed } from '@angular/core/testing';
import { of, type Observable } from 'rxjs';

import {
  asId,
  asIsoDateTime,
  DEFAULT_TOAST_DISMISS_MS,
  NOTIFICATION_REPOSITORY,
  type AppNotification,
  type NotificationId,
  type NotificationRepository,
  type NotificationRequest,
} from '@domain/index';

import { NotificationStore } from './notification.store';

/** Mirrors the channel/dismissal defaults the real adapters apply. */
class FakeNotificationRepository implements NotificationRepository {
  private items: AppNotification[] = [];
  private sequence = 0;

  seed(notifications: readonly AppNotification[]): void {
    this.items = [...notifications];
  }

  listForCurrentUser(): Observable<readonly AppNotification[]> {
    return of(this.items);
  }

  create(request: NotificationRequest): Observable<AppNotification> {
    this.sequence += 1;
    const notification: AppNotification = {
      kind: 'general',
      id: asId<NotificationId>(`ntf-${this.sequence}`),
      recipientId: request.recipientId ?? null,
      severity: request.severity,
      title: request.title,
      body: request.body ?? null,
      channel: request.channel ?? 'toast',
      action: request.action ?? null,
      createdAt: asIsoDateTime(new Date()),
      readAt: null,
      autoDismissMs:
        request.autoDismissMs !== undefined
          ? request.autoDismissMs
          : request.severity === 'error'
            ? null
            : DEFAULT_TOAST_DISMISS_MS,
    };
    this.items = [notification, ...this.items];
    return of(notification);
  }

  markRead(id: NotificationId): Observable<AppNotification> {
    const existing = this.items.find((item) => item.id === id);
    if (!existing) {
      throw new Error('missing');
    }
    const updated = { ...existing, readAt: asIsoDateTime(new Date()) };
    this.items = this.items.map((item) => (item.id === id ? updated : item));
    return of(updated);
  }

  markAllRead(): Observable<readonly AppNotification[]> {
    const readAt = asIsoDateTime(new Date());
    this.items = this.items.map((item) => (item.readAt ? item : { ...item, readAt }));
    return of(this.items);
  }
}

function setUp(): { store: NotificationStore; repository: FakeNotificationRepository } {
  const repository = new FakeNotificationRepository();
  TestBed.configureTestingModule({
    providers: [{ provide: NOTIFICATION_REPOSITORY, useValue: repository }],
  });
  return { store: TestBed.inject(NotificationStore), repository };
}

describe('NotificationStore', () => {
  it('raises a success message as a toast only', () => {
    const { store } = setUp();
    store.success('Request approved');

    expect(store.toasts()).toHaveLength(1);
    expect(store.toasts()[0]?.title).toBe('Request approved');
    expect(store.inbox()).toHaveLength(0);
  });

  it('sends errors to both surfaces and does not auto-dismiss them', () => {
    const { store } = setUp();
    store.error('Request failed', 'The server could not be reached.');

    expect(store.toasts()).toHaveLength(1);
    expect(store.inbox()).toHaveLength(1);
    expect(store.toasts()[0]?.autoDismissMs).toBeNull();
  });

  it('dismisses a toast without touching the inbox copy', () => {
    const { store } = setUp();
    store.error('Request failed');
    const id = store.toasts()[0]?.id;

    store.dismissToast(id as NotificationId);

    expect(store.toasts()).toHaveLength(0);
    expect(store.inbox()).toHaveLength(1);
  });

  it('counts unread inbox items', () => {
    const { store } = setUp();
    store.error('One');
    store.error('Two');
    expect(store.unreadCount()).toBe(2);

    store.markRead(store.inbox()[0]?.id as NotificationId);
    expect(store.unreadCount()).toBe(1);

    store.markAllRead();
    expect(store.unreadCount()).toBe(0);
  });

  it('loads the inbox from the repository on refresh', () => {
    const { store, repository } = setUp();
    repository.seed([
      {
        kind: 'general',
        id: asId<NotificationId>('seeded'),
        recipientId: null,
        severity: 'info',
        title: 'Seeded',
        body: null,
        channel: 'inbox',
        action: null,
        createdAt: asIsoDateTime(new Date()),
        readAt: null,
        autoDismissMs: null,
      },
    ]);

    store.refresh();

    expect(store.inbox()).toHaveLength(1);
    expect(store.unreadCount()).toBe(1);
  });

  it('gives non-error toasts a default dismissal delay', () => {
    const { store } = setUp();
    store.info('Saved');
    expect(store.toasts()[0]?.autoDismissMs).toBe(DEFAULT_TOAST_DISMISS_MS);
  });
  /**
   * `DL-135` — TAB 11 step 10. Nothing polls, and nothing claims to be live.
   *
   * A recurring request from every open tab against a shared municipal API is a cost somebody
   * pays; a five-second one called "real time" is that cost plus a false promise.
   */
  it('never starts a background poll for the inbox', () => {
    const setInterval = vi.spyOn(globalThis, 'setInterval');

    const { store } = setUp();
    store.refresh();

    expect(setInterval).not.toHaveBeenCalled();

    setInterval.mockRestore();
  });

});
