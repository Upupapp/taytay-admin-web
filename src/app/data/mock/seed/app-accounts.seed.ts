import {
  asId,
  type AccountRole,
  type AppAccount,
  type AppAccountId,
  type OfficeId,
  type StaffRole,
} from '@domain/index';

import { MOCK_OFFICE_HEALTH, MOCK_OFFICE_MSWDO } from './offices.seed';

/**
 * Fictional residents' app accounts, for the `local-mock` configuration (`DL-168`).
 *
 * Nobody here exists. Every address is at `example.test`, a name reserved so that it can never
 * reach anybody, and a `check:bundle` seed marker: it must never ship.
 */
export const SAMPLE_ACCOUNT_DOMAIN = 'accounts.example.test';

interface SeedRow {
  readonly key: string;
  readonly name: string | null;
  readonly role: AccountRole;
  readonly office?: OfficeId;
  readonly officeRole?: StaffRole;
}

const HAND_WRITTEN: readonly SeedRow[] = [
  // The mock administrator's own account, so the screen has one row it must not offer to change.
  { key: 'staff-admin', name: 'Marisol Alcantara', role: 'admin' },
  {
    key: 'app-account-0001',
    name: 'Teresita Valdez',
    role: 'staff',
    office: MOCK_OFFICE_MSWDO,
    officeRole: 'intake-officer',
  },
  { key: 'app-account-0002', name: 'Rogelio Manalo', role: 'staff' },
  { key: 'app-account-0003', name: 'Jocelyn Pascual', role: 'staff', office: MOCK_OFFICE_HEALTH },
  { key: 'app-account-0004', name: 'Danilo Ferrer', role: 'verified' },
  { key: 'app-account-0005', name: 'Maricel Robles', role: 'registered' },
  { key: 'app-account-0006', name: null, role: 'registered' },
  {
    key: 'app-account-0007',
    name: 'Arnel Villanueva',
    role: 'verified',
    office: MOCK_OFFICE_MSWDO,
  },
];

const GIVEN = ['Liza', 'Noel', 'Carmela', 'Efren', 'Rowena', 'Jun', 'Analyn', 'Ricardo', 'Mylene'];
const FAMILY = ['Soriano', 'Navarro', 'Castillo', 'Mercado', 'Samonte', 'Bernardo', 'Galang'];

/** Enough further residents that the list has a second page, as the real one will. */
const GENERATED: readonly SeedRow[] = Array.from({ length: 22 }, (_, index) => ({
  key: `app-account-${String(index + 8).padStart(4, '0')}`,
  name: `${GIVEN[index % GIVEN.length] ?? 'Sample'} ${FAMILY[index % FAMILY.length] ?? 'Resident'}`,
  role: index % 3 === 0 ? 'verified' : 'registered',
}));

function toAccount(row: SeedRow): AppAccount {
  const handle = (row.name ?? 'no.name').toLowerCase().replace(/\s+/g, '.');
  return {
    id: asId<AppAccountId>(row.key),
    name: row.name,
    email: `${handle}@${SAMPLE_ACCOUNT_DOMAIN}`,
    role: row.role,
    officeId: row.office ?? null,
    // As the server says it: an administrator is the system administrator, staff hold what was given.
    officeRole: row.role === 'admin' ? 'system-administrator' : (row.officeRole ?? null),
    scopeBarangayId: null,
  };
}

export const MOCK_APP_ACCOUNTS: readonly AppAccount[] = [...HAND_WRITTEN, ...GENERATED].map(
  toAccount,
);
