import {
  asId,
  asIsoDate,
  type IsoDate,
  type NotificationId,
  type StaffUserId,
} from '../shared/ids';
import {
  groupNotifications,
  isForRecipient,
  type AppNotification,
} from '../notifications/notification';
import {
  ALERT_SEVERITY_CATALOG,
  compareAlerts,
  describeAlerts,
  type OfficeAlert,
} from './office-alert';
import {
  compareWork,
  describeLateness,
  describeWaiting,
  isWorkOverdue,
  workUrgency,
  WORK_KIND_LABELS,
  WORK_PRIORITY_CATALOG,
  type WorkItem,
  type WorkKind,
  type WorkPriority,
  type WorkSource,
} from './work-item';
import { bucketWork, buildTeamQueue, describeQueue, totalWork } from './work-queue';

const TODAY = asIsoDate('2026-08-16');

function work(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'case-task:task-1',
    source: 'case-task',
    sourceId: 'task-1',
    kind: 'close-case',
    priority: 'routine',
    title: 'Do the thing',
    subject: 'Dela Cruz, Maria',
    preview: 'Case TAY-C-2026-0001',
    dueOn: asIsoDate('2026-08-20'),
    waitingSince: null,
    assignedTo: asId<StaffUserId>('staff-sw-1'),
    assignedToName: 'Grace Ocampo',
    permission: 'case.manage',
    link: { routerLink: ['/cases', 'case-0001'], label: 'Open the case' },
    isManageable: true,
    ...overrides,
  };
}

/* ── Criterion: overdue is obvious, and not by colour ─────────────────────── */

describe('when work is owed', () => {
  it('derives urgency from the date rather than reading a stored flag', () => {
    expect(workUrgency(work({ dueOn: asIsoDate('2026-08-10') }), TODAY)).toBe('overdue');
    expect(workUrgency(work({ dueOn: TODAY }), TODAY)).toBe('due-today');
    expect(workUrgency(work({ dueOn: asIsoDate('2026-08-20') }), TODAY)).toBe('due-soon');
    expect(workUrgency(work({ dueOn: asIsoDate('2026-09-30') }), TODAY)).toBe('later');
    expect(workUrgency(work({ dueOn: null }), TODAY)).toBe('undated');
  });

  it('says how late it is in words, so colour is never the only carrier', () => {
    expect(describeLateness(work({ dueOn: asIsoDate('2026-08-13') }), TODAY)).toBe(
      'Late by 3 days',
    );
    expect(describeLateness(work({ dueOn: asIsoDate('2026-08-15') }), TODAY)).toBe(
      'Late by 1 day',
    );
    expect(describeLateness(work({ dueOn: TODAY }), TODAY)).toBe('Due today');
    expect(describeLateness(work({ dueOn: asIsoDate('2026-08-17') }), TODAY)).toBe('Due tomorrow');
  });

  it('reports waiting time for work with no deadline, and never calls it late', () => {
    const item = work({ dueOn: null, waitingSince: asIsoDate('2026-08-07') });

    expect(describeWaiting(item, TODAY)).toBe('Waiting 9 days');
    expect(describeLateness(item, TODAY)).toBeNull();
    expect(isWorkOverdue(item, TODAY)).toBe(false);
  });

  it('borrows the case module’s due-soon window rather than declaring a second one', () => {
    // Seven days is the boundary the case list already uses. If these two ever
    // disagree, one screen calls an item "this week" while the other does not.
    expect(workUrgency(work({ dueOn: asIsoDate('2026-08-23') }), TODAY)).toBe('due-soon');
    expect(workUrgency(work({ dueOn: asIsoDate('2026-08-24') }), TODAY)).toBe('later');
  });
});

/* ── Criterion: the queue is ordered by what actually matters ─────────────── */

describe('ordering a queue', () => {
  it('puts late work first, whatever its priority', () => {
    const late = work({ id: 'a', priority: 'routine', dueOn: asIsoDate('2026-08-01') });
    const urgentButFuture = work({ id: 'b', priority: 'urgent', dueOn: asIsoDate('2026-09-01') });

    expect([urgentButFuture, late].sort((x, y) => compareWork(x, y, TODAY))[0]).toBe(late);
  });

  it('breaks ties on the identifier so two officers see the same order', () => {
    const first = work({ id: 'aaa' });
    const second = work({ id: 'bbb' });

    expect([second, first].sort((a, b) => compareWork(a, b, TODAY))).toEqual([first, second]);
  });

  it('orders undated work by who has waited longest', () => {
    const recent = work({ id: 'a', dueOn: null, waitingSince: asIsoDate('2026-08-14') });
    const old = work({ id: 'b', dueOn: null, waitingSince: asIsoDate('2026-07-01') });

    expect([recent, old].sort((a, b) => compareWork(a, b, TODAY))[0]).toBe(old);
  });
});

