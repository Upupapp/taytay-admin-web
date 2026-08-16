import { asId, type AppNotification, type NotificationId, type StaffUserId } from '@domain/index';

import { daysBeforeAnchor } from './seed-utils';

const head = asId<StaffUserId>('staff-head');
const socialWorker = asId<StaffUserId>('staff-sw-1');

/**
 * Notifications are things that **happened**.
 *
 * Not one of these is a job. What the office owes is a `WorkItem`, which has an
 * assignee and a date; these are the record of events, read or unread. Keeping
 * the two apart is the whole of "FYI versus action required" (`DL-96`), so a
 * seed entry that reads like a to-do is a modelling mistake, not a wording one.
 *
 * The `recipientId: null` entry is an office-wide announcement — which is not
 * the same thing as "everybody may read everybody else's".
 */
export const MOCK_NOTIFICATIONS: readonly AppNotification[] = [
  {
    id: asId<NotificationId>('ntf-0001'),
    recipientId: head,
    severity: 'info',
    kind: 'status-change',
    title: 'Request TAY-2026-000841 endorsed',
    body: 'Grace Ocampo endorsed a medical assistance request for ₱8,000.00.',
    channel: 'inbox',
    action: { label: 'Open request', routerLink: ['/assistance-requests', 'req-0001'] },
    createdAt: daysBeforeAnchor(8, 15),
    readAt: null,
    autoDismissMs: null,
  },
  {
    id: asId<NotificationId>('ntf-0002'),
    recipientId: head,
    severity: 'warning',
    kind: 'decision',
    title: 'Livelihood Starter Kit suspended',
    body: 'The programme is paused pending the next tranche of funds. Three applicants are waiting.',
    channel: 'inbox',
    action: { label: 'View programme', routerLink: ['/programs', 'prog-livelihood'] },
    createdAt: daysBeforeAnchor(10, 8),
    readAt: null,
    autoDismissMs: null,
  },
  {
    id: asId<NotificationId>('ntf-0003'),
    recipientId: head,
    severity: 'success',
    kind: 'release',
    title: 'August payout session prepared',
    body: '1 voucher totalling ₱3,000.00 is scheduled for 10 August 2026.',
    channel: 'inbox',
    action: { label: 'View releases', routerLink: ['/releases'] },
    createdAt: daysBeforeAnchor(14, 16),
    readAt: daysBeforeAnchor(13, 8),
    autoDismissMs: null,
  },
  {
    id: asId<NotificationId>('ntf-0004'),
    recipientId: socialWorker,
    severity: 'info',
    kind: 'assignment',
    title: 'Case TAY-C-2026-0004 assigned to you',
    body: 'Reassigned by the MSWDO head while Mila Santiago is on leave.',
    channel: 'inbox',
    action: { label: 'Open case', routerLink: ['/cases', 'case-0004'] },
    createdAt: daysBeforeAnchor(3, 9),
    readAt: null,
    autoDismissMs: null,
  },
  {
    id: asId<NotificationId>('ntf-0005'),
    recipientId: null,
    severity: 'info',
    kind: 'general',
    title: 'Office closed 21 August',
    body: 'Ninoy Aquino Day. Payouts scheduled for that day move to the following Monday.',
    channel: 'inbox',
    action: null,
    createdAt: daysBeforeAnchor(2, 8),
    readAt: null,
    autoDismissMs: null,
  },
];
