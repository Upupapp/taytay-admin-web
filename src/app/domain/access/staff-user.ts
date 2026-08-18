import type { AuditStamp } from '../shared/audit';
import type { BarangayId, IsoDateTime, StaffUserId } from '../shared/ids';
import { formatPersonName, type PersonName } from '../residents/resident';
import { PERMISSIONS, ROLE_DEFINITIONS, type DataScope, type Permission, type StaffRole } from './permission';

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
  /**
   * Keys the server sent that this console does not know.
   *
   * Never used to grant anything — that is the point. Carried so drift between
   * the two vocabularies is visible rather than mysterious, and logged once per
   * session rather than per check.
   */
  readonly unknownPermissions?: readonly string[];
}

export interface StaffFilter {
  readonly search?: string;
  readonly role?: StaffRole;
  readonly includeInactive?: boolean;
}

/**
 * Builds the identity from **what the server resolved**, when the server said.
 *
 * `GET /api/v1/me` answers with `permissions[]` and `roles[]` — the API's own
 * decision about what this actor may do — and those are what the console
 * renders from. Computing them here from `ROLE_DEFINITIONS` would mean two
 * authorities disagreeing: the console showing a caseworker a button the server
 * refuses, or hiding one it would have allowed, and both are reported as "the
 * system is broken".
 *
 * FAIL CLOSED, IN BOTH DIRECTIONS (`DL-133`):
 *
 *  * a key the **server** sends that this console does not know is ignored — it
 *    guards nothing here, so honouring it would grant something no screen has
 *    been reasoned about;
 *  * a key this console expects that the **server** never sends is simply
 *    absent, so the feature stays hidden.
 *
 * Both are silent to the user and loud to a developer: `unknownPermissions`
 * carries the drift so it can be logged once per session rather than discovered
 * as a mystery.
 */
export function fromServerIdentity(identity: ServerIdentity): AuthenticatedUser {
  const known = new Set<string>(PERMISSIONS);
  const granted = new Set<Permission>();
  const unknown: string[] = [];

  for (const key of identity.permissions) {
    if (known.has(key)) {
      granted.add(key as Permission);
    } else {
      unknown.push(key);
    }
  }

  const role = identity.roles.find((candidate): candidate is StaffRole => candidate in ROLE_DEFINITIONS) ?? null;

  return {
    id: identity.id,
    displayName: identity.displayName,
    email: identity.email,
    // The role is presentation only from here on: it labels the account on
    // screen and nothing branches on it. Authorization asks about permissions.
    role: role ?? 'auditor',
    roleLabel: role ? ROLE_DEFINITIONS[role].label : identity.roleLabel,
    position: identity.position,
    barangayId: identity.barangayId,
    scope: identity.scope,
    permissions: granted,
    unknownPermissions: unknown,
  };
}

/**
 * What `GET /api/v1/me` gives the console, already mapped out of the wire shape
 * by the adapter.
 */
export interface ServerIdentity {
  readonly id: StaffUserId;
  readonly displayName: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly roleLabel: string;
  readonly position: string;
  readonly barangayId: BarangayId | null;
  readonly scope: DataScope;
  readonly permissions: readonly string[];
}

/**
 * Flattens a staff record into the identity the UI uses, from the **role map**.
 *
 * Retained for the mock adapter and for tests, which have no server to ask.
 * `check:access` fails the build if a guard, directive or feature reaches for
 * `ROLE_DEFINITIONS` at runtime — the map is documentation and a fixture, and
 * the server is the authority.
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
