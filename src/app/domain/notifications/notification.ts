import type { IsoDateTime, NotificationId, StaffUserId } from '../shared/ids';

/** Severity drives both the toast styling and the inbox grouping. */
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Where a notification is shown.
 *
 * **These are the only two surfaces, and that is deliberate.** No email, no
 * SMS, no push, no webhook: the LGU supplied no mail relay, no SMS gateway and
 * no push credentials, so this application has no way to send anything and must
 * not appear to. Same doctrine as `DL-89` refusing to invent accounting.
 *
 * The failure it prevents is specific. A `channel: 'sms'` that silently no-ops
 * leaves an office believing a beneficiary was told to come on Tuesday. Nobody
 * finds out until the family does not arrive, and by then the record says they
 * were notified. `tools/check-work.mjs` fails the build if a delivery channel
 * appears here or anywhere in the notification path.
 */
export type NotificationChannel = 'toast' | 'inbox' | 'both';

/**
 * What happened.
 *
 * Carried so the notification centre can group events rather than presenting
 * one flat stream — the master command asks for grouping, and an office that
 * has to read forty lines to find the two that concern them stops reading any.
 *
 * A notification is **always** something that happened, never something owed.
 * What is owed is a `WorkItem` (`domain/work`), which has an assignee and a due
 * date. Keeping them apart is what lets a user tell "FYI" from "action
 * required" at a glance.
 */
export type NotificationKind =
  | 'assignment'
  | 'status-change'
  | 'decision'
  | 'release'
  | 'referral'
  | 'data-quality'
  | 'general';

export const NOTIFICATION_KIND_LABELS: Readonly<Record<NotificationKind, string>> = {
  assignment: 'Assigned to you',
  'status-change': 'Progress',
  decision: 'Decisions',
  release: 'Releases',
  referral: 'Referrals',
  'data-quality': 'Data quality',
  general: 'Other',
};

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
  /** Who it is for. `null` is an office-wide announcement, not "everybody's". */
  readonly recipientId: StaffUserId | null;
  readonly severity: NotificationSeverity;
  readonly kind: NotificationKind;
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
  readonly kind?: NotificationKind;
  readonly channel?: NotificationChannel;
  readonly action?: NotificationAction | null;
  readonly autoDismissMs?: number | null;
  readonly recipientId?: StaffUserId | null;
}

export const DEFAULT_TOAST_DISMISS_MS = 6000;

export function isUnread(notification: AppNotification): boolean {
  return notification.readAt === null;
}

export function unreadCount(notifications: readonly AppNotification[]): number {
  return notifications.filter(isUnread).length;
}

/* ── Grouping the notification centre ─────────────────────────────────────── */

export interface NotificationGroup {
  readonly kind: NotificationKind;
  readonly label: string;
  readonly items: readonly AppNotification[];
  readonly unread: number;
}

const KIND_ORDER: readonly NotificationKind[] = [
  'assignment',
  'decision',
  'status-change',
  'release',
  'referral',
  'data-quality',
  'general',
];

/**
 * Groups the centre by what happened, newest first inside each group.
 *
 * "Assigned to you" leads because it is the only group that might mean somebody
 * now owes something. Everything below it is genuinely informational, and the
 * screen says so — that is the whole of the "FYI versus action required"
 * distinction on this surface.
 *
 * Empty groups are dropped rather than rendered as zeroes. A column of "0" is
 * noise dressed as information.
 */
export function groupNotifications(
  notifications: readonly AppNotification[],
): readonly NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const kind of KIND_ORDER) {
    const items = notifications
      .filter((notification) => notification.kind === kind)
      .sort((a, b) => (a.createdAt === b.createdAt ? 0 : a.createdAt < b.createdAt ? 1 : -1));
    if (items.length > 0) {
      groups.push({
        kind,
        label: NOTIFICATION_KIND_LABELS[kind],
        items,
        unread: items.filter(isUnread).length,
      });
    }
  }
  return groups;
}

/**
 * Whether a user should see this notification.
 *
 * Enforced in the data layer as well; this exists so the rule is stated once,
 * in the domain, rather than reimplemented per adapter. A notification with no
 * recipient is an office-wide announcement — which is not the same thing as
 * "everybody may read everybody's".
 */
export function isForRecipient(
  notification: AppNotification,
  userId: StaffUserId | null,
): boolean {
  return notification.recipientId === null || notification.recipientId === userId;
}
