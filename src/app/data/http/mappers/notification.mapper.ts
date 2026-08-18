import type {
  AppNotification,
  NotificationId,
  NotificationKind,
  NotificationSeverity,
} from '@domain/index';

import { dateTime, field, id, oneOf, str, text } from './wire';

/**
 * `GET me/notifications` → `AppNotification`.
 *
 * The cleanest resource mapped so far, and worth saying why: **this endpoint's
 * items are, by definition, inbox items for the calling actor.** Three domain
 * fields the wire does not carry are therefore *determined* rather than
 * guessed —
 *
 *  * `channel` is `'inbox'`. That is what the endpoint is.
 *  * `autoDismissMs` is `null`. An inbox entry is not a toast; nothing dismisses
 *    it on a timer.
 *  * `recipientId` is `null`, meaning "the caller". The route is `me/…`, so
 *    there is no other person it could be about, and inventing an id here would
 *    be the console asserting something the payload never said.
 *
 * That is the distinction this whole mapping exercise turns on: a field the
 * endpoint's own contract fixes is not the same as a field nobody sent. Compare
 * `household.mapper.ts`, where the absent field was a claim about a household
 * and the mapper was left unwritten.
 *
 * @consumes GET me/notifications
 */
export function toNotification(wire: unknown): AppNotification | null {
  const notificationId = id<NotificationId>(field(wire, 'id'));

  if (notificationId === null) {
    return null;
  }

  const createdAt = dateTime(field(wire, 'created_at'));

  if (createdAt === null) {
    // Every inbox view orders by time. An entry with no timestamp would sort
    // arbitrarily and read as though it had just arrived.
    return null;
  }

  return {
    id: notificationId,
    recipientId: null,
    severity: toSeverity(field(wire, 'priority')),
    kind: oneOf<NotificationKind>(field(wire, 'category'), KINDS) ?? 'general',
    title: text(field(wire, 'title'), 'Notification'),
    body: str(field(wire, 'body')),
    channel: 'inbox',
    action: toAction(wire),
    createdAt,
    readAt: dateTime(field(wire, 'read_at')),
    autoDismissMs: null,
  };
}

const KINDS: readonly NotificationKind[] = [
  'assignment',
  'status-change',
  'decision',
  'release',
  'referral',
  'data-quality',
  'general',
];

/**
 * The API sends a `priority`; the console renders a severity.
 *
 * An unrecognised value becomes `'info'` rather than `'error'`. A message the
 * console does not understand must not be shown as an alarm — an inbox that
 * cries wolf on every unfamiliar type is an inbox people stop reading, which is
 * how the one real alert gets missed.
 */
function toSeverity(priority: unknown): NotificationSeverity {
  switch (str(priority)) {
    case 'urgent':
    case 'high':
      return 'warning';
    case 'critical':
      return 'error';
    default:
      return 'info';
  }
}

/**
 * The subject reference, turned into somewhere to go.
 *
 * The payload carries `subject_type` and `subject_id` and **no narrative** —
 * deliberately, and the console must not add one. A notification says that
 * something happened and points at it; the record itself is read over the
 * authenticated API, behind its own permission. That is the same rule the push
 * payload follows, for the same reason.
 *
 * An unrecognised `subject_type` yields no action rather than a guessed route:
 * a link that 404s is worse than no link, because the user believes the record
 * is gone.
 */
function toAction(wire: unknown): { label: string; routerLink: readonly string[] } | null {
  const subjectId = str(field(wire, 'subject_id'));
  const route = SUBJECT_ROUTES[str(field(wire, 'subject_type')) ?? ''];

  return subjectId === null || route === undefined
    ? null
    : { label: 'Open', routerLink: [route, subjectId] };
}

const SUBJECT_ROUTES: Readonly<Record<string, string>> = {
  welfare_case: '/requests',
  assistance_request: '/requests',
  referral: '/referrals',
  visit: '/visits',
  release: '/releases',
  resident: '/residents',
};
