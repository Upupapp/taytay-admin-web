import type { StaffRole } from '../access/permission';
import type { AccountVerificationStatus } from '../dashboard/dashboard-summary';
import type { AppAccountId, BarangayId, OfficeId } from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * An account in the residents' app, as an administrator manages it (`DL-168`) — residents and staff
 * alike, because on this API they are one kind of account with a role.
 *
 * ## The minimum, on purpose
 *
 * The list is every account in the app, so most rows are residents, and a screen for deciding who is
 * staff needs to tell accounts apart and nothing more: a name, an email, the role, the office. The
 * API also sends a mobile number and a home barangay; neither is read, so no template can reach them
 * (CLAUDE.md §6.1). It omits birth dates and addresses itself. `check:accounts` fails the build if
 * one appears.
 */
export interface AppAccount {
  readonly id: AppAccountId;
  /** Null when the person has not given one — or has closed the account, which clears it. */
  readonly name: string | null;
  readonly email: string | null;
  readonly role: AccountRole;
  /** The office a staff account answers for. Kept by the server, unused, when the role is not staff. */
  readonly officeId: OfficeId | null;
  /**
   * Which of the office's roles the account works in, as the server says (`DL-173`):
   * `system-administrator` for an administrator, the role given or `null` for staff, `null` for a
   * resident. Its casework permissions are the server's answer on `/me`, never computed from this.
   */
  readonly officeRole: StaffRole | null;
  /**
   * For a barangay link only: the barangay its data scope is confined to. Not where the person
   * lives — the API's home `barangay_id` is not read (CLAUDE.md §6.1).
   */
  readonly scopeBarangayId: BarangayId | null;
}

/**
 * What the account list can be narrowed to (`DL-186`). With a verification status it holds the open
 * residents' app accounts — role `registered` or `verified`, not closed — with that status: exactly
 * those the dashboard counts by verification. Staff and closed accounts are not listed by it. The
 * status narrows the list; it is not read onto a row, which carries the minimum (`DL-168`).
 */
export interface AppAccountFilter {
  readonly verificationStatus?: AccountVerificationStatus;
}

/* ── roles, defined once (rule 7) ────────────────────────────────────────── */

/** The roles an administrator can give, exactly as the API's `RoleChange` lists them. */
export const ACCOUNT_ROLES = ['registered', 'verified', 'staff', 'admin'] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const ACCOUNT_ROLE_CATALOG: StatusCatalog<AccountRole> = {
  registered: {
    value: 'registered',
    label: 'Resident',
    tone: 'neutral',
    description: 'A residents’ app account whose identity has not been verified.',
  },
  verified: {
    value: 'verified',
    label: 'Verified resident',
    tone: 'success',
    description: 'A resident whose identity the office has verified.',
  },
  staff: {
    value: 'staff',
    label: 'Staff',
    tone: 'info',
    description:
      'Signs in to this console. Answers an office’s residents once assigned to an office.',
  },
  admin: {
    value: 'admin',
    label: 'Administrator',
    tone: 'progress',
    description: 'Signs in to this console with every capability, including this screen.',
  },
};

/**
 * An administrator may move any account to any other role — the API allows every change but one, an
 * administrator's own, which it refuses whoever asks (`isOwnAccount`).
 */
export const ACCOUNT_ROLE_TRANSITIONS: StatusTransitions<AccountRole> = {
  registered: ['verified', 'staff', 'admin'],
  verified: ['registered', 'staff', 'admin'],
  staff: ['registered', 'verified', 'admin'],
  admin: ['registered', 'verified', 'staff'],
};

/** True for the signed-in administrator's own account, whose role the server will not change. */
export function isOwnAccount(account: AppAccount, readerAccountId: string | null): boolean {
  return readerAccountId !== null && String(account.id) === readerAccountId;
}

/** True when the server will link this account to an office: staff only. */
export function takesAnOffice(account: AppAccount): boolean {
  return account.role === 'staff';
}

/* ── what a change does, as the API says ─────────────────────────────────── */

