import { describe, expect, it } from 'vitest';

import ME_ADMIN from '../fixtures/me-admin.json';
import ME_RESIDENT from '../fixtures/me-resident.json';
import ME_STAFF from '../fixtures/me-staff.json';
import { confinesToOneBarangay, toServerIdentity } from './me.mapper';
import { toBarangayIndex } from './resident.mapper';

/** The API's ids for two barangays, joined to the console's by name as `GET barangays` is. */
const BARANGAYS = toBarangayIndex([
  { id: 'api-san-juan', name: 'San Juan' },
  { id: 'api-dolores', name: 'Dolores' },
]);

describe('toServerIdentity', () => {
  it('passes the server permissions on as sent, and computes none from the role', () => {
    expect(toServerIdentity(ME_STAFF.data, null)?.permissions).toEqual(ME_STAFF.data.permissions);
    expect(toServerIdentity(ME_ADMIN.data, null)?.permissions).toEqual(ME_ADMIN.data.permissions);
  });

  it('grants nothing to a staff account the server sent no permissions for', () => {
    expect(toServerIdentity({ ...ME_ADMIN.data, permissions: [] }, null)?.permissions).toEqual([]);
    expect(
      toServerIdentity({ ...ME_ADMIN.data, permissions: undefined }, null)?.permissions,
    ).toEqual([]);
  });

  it('labels the account by its role and nothing more', () => {
    expect(toServerIdentity(ME_STAFF.data, null)).toMatchObject({
      roles: ['staff'],
      roleLabel: 'Staff',
    });
    // The server names an administrator's office role (DL-173); the tier stays beside it.
    expect(toServerIdentity(ME_ADMIN.data, null)).toMatchObject({
      roles: ['system-administrator', 'admin'],
      roleLabel: 'Administrator',
    });
  });

  it('puts the office role the server names first, and ignores one it does not know', () => {
    expect(
      toServerIdentity({ ...ME_STAFF.data, office_role: 'release-officer' }, null)?.roles,
    ).toEqual(['release-officer', 'staff']);
    expect(toServerIdentity({ ...ME_STAFF.data, office_role: 'treasurer' }, null)?.roles).toEqual([
      'staff',
    ]);
  });

  it('reads the scope the server decided, and never the home barangay (DL-173)', () => {
    const staff = toServerIdentity(ME_STAFF.data, null);
    expect(staff?.scope).toBe('assigned-cases');
    expect(staff?.barangayId).toBeNull();
    expect(staff?.position).toBe('');

    expect(toServerIdentity(ME_ADMIN.data, null)?.scope).toBe('all-barangays');

    const linkWire = {
      ...ME_STAFF.data,
      barangay_id: 'api-dolores',
      office_role: 'barangay-link',
      scope: 'own-barangay',
      scope_barangay_id: 'api-san-juan',
    };
    expect(confinesToOneBarangay(linkWire)).toBe(true);
    const link = toServerIdentity(linkWire, BARANGAYS);
    expect(link?.scope).toBe('own-barangay');
    // The console's id, not the API's: kept as sent it named no barangay the console knew, and the
    // footer read "Barangay Unknown barangay" (dry run 2026-11-09, defect 3).
    expect(link?.barangayId).toBe('brgy-san-juan');

    // A scope wider than one barangay names none, whatever else the answer carries.
    const wide = { ...ME_STAFF.data, scope: 'all-barangays', scope_barangay_id: 'api-san-juan' };
    expect(confinesToOneBarangay(wide)).toBe(false);
    expect(toServerIdentity(wide, BARANGAYS)?.barangayId).toBeNull();
  });

  it('reads a barangay the join cannot place, or that was never translated, as the narrowest scope', () => {
    const link = { ...ME_STAFF.data, scope: 'own-barangay', scope_barangay_id: 'api-san-juan' };
    const elsewhere = { ...link, scope_barangay_id: 'api-not-in-taytay' };
    expect(toServerIdentity(elsewhere, BARANGAYS)).toMatchObject({
      scope: 'assigned-cases',
      barangayId: null,
    });
    expect(toServerIdentity(link, null)).toMatchObject({
      scope: 'assigned-cases',
      barangayId: null,
    });
  });

  it('fails closed to the narrowest scope on an answer it cannot trust', () => {
    expect(toServerIdentity({ ...ME_STAFF.data, scope: undefined }, null)?.scope).toBe(
      'assigned-cases',
    );
    expect(toServerIdentity({ ...ME_STAFF.data, scope: 'everything' }, null)?.scope).toBe(
      'assigned-cases',
    );
    // own-barangay with no barangay would be a scope confined to nowhere in particular.
    const unnamed = { ...ME_STAFF.data, scope: 'own-barangay', scope_barangay_id: null };
    expect(toServerIdentity(unnamed, null)?.scope).toBe('assigned-cases');
    expect(toServerIdentity(unnamed, null)?.barangayId).toBeNull();
  });

  it('refuses a resident account', () => {
    expect(toServerIdentity(ME_RESIDENT.data, null)).toBeNull();
    expect(toServerIdentity({ ...ME_RESIDENT.data, role: 'registered' }, null)).toBeNull();
  });

  it('refuses a closed account, and one that does not say it is open', () => {
    expect(toServerIdentity({ ...ME_STAFF.data, closed: true }, null)).toBeNull();
    expect(toServerIdentity({ ...ME_STAFF.data, closed: undefined }, null)).toBeNull();
  });

  it('refuses an account the office switched off, and one that does not say it is on (DL-191)', () => {
    expect(toServerIdentity(ME_STAFF.data, null)).not.toBeNull();
    expect(toServerIdentity({ ...ME_STAFF.data, deactivated: true }, null)).toBeNull();
    expect(toServerIdentity({ ...ME_STAFF.data, deactivated: undefined }, null)).toBeNull();
    expect(toServerIdentity({ ...ME_ADMIN.data, deactivated: true }, null)).toBeNull();
  });

  it('falls back to the email, then the role, for a name', () => {
    expect(toServerIdentity({ ...ME_STAFF.data, name: null }, null)?.displayName).toBe(
      ME_STAFF.data.email,
    );
    expect(toServerIdentity({ ...ME_STAFF.data, name: null, email: null }, null)?.displayName).toBe(
      'Staff',
    );
  });
});