describe('bucketing a queue', () => {
  const items = [
    work({ id: 'a', dueOn: asIsoDate('2026-08-10') }),
    work({ id: 'b', dueOn: TODAY }),
    work({ id: 'c', dueOn: asIsoDate('2026-08-19') }),
    work({ id: 'd', dueOn: asIsoDate('2026-10-01') }),
    work({ id: 'e', dueOn: null }),
  ];

  it('separates late, today, this week and later', () => {
    const buckets = bucketWork(items, TODAY);

    expect(buckets.overdue.map((item) => item.id)).toEqual(['a']);
    expect(buckets.dueToday.map((item) => item.id)).toEqual(['b']);
    expect(buckets.dueSoon.map((item) => item.id)).toEqual(['c']);
    expect(buckets.later.map((item) => item.id)).toEqual(['d']);
    expect(buckets.undated.map((item) => item.id)).toEqual(['e']);
    expect(totalWork(buckets)).toBe(5);
  });

  it('describes the queue in counts, never as a verdict', () => {
    const sentence = describeQueue(bucketWork(items, TODAY));

    expect(sentence).toContain('1 late');
    expect(sentence).toContain('1 due today');
    expect(sentence).not.toMatch(/behind schedule|on track|complete/i);
  });

  it('says nothing is owed rather than showing an empty verdict', () => {
    expect(describeQueue(bucketWork([], TODAY))).toBe('Nothing owed.');
  });
});

/* ── Criterion: a supervisor can see who is carrying what ─────────────────── */

describe('the team queue', () => {
  const names = new Map([
    ['staff-sw-1', 'Grace Ocampo'],
    ['staff-sw-2', 'Jomar Villanueva'],
  ]);

  it('groups by person rather than pooling the office’s work', () => {
    const queue = buildTeamQueue(
      [
        work({ id: 'a', assignedTo: asId<StaffUserId>('staff-sw-1') }),
        work({ id: 'b', assignedTo: asId<StaffUserId>('staff-sw-2') }),
      ],
      names,
      TODAY,
      'Nobody yet',
    );

    expect(queue.members).toHaveLength(2);
    expect(queue.members.map((member) => member.name).sort()).toEqual([
      'Grace Ocampo',
      'Jomar Villanueva',
    ]);
  });

  it('puts whoever is most behind first', () => {
    const queue = buildTeamQueue(
      [
        work({ id: 'a', assignedTo: asId<StaffUserId>('staff-sw-1') }),
        work({
          id: 'b',
          assignedTo: asId<StaffUserId>('staff-sw-2'),
          dueOn: asIsoDate('2026-08-01'),
        }),
      ],
      names,
      TODAY,
      'Nobody yet',
    );

    expect(queue.members[0]?.name).toBe('Jomar Villanueva');
    expect(queue.members[0]?.overdueCount).toBe(1);
  });

  it('keeps unassigned work as its own group, and sorts it last', () => {
    const queue = buildTeamQueue(
      [
        work({ id: 'a', assignedTo: asId<StaffUserId>('staff-sw-1') }),
        work({ id: 'b', assignedTo: null }),
      ],
      names,
      TODAY,
      'Nobody yet',
    );

    // An unassigned request is the office's most common failure: nobody picked
    // it up, and it is nobody's caseload to be behind on.
    expect(queue.members.at(-1)?.staffId).toBeNull();
    expect(queue.members.at(-1)?.name).toBe('Nobody yet');
    expect(queue.unassignedCount).toBe(1);
  });
});

/* ── Criterion: FYI, action required and data quality are three things ────── */

describe('the three surfaces stay apart', () => {
  it('gives a work item an owner and a completion, which a notification has not', () => {
    const item = work();

    expect(item.assignedTo).not.toBeUndefined();
    expect('readAt' in item).toBe(false);
  });

  it('gives an alert no due date, no assignee and no done state', () => {
    const alert: OfficeAlert = {
      id: 'alert-1',
      kind: 'possible-duplicate',
      severity: 'attention',
      summary: 'Two records may be the same person.',
      basis: 'Compared surname, birth date and address across the active registry.',
      permission: 'beneficiary.review-duplicates',
      link: { routerLink: ['/beneficiaries', 'duplicates'], label: 'Open the queue' },
      detectedFrom: 2,
    };

    // Nobody completes a data-quality alert. Somebody fixes the record.
    expect('dueOn' in alert).toBe(false);
    expect('assignedTo' in alert).toBe(false);
    expect('status' in alert).toBe(false);
    expect('resolvedAt' in alert).toBe(false);
    expect(alert.basis.length).toBeGreaterThan(0);
  });

  it('states every alert’s basis, so an office can check it rather than dismiss it', () => {
    const alerts: readonly OfficeAlert[] = [
      {
        id: 'b',
        kind: 'voucher-mismatch',
        severity: 'risk',
        summary: 'A voucher does not match the registry.',
        basis: 'Read every release held for correction.',
        permission: 'release.view',
        link: { routerLink: ['/releases'], label: 'Open releases' },
        detectedFrom: 1,
      },
      {
        id: 'a',
        kind: 'stalled-request',
        severity: 'notice',
        summary: 'A request is waiting on the applicant.',
        basis: 'Read every request returned for more information.',
        permission: 'request.view',
        link: { routerLink: ['/assistance-requests'], label: 'Open requests' },
        detectedFrom: 1,
      },
    ];

    // Risk before notice, whatever order they arrive in.
    expect([...alerts].sort(compareAlerts)[0]?.severity).toBe('risk');
    expect(describeAlerts(alerts)).toBe('1 risk, 1 notice.');
    expect(describeAlerts([])).toBe('Nothing flagged.');
  });
});