/**
 * What changing **to** each role does, shown **before** the button (`DL-168`).
 *
 * Read from the backend, not assumed: `taytay-backend` `2736e28` — `changeUserRole` in
 * `openapi/openapi.json` ("Cannot target the caller. verified and registered also update
 * verification_status."), its handler in `src/modules/users/routes.ts` (any role but `verified`
 * revokes the account's current digital ID; the change is audited as `user.role_changed` with no
 * reason), `UserRepository.changeRole` (`registered` sets the account unverified, `verified` sets it
 * verified now, `staff` and `admin` leave it alone, the office link is untouched),
 * `src/auth/capabilities.ts` (staff hold the inbox and news only while assigned to an office;
 * administrators hold everything), and `src/auth/resolve-user.ts` (the database role replaces the
 * token's on every request). If the backend changes, this list is wrong until somebody reads it
 * again — as it was read again for `DL-173`: `changeRole` now clears an office role in the same
 * transaction when the account leaves the staff tier, and records that it did.
 */
export const ROLE_CHANGE_EFFECTS: Readonly<Record<AccountRole, readonly string[]>> = {
  registered: [
    'The account becomes an unverified resident account. The server marks it unverified, so the ' +
      'person must be verified again before anything that needs a verified identity.',
    'Any digital ID the account holds is revoked.',
    'It can no longer use this console, if it could.',
  ],
  verified: [
    'The account is marked verified now, without an ID review. Do this only where the office has ' +
      'verified the person some other way.',
    'No digital ID is issued by this change: an approved ID review issues one, a role change does ' +
      'not.',
    'It can no longer use this console, if it could.',
  ],
  staff: [
    'The account can sign in to this console as staff.',
    'It answers an office’s residents and posts that office’s news only once it is assigned to an ' +
      'office. Assign one below after the change.',
    'It holds no casework permission until it is given an office role, below, after the change.',
    'Its verification status is unchanged. Any digital ID it holds is revoked.',
  ],
  admin: [
    'The account can sign in to this console as an administrator, with every capability: deciding ' +
      'ID reviews, changing other accounts’ roles and offices, and every office’s conversations.',
    'Its verification status is unchanged. Any digital ID it holds is revoked.',
  ],
};

/** Said with every role change, whichever role it is to. */
export const ROLE_CHANGE_ALWAYS: readonly string[] = [
  'The server applies it at that person’s next request. A console or app they already have open ' +
    'keeps showing what it showed until it is reloaded, but the server refuses whatever the new ' +
    'role does not allow.',
  'An office link is kept, unused, when an account stops being staff, and applies again if it ' +
    'becomes staff again.',
  'An office role is not kept: the server clears it when the account stops being staff, records ' +
    'that it did, and does not bring it back if the account becomes staff again.',
  'The server records that you made the change, and when. It keeps no reason, so none is asked for.',
];

/**
 * What linking a staff account to an office does, or clearing the link — read from
 * `assignUserOffice` and its handler in `src/modules/offices/routes.ts` at `2736e28` (staff only;
 * audited as `user.office_assigned` with no reason) and `src/auth/capabilities.ts`.
 */
export const OFFICE_ASSIGNMENT_EFFECTS: Readonly<Record<'assign' | 'clear', readonly string[]>> = {
  assign: [
    'The account answers this office’s residents in the office inbox, and may post news for it, ' +
      'from its next request. A console it already has open shows the inbox once reloaded.',
    'It sees only this office’s conversations. Moving it from another office takes that office’s ' +
      'conversations away from it.',
    'The server records that you made the change, and when. It keeps no reason, so none is asked ' +
      'for.',
  ],
  clear: [
    'The account stays staff but answers no office: the office inbox and news posting close to it ' +
      'from its next request.',
    'When that person next signs in, the console tells them they are not assigned to an office, ' +
      'and that an administrator assigns one.',
    'The server records that you made the change, and when. It keeps no reason, so none is asked ' +
      'for.',
  ],
};

/* ── the office role (`DL-173`) ──────────────────────────────────────────── */

