import { describe, expect, it } from 'vitest';

import USERS_PAGE from '../fixtures/users-page.json';
import { toAppAccount } from './app-account.mapper';

describe('toAppAccount (DL-168)', () => {
  it('reads name, email, role and office — and nothing else the server sends', () => {
    const [wire] = USERS_PAGE.data;

    expect(toAppAccount(wire)).toEqual({
      id: wire?.id,
      name: 'Teresita Valdez',
      email: 'teresita.valdez@example.invalid',
      role: 'staff',
      officeId: wire?.office_id,
    });
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
