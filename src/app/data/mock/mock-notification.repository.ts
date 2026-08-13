import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import {
  asId,
  asIsoDateTime,
  DEFAULT_TOAST_DISMISS_MS,
  type AppNotification,
  type NotificationId,
  type NotificationRepository,
  type NotificationRequest,
} from '@domain/index';

import { MOCK_NOTIFICATIONS } from './seed/notifications.seed';
import { MockLatency } from './mock-latency';
import { sortItems } from './mock-query';

@Injectable()
export class MockNotificationRepository implements NotificationRepository {
  private readonly latency = inject(MockLatency);
  private notifications: AppNotification[] = [...MOCK_NOTIFICATIONS];
  private sequence = MOCK_NOTIFICATIONS.length;

  listForCurrentUser(): Observable<readonly AppNotification[]> {
    return this.latency.respond(
      sortItems(this.notifications, (notification) => notification.createdAt, 'desc'),
    );
  }

  create(request: NotificationRequest): Observable<AppNotification> {
    this.sequence += 1;
    const severity = request.severity;
    const notification: AppNotification = {
      id: asId<NotificationId>(`ntf-local-${this.sequence}`),
      recipientId: request.recipientId ?? null,
      severity,
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
    const existing = this.notifications.find((notification) => notification.id === id);
    if (!existing) {
      return throwError(() => new Error(`Notification ${id} was not found.`));
    }
    const updated: AppNotification = { ...existing, readAt: asIsoDateTime(new Date()) };
    this.notifications = this.notifications.map((notification) =>
      notification.id === id ? updated : notification,
    );
    return this.latency.respond(updated);
  }

  markAllRead(): Observable<readonly AppNotification[]> {
    const readAt = asIsoDateTime(new Date());
    this.notifications = this.notifications.map((notification) =>
      notification.readAt === null ? { ...notification, readAt } : notification,
    );
    return this.latency.respond(this.notifications);
  }
}
