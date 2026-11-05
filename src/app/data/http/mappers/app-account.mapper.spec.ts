import { describe, expect, it } from 'vitest';

import { asId, type BarangayId } from '@domain/index';

import USER_OFFICE_ROLE_CHANGED from '../fixtures/user-office-role-changed.json';
import USERS_PAGE from '../fixtures/users-page.json';
import { toAccountBarangay, toAppAccount, toWireOfficeRoleChange } from './app-account.mapper';

describe('toAppAccount (DL-168)', () => {
  it('reads name, email, role and office — and nothing else the server sends', () => {
    const [wire] = USERS_PAGE.data;

    expect(toAppAccount(wire)).toEqual({
      id: wire?.id,
      name: 'Teresita Valdez',
      email: 'teresita.valdez@example.invalid',
      role: 'staff',
      officeId: wire?.office_id,
      officeRole: 'social-worker',
      scopeBarangayId: null,
    });
  });

  it('reads the office role and the barangay a barangay link is confined to (DL-173)', () => {
    const account = toAppAccount(USER_OFFICE_ROLE_CHANGED.data);

    expect(account?.officeRole).toBe('barangay-link');
    expect(account?.scopeBarangayId).toBe(USER_OFFICE_ROLE_CHANGED.data.scope_barangay_id);
    // Still not the home barangay: the scope is what the account may see, not where it lives.
    const [wire] = USERS_PAGE.data;
    expect(JSON.stringify(toAppAccount({ ...wire, barangay_id: 'home-barangay' }))).not.toContain(
      'home-barangay',
    );
  });

  it('reads an office role it does not know as none, rather than guessing', () => {
    const [wire] = USERS_PAGE.data;

    expect(toAppAccount({ ...wire, office_role: 'treasurer' })?.officeRole).toBeNull();
    expect(toAppAccount({ ...wire, office_role: undefined })?.officeRole).toBeNull();
  });

  it('reads an account with no name, email or office as said, not as blank', () => {
    const account = toAppAccount(USERS_PAGE.data[1]);

    expect(account?.name).toBeNull();
    expect(account?.officeId).toBeNull();
  });

  it('refuses an account with no id, or a role it cannot change', () => {
    const [wire] = USERS_PAGE.data;

    expect(toAppAccount({ ...wire, id: null })).toBeNull();
    expect(toAppAccount({ ...wire, role: 'guest' })).toBeNull();
    expect(toAppAccount({ ...wire, role: 'auditor' })).toBeNull();
  });
});

describe('toWireOfficeRoleChange (DL-173)', () => {
  it('sends the role, the barangay and the reason, trimmed, and nothing else', () => {
    const barangay = asId<BarangayId>('7d1e0c55-2f6a-4b8e-9c3d-5a6b7c8d9e01');

    expect(
      toWireOfficeRoleChange({ role: 'barangay-link', barangayId: barangay, reason: ' Why. ' }),
    ).toEqual({ office_role: 'barangay-link', scope_barangay_id: barangay, reason: 'Why.' });
    expect(toWireOfficeRoleChange({ role: null, barangayId: null, reason: 'Left.' })).toEqual({
      office_role: null,
      scope_barangay_id: null,
      reason: 'Left.',
    });
  });
});

describe('toAccountBarangay (DL-173)', () => {
  it('reads an id and a name, and refuses a barangay without either', () => {
    expect(toAccountBarangay({ id: 'b-1', code: 'SJ', name: 'San Juan' })).toEqual({
      id: 'b-1',
      name: 'San Juan',
    });
    expect(toAccountBarangay({ id: null, name: 'San Juan' })).toBeNull();
    expect(toAccountBarangay({ id: 'b-1', name: null })).toBeNull();
  });
});
