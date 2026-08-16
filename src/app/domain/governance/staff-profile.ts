import type { AuditStamp } from '../shared/audit';
import type { BarangayId, IsoDateTime, StaffUserId } from '../shared/ids';
import type { StaffRole } from '../access/permission';

/**
 * The internal directory entry for a member of staff.
 *
 * **Held apart from `StaffUser` on purpose** (`DL-115`). `StaffUser` is the
 * authorisation model: it answers *who may do what*, and every guard, every
 * adapter and twenty-eight test fixtures depend on its shape. A mobile number
 * is not an authorisation concern, and putting one there would make every
 * permission test care about a phone number.
 *
 * They are also different data. A role is office structure; an employee's
 * contact details are **personal information about that employee**, with the
 * same protection under RA 10173 that a resident's has. Keeping them in
 * separate records is what makes it possible to show a role without showing a
 * number.
 *
 * One identity, two facets: both are keyed on `StaffUserId`, so there is
 * nothing to keep in step.
 */
export interface StaffProfile {
  readonly staffId: StaffUserId;
  /** As printed on the plantilla. Not a login, and not a secret. */
  readonly employeeId: string;
  /** The unit within the MSWDO — intake, casework, disbursement, records. */
  readonly unit: string;
  /** Office extension or mobile. Personal information; shown to staff.view only. */
  readonly contactNumber: string | null;
  readonly officeEmail: string;
  readonly audit: AuditStamp;
}

/**
 * What an administrator sees about an account, assembled for the detail screen.
 *
 * Composed by the data layer rather than by the screen, so the disclosure
 * decisions live in one place.
 */
export interface StaffAccount {
  readonly staffId: StaffUserId;
  readonly displayName: string;
  readonly role: StaffRole;
  readonly roleLabel: string;
  readonly position: string;
  /** `null` means municipality-wide rather than "not recorded". */
  readonly barangayId: BarangayId | null;
  readonly barangayLabel: string | null;
  readonly isActive: boolean;
  readonly lastSignInAt: IsoDateTime | null;
  readonly profile: StaffProfile | null;
  /** Grants beyond the role baseline, which the matrix screen explains. */
  readonly additionalPermissionCount: number;
}

/**
 * Whether an account may hold a session **right now**.
 *
 * Before TAB 21 deactivation only blocked a fresh sign-in: `currentUser()`
 * resolved a deactivated account into a fully-permissioned identity, so
 * somebody deactivated at 10am kept every grant until they happened to sign
 * out. An account is disabled the moment the office says so, not the next time
 * the person closes their browser (`DL-116`).
 *
 * Stated in the domain so both adapters ask the same question.
 */
export function canHoldSession(account: { readonly isActive: boolean }): boolean {
  return account.isActive;
}

export const DEACTIVATED_NOTICE =
  'This account is deactivated. It cannot sign in, and an open session stops being able to act ' +
  'as soon as the next request is made.';

/* ── Provisioning: a placeholder, and labelled as one ─────────────────────── */

/**
 * There is no invite flow, and this file is where that is written down.
 *
 * The master command asks for an "invite/provision UI placeholder only; no
 * public admin registration". `DL-32` already established there is no
 * self-registration route anywhere in this application. What TAB 21 adds is the
 * screen that says so, rather than a form that appears to work.
 *
 * A half-built invite flow is worse than none: an administrator who fills one
 * in reasonably believes an account now exists.
 */
export const PROVISIONING_IS_NOT_BUILT =
  'Accounts are created by the system administrator directly, and this console cannot yet do it. ' +
  'There is deliberately no self-registration and no public invite link. When provisioning is ' +
  'built it will issue a single-use invitation to a municipal address, and it will be recorded ' +
  'in the audit trail like any other change to access.';

export const RESET_ACCESS_IS_NOT_BUILT =
  'Resetting access is not built here. Until it is, ask the system administrator — and expect to ' +
  'prove who you are by some means other than this application.';
