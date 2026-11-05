import type { IsoDateTime, PlatformAuditEntryId } from '../shared/ids';

/**
 * One row of the Node API's audit trail (`DL-171`), read from `GET admin/audit` at `2736e28`
 * (`src/modules/audit`).
 *
 * **Who, what, which record, when — and nothing else.** The API stores no old value, no new value,
 * no reason and no detail, and this model has no field that could hold one (`DL-114`: a row says
 * what changed, never what it changed to). The actor and the record are **ids as the API gives
 * them**: nothing is looked up beside a row, so the trail discloses no name, email or record content
 * to the person reading it.
 *
 * **Not the governance audit trail** (`AuditRow`), which belongs to the unserved governance module
 * and carries fields — summaries, sensitivity, sources — this API has none of.
 */
export interface PlatformAuditEntry {
  readonly id: PlatformAuditEntryId;
  /** The account that acted, or `null` when the API recorded none. */
  readonly actorId: string | null;
  /** The API's dotted code, as given — `user.role_changed`. */
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string | null;
  readonly at: IsoDateTime;
}

/**
 * Every action the API records at `6544381`, in words. Read from the backend's
 * `audit.record(...)` calls; a code not here is shown as given and said to have no description in
 * this console, never dropped or guessed at.
 */
export const PLATFORM_AUDIT_ACTIONS: Readonly<Record<string, string>> = {
  'account.closed': 'A resident closed their own account',
  'app.config_updated': 'Changed the app’s settings',
  'banner.created': 'Added a home screen banner',
  'banner.deleted': 'Deleted a home screen banner',
  'banner.updated': 'Changed a home screen banner',
  'digital_id.issued': 'Issued a digital ID',
  'digital_id.reissued': 'Replaced a digital ID with a new one',
  'digital_id.revoked': 'Revoked a digital ID',
  'digital_id.scanned': 'Checked a resident’s digital ID',
  'digital_id.suspended': 'Suspended a digital ID',
  'hotline.created': 'Added a hotline',
  'hotline.deleted': 'Deleted a hotline',
  'hotline.updated': 'Changed a hotline',
  'link.created': 'Added a home screen link',
  'link.deleted': 'Deleted a home screen link',
  'link.updated': 'Changed a home screen link',
  'news.created': 'Wrote a Balita article',
  'news.pinned': 'Pinned a Balita article',
  'news.unpinned': 'Unpinned a Balita article',
  'news.updated': 'Changed a Balita article',
  'office.created': 'Added an office to the directory',
  'office.deleted': 'Deleted an office from the directory',
  'office.updated': 'Changed an office in the directory',
  'office_resident.created': 'Recorded a resident in the office registry',
  'office_resident.deactivated': 'Retired a resident’s registry record',
  'office_resident.reactivated': 'Restored a resident’s registry record',
  'office_resident.sector_ended': 'Ended a resident’s sector membership',
  'office_resident.sector_recorded': 'Recorded a resident’s sector membership',
  'office_resident.updated': 'Changed a resident’s registry record',
  'password.reset_completed': 'Reset their password',
  'service.created': 'Added a Tulong page',
  'service.deleted': 'Deleted a Tulong page',
  'service.updated': 'Changed a Tulong page',
  'session.revoked': 'Signed out everywhere',
  'thread.closed': 'Closed a conversation with a resident',
  'user.office_assigned': 'Changed a staff account’s office',
  'user.office_role_changed': 'Changed a staff account’s office role',
  'user.role_changed': 'Changed an account’s role',
  'verification.approved': 'Approved a resident’s ID verification',
  'verification.rejected': 'Rejected a resident’s ID verification',
};

/** The action in words, or `null` when this console has none for the code. */
export function describeAuditAction(code: string): string | null {
  return Object.hasOwn(PLATFORM_AUDIT_ACTIONS, code) ? (PLATFORM_AUDIT_ACTIONS[code] ?? null) : null;
}

/** What a row of this trail does not hold, said on the screen once rather than implied. */
export const PLATFORM_AUDIT_LIMITS: readonly string[] = [
  'A row says who acted, what they did, to which record and when. The API keeps no earlier or later value, and no reason.',
  'People and records are shown by their IDs, as the API records them. Nothing is looked up about them here.',
  'A change to the app’s settings is recorded without saying which setting.',
];
