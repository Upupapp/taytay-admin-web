import type { AppNotification, NotificationId, NotificationKind } from '@domain/index';

import { dateTime, field, id, str, text } from './wire';

/**
 * `GET notifications` (and the row `POST notifications/{id}/read` answers with) → `AppNotification`.
 *
 * ## What the API sends, and what the console has to supply
 *
 * A row is `id`, `type`, `title`, `body`, `subject_id`, `read_at`, `created_at`. The console's
 * notification also has a kind, a severity and an action, and none of the three is on the wire.
 * Each is filled with the **least** it can honestly say:
 *
 * | `type`                 | kind       | severity | action |
 * | ---------------------- | ---------- | -------- | ------ |
 * | `verification_decided` | `decision` | `info`   | none   |
 * | `message_received`     | `general`  | `info`   | none   |
 * | anything else          | `general`  | `info`   | none   |
 *
 * - **Kind.** A verification outcome is a decision somebody made about an account; a message to an
 *   office inbox is not an assignment, a status change or a referral, so it is `general` rather
 *   than borrowed from a kind that would group it with work it is not.
 * - **Severity is always `info`.** The API sends no priority. Promoting any of these to a warning
 *   would be the console raising an alarm nobody raised — and an inbox that cries wolf is one
 *   people stop reading, which is how the one real alert gets missed.
 * - **No action.** `subject_id` names a verification request or a message thread, and this console
 *   has no screen for either yet. A link to a route that does not exist is worse than no link: the
 *   user concludes the record is gone. The action arrives with the screen it points at.
 * - **An unrecognised `type` is kept**, as `general`. Dropping it would show one fewer message with
 *   no error anywhere; showing it plainly loses nothing.
 *
 * `channel` is `'inbox'`, `recipientId` is `null` ("the caller") and `autoDismissMs` is `null`
 * because the endpoint fixes them: these rows are, by definition, the caller's own inbox, and an
 * inbox entry is not dismissed on a timer.
 *
 * @consumes GET notifications
 * @consumes POST notifications/{id}/read
 */
export function toNotification(wire: unknown): AppNotification | null {
  const notificationId = id<NotificationId>(field(wire, 'id'));
  // Every inbox view orders by time; a row with no timestamp would read as though it had just come.
  const createdAt = dateTime(field(wire, 'created_at'));

  if (notificationId === null || createdAt === null) {
    return null;
  }

  return {
    id: notificationId,
    recipientId: null,
    severity: 'info',
    kind: KIND_BY_TYPE[str(field(wire, 'type')) ?? ''] ?? 'general',
    title: text(field(wire, 'title'), 'Notification'),
    body: str(field(wire, 'body')),
    channel: 'inbox',
    action: null,
    createdAt,
    readAt: dateTime(field(wire, 'read_at')),
    autoDismissMs: null,
  };
}

const KIND_BY_TYPE: Readonly<Record<string, NotificationKind>> = {
  verification_decided: 'decision',
  message_received: 'general',
};
