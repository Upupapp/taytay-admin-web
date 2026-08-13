import type { IsoDateTime, NotificationId, StaffUserId } from '../shared/ids';

/** Severity drives both the toast styling and the inbox grouping. */
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export type NotificationChannel = 'toast' | 'inbox' | 'both';

export interface NotificationAction {
  readonly label: string;
  /** Router link segments; the shell navigates, the notifier never does. */
  readonly routerLink: readonly string[];
}

/**
 * A persisted, per-user notification. Transient toasts reuse the same shape so
 * one message object can be raised once and rendered in either surface.
 */
export interface AppNotification {
  readonly id: NotificationId;
  readonly recipientId: StaffUserId | null;
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly body: string | null;
  readonly channel: NotificationChannel;
  readonly action: NotificationAction | null;
  readonly createdAt: IsoDateTime;
  readonly readAt: IsoDateTime | null;
  /** Auto-dismiss delay for toasts. `null` keeps the toast until dismissed. */
  readonly autoDismissMs: number | null;
}

/** What a caller supplies when raising a notification. */
export interface NotificationRequest {
  readonly severity: NotificationSeverity;
  readonly title: string;
  readonly body?: string | null;
  readonly channel?: NotificationChannel;
  readonly action?: NotificationAction | null;
  readonly autoDismissMs?: number | null;
  readonly recipientId?: StaffUserId | null;
}

export const DEFAULT_TOAST_DISMISS_MS = 6000;

export function isUnread(notification: AppNotification): boolean {
  return notification.readAt === null;
}
