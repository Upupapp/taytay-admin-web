import type { AppAccountId, OfficeId } from '../shared/ids';
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
 * again.
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
