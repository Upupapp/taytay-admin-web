import { asId, type StaffUserId } from '../shared/ids';
import {
  PERMISSIONS,
  permissionsForRole,
  requireAll,
  requireAny,
  ROLE_DEFINITIONS,
  scopeForRole,
  type Permission,
  type StaffRole,
} from './permission';
import { toAuthenticatedUser, type StaffUser } from './staff-user';

const ROLES = Object.keys(ROLE_DEFINITIONS) as StaffRole[];

describe('role definitions', () => {
  it('only grants permissions that exist in the vocabulary', () => {
    for (const role of ROLES) {
      for (const permission of permissionsForRole(role)) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('gives the system administrator every permission', () => {
    expect(permissionsForRole('system-administrator')).toHaveLength(PERMISSIONS.length);
  });

  it('keeps the auditor read-only', () => {
    const writeLike: readonly Permission[] = [
      'resident.create',
      'resident.update',
      'program.manage',
      'request.approve',
      'release.release',
      'staff.manage',
      'settings.manage',
    ];
    const auditor = permissionsForRole('auditor');
    for (const permission of writeLike) {
      expect(auditor).not.toContain(permission);
    }
  });

  it('does not let a social worker approve their own endorsement', () => {
    const socialWorker = permissionsForRole('social-worker');
    expect(socialWorker).toContain('request.endorse');
    expect(socialWorker).not.toContain('request.approve');
  });

  it('separates release from approval so no one can do both alone', () => {
    for (const role of ROLES) {
      if (role === 'system-administrator') {
        continue;
      }
      const permissions = permissionsForRole(role);
      const canApprove = permissions.includes('request.approve');
      const canRelease = permissions.includes('release.release');
      expect(canApprove && canRelease).toBe(false);
    }
  });

  it('confines the barangay link to its own barangay', () => {
    expect(scopeForRole('barangay-link')).toBe('own-barangay');
    expect(scopeForRole('mswdo-head')).toBe('all-barangays');
    expect(scopeForRole('social-worker')).toBe('assigned-cases');
  });

  it('restricts sensitive-case access to roles that do casework', () => {
    for (const role of ROLES) {
      if (permissionsForRole(role).includes('request.view-sensitive')) {
        expect(['system-administrator', 'mswdo-head', 'social-worker']).toContain(role);
      }
    }
  });
});

describe('permission requirements', () => {
  it('builds every/some requirements', () => {
    expect(requireAll('report.view', 'report.export-person-level').match).toBe('every');
    expect(requireAny('report.view', 'report.export-person-level').match).toBe('some');
  });
});

describe('toAuthenticatedUser', () => {
  function staff(overrides: Partial<StaffUser> = {}): StaffUser {
    return {
      id: asId<StaffUserId>('staff-1'),
      name: { first: 'Grace', middle: 'Dimaculangan', last: 'Ocampo', suffix: null },
      email: 'grace@example.gov.ph',
      role: 'social-worker',
      position: 'Social Welfare Officer II',
      barangayId: null,
      additionalPermissions: [],
      isActive: true,
      lastSignInAt: null,
      audit: {
        createdAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['createdAt'],
        createdBy: null,
        updatedAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['updatedAt'],
        updatedBy: null,
      },
      ...overrides,
    };
  }

  it('flattens the role baseline into an effective permission set', () => {
    const user = toAuthenticatedUser(staff());
    expect(user.permissions.has('request.endorse')).toBe(true);
    expect(user.permissions.has('request.approve')).toBe(false);
    expect(user.scope).toBe('assigned-cases');
    expect(user.displayName).toBe('Grace D. Ocampo');
  });

  it('adds explicit extra grants on top of the role', () => {
    const user = toAuthenticatedUser(staff({ additionalPermissions: ['report.export-person-level'] }));
    expect(user.permissions.has('report.export-person-level')).toBe(true);
  });

  it('cannot be used to take a role permission away', () => {
    const baseline = permissionsForRole('social-worker');
    const user = toAuthenticatedUser(staff({ additionalPermissions: [] }));
    for (const permission of baseline) {
      expect(user.permissions.has(permission)).toBe(true);
    }
  });
});
