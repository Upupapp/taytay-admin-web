import type { ServerIdentity, StaffUserId } from '@domain/index';

import { field, id, list, oneOf, str } from './wire';

/** The two API roles that may hold a console session. `registered` and `verified` are residents. */
type ConsoleRole = 'staff' | 'admin';

const CONSOLE_ROLES: readonly ConsoleRole[] = ['staff', 'admin'];

const ROLE_LABELS: Readonly<Record<ConsoleRole, string>> = {
  staff: 'Staff',
  admin: 'Administrator',
};

/**
 * `GET me` → the identity the console decides from, or `null` when this account may not hold a
 * console session at all.
 *
 * ## What it takes from the server, and only from the server
 *
 * `permissions` is the API's own answer about what its route guards will allow this account — a
 * list of `StaffCapability` keys built from the table the guards themselves read. It is passed on
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
 * officer to their own neighbourhood, or, worse, open it to them. The scope is therefore the
 * narrowest one, `assigned-cases`, until the server publishes a scope of its own.
 *
 * ## Who is refused
 *
 * A `registered` or `verified` account is a resident, and a closed account is closed. Either is
 * answered with `null` — no session — rather than a session with nothing in it, which would look
 * real to every guard and fail one screen at a time. Only an explicit `closed: false` is open: an
 * absent or malformed flag must not let a closed account in.
 *
 * @consumes GET me
 */
export function toServerIdentity(wire: unknown): ServerIdentity | null {
  const accountId = id<StaffUserId>(field(wire, 'id'));
  const role = oneOf<ConsoleRole>(field(wire, 'role'), CONSOLE_ROLES);
  const open = field(wire, 'closed') === false ? true : null;

  if (accountId === null || role === null || open === null) {
    return null;
  }

  const email = str(field(wire, 'email'));

  return {
    id: accountId,
    displayName: str(field(wire, 'name')) ?? email ?? ROLE_LABELS[role],
    email: email ?? '',
    roles: [role],
    roleLabel: ROLE_LABELS[role],
    position: '',
    barangayId: null,
    scope: 'assigned-cases',
    permissions: list(field(wire, 'permissions'), str),
  };
}
