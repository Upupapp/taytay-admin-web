import { ACCOUNT_ROLES, type AppAccount, type AppAccountId, type OfficeId } from '@domain/index';

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
  };
}
