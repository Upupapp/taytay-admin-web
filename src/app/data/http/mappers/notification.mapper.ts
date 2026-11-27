import type {
  AppNotification,
  NotificationAction,
  NotificationId,
  NotificationKind,
  OfficeThreadId,
} from '@domain/index';

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
 * | `type`                 | kind       | severity | action                                  |
 * | ---------------------- | ---------- | -------- | --------------------------------------- |
 * | `verification_decided` | `decision` | `info`   | none                                    |
 * | `message_received`     | `message`  | `info`   | the conversation, under the inbox's key |
 * | anything else          | `general`  | `info`   | none                                    |
 *
 * - **Kind.** A verification outcome is a decision somebody made about an account. A resident's
 *   message to the office is the one notice staff actually receive (backend `messaging/routes.ts`),
 *   so it has its own kind and filter rather than sitting under "Other" (DL-291).
 * - **Severity is always `info`.** The API sends no priority. Promoting any of these to a warning
 *   would be the console raising an alarm nobody raised — and an inbox that cries wolf is one
 *   people stop reading, which is how the one real alert gets missed.
 * - **Action only for a message.** `subject_id` on a message notice is the thread, and the office
 *   inbox opens one at `/inbox/:threadId` (`DL-168`); the link carries `office-inbox.manage` so it
 *   is not offered to somebody whose grant has since gone (DL-291). A verification request has no
 *   address — review opens in a drawer because the API cannot read one request by id (`DL-167`) —
 *   and a link to a route that does not exist is worse than none.
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

  const type = str(field(wire, 'type')) ?? '';

  return {
    id: notificationId,
    recipientId: null,
    severity: 'info',
    kind: KIND_BY_TYPE[type] ?? 'general',
    title: text(field(wire, 'title'), 'Notification'),
    body: str(field(wire, 'body')),
    channel: 'inbox',
    action: actionFor(type, id<OfficeThreadId>(field(wire, 'subject_id'))),
    createdAt,
    readAt: dateTime(field(wire, 'read_at')),
    autoDismissMs: null,
  };
}

const KIND_BY_TYPE: Readonly<Record<string, NotificationKind>> = {
  verification_decided: 'decision',
  message_received: 'message',
};

function actionFor(type: string, threadId: OfficeThreadId | null): NotificationAction | null {
  if (type !== 'message_received' || threadId === null) {
    return null;
  }
  return {
    label: 'Open conversation',
    routerLink: ['/inbox', threadId],
    permission: 'office-inbox.manage',
  };
}
