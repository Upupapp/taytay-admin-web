import type { BarangayId } from '../shared/ids';
import type { Permission } from './permission';
import type { AuthenticatedUser } from './staff-user';

/**
 * Refusal, expressed so that it cannot leak.
 *
 * The error carries the permission that was required and nothing else — no
 * record id, no resident name, no field value. That is deliberate: "you may not
 * open resident res-0005" already discloses that res-0005 exists, which is
 * precisely what a denial is supposed to withhold (`CLAUDE.md` §6, RA 10173).
 *
 * The message is fixed and non-technical. Anything a support agent needs to
 * diagnose is the permission name, which is not personal data.
 */
export class PermissionDeniedError extends Error {
  readonly requiredPermission: Permission | null;

  constructor(requiredPermission: Permission | null = null) {
    super('You do not have permission to do that.');
    this.name = 'PermissionDeniedError';
    this.requiredPermission = requiredPermission;
  }
}

export function isPermissionDenied(error: unknown): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}

/** Pure check. `null` user means anonymous, which holds no permission. */
export function userHasPermission(user: AuthenticatedUser | null, permission: Permission): boolean {
  return user !== null && user.permissions.has(permission);
}

/**
 * Throws rather than returning false, for the call sites that must not proceed.
 *
 * This is the "protected at logic level" half of the rule that hiding a control
 * is never protection: the guard hides the button, this stops the action.
 */
export function assertPermission(user: AuthenticatedUser | null, permission: Permission): void {
  if (!userHasPermission(user, permission)) {
    throw new PermissionDeniedError(permission);
  }
}

/**
 * Whether a record belonging to `barangayId` is inside the user's data scope.
 *
 * `all-barangays` sees everything. `own-barangay` is confined to the barangay
 * on the account. `assigned-cases` is *not* a geographic restriction — a social
 * worker's caseload is decided per record, so scope alone cannot answer it and
 * the caller must additionally check assignment.
 */
export function isWithinBarangayScope(
  user: AuthenticatedUser | null,
  barangayId: BarangayId | null,
): boolean {
  if (user === null) {
    return false;
  }
  if (user.scope !== 'own-barangay') {
    return true;
  }
  return user.barangayId !== null && user.barangayId === barangayId;
}

/**
 * Combined read check for a record that belongs to a barangay.
 *
 * Returns a boolean rather than throwing, because a list must *filter* records
 * it may not show rather than fail — a denial that empties the whole page would
 * itself disclose that something was withheld.
 */
export function canReadRecord(
  user: AuthenticatedUser | null,
  permission: Permission,
  barangayId: BarangayId | null,
): boolean {
  return userHasPermission(user, permission) && isWithinBarangayScope(user, barangayId);
}