/**
 * The office roles an administrator may give a staff account — every role but
 * `system-administrator`, which on the server is the `admin` account role itself. Given to a staff
 * account it would hold both approval and release, which no one non-administrator may (CLAUDE.md
 * §5, separation of duties); the server refuses it, so it is not offered.
 */
export const ASSIGNABLE_OFFICE_ROLES: readonly StaffRole[] = [
  'mswdo-head',
  'social-worker',
  'intake-officer',
  'release-officer',
  'barangay-link',
  'auditor',
];

/** The role whose data scope is one barangay, so the one that names it. */
export const BARANGAY_SCOPED_ROLE: StaffRole = 'barangay-link';

/** What `PATCH admin/users/{id}/office-role` takes: the role, its barangay, and why. */
export interface OfficeRoleChange {
  /** `null` takes the office role away. */
  readonly role: StaffRole | null;
  /** Required for a barangay link, and refused by the server for any other role. */
  readonly barangayId: BarangayId | null;
  /** Kept by the server with the change, in a history that is never edited. */
  readonly reason: string;
}

/** The longest reason the server keeps. */
export const OFFICE_ROLE_REASON_MAX = 500;

/** A barangay as the API lists it, for the barangay link's picker. */
export interface AccountBarangay {
  readonly id: BarangayId;
  readonly name: string;
}

/** True when the server will give this account an office role: staff only. */
export function takesAnOfficeRole(account: AppAccount): boolean {
  return account.role === 'staff';
}

/**
 * Why the server would refuse this change, in words, before it is sent — or an empty list. The
 * server checks all of it again; this only saves a round trip that is certain to fail.
 */
export function officeRoleChangeProblems(change: OfficeRoleChange): readonly string[] {
  const problems: string[] = [];
  const reason = change.reason.trim();
  if (reason === '') {
    problems.push('Say why. The server keeps the reason with the change.');
  } else if (reason.length > OFFICE_ROLE_REASON_MAX) {
    problems.push(`Keep the reason to ${OFFICE_ROLE_REASON_MAX} characters.`);
  }
  if (change.role !== null && !ASSIGNABLE_OFFICE_ROLES.includes(change.role)) {
    problems.push('The system administrator is the administrator account role, not an office role.');
  }
  if (change.role === BARANGAY_SCOPED_ROLE && change.barangayId === null) {
    problems.push('Choose the barangay a barangay link works in.');
  }
  if (change.role !== BARANGAY_SCOPED_ROLE && change.barangayId !== null) {
    problems.push('Only a barangay link is confined to one barangay.');
  }
  return problems;
}

/**
 * What giving or taking away an office role does, shown **before** the button (`DL-173`). Read from
 * `taytay-backend` `src/auth/casework.ts` (the role table, a copy of `ROLE_DEFINITIONS` that its own
 * test compares with this console's), `PATCH admin/users/{id}/office-role` and its handler in
 * `src/modules/users/routes.ts`, and `UserRepository.setOfficeRole`.
 */
export const OFFICE_ROLE_EFFECTS: Readonly<Record<'assign' | 'clear', readonly string[]>> = {
  assign: [
    'From the account’s next request the server grants it this role’s casework permissions, as ' +
      'listed for the role under Roles and permissions, and confines what it may see to the role’s ' +
      'scope. A console it already has open shows the change once reloaded.',
    'It replaces any office role the account had. Nobody holds two.',
    'Its platform permissions — the office inbox, news, digital ID checks — are unchanged: they ' +
      'follow the account role and its office, not the office role.',
  ],
  clear: [
    'From the account’s next request the server withdraws every casework permission it held. It ' +
      'stays staff, with the platform permissions of a staff account.',
    'Its data scope becomes the narrowest, its assigned cases only.',
  ],
};

/** Said with every office role change. */
export const OFFICE_ROLE_ALWAYS: readonly string[] = [
  'The server keeps your reason with the change, together with who made it and when, in a ' +
    'history that is never edited or deleted. It is not shown to the account holder.',
  'The server refuses a role that would let one person both approve a request and release its ' +
    'money.',
];
