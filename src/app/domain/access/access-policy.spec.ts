import { asId, type BarangayId, type StaffUserId } from '../shared/ids';
import {
  assertPermission,
  canReadRecord,
  isPermissionDenied,
  isWithinBarangayScope,
  PermissionDeniedError,
  userHasPermission,
} from './access-policy';
import { ROLE_DEFINITIONS, type Permission, type StaffRole } from './permission';
import type { AuthenticatedUser } from './staff-user';

function user(role: StaffRole, barangayId: BarangayId | null = null): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id: asId<StaffUserId>('staff-x'),
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
}

const SAN_JUAN = asId<BarangayId>('brgy-san-juan');
const DOLORES = asId<BarangayId>('brgy-dolores');

describe('userHasPermission', () => {
  it('grants what the role holds', () => {
    expect(userHasPermission(user('mswdo-head'), 'request.approve')).toBe(true);
  });

  it('denies what the role lacks', () => {
    expect(userHasPermission(user('social-worker'), 'request.approve')).toBe(false);
  });

  it('treats anonymous as holding nothing', () => {
    expect(userHasPermission(null, 'dashboard.view')).toBe(false);
  });
});

describe('assertPermission', () => {
  it('passes silently when permitted', () => {
    expect(() => assertPermission(user('mswdo-head'), 'request.approve')).not.toThrow();
  });

  it('throws PermissionDeniedError when not', () => {
    expect(() => assertPermission(user('auditor'), 'request.approve')).toThrow(
      PermissionDeniedError,
    );
  });

  it('carries the required permission but no record detail', () => {
    // The whole point: a denial must not disclose what was being reached for.
    try {
      assertPermission(user('auditor'), 'request.approve');
      throw new Error('should have thrown');
    } catch (error) {
      expect(isPermissionDenied(error)).toBe(true);
      const denial = error as PermissionDeniedError;
      expect(denial.requiredPermission).toBe('request.approve');
      expect(denial.message).toBe('You do not have permission to do that.');
      // No id, no name, no field value anywhere in the serialised error.
      expect(JSON.stringify({ m: denial.message })).not.toMatch(/res-|req-|brgy-/);
    }
  });
});

describe('isWithinBarangayScope', () => {
  it('lets a municipality-wide role see every barangay', () => {
    expect(isWithinBarangayScope(user('mswdo-head'), DOLORES)).toBe(true);
    expect(isWithinBarangayScope(user('intake-officer'), SAN_JUAN)).toBe(true);
  });

  it('confines a barangay link to its own barangay', () => {
    const link = user('barangay-link', SAN_JUAN);
    expect(isWithinBarangayScope(link, SAN_JUAN)).toBe(true);
    expect(isWithinBarangayScope(link, DOLORES)).toBe(false);
  });

  it('confines a barangay link with no barangay set to nothing', () => {
    // Fail closed: an unconfigured scoped account sees nothing, rather than
    // everything.
    expect(isWithinBarangayScope(user('barangay-link', null), SAN_JUAN)).toBe(false);
  });

  it('does not treat assigned-cases as a geographic restriction', () => {
    // A social worker's caseload is decided per record, so scope alone cannot
    // answer it and must not silently filter by barangay.
    expect(isWithinBarangayScope(user('social-worker'), DOLORES)).toBe(true);
  });

  it('denies anonymous', () => {
    expect(isWithinBarangayScope(null, SAN_JUAN)).toBe(false);
  });
});

describe('canReadRecord', () => {
  it('requires both the permission and the scope', () => {
    const link = user('barangay-link', SAN_JUAN);
    expect(canReadRecord(link, 'resident.view', SAN_JUAN)).toBe(true);
    // Right permission, wrong barangay.
    expect(canReadRecord(link, 'resident.view', DOLORES)).toBe(false);
    // Right barangay, missing permission.
    expect(canReadRecord(link, 'staff.manage', SAN_JUAN)).toBe(false);
  });
});
