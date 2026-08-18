import { fromServerIdentity, type ServerIdentity } from './staff-user';
import type { BarangayId, StaffUserId } from '../shared/ids';

/**
 * The console renders from what `GET /api/v1/me` resolved.
 *
 * Before TAB 03 it computed permissions locally from `ROLE_DEFINITIONS`, which
 * meant two authorities: with 21 of 68 keys in common and no shared role names,
 * the console would have hidden things the server allows and shown things it
 * refuses — from the first authenticated page load.
 */

function identity(overrides: Partial<ServerIdentity> = {}): ServerIdentity {
  return {
    id: 'staff-1' as StaffUserId,
    displayName: 'Ana Reyes',
    email: 'ana.reyes@taytay.gov.ph',
    roles: ['social-worker'],
    roleLabel: 'Staff',
    position: 'Social Welfare Officer II',
    barangayId: null,
    scope: 'own-barangay',
    permissions: ['resident.view', 'case.view'],
    ...overrides,
  };
}

describe('fromServerIdentity', () => {
  it('grants exactly what the server sent', () => {
    const user = fromServerIdentity(identity());

    expect([...user.permissions].sort()).toEqual(['case.view', 'resident.view']);
  });

  it('grants nothing the role map would have added', () => {
    // A social worker's local baseline is far wider than these two keys. If the
    // map were still consulted, this set would not be two.
    const user = fromServerIdentity(identity({ permissions: ['resident.view'] }));

    expect(user.permissions.size).toBe(1);
    expect(user.permissions.has('resident.view')).toBe(true);
    expect(user.permissions.has('case.view')).toBe(false);
  });

  it('ignores a key it does not know, and records it', () => {
    // Fail closed: an unrecognised key guards nothing here, so honouring it
    // would grant something no screen has been reasoned about.
    const user = fromServerIdentity(
      identity({ permissions: ['resident.view', 'kyc.approve', 'something.invented'] }),
    );

    expect(user.permissions.has('resident.view')).toBe(true);
    expect(user.permissions.size).toBe(1);
    expect(user.unknownPermissions).toEqual(['kyc.approve', 'something.invented']);
  });

  it('hides a feature whose key the server never sent', () => {
    // The other direction of failing closed.
    const user = fromServerIdentity(identity({ permissions: [] }));

    expect(user.permissions.size).toBe(0);
    expect(user.unknownPermissions).toEqual([]);
  });

  it('keeps the role for presentation only', () => {
    const user = fromServerIdentity(identity({ roles: ['social-worker'] }));

    expect(user.role).toBe('social-worker');
    // The label comes from the map because it is a display string. Nothing
    // about what the user may *do* comes from it.
    expect(user.roleLabel).not.toBe('');
  });

  it('survives a role name this console has never heard of', () => {
    // The backend has eight roles, three of which have no MSWDO counterpart and
    // guard surfaces this console does not render. Meeting one must not throw.
    const user = fromServerIdentity(identity({ roles: ['operations_engineer'], permissions: ['resident.view'] }));

    expect(user.permissions.has('resident.view')).toBe(true);
  });

  it('carries the barangay the server assigned', () => {
    const user = fromServerIdentity(identity({ barangayId: 'brgy-dolores' as BarangayId }));

    expect(user.barangayId).toBe('brgy-dolores');
  });
});
