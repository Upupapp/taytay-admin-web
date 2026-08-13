import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import {
  isUnread,
  NOTIFICATION_REPOSITORY,
  type AppNotification,
  type NotificationId,
  type NotificationRequest,
} from '@domain/index';

/**
 * Application-wide notification surface.
 *
 * Callers raise a message; this store decides whether it lands in the toast
 * stack, the inbox, or both. Components never construct notification DOM
 * themselves and never navigate on their own from a notification.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly repository = inject(NOTIFICATION_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  private readonly inboxItems = signal<readonly AppNotification[]>([]);
  private readonly toastItems = signal<readonly AppNotification[]>([]);
  private readonly timers = new Map<NotificationId, ReturnType<typeof setTimeout>>();

  readonly inbox = this.inboxItems.asReadonly();
  readonly toasts = this.toastItems.asReadonly();
  readonly unreadCount = computed(() => this.inboxItems().filter(isUnread).length);

  constructor() {
    this.destroyRef.onDestroy(() => {
      for (const timer of this.timers.values()) {
        clearTimeout(timer);
      }
      this.timers.clear();
    });
  }

  refresh(): void {
    this.repository.listForCurrentUser().subscribe({
      next: (notifications) => this.inboxItems.set(notifications),
    });
  }

  notify(request: NotificationRequest): void {
    this.repository.create(request).subscribe({
      next: (notification) => this.receive(notification),
    });
  }

  info(title: string, body?: string): void {
    this.notify({ severity: 'info', title, body: body ?? null });
  }

  success(title: string, body?: string): void {
    this.notify({ severity: 'success', title, body: body ?? null });
  }

  warning(title: string, body?: string): void {
    this.notify({ severity: 'warning', title, body: body ?? null });
  }

  /** Errors stay on screen until dismissed and are always kept in the inbox. */
  error(title: string, body?: string): void {
    this.notify({
      severity: 'error',
      title,
      body: body ?? null,
      channel: 'both',
      autoDismissMs: null,
    });
  }

  dismissToast(id: NotificationId): void {
    this.clearTimer(id);
    this.toastItems.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }

  markRead(id: NotificationId): void {
    this.repository.markRead(id).subscribe({
      next: (updated) =>
        this.inboxItems.update((items) => items.map((item) => (item.id === id ? updated : item))),
    });
  }

  markAllRead(): void {
    this.repository.markAllRead().subscribe({
      next: (items) => this.inboxItems.set(items),
    });
  }

  private receive(notification: AppNotification): void {
    if (notification.channel === 'inbox' || notification.channel === 'both') {
      this.inboxItems.update((items) => [notification, ...items]);
    }
    if (notification.channel === 'toast' || notification.channel === 'both') {
      this.toastItems.update((toasts) => [...toasts, notification]);
      this.scheduleDismissal(notification);
    }
  }

  private scheduleDismissal(notification: AppNotification): void {
    const delay = notification.autoDismissMs;
    if (delay === null || delay <= 0) {
      return;
    }
    this.clearTimer(notification.id);
    this.timers.set(
      notification.id,
      setTimeout(() => this.dismissToast(notification.id), delay),
    );
  }

  private clearTimer(id: NotificationId): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
