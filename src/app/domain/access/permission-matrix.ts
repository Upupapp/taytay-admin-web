import {
  PERMISSIONS,
  ROLE_DEFINITIONS,
  type DataScope,
  type Permission,
  type StaffRole,
} from './permission';

/**
 * The role × permission matrix, in a shape that can be queried and audited.
 *
 * `ROLE_DEFINITIONS` remains the single place a grant is *written*. This module
 * is the derived view: it answers "who can do X" as cheaply as "what can this
 * role do", and it gives the matrix invariants somewhere to live.
 *
 * Deriving rather than duplicating matters — a second hand-maintained list of
 * grants is how a permission model silently stops matching itself.
 */
export type PermissionMatrix = Readonly<Record<StaffRole, ReadonlySet<Permission>>>;

export const ALL_ROLES = Object.keys(ROLE_DEFINITIONS) as readonly StaffRole[];

function buildMatrix(): PermissionMatrix {
  const matrix = {} as Record<StaffRole, ReadonlySet<Permission>>;
  for (const role of ALL_ROLES) {
    matrix[role] = new Set(ROLE_DEFINITIONS[role].permissions);
  }
  return matrix;
}

export const PERMISSION_MATRIX: PermissionMatrix = buildMatrix();

export function roleGrants(role: StaffRole, permission: Permission): boolean {
  return PERMISSION_MATRIX[role].has(permission);
}

/** Every role holding a permission. Used by the matrix documentation check. */
export function rolesWith(permission: Permission): readonly StaffRole[] {
  return ALL_ROLES.filter((role) => roleGrants(role, permission));
}

export function scopeOf(role: StaffRole): DataScope {
  return ROLE_DEFINITIONS[role].scope;
}

/**
 * Permissions no role holds.
 *
 * A permission nobody can exercise is dead weight at best and, more often, a
 * gate someone forgot to open — so the matrix test asserts this is empty.
 */
export function orphanPermissions(): readonly Permission[] {
  return PERMISSIONS.filter((permission) => rolesWith(permission).length === 0);
}

/**
 * Roles that can both approve a request and release its money.
 *
 * `system-administrator` is excluded by design: it maintains accounts and
 * reference data rather than working cases, and a break-glass account that can
 * do everything is a deliberate, auditable exception. Any *other* role
 * appearing here is a separation-of-duties failure (`DL-08`).
 */
export function rolesBreachingSeparationOfDuties(): readonly StaffRole[] {
  return ALL_ROLES.filter(
    (role) =>
      role !== 'system-administrator' &&
      roleGrants(role, 'request.approve') &&
      roleGrants(role, 'disbursement.release'),
  );
}

/** Permissions that alter data, as opposed to merely reading it. */
export const MUTATING_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter(
  (permission) => !permission.endsWith('.view') && !permission.startsWith('report.'),
);

/** True when the role can read but never change anything. */
export function isReadOnlyRole(role: StaffRole): boolean {
  return MUTATING_PERMISSIONS.every((permission) => !roleGrants(role, permission));
}
