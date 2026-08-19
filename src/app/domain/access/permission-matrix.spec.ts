import { PERMISSIONS, ROLE_DEFINITIONS, type Permission } from './permission';
import {
  ALL_ROLES,
  isReadOnlyRole,
  MUTATING_PERMISSIONS,
  orphanPermissions,
  PERMISSION_MATRIX,
  roleGrants,
  rolesBreachingSeparationOfDuties,
  rolesWith,
  scopeOf,
} from './permission-matrix';

describe('permission matrix', () => {
  it('covers every role', () => {
    expect(ALL_ROLES).toHaveLength(Object.keys(ROLE_DEFINITIONS).length);
    for (const role of ALL_ROLES) {
      expect(PERMISSION_MATRIX[role]).toBeDefined();
    }
  });

  it('derives from the role definitions rather than duplicating them', () => {
    for (const role of ALL_ROLES) {
      const declared = new Set(ROLE_DEFINITIONS[role].permissions);
      expect(PERMISSION_MATRIX[role].size).toBe(declared.size);
      for (const permission of declared) {
        expect(roleGrants(role, permission)).toBe(true);
      }
    }
  });

  it('leaves no permission unreachable by every role', () => {
    // A permission nobody holds is either dead weight or a gate someone forgot
    // to open. Either way it should not exist silently.
    expect(orphanPermissions()).toEqual([]);
  });

  it('grants no permission outside the declared vocabulary', () => {
    for (const role of ALL_ROLES) {
      for (const permission of PERMISSION_MATRIX[role]) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('keeps approval and release apart for every case-working role', () => {
    // DL-08. system-administrator is the documented break-glass exception.
    expect(rolesBreachingSeparationOfDuties()).toEqual([]);
  });

  it('identifies the auditor as read-only', () => {
    expect(isReadOnlyRole('auditor')).toBe(true);
    expect(isReadOnlyRole('mswdo-head')).toBe(false);
    expect(isReadOnlyRole('intake-officer')).toBe(false);
  });

  it('classifies mutating permissions sensibly', () => {
    expect(MUTATING_PERMISSIONS).toContain('request.approve' as Permission);
    expect(MUTATING_PERMISSIONS).toContain('release.release' as Permission);
    expect(MUTATING_PERMISSIONS).not.toContain('resident.view' as Permission);
  });

  it('does not mistake a read for a change because of how it is spelled', () => {
    // `document.download` reads a file and alters nothing. Under the name-shape
    // rule this replaced, it counted as mutating and made the auditor — a
    // read-only role by definition — look like one that could change records.
    expect(MUTATING_PERMISSIONS).not.toContain('document.download' as Permission);
    expect(MUTATING_PERMISSIONS).not.toContain('document.view-full-number' as Permission);
    // And recording one is still a change.
    expect(MUTATING_PERMISSIONS).toContain('document.record' as Permission);
  });

  it('answers who holds a permission', () => {
    const approvers = rolesWith('request.approve');
    expect(approvers).toContain('mswdo-head');
    expect(approvers).not.toContain('social-worker');

    const releasers = rolesWith('release.release');
    expect(releasers).toContain('release-officer');
    expect(releasers).not.toContain('mswdo-head');
  });

  it('confines the barangay link and nobody else', () => {
    expect(scopeOf('barangay-link')).toBe('own-barangay');
    for (const role of ALL_ROLES) {
      if (role !== 'barangay-link') {
        expect(scopeOf(role)).not.toBe('own-barangay');
      }
    }
  });

  it('restricts sensitive-record access to casework roles', () => {
    for (const role of rolesWith('request.view-sensitive')) {
      expect(['system-administrator', 'mswdo-head', 'social-worker']).toContain(role);
    }
  });

  it('gives every role the dashboard, so no one signs in to a dead end', () => {
    for (const role of ALL_ROLES) {
      expect(roleGrants(role, 'dashboard.view')).toBe(true);
    }
  });
});
