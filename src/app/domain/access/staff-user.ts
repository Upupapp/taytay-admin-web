import type { AuditStamp } from '../shared/audit';
import type { BarangayId, IsoDateTime, StaffUserId } from '../shared/ids';
import { formatPersonName, type PersonName } from '../residents/resident';
import { ROLE_DEFINITIONS, type DataScope, type Permission, type StaffRole } from './permission';

export interface StaffUser {
  readonly id: StaffUserId;
  readonly name: PersonName;
  readonly email: string;
  readonly role: StaffRole;
  /** Position title as printed on office documents, e.g. "Social Welfare Officer II". */
  readonly position: string;
  /** Set only for `barangay-link` accounts; `null` means municipality-wide. */
  readonly barangayId: BarangayId | null;
  /** Grants beyond the role baseline. Never used to take permissions away. */
  readonly additionalPermissions: readonly Permission[];
  readonly isActive: boolean;
  readonly lastSignInAt: IsoDateTime | null;
  readonly audit: AuditStamp;
}

/**
 * The resolved identity the UI reasons about. Produced by the auth service from
 * a `StaffUser` plus the role map, so components never recompute permissions.
 */
export interface AuthenticatedUser {
  readonly id: StaffUserId;
  readonly displayName: string;
  readonly email: string;
  readonly role: StaffRole;
  readonly roleLabel: string;
  readonly position: string;
  readonly barangayId: BarangayId | null;
  readonly scope: DataScope;
  readonly permissions: ReadonlySet<Permission>;
}

export interface StaffFilter {
  readonly search?: string;
  readonly role?: StaffRole;
  readonly includeInactive?: boolean;
}

/**
 * Flattens a staff record into the identity the UI uses. Role baseline plus
 * explicit extras; nothing here can revoke a permission, so the effective set
 * is always a superset of the role and stays easy to reason about.
 */
export function toAuthenticatedUser(staff: StaffUser): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[staff.role];
  return {
    id: staff.id,
    displayName: formatPersonName(staff.name),
    email: staff.email,
    role: staff.role,
    roleLabel: definition.label,
    position: staff.position,
    barangayId: staff.barangayId,
    scope: definition.scope,
    permissions: new Set<Permission>([...definition.permissions, ...staff.additionalPermissions]),
  };
}