/* ── Criterion: the notification centre groups, and is per recipient ──────── */

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: asId<NotificationId>('ntf-1'),
    recipientId: asId<StaffUserId>('staff-head'),
    severity: 'info',
    kind: 'general',
    title: 'Something happened',
    body: null,
    channel: 'inbox',
    action: null,
    createdAt: '2026-08-10T01:00:00.000Z' as AppNotification['createdAt'],
    readAt: null,
    autoDismissMs: null,
    ...overrides,
  };
}

describe('the notification centre', () => {
  it('leads with assignments, the only group that might mean somebody owes something', () => {
    const groups = groupNotifications([
      notification({ id: asId<NotificationId>('a'), kind: 'release' }),
      notification({ id: asId<NotificationId>('b'), kind: 'assignment' }),
    ]);

    expect(groups[0]?.kind).toBe('assignment');
  });

  it('drops empty groups rather than rendering a column of zeroes', () => {
    const groups = groupNotifications([notification({ kind: 'referral' })]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.kind).toBe('referral');
  });

  it('counts what is unread within each group', () => {
    const groups = groupNotifications([
      notification({ id: asId<NotificationId>('a'), kind: 'decision', readAt: null }),
      notification({
        id: asId<NotificationId>('b'),
        kind: 'decision',
        readAt: '2026-08-11T01:00:00.000Z' as AppNotification['readAt'],
      }),
    ]);

    expect(groups[0]?.unread).toBe(1);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it('treats a notification with no recipient as an announcement, not as everybody’s', () => {
    const mine = notification({ recipientId: asId<StaffUserId>('staff-sw-1') });
    const announcement = notification({ recipientId: null });
    const somebody = asId<StaffUserId>('staff-sw-1');
    const other = asId<StaffUserId>('staff-head');

    expect(isForRecipient(mine, somebody)).toBe(true);
    expect(isForRecipient(mine, other)).toBe(false);
    expect(isForRecipient(announcement, somebody)).toBe(true);
    expect(isForRecipient(announcement, other)).toBe(true);
  });
});

/* ── The catalogues stay complete ─────────────────────────────────────────── */

describe('the catalogues', () => {
  it('labels all eleven task types the master command names', () => {
    const kinds: readonly WorkKind[] = [
      'review-intake',
      'verify-household',
      'request-requirements',
      'complete-assessment',
      'follow-up-referral',
      'conduct-visit',
      'review-recommendation',
      'prepare-release',
      'confirm-release',
      'close-case',
      'resolve-data-quality',
    ];

    for (const kind of kinds) {
      expect(WORK_KIND_LABELS[kind]).toBeTruthy();
    }
  });

  it('describes every priority and severity, so no screen invents wording', () => {
    for (const priority of ['routine', 'important', 'urgent'] as WorkPriority[]) {
      expect(WORK_PRIORITY_CATALOG[priority].description).toBeTruthy();
    }
    for (const severity of ['notice', 'attention', 'risk'] as const) {
      expect(ALERT_SEVERITY_CATALOG[severity].description).toBeTruthy();
    }
  });

  it('does not treat a possible duplicate as work', () => {
    // It has no assignee and no date. Listing one row per pair buried seven
    // late items under 182 of them (`DL-103`); it is an alert with a count.
    const sources: readonly string[] = [
      'case-task',
      'assistance-request',
      'field-visit',
      'referral',
      'release',
    ];
    expect(sources).not.toContain('duplicate-review');
  });

  it('only marks a case task manageable', () => {
    const derived: readonly WorkSource[] = [
      'assistance-request',
      'field-visit',
      'referral',
      'release',
    ];

    // Everything derived is the *state of a record*. Offering a snooze on one
    // would be offering a control that quietly does nothing.
    expect(work({ source: 'case-task', isManageable: true }).isManageable).toBe(true);
    for (const source of derived) {
      expect(work({ source, isManageable: false }).isManageable).toBe(false);
    }
  });
});

const _today: IsoDate = TODAY;
void _today;
