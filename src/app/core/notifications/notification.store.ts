import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import {
  isUnread,
  NOTIFICATION_REPOSITORY,
  type AppNotification,
  type NotificationId,
  type NotificationRequest,
  toLocalNotification,
  isLocalNotification,
} from '@domain/index';

import { SessionState } from '../auth/session-state';

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
  /**
   * Who "for me" means when a message is raised without a recipient.
   *
   * `SessionState` rather than the `ACCESS_CONTEXT` token: it is root-provided
   * and depends on nothing, so raising a toast does not oblige every test that
   * mounts a component to wire an authorization context it never uses.
   */
  private readonly session = inject(SessionState);
  private readonly destroyRef = inject(DestroyRef);

  private readonly inboxItems = signal<readonly AppNotification[]>([]);
  private readonly toastItems = signal<readonly AppNotification[]>([]);
  private readonly timers = new Map<NotificationId, ReturnType<typeof setTimeout>>();
  private sequence = 0;

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

  /**
   * Raises a message this console is showing its own user.
   *
   * Built locally and sent nowhere. The API's inbox is read-only for the actor
   * (TAB 05, step 9), so there is no server record to create — and pretending
   * otherwise would mean an office believing a message was filed when it lived
   * in one browser tab.
   */
  notify(request: NotificationRequest): void {
    this.sequence += 1;
    this.receive(
      toLocalNotification(request, this.session.currentUser()?.id ?? null, this.sequence, new Date()),
    );
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
    const item = this.inboxItems().find((candidate) => candidate.id === id);

    /*
     * A message this console raised for itself has no server record to mark.
     * Sending its `local-` id to `POST me/notifications/{id}/read` would ask the
     * API about something it never issued, and be answered with a 404 the user
     * would see as a failure to dismiss their own toast.
     */
    if (item !== undefined && isLocalNotification(item)) {
      this.markLocallyRead(id);
      return;
    }

    this.repository.markRead(id).subscribe({
      next: (updated) =>
        this.inboxItems.update((items) => items.map((entry) => (entry.id === id ? updated : entry))),
    });
  }

  markAllRead(): void {
    // The local ones first and unconditionally: the server's answer replaces
    // only what the server knows about, and it knows about none of these.
    for (const item of this.inboxItems().filter(isLocalNotification)) {
      this.markLocallyRead(item.id);
    }

    const local = this.inboxItems().filter(isLocalNotification);

    this.repository.markAllRead().subscribe({
      next: (items) => this.inboxItems.set([...local, ...items]),
    });
  }

  private markLocallyRead(id: NotificationId): void {
    this.inboxItems.update((items) =>
      items.map((item) =>
        item.id === id && item.readAt === null
          ? { ...item, readAt: new Date().toISOString() as typeof item.createdAt }
          : item,
      ),
    );
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
