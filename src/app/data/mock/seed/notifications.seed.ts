import { asId, type AppNotification, type NotificationId, type StaffUserId } from '@domain/index';

import { daysBeforeAnchor } from './seed-utils';

const head = asId<StaffUserId>('staff-head');

export const MOCK_NOTIFICATIONS: readonly AppNotification[] = [
  {
    id: asId<NotificationId>('ntf-0001'),
    recipientId: head,
    severity: 'info',
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
    title: 'August payout batch prepared',
    body: '1 voucher totalling ₱3,000.00 is scheduled for 10 August 2026.',
    channel: 'inbox',
    action: { label: 'View disbursements', routerLink: ['/disbursements'] },
    createdAt: daysBeforeAnchor(14, 16),
    readAt: daysBeforeAnchor(13, 8),
    autoDismissMs: null,
  },
];
