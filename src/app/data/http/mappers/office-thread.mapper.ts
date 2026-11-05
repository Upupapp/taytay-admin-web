import {
  THREAD_STATUSES,
  type AppAccountId,
  type MediaId,
  type OfficeId,
  type OfficeThread,
  type OfficeThreadId,
  type ThreadMessage,
  type ThreadMessageId,
} from '@domain/index';

import { dateTime, field, id, int, list, oneOf, str } from './wire';

/**
 * `Thread` → `OfficeThread` (`DL-168`).
 *
 * | wire              | domain              | if absent                       |
 * | ----------------- | ------------------- | ------------------------------- |
 * | `id`              | `id`                | the conversation is not readable |
 * | `resident_id`     | `residentAccountId` | the conversation is not readable |
 * | `office_id`       | `officeId`          | the conversation is not readable |
 * | `office_slug`     | `officeSlug`        | the conversation is not readable |
 * | `subject`         | `subject`           | the conversation is not readable |
 * | `status`          | `status`            | the conversation is not readable |
 * | `unread_count`    | `unreadCount`       | the conversation is not readable |
 * | `last_message_at` | `lastMessageAt`     | nothing written yet             |
 * | `created_at`      | `createdAt`         | the conversation is not readable |
 * | `updated_at`      | `updatedAt`         | the conversation is not readable |
 *
 * **Not read**: `last_message_preview` — the first 140 characters of what was last written. The
 * inbox is a list, and what a resident wrote to their government is read by opening the
 * conversation, not in a column anybody passing the screen can read (`check:inbox`). `unread` is
 * `unread_count > 0` said twice.
 *
 * Every field the record cannot be read without is one the spec marks required, so a `null` here is
 * the API breaking its contract — and the adapter refuses the page rather than showing one fewer
 * conversation, which would be a resident nobody knows is waiting.
 *
 * @consumes GET threads
 * @consumes GET threads/{id}
 * @consumes POST threads/{id}/read
 * @consumes POST threads/{id}/close
 */
export function toOfficeThread(wire: unknown): OfficeThread | null {
  const threadId = id<OfficeThreadId>(field(wire, 'id'));
  const residentAccountId = id<AppAccountId>(field(wire, 'resident_id'));
  const officeId = id<OfficeId>(field(wire, 'office_id'));
  const officeSlug = str(field(wire, 'office_slug'));
  const subject = str(field(wire, 'subject'));
  const status = oneOf(field(wire, 'status'), THREAD_STATUSES);
  const unreadCount = int(field(wire, 'unread_count'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    threadId === null ||
    residentAccountId === null ||
    officeId === null ||
    officeSlug === null ||
    subject === null ||
    status === null ||
    unreadCount === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    id: threadId,
    residentAccountId,
    officeId,
    officeSlug,
    subject,
    status,
    unreadCount: Math.max(0, unreadCount),
    lastMessageAt: dateTime(field(wire, 'last_message_at')),
    createdAt,
    updatedAt,
  };
}

/**
 * `Message` → `ThreadMessage` (`DL-168`).
 *
 * | wire          | domain        | if absent                    |
 * | ------------- | ------------- | ---------------------------- |
 * | `id`          | `id`          | the message is not readable  |
 * | `thread_id`   | `threadId`    | the message is not readable  |
 * | `sender_id`   | `senderId`    | the message is not readable  |
 * | `body`        | `body`        | the message is not readable  |
 * | `attachments` | `attachments` | no images                    |
 * | `created_at`  | `sentAt`      | the message is not readable  |
 *
 * An attachment is a media id and nothing else: no address, no file name. Its bytes are read on
 * request through the data layer, like an ID review's images (`DL-167`).
 *
 * @consumes GET threads/{id}/messages
 */
export function toThreadMessage(wire: unknown): ThreadMessage | null {
  const messageId = id<ThreadMessageId>(field(wire, 'id'));
  const threadId = id<OfficeThreadId>(field(wire, 'thread_id'));
  const senderId = id<AppAccountId>(field(wire, 'sender_id'));
  const body = str(field(wire, 'body'));
  const sentAt = dateTime(field(wire, 'created_at'));

  if (
    messageId === null ||
    threadId === null ||
    senderId === null ||
    body === null ||
    sentAt === null
  ) {
    return null;
  }

  return {
    id: messageId,
    threadId,
    senderId,
    body,
    attachments: list(field(wire, 'attachments'), (attachment) =>
      id<MediaId>(field(attachment, 'media_id')),
    ),
    sentAt,
  };
}

/**
 * A reply's answer, `{ thread, message }`, → the message sent (`DL-168`).
 *
 * The conversation half is not read: the screen reads the conversation again after a reply, so a
 * second copy of it here would be one more thing that could disagree.
 *
 * @consumes POST threads/{id}/messages
 */
export function toPostedMessage(wire: unknown): ThreadMessage | null {
  const message = toThreadMessage(field(wire, 'message'));

  if (message === null) {
    return null;
  }

  return message;
}
