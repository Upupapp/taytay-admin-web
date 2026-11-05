import { describe, expect, it } from 'vitest';

import NOTIFICATIONS from '../fixtures/notifications-page-1.json';
import { toNotification } from './notification.mapper';

const [MESSAGE, DECISION] = NOTIFICATIONS.data;

describe('toNotification', () => {
  it('maps a Node inbox row', () => {
    const notification = toNotification(MESSAGE);

    expect(notification?.id).toBe(MESSAGE?.id);
    expect(notification?.title).toBe('New message');
    expect(notification?.body).toBe('A resident wrote to your office.');
    expect(notification?.readAt).toBeNull();
  });

  it('fixes the three fields this endpoint determines rather than sends', () => {
    // These rows are the caller's own inbox by definition. Not guesses — what the endpoint is.
    const notification = toNotification(DECISION);

    expect(notification?.channel).toBe('inbox');
    expect(notification?.recipientId).toBeNull();
    expect(notification?.autoDismissMs).toBeNull();
  });

  it('says the least it honestly can about kind, severity and action', () => {
    expect(toNotification(MESSAGE)?.kind).toBe('general');
    expect(toNotification(DECISION)?.kind).toBe('decision');

    for (const row of [MESSAGE, DECISION]) {
      // No priority is sent, so nothing is promoted to an alarm; no screen exists to link to.
      expect(toNotification(row)?.severity).toBe('info');
      expect(toNotification(row)?.action).toBeNull();
    }
  });

  it('keeps a type it does not recognise, as general, rather than dropping the message', () => {
    expect(toNotification({ ...MESSAGE, type: 'something_new' })?.kind).toBe('general');
  });

  it('drops a row with no id or no timestamp, which nothing could order or mark read', () => {
    expect(toNotification({ ...MESSAGE, id: undefined })).toBeNull();
    expect(toNotification({ ...MESSAGE, created_at: 'not a date' })).toBeNull();
  });
});
