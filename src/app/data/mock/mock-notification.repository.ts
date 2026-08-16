import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  DEFAULT_TOAST_DISMISS_MS,
  isForRecipient,
  type AppNotification,
  type NotificationId,
  type NotificationRepository,
  type NotificationRequest,
} from '@domain/index';

import { MOCK_NOTIFICATIONS } from './seed/notifications.seed';
import { MockLatency } from './mock-latency';
import { sortItems } from './mock-query';

/**
 * The notification adapter.
 *
 * **This file gained its recipient filter in TAB 18.** Before that,
 * `listForCurrentUser` returned every seeded notification to every caller: the
 * `recipientId` field existed on the model and nothing read it, so a barangay
 * link account signing in saw the MSWDO head's inbox — case assignments,
 * suspended programmes, payout preparations, all of it.
 *
 * That is the **third** adapter found ungated (`DL-84`, `DL-95`, and now
 * `DL-100`). The cause here is different from the first two and worth naming
 * separately: the method was *named* `listForCurrentUser` and did not know who
 * the current user was. A name is not an implementation, and a name that
 * describes the intended behaviour is the easiest possible place to stop
 * looking.
 *
 * A notification with `recipientId: null` is an office-wide announcement. That
 * is a deliberate case, not the absence of a recipient — the rule lives in
 * `isForRecipient` so both adapters cannot drift.
 */
@Injectable()
export class MockNotificationRepository implements NotificationRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private notifications: AppNotification[] = [...MOCK_NOTIFICATIONS];
  private sequence = MOCK_NOTIFICATIONS.length;

  listForCurrentUser(): Observable<readonly AppNotification[]> {
    const user = this.access.currentUser();
    const mine = this.notifications.filter((notification) =>
      isForRecipient(notification, user?.id ?? null),
    );
    return this.latency.respond(sortItems(mine, (notification) => notification.createdAt, 'desc'));
  }

  create(request: NotificationRequest): Observable<AppNotification> {
    this.sequence += 1;
    const severity = request.severity;
    const user = this.access.currentUser();
    const notification: AppNotification = {
      id: asId<NotificationId>(`ntf-local-${this.sequence}`),
      // Raised without a recipient means "for me", not "for everybody": a
      // success toast on my own action must not land in the whole office's
      // inbox as an announcement.
      recipientId: request.recipientId ?? user?.id ?? null,
      severity,
      kind: request.kind ?? 'general',
      title: request.title,
      body: request.body ?? null,
      channel: request.channel ?? 'toast',
      action: request.action ?? null,
      createdAt: asIsoDateTime(new Date()),
      readAt: null,
      autoDismissMs:
        request.autoDismissMs !== undefined
          ? request.autoDismissMs
          : severity === 'error'
            ? null
            : DEFAULT_TOAST_DISMISS_MS,
    };
    this.notifications = [notification, ...this.notifications];
    return this.latency.respond(notification);
  }

  markRead(id: NotificationId): Observable<AppNotification> {
    const user = this.access.currentUser();
    const existing = this.notifications.find((notification) => notification.id === id);
    // Not found and not yours read identically (`DL-31`), so a probe cannot
    // learn that somebody else's notification exists.
    if (!existing || !isForRecipient(existing, user?.id ?? null)) {
      return throwError(() => new Error(`Notification ${id} was not found.`));
    }
    const updated: AppNotification = { ...existing, readAt: asIsoDateTime(new Date()) };
    this.notifications = this.notifications.map((notification) =>
      notification.id === id ? updated : notification,
    );
    return this.latency.respond(updated);
  }

  markAllRead(): Observable<readonly AppNotification[]> {
    const user = this.access.currentUser();
    const readAt = asIsoDateTime(new Date());
    this.notifications = this.notifications.map((notification) =>
      notification.readAt === null && isForRecipient(notification, user?.id ?? null)
        ? { ...notification, readAt }
        : notification,
    );
    return this.latency.respond(
      this.notifications.filter((notification) =>
        isForRecipient(notification, user?.id ?? null),
      ),
    );
  }
}
