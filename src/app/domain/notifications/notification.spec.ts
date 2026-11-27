import { describe, expect, it } from 'vitest';

import { asId, type IsoDateTime, type NotificationId } from '../shared/ids';
import {
  filterNotifications,
  kindsPresent,
  NO_NOTIFICATION_FILTER,
  periodStart,
  type AppNotification,
  type NotificationKind,
} from './notification';

const NOW = new Date(2026, 10, 27, 15, 0);

function notice(
  id: string,
  kind: NotificationKind,
  daysAgo: number,
  read = false,
): AppNotification {
  const createdAt = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: asId<NotificationId>(id),
    recipientId: null,
    severity: 'info',
    kind,
    title: id,
    body: null,
    channel: 'inbox',
    action: null,
    createdAt: createdAt as IsoDateTime,
    readAt: read ? (createdAt as IsoDateTime) : null,
    autoDismissMs: null,
  };
}

const INBOX = [
  notice('message-today', 'message', 0),
  notice('message-old', 'message', 20, true),
  notice('decision-week', 'decision', 3, true),
  notice('general-ancient', 'general', 90),
];

const ids = (items: readonly AppNotification[]) => items.map((item) => item.id);

describe('filtering the notification centre (DL-291)', () => {
  it('shows everything with no filter', () => {
    expect(filterNotifications(INBOX, NO_NOTIFICATION_FILTER, NOW)).toHaveLength(4);
  });

  it('shows only unread notices on Unread', () => {
    const shown = filterNotifications(INBOX, { ...NO_NOTIFICATION_FILTER, show: 'unread' }, NOW);
    expect(ids(shown)).toEqual(['message-today', 'general-ancient']);
  });

  it('narrows to one category', () => {
    const shown = filterNotifications(INBOX, { ...NO_NOTIFICATION_FILTER, kind: 'message' }, NOW);
    expect(ids(shown)).toEqual(['message-today', 'message-old']);
  });

  it('narrows by when, from local midnight for today', () => {
    const today = filterNotifications(INBOX, { ...NO_NOTIFICATION_FILTER, period: 'today' }, NOW);
    const week = filterNotifications(INBOX, { ...NO_NOTIFICATION_FILTER, period: 'week' }, NOW);
    const month = filterNotifications(INBOX, { ...NO_NOTIFICATION_FILTER, period: 'month' }, NOW);

    expect(ids(today)).toEqual(['message-today']);
    expect(ids(week)).toEqual(['message-today', 'decision-week']);
    expect(ids(month)).toEqual(['message-today', 'message-old', 'decision-week']);
    expect(periodStart('today', NOW)).toEqual(new Date(2026, 10, 27));
    expect(periodStart('any', NOW)).toBeNull();
  });

  it('combines the three filters', () => {
    const shown = filterNotifications(
      INBOX,
      { show: 'unread', kind: 'message', period: 'month' },
      NOW,
    );
    expect(ids(shown)).toEqual(['message-today']);
  });

  it('offers only the categories the inbox holds, in the centre order, with counts', () => {
    expect(kindsPresent(INBOX)).toEqual([
      { kind: 'message', label: 'Messages from residents', count: 2 },
      { kind: 'decision', label: 'Decisions', count: 1 },
      { kind: 'general', label: 'Other', count: 1 },
    ]);
  });
});
