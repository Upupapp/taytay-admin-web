import { describe, expect, it } from 'vitest';

import { asId } from '../shared/ids';
import type { AppAccountId, OfficeId } from '../shared/ids';
import {
  ACCOUNT_ROLE_CATALOG,
  ACCOUNT_ROLE_TRANSITIONS,
  ACCOUNT_ROLES,
  isOwnAccount,
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
};

describe('an app account (DL-168)', () => {
  it('carries the minimum: no mobile, barangay, birth date or address', () => {
    expect(Object.keys(account).sort()).toEqual(['email', 'id', 'name', 'officeId', 'role']);
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
