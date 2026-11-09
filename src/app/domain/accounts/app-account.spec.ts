import { describe, expect, it } from 'vitest';

import { asId } from '../shared/ids';
import type { AppAccountId, BarangayId, OfficeId } from '../shared/ids';
import { permissionsForRole, ROLE_DEFINITIONS, STAFF_ROLES } from '../access/permission';
import {
  ASSIGNABLE_OFFICE_ROLES,
  OFFICE_ROLE_ALWAYS,
  OFFICE_ROLE_EFFECTS,
  OFFICE_ROLE_REASON_MAX,
  officeRoleChangeProblems,
  takesAnOfficeRole,
  ACCOUNT_ROLE_CATALOG,
  ACCOUNT_ROLE_TRANSITIONS,
  ACCOUNT_ROLES,
  hasCheckedName,
  isOwnAccount,
  NAME_CORRECTION_EFFECTS,
  NAME_CORRECTION_MAX,
  nameCorrectionProblems,
  OFFICE_ASSIGNMENT_EFFECTS,
  ROLE_CHANGE_ALWAYS,
  ROLE_CHANGE_EFFECTS,
  takesAnOffice,
  type AppAccount,
} from './app-account';

const account: AppAccount = {
  id: asId<AppAccountId>('account-1'),
  name: 'Someone',
  email: 'someone@accounts.example.test',
  role: 'staff',
  officeId: asId<OfficeId>('office-1'),
  officeRole: null,
  scopeBarangayId: null,
};

describe('an app account (DL-168)', () => {
  it('carries the minimum: no mobile, home barangay, birth date or address', () => {
    // `scopeBarangayId` is the barangay a barangay link may see (DL-173), not where anybody lives.
    expect(Object.keys(account).sort()).toEqual([
      'email',
      'id',
      'name',
      'officeId',
      'officeRole',
      'role',
      'scopeBarangayId',
    ]);
  });

  it('defines every role once, and lets any role become any other', () => {
    for (const role of ACCOUNT_ROLES) {
      expect(ACCOUNT_ROLE_CATALOG[role].description.length).toBeGreaterThan(20);
      expect([...ACCOUNT_ROLE_TRANSITIONS[role]].sort()).toEqual(
        ACCOUNT_ROLES.filter((other) => other !== role).sort(),
      );
    }
  });

  it('knows the reader’s own account, whose role the server will not change', () => {
    expect(isOwnAccount(account, 'account-1')).toBe(true);
    expect(isOwnAccount(account, 'account-2')).toBe(false);
    expect(isOwnAccount(account, null)).toBe(false);
  });

  it('links only a staff account to an office, as the server does', () => {
    expect(takesAnOffice(account)).toBe(true);
    expect(takesAnOffice({ ...account, role: 'admin' })).toBe(false);
    expect(takesAnOffice({ ...account, role: 'verified' })).toBe(false);
  });

  it('says, for every role, what the server does — including the digital ID', () => {
    for (const role of ACCOUNT_ROLES) {
      expect(ROLE_CHANGE_EFFECTS[role].length).toBeGreaterThan(0);
    }
    for (const role of ['registered', 'staff', 'admin'] as const) {
      expect(ROLE_CHANGE_EFFECTS[role].join(' ')).toMatch(/digital ID .*revoked/);
    }
    expect(ROLE_CHANGE_EFFECTS.verified.join(' ')).toMatch(/without an ID review/);
    expect(ROLE_CHANGE_ALWAYS.join(' ')).toMatch(/next request/);
    expect(ROLE_CHANGE_ALWAYS.join(' ')).toMatch(/keeps no reason/);
    expect(OFFICE_ASSIGNMENT_EFFECTS.clear.join(' ')).toMatch(/office inbox/);
  });
});

