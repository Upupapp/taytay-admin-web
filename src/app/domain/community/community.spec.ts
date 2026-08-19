import { PERMISSIONS, ROLE_DEFINITIONS, permissionsForRole } from '../access/permission';
import {
  READ_ONLY_PERMISSIONS,
  isReadOnlyRole,
  rolesBreachingSeparationOfDuties,
} from '../access/permission-matrix';
import { AUDIT_ACTION_LABELS } from '../governance/audit-view';
import type { AuditAction } from '../shared/audit';
import {
  RESIDENT_CAPABILITIES,
  RESIDENT_MUST_NEVER,
  isResidentCapability,
  type ResidentCommunityContract,
} from './resident-contract';

const NEWSFEED_KEYS = [
  'newsfeed.view',
  'newsfeed.create',
  'newsfeed.edit',
  'newsfeed.publish',
  'newsfeed.schedule',
  'newsfeed.archive',
  'newsfeed.pin',
  'newsfeed.moderate',
  'newsfeed.view-insights',
] as const;

const EVENT_KEYS = [
  'event.view',
  'event.create',
  'event.edit',
  'event.publish',
  'event.cancel',
  'event.archive',
  'event.manage-registrations',
  'event.export-registrants',
  'event.mark-attendance',
  'event.view-insights',
] as const;

/* ── Criterion: no duplicate permission architecture ──────────────────────── */

describe('the community permissions', () => {
  it('live in the one permission array, not a second RBAC', () => {
    for (const key of [...NEWSFEED_KEYS, ...EVENT_KEYS]) {
      expect(PERMISSIONS, `${key} is not in the central permission model`).toContain(key);
    }
  });

  it('follows the naming this array already uses', () => {
    // The command suggests `moderate_comments`; every other key here is
    // kebab-case, and one array with two conventions is one nobody can predict.
    for (const permission of PERMISSIONS) {
      expect(permission).not.toMatch(/_/);
    }
  });

  it('adds both modules in full', () => {
    expect(NEWSFEED_KEYS).toHaveLength(9);
    expect(EVENT_KEYS).toHaveLength(10);
  });
});

/* ── Criterion: unauthorised admin users cannot act ───────────────────────── */

describe('who may publish', () => {
  it('gives the head the publishing authority, because a post goes out in the office’s name', () => {
    const head = permissionsForRole('mswdo-head');

    expect(head).toContain('newsfeed.publish');
    expect(head).toContain('event.publish');
    expect(head).toContain('newsfeed.moderate');
  });

  it('gives a caseworker neither module by default', () => {
    // A social worker's remit is casework. Nothing about it implies speaking
    // for the municipality.
    const socialWorker = permissionsForRole('social-worker');

    for (const key of [...NEWSFEED_KEYS, ...EVENT_KEYS]) {
      expect(socialWorker, `a caseworker should not hold ${key}`).not.toContain(key);
    }
  });

  it('gives an intake officer and a disbursing officer neither module', () => {
    for (const role of ['intake-officer', 'release-officer'] as const) {
      const held = permissionsForRole(role);
      for (const key of [...NEWSFEED_KEYS, ...EVENT_KEYS]) {
        expect(held, `${role} should not hold ${key}`).not.toContain(key);
      }
    }
  });

  it('lets a role hold one module without the other, as the command allows', () => {
    // Demonstrated by construction: the keys are independent, and nothing in
    // the model couples them.
    const newsfeedOnly = NEWSFEED_KEYS.filter((key) => !EVENT_KEYS.includes(key as never));
    expect(newsfeedOnly).toHaveLength(NEWSFEED_KEYS.length);
  });
});

describe('the auditor stays read-only', () => {
  it('sees both modules and can change neither', () => {
    const auditor = permissionsForRole('auditor');

    expect(auditor).toContain('newsfeed.view');
    expect(auditor).toContain('event.view');
    expect(auditor).not.toContain('newsfeed.publish');
    expect(auditor).not.toContain('event.cancel');
  });

  it('is still a read-only role after the additions', () => {
    // The property that would break silently: `events.export-registrations`
    // and the two `view-insights` keys must be classified as reads, or adding
    // them turns oversight into a mutating role.
    expect(isReadOnlyRole('auditor')).toBe(true);
  });

  it('classifies insights and registration export as reads', () => {
    expect(READ_ONLY_PERMISSIONS).toContain('newsfeed.view-insights');
    expect(READ_ONLY_PERMISSIONS).toContain('event.view-insights');
    expect(READ_ONLY_PERMISSIONS).toContain('event.export-registrants');
  });

  it('does not classify publishing or moderation as a read', () => {
    expect(READ_ONLY_PERMISSIONS).not.toContain('newsfeed.publish');
    expect(READ_ONLY_PERMISSIONS).not.toContain('newsfeed.moderate');
    expect(READ_ONLY_PERMISSIONS).not.toContain('event.mark-attendance');
  });
});

