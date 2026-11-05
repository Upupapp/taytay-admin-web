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
    expect(toServerIdentity(ME_ADMIN.data)).toMatchObject({
      roles: ['admin'],
      roleLabel: 'Administrator',
    });
  });

  it('takes the narrowest scope and never the home barangay', () => {
    const identity = toServerIdentity(ME_STAFF.data);

    expect(identity?.scope).toBe('assigned-cases');
    expect(identity?.barangayId).toBeNull();
    expect(identity?.position).toBe('');
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