describe('the office role (DL-173)', () => {
  const barangay = asId<BarangayId>('barangay-1');

  it('names the same seven roles as the role map', () => {
    expect([...STAFF_ROLES].sort()).toEqual(Object.keys(ROLE_DEFINITIONS).sort());
  });

  it('offers every role but the system administrator, and none that both approves and releases', () => {
    expect(ASSIGNABLE_OFFICE_ROLES).toEqual(STAFF_ROLES.filter((role) => role !== 'system-administrator'));
    for (const role of ASSIGNABLE_OFFICE_ROLES) {
      const held = permissionsForRole(role);
      expect(held.includes('request.approve') && held.includes('release.release'), role).toBe(false);
    }
  });

  it('is given to staff only', () => {
    expect(takesAnOfficeRole(account)).toBe(true);
    for (const role of ['registered', 'verified', 'admin'] as const) {
      expect(takesAnOfficeRole({ ...account, role })).toBe(false);
    }
  });

  it('says why the server would refuse a change, before it is sent', () => {
    expect(officeRoleChangeProblems({ role: 'auditor', barangayId: null, reason: 'Oversight.' })).toEqual([]);
    expect(officeRoleChangeProblems({ role: null, barangayId: null, reason: 'Left the office.' })).toEqual([]);
    expect(
      officeRoleChangeProblems({ role: 'barangay-link', barangayId: barangay, reason: 'Encoder.' }),
    ).toEqual([]);

    expect(officeRoleChangeProblems({ role: 'auditor', barangayId: null, reason: '   ' })).toHaveLength(1);
    const long = 'x'.repeat(OFFICE_ROLE_REASON_MAX + 1);
    expect(officeRoleChangeProblems({ role: 'auditor', barangayId: null, reason: long })).toHaveLength(1);
    expect(
      officeRoleChangeProblems({ role: 'system-administrator', barangayId: null, reason: 'All.' }),
    ).toHaveLength(1);
    expect(
      officeRoleChangeProblems({ role: 'barangay-link', barangayId: null, reason: 'Encoder.' }),
    ).toHaveLength(1);
    expect(
      officeRoleChangeProblems({ role: 'intake-officer', barangayId: barangay, reason: 'Counter.' }),
    ).toHaveLength(1);
  });

  it('says what the server does, and that it keeps the reason', () => {
    expect(OFFICE_ROLE_EFFECTS.assign.join(' ')).toMatch(/next request/);
    expect(OFFICE_ROLE_EFFECTS.clear.join(' ')).toMatch(/every casework permission/);
    expect(OFFICE_ROLE_ALWAYS.join(' ')).toMatch(/keeps your reason/);
    expect(OFFICE_ROLE_ALWAYS.join(' ')).toMatch(/approve a request and release its money/);
    expect(ROLE_CHANGE_ALWAYS.join(' ')).toMatch(/office role is not kept/);
  });
});

describe('correcting a verified account’s name (DL-198)', () => {
  const verified: AppAccount = {
    id: asId<AppAccountId>('account-v'),
    name: 'Ana Cruz',
    email: null,
    role: 'verified',
    officeId: null,
    officeRole: null,
    scopeBarangayId: null,
  };

  it('is the office’s only for a verified account with a name', () => {
    expect(hasCheckedName(verified)).toBe(true);
    expect(hasCheckedName({ ...verified, role: 'registered' })).toBe(false);
    expect(hasCheckedName({ ...verified, role: 'staff' })).toBe(false);
    expect(hasCheckedName({ ...verified, name: null })).toBe(false);
  });

  it('refuses an empty name, a long one and the same one, before anything is sent', () => {
    expect(nameCorrectionProblems(verified, '   ')).toHaveLength(1);
    expect(nameCorrectionProblems(verified, 'x'.repeat(NAME_CORRECTION_MAX + 1))).toHaveLength(1);
    expect(nameCorrectionProblems(verified, ' Ana Cruz ')).toEqual(['That is already the account’s name.']);
    expect(nameCorrectionProblems(verified, 'Ana Cruz Reyes')).toEqual([]);
  });

  it('says before the button that the earlier name is kept and the ID is not reviewed again', () => {
    const said = NAME_CORRECTION_EFFECTS.join(' ');
    expect(said).toMatch(/earlier name is kept/);
    expect(said).toMatch(/not reviewed again/);
    expect(said).toMatch(/keeps no reason/);
  });
});