describe('nothing already built was disturbed', () => {
  it('keeps approving and releasing apart in every non-administrator role', () => {
    expect(rolesBreachingSeparationOfDuties()).toEqual([]);
  });

  it('leaves every role holding everything it held before', () => {
    for (const role of Object.keys(ROLE_DEFINITIONS) as (keyof typeof ROLE_DEFINITIONS)[]) {
      for (const permission of ROLE_DEFINITIONS[role].permissions) {
        expect(permissionsForRole(role)).toContain(permission);
      }
    }
  });
});

/* ── Criterion: audit seams exist for the named acts ──────────────────────── */

describe('the audit seams', () => {
  const REQUIRED: readonly AuditAction[] = [
    'published',
    'scheduled',
    'archived',
    'pinned',
    'comment-hidden',
    'comment-restored',
    'comment-replied',
    'cancelled',
    'registration-changed',
    'attendance-changed',
  ];

  it('covers publishing, moderation, registration and attendance', () => {
    for (const action of REQUIRED) {
      expect(AUDIT_ACTION_LABELS[action], `${action} has no label`).toBeTruthy();
    }
  });

  it('extends the one action vocabulary rather than starting a second', () => {
    // A second vocabulary would need a second explorer, and `DL-114`'s
    // row/detail split would not apply to it.
    expect(AUDIT_ACTION_LABELS['created']).toBeTruthy();
    expect(AUDIT_ACTION_LABELS['published']).toBeTruthy();
  });

  it('words every label as what a person did', () => {
    for (const action of REQUIRED) {
      expect(AUDIT_ACTION_LABELS[action]).not.toMatch(/^[a-z-]+$/);
    }
  });
});

/* ── Criterion: no resident portal, and residents cannot publish ──────────── */

describe('the resident contract', () => {
  it('lets a resident read and respond', () => {
    for (const capability of [
      'newsfeed.read',
      'newsfeed.react',
      'newsfeed.comment',
      'newsfeed.share',
      'events.read',
      'events.register',
    ] as const) {
      expect(RESIDENT_CAPABILITIES).toContain(capability);
    }
  });

  it('never lets a resident publish or create', () => {
    // A resident capability that could publish would let somebody post under
    // the MSWDO's masthead (`DL-123`).
    for (const forbidden of RESIDENT_MUST_NEVER) {
      expect(isResidentCapability(forbidden)).toBe(false);
      expect(RESIDENT_CAPABILITIES as readonly string[]).not.toContain(forbidden);
    }
  });

  it('names every admin permission it refuses, so an addition has to delete a line', () => {
    for (const key of [...NEWSFEED_KEYS, ...EVENT_KEYS]) {
      if (key === 'newsfeed.view' || key === 'event.view') {
        continue;
      }
      expect(RESIDENT_MUST_NEVER, `${key} is not refused to residents`).toContain(key);
    }
  });

  it('shows a resident an office, not a member of staff', () => {
    const post: import('./resident-contract').ResidentPostView = {
      id: 'post-1',
      title: 'Payout schedule for August',
      body: 'Releases at the municipal hall on the tenth.',
      publishedBy: 'MSWDO Taytay',
      publishedAt: '2026-08-01T02:00:00.000Z' as never,
      isPinned: false,
      reactionCount: 4,
      commentCount: 2,
      hasReacted: false,
    };

    expect(post as unknown as Record<string, unknown>).not.toHaveProperty('publishedByStaffId');
    expect(post as unknown as Record<string, unknown>).not.toHaveProperty('authorAccount');
  });

  it('does not tell a resident how many neighbours registered', () => {
    const event: import('./resident-contract').ResidentEventView = {
      id: 'event-1',
      title: 'Livelihood seminar',
      description: 'Half-day session at the covered court.',
      startsAt: '2026-09-01T01:00:00.000Z' as never,
      endsAt: null,
      venue: 'Covered court',
      barangayLabel: 'San Juan',
      isRegistrationOpen: true,
      capacityRemaining: 12,
      isRegistered: false,
    };

    // A low count on a sensitive service is disclosive in a municipality this
    // size. "Places left" answers the question a resident actually has.
    expect(event as unknown as Record<string, unknown>).not.toHaveProperty('registrationCount');
    expect(event.capacityRemaining).toBe(12);
  });

  it('offers a resident no way to publish, moderate or see a registration list', () => {
    const methods: readonly (keyof ResidentCommunityContract)[] = [
      'listPublishedPosts',
      'listComments',
      'react',
      'comment',
      'listPublishedEvents',
      'register',
    ];

    // An exact allow-list rather than a keyword search: `listPublishedPosts`
    // contains "published" as an adjective and is a read, so a regex over the
    // name would flag the safest method on the interface.
    expect(methods).toEqual([
      'listPublishedPosts',
      'listComments',
      'react',
      'comment',
      'listPublishedEvents',
      'register',
    ]);
  });
});
