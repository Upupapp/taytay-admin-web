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
    for (const key of EVENT_KEYS) {
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

  it('adds events in full', () => {
    expect(EVENT_KEYS).toHaveLength(10);
  });

  it('holds no newsfeed key since the newsfeed was retired (DL-194)', () => {
    // Balita is the one news channel, under the server's own `news.write`.
    expect(PERMISSIONS.filter((permission) => permission.startsWith('newsfeed.'))).toEqual([]);
    expect(PERMISSIONS).toContain('news.write');
  });
});

/* ── Criterion: unauthorised admin users cannot act ───────────────────────── */

describe('who may publish', () => {
  it('gives the head the publishing authority, because an event goes out in the office’s name', () => {
    const head = permissionsForRole('mswdo-head');

    expect(head).toContain('event.publish');
    expect(head).toContain('event.cancel');
  });

  it('gives a caseworker no events key by default', () => {
    // A social worker's remit is casework. Nothing about it implies speaking
    // for the municipality.
    const socialWorker = permissionsForRole('social-worker');

    for (const key of EVENT_KEYS) {
      expect(socialWorker, `a caseworker should not hold ${key}`).not.toContain(key);
    }
  });

  it('gives an intake officer and a disbursing officer no events key', () => {
    for (const role of ['intake-officer', 'release-officer'] as const) {
      const held = permissionsForRole(role);
      for (const key of EVENT_KEYS) {
        expect(held, `${role} should not hold ${key}`).not.toContain(key);
      }
    }
  });
});

describe('the auditor stays read-only', () => {
  it('sees events and can change nothing about them, or about the news', () => {
    const auditor = permissionsForRole('auditor');

    expect(auditor).toContain('event.view');
    expect(auditor).toContain('event.view-insights');
    expect(auditor).not.toContain('event.cancel');
    expect(auditor).not.toContain('news.write');
  });

  it('is still a read-only role after the additions', () => {
    // The property that would break silently: `event.export-registrants` and
    // `event.view-insights` must be classified as reads, or adding them turns
    // oversight into a mutating role.
    expect(isReadOnlyRole('auditor')).toBe(true);
  });

  it('classifies insights and registration export as reads', () => {
    expect(READ_ONLY_PERMISSIONS).toContain('event.view-insights');
    expect(READ_ONLY_PERMISSIONS).toContain('event.export-registrants');
  });

  it('does not classify publishing or attendance as a read', () => {
    expect(READ_ONLY_PERMISSIONS).not.toContain('event.publish');
    expect(READ_ONLY_PERMISSIONS).not.toContain('news.write');
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
  // The comment acts outlived the newsfeed (`DL-194`): the API's audit trail still names every one
  // of these kinds of act, and the vocabulary is the server's as much as this console's.
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
    expect(RESIDENT_CAPABILITIES).toEqual(['events.read', 'events.register']);
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
    for (const key of EVENT_KEYS) {
      if (key === 'event.view') {
        continue;
      }
      expect(RESIDENT_MUST_NEVER, `${key} is not refused to residents`).toContain(key);
    }
    // The one news channel (`DL-171`, `DL-194`): a resident never publishes to it.
    expect(RESIDENT_MUST_NEVER).toContain('news.write');
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
      capacity: 40,
      registrationState: 'open',
      registrationWords: 'Registration is open.',
      isRegistered: false,
    };

    // A low count on a sensitive service is disclosive in a municipality this
    // size, and capacity minus a count is the same count (DL-192): where
    // registration stands is a state, never a places-left number.
    expect(event as unknown as Record<string, unknown>).not.toHaveProperty('registrationCount');
    expect(event as unknown as Record<string, unknown>).not.toHaveProperty('capacityRemaining');
    expect(event.registrationState).toBe('open');
  });

  it('offers a resident no way to publish, moderate or see a registration list', () => {
    const methods: readonly (keyof ResidentCommunityContract)[] = [
      'listPublishedEvents',
      'register',
    ];

    // An exact allow-list rather than a keyword search: `listPublishedEvents`
    // contains "published" as an adjective and is a read, so a regex over the
    // name would flag the safest method on the interface.
    expect(methods).toEqual(['listPublishedEvents', 'register']);
  });
});
