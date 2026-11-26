import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import { UNSERVED_PORTS, type DataPort, type DataScope, type Permission } from '@domain/index';

import { MenuReach } from './menu-reach';

function reach(
  granted: readonly Permission[],
  unserved: readonly DataPort[] = [],
  scope: DataScope = 'all-barangays',
): MenuReach {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: UNSERVED_PORTS, useValue: unserved },
      { provide: SessionStore, useValue: { user: signal({ scope }) } },
      {
        provide: PermissionService,
        useValue: { can: (permission: Permission) => signal(granted.includes(permission)) },
      },
    ],
  });
  return TestBed.inject(MenuReach);
}

describe('MenuReach — a figure links only where the menu would (DL-273, rule 8)', () => {
  it('offers a screen whose entry the reader holds a permission for', () => {
    expect(reach(['user.view']).canOpen('/users')).toBe(true);
    expect(reach(['digital-id.verify']).canOpen('/digital-ids')).toBe(true);
  });

  it('refuses one without the permission, with a port unserved, or closed to the scope', () => {
    expect(reach([]).canOpen('/users')).toBe(false);
    expect(reach(['user.view'], ['app-account']).canOpen('/users')).toBe(false);
    expect(reach(['resident.view'], [], 'assigned-cases').canOpen('/residents')).toBe(false);
    expect(reach(['resident.view']).canOpen('/residents')).toBe(true);
  });

  // Flow audit 5: a social worker was offered Beneficiaries and met the API's caseload refusal.
  it('does not offer a caseload the beneficiary registry the API refuses it (DL-290)', () => {
    expect(reach(['beneficiary.view'], [], 'assigned-cases').canOpen('/beneficiaries')).toBe(false);
    expect(reach(['beneficiary.view']).canOpen('/beneficiaries')).toBe(true);
  });

  it('never offers a route the menu does not list', () => {
    expect(reach(['user.view']).canOpen('/users/somebody')).toBe(false);
  });
});
