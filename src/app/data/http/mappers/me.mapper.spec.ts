import { describe, expect, it } from 'vitest';

import ME_ADMIN from '../fixtures/me-admin.json';
import ME_RESIDENT from '../fixtures/me-resident.json';
import ME_STAFF from '../fixtures/me-staff.json';
import { toServerIdentity } from './me.mapper';

describe('toServerIdentity', () => {
  it('passes the server permissions on as sent, and computes none from the role', () => {
    expect(toServerIdentity(ME_STAFF.data)?.permissions).toEqual(ME_STAFF.data.permissions);
    expect(toServerIdentity(ME_ADMIN.data)?.permissions).toEqual(ME_ADMIN.data.permissions);
  });

  it('grants nothing to a staff account the server sent no permissions for', () => {
    expect(toServerIdentity({ ...ME_ADMIN.data, permissions: [] })?.permissions).toEqual([]);
    expect(toServerIdentity({ ...ME_ADMIN.data, permissions: undefined })?.permissions).toEqual([]);
  });

  it('labels the account by its role and nothing more', () => {
    expect(toServerIdentity(ME_STAFF.data)).toMatchObject({ roles: ['staff'], roleLabel: 'Staff' });
    // The server names an administrator's office role (DL-173); the tier stays beside it.
    expect(toServerIdentity(ME_ADMIN.data)).toMatchObject({
      roles: ['system-administrator', 'admin'],
      roleLabel: 'Administrator',
    });
  });

  it('puts the office role the server names first, and ignores one it does not know', () => {
    expect(toServerIdentity({ ...ME_STAFF.data, office_role: 'release-officer' })?.roles).toEqual([
      'release-officer',
      'staff',
    ]);
    expect(toServerIdentity({ ...ME_STAFF.data, office_role: 'treasurer' })?.roles).toEqual([
      'staff',
    ]);
  });

  it('reads the scope the server decided, and never the home barangay (DL-173)', () => {
    const staff = toServerIdentity(ME_STAFF.data);
    expect(staff?.scope).toBe('assigned-cases');
    expect(staff?.barangayId).toBeNull();
    expect(staff?.position).toBe('');

    expect(toServerIdentity(ME_ADMIN.data)?.scope).toBe('all-barangays');

    const link = toServerIdentity({
      ...ME_STAFF.data,
      barangay_id: 'where-they-live',
      office_role: 'barangay-link',
      scope: 'own-barangay',
      scope_barangay_id: 'barangay-they-serve',
    });
    expect(link?.scope).toBe('own-barangay');
    expect(link?.barangayId).toBe('barangay-they-serve');

    // A scope wider than one barangay names none, whatever else the answer carries.
    const wide = { ...ME_STAFF.data, scope: 'all-barangays', scope_barangay_id: 'stray' };
    expect(toServerIdentity(wide)?.barangayId).toBeNull();
  });

  it('fails closed to the narrowest scope on an answer it cannot trust', () => {
    expect(toServerIdentity({ ...ME_STAFF.data, scope: undefined })?.scope).toBe('assigned-cases');
    expect(toServerIdentity({ ...ME_STAFF.data, scope: 'everything' })?.scope).toBe(
      'assigned-cases',
    );
    // own-barangay with no barangay would be a scope confined to nowhere in particular.
    const unnamed = { ...ME_STAFF.data, scope: 'own-barangay', scope_barangay_id: null };
    expect(toServerIdentity(unnamed)?.scope).toBe('assigned-cases');
    expect(toServerIdentity(unnamed)?.barangayId).toBeNull();
  });

  it('refuses a resident account', () => {
    expect(toServerIdentity(ME_RESIDENT.data)).toBeNull();
    expect(toServerIdentity({ ...ME_RESIDENT.data, role: 'registered' })).toBeNull();
  });

  it('refuses a closed account, and one that does not say it is open', () => {
    expect(toServerIdentity({ ...ME_STAFF.data, closed: true })).toBeNull();
    expect(toServerIdentity({ ...ME_STAFF.data, closed: undefined })).toBeNull();
  });

  it('falls back to the email, then the role, for a name', () => {
    expect(toServerIdentity({ ...ME_STAFF.data, name: null })?.displayName).toBe(
      ME_STAFF.data.email,
    );
    expect(toServerIdentity({ ...ME_STAFF.data, name: null, email: null })?.displayName).toBe(
      'Staff',
    );
  });
});
