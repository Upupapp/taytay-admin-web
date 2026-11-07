import {
  STAFF_ROLES,
  canHoldSession,
  type BarangayId,
  type DataScope,
  type ServerIdentity,
  type StaffUserId,
} from '@domain/index';

import { field, flag, id, list, oneOf, str } from './wire';

/** The two API roles that may hold a console session. `registered` and `verified` are residents. */
type ConsoleRole = 'staff' | 'admin';

const CONSOLE_ROLES: readonly ConsoleRole[] = ['staff', 'admin'];

const ROLE_LABELS: Readonly<Record<ConsoleRole, string>> = {
  staff: 'Staff',
  admin: 'Administrator',
};

const SCOPES: readonly DataScope[] = ['all-barangays', 'own-barangay', 'assigned-cases'];

/**
 * `GET me` → the identity the console decides from, or `null` when this account may not hold a
 * console session at all.
 *
 * ## What it takes from the server, and only from the server
 *
 * `permissions` is the API's own answer about what its route guards will allow this account — a
 * list of `Permission` keys: the platform capabilities of its tier and the casework keys of its office
 * role (`DL-173`), built from the tables the server itself enforces. It is passed on
 * as sent, and `fromServerIdentity` keeps the keys this console knows and grants nothing else
 * (`DL-133`). **Nothing here computes a permission from `role`.** Two staff roles cannot express
 * what the console's seven do, and deriving a grant from one would be a second authority one
 * folder away from the one `check:auth` already forbids.
 *
 * ## What it refuses to read
 *
 * `/me` is the resident profile endpoint, and a staff member's answer carries their birth date,
 * sex, mobile number, home address, street, purok and home barangay. None of it is mapped: the
 * console has no operational need for any of it (CLAUDE.md §6.1). `barangay_id` in particular is
 * where somebody **lives**, not what they may see — reading it as a data scope would confine an
 * officer to their own neighbourhood, or, worse, open it to them.
 *
 * ## The scope and the office role are the server's (`DL-173`)
 *
 * `scope` and `scope_barangay_id` are the server's decision from the account's office role, and are
 * read as sent — never computed here from `role` or `office_role`. A scope that is missing or
 * unknown, or an `own-barangay` scope that names no barangay, is read as the narrowest,
 * `assigned-cases`: failing closed, as `fromServerIdentity` does with keys (`DL-133`).
 * `office_role` labels the account on screen and decides nothing.
 *
 * ## Who is refused
 *
 * A `registered` or `verified` account is a resident, and a closed account is closed. Either is
 * answered with `null` — no session — rather than a session with nothing in it, which would look
 * real to every guard and fail one screen at a time. Only an explicit `closed: false` is open: an
 * absent or malformed flag must not let a closed account in.
 *
 * An account the office has **switched off** is refused the same way, through `canHoldSession` —
 * the rule the mock's staff adapter asks too (`DL-116`). A missing or malformed `deactivated` is
 * refused like a missing `closed`; the server answers every other route for it with 401 at the next request, and
 * this keeps the console from opening a session the server would end on its first read (`DL-191`).
 *
 * @consumes GET me
 */
export function toServerIdentity(wire: unknown): ServerIdentity | null {
  const accountId = id<StaffUserId>(field(wire, 'id'));
  const role = oneOf<ConsoleRole>(field(wire, 'role'), CONSOLE_ROLES);
  const open = field(wire, 'closed') === false ? true : null;
  const deactivated = flag(field(wire, 'deactivated'));

  if (accountId === null || role === null || open === null || deactivated === null) {
    return null;
  }
  // Switched off by the office: no session, asked the way the mock's staff adapter asks (`DL-116`).
  if (!canHoldSession({ isActive: !deactivated })) {
    return null;
  }

  const email = str(field(wire, 'email'));
  const officeRole = oneOf(field(wire, 'office_role'), STAFF_ROLES);
  const sentScope = oneOf(field(wire, 'scope'), SCOPES);
  const scopeBarangay = id<BarangayId>(field(wire, 'scope_barangay_id'));
  const scope: DataScope =
    sentScope === null || (sentScope === 'own-barangay' && scopeBarangay === null)
      ? 'assigned-cases'
      : sentScope;

  return {
    id: accountId,
    displayName: str(field(wire, 'name')) ?? email ?? ROLE_LABELS[role],
    email: email ?? '',
    // The office role first, so the console's own label is the one shown; the tier stays beside it.
    roles: officeRole === null ? [role] : [officeRole, role],
    roleLabel: ROLE_LABELS[role],
    position: '',
    barangayId: scope === 'own-barangay' ? scopeBarangay : null,
    scope,
    permissions: list(field(wire, 'permissions'), str),
    // An administrator acts for every office; only a staff account can be without one (`DL-168`).
    awaitingOffice: role === 'staff' && str(field(wire, 'office_id')) === null,
  };
}
