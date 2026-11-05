import {
  ACCOUNT_ROLES,
  STAFF_ROLES,
  type AccountBarangay,
  type AppAccount,
  type AppAccountId,
  type BarangayId,
  type OfficeId,
  type OfficeRoleChange,
} from '@domain/index';

import { field, id, oneOf, str } from './wire';

/**
 * `UserListItem` → `AppAccount` (`DL-168`).
 *
 * | wire        | domain     | if absent                    |
 * | ----------- | ---------- | ---------------------------- |
 * | `id`        | `id`       | the account is not readable  |
 * | `role`      | `role`     | the account is not readable  |
 * | `name`      | `name`     | no name given                |
 * | `email`     | `email`    | no email given               |
 * | `office_id` | `officeId` | no office                    |
 * | `office_role` | `officeRole` | no office role (`DL-173`) |
 * | `scope_barangay_id` | `scopeBarangayId` | not confined to one barangay |
 *
 * `scope_barangay_id` is the barangay a barangay link may see, which the server decides; it is not
 * where the person lives.
 *
 * **Not read**: `mobile` and `barangay_id` — personal details a screen deciding who is staff does
 * not need (CLAUDE.md §6.1); `verification_status`, which the role already says for a resident and
 * which this screen does not decide; `created_at`, which only orders the server's cursor. The API
 * itself omits birth dates and addresses from this list.
 *
 * A role outside the four an administrator can give — the spec types the field as a bare string —
 * makes the account unreadable, and the adapter refuses the page: a role this console does not know
 * is one it cannot say anything true about changing.
 *
 * @consumes GET admin/users
 * @consumes PATCH admin/users/{id}/role
 * @consumes PATCH admin/users/{id}/office
 * @consumes PATCH admin/users/{id}/office-role
 */
export function toAppAccount(wire: unknown): AppAccount | null {
  const accountId = id<AppAccountId>(field(wire, 'id'));
  const role = oneOf(field(wire, 'role'), ACCOUNT_ROLES);

  if (accountId === null || role === null) {
    return null;
  }

  return {
    id: accountId,
    name: str(field(wire, 'name')),
    email: str(field(wire, 'email')),
    role,
    officeId: id<OfficeId>(field(wire, 'office_id')),
    // A role this console does not know is shown as none rather than guessed at; the server's
    // permissions, not this label, decide what the account may do.
    officeRole: oneOf(field(wire, 'office_role'), STAFF_ROLES),
    scopeBarangayId: id<BarangayId>(field(wire, 'scope_barangay_id')),
  };
}

/**
 * What `PATCH admin/users/{id}/office-role` reads (`OfficeRoleChange` in the spec), and nothing else:
 * the body is strict on the server.
 */
export interface OfficeRoleChangeWire {
  readonly office_role: string | null;
  readonly scope_barangay_id: string | null;
  readonly reason: string;
}

/**
 * `OfficeRoleChange` → its wire body. The reason is sent as typed, trimmed: the server keeps it, and
 * leading or trailing space is nobody's words.
 */
export function toWireOfficeRoleChange(change: OfficeRoleChange): OfficeRoleChangeWire {
  return {
    office_role: change.role,
    scope_barangay_id: change.barangayId,
    reason: change.reason.trim(),
  };
}

/**
 * `Barangay` → `AccountBarangay`, or `null` when it cannot be read. `code` is not read: the picker
 * names a barangay, it does not code one.
 *
 * @consumes GET barangays
 */
export function toAccountBarangay(wire: unknown): AccountBarangay | null {
  const barangayId = id<BarangayId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  return barangayId === null || name === null ? null : { id: barangayId, name };
}
