/**
 * The complete permission vocabulary, expressed as `resource.action`.
 *
 * This union is the single source of truth: guards, the `appHasPermission`
 * directive, nav definitions and role maps all reference these literals, so a
 * typo cannot silently grant or hide anything.
 */
export const PERMISSIONS = [
  'dashboard.view',

  'resident.view',
  // Identity and means: the PhilSys reference (RA 11055) and monthly income.
  // Held apart from `resident.view` so seeing that a person exists does not
  // also hand over their identity number.
  'resident.view-sensitive',
  'resident.create',
  'resident.update',
  'resident.deactivate',
  'resident.export',
  // Importing the office's own lists into the registry (`DL-214`): intake's work, with the head
  // and the administrator; never a caseload's, whose scope is its own clients (`DL-183`).
  'resident.import',

  // The longitudinal view: everything this office has done for one person,
  // across every programme and every year. Held apart from `resident.view`
  // because seeing that somebody is on the registry is a different disclosure
  // from reading their whole assistance history on one screen.
  'beneficiary.view',
  // Judging whether two registry records are the same person. A finding about
  // somebody's identity, recorded against the reviewer's name (`DL-74`), and so
  // never implied by being able to read the registry.
  'beneficiary.review-duplicates',
  // Taking a beneficiary list out of the system. Named as a sensitive operation
  // by TAB 05, and held apart from `report.export`, which produces aggregates.
  'beneficiary.export',

  'household.view',
  // Composition: who lives under this roof, and who heads it.
  'household.manage',
  // Overriding a computed vulnerability factor. Held apart from `manage`
  // because moving a person between households is clerical, while contradicting
  // what the records say about a family's circumstances is a judgement.
  'household.correct-vulnerability',

  'family.view',
  // Recording who belongs to whom, and moving a person between families. Held
  // apart from `household.manage` because a household is an address and a
  // family is a claim about people.
  'family.manage',

  'case.view',
  // Advancing a case, assigning it, and recording tasks against it.
  'case.manage',
  // Writing on the running record. Held apart from `case.manage` because a
  // clerk may move a file along without adding to the social worker's notes.
  'case.note',
  // Reading a note written under the protected tier: safety planning (RA 9262),
  // anything identifying a child in conflict with the law (RA 9344), a third
  // party's confidence. The narrow grant, and never implied by `case.view`.
  'case-note.view-protected',
  // Ending the office's involvement with a family. A decision, not a step, and
  // so held apart from `case.manage`.
  'case.close',

  'program.view',
  // Editing the catalog: guidance, documents, review windows, and the
  // responsibility record that says whose programme it is. Held apart from
  // `program.view` because a wrong entry here misdescribes the office to every
  // applicant at once.
  'program.manage',

  'request.view',
  'request.create',
  'request.intake',
  'request.assess',
  'request.endorse',
  'request.approve',
  'request.reject',
  'request.schedule',
  'request.close',
  // Opens records flagged under a sensitive sector (VAWC survivors, CICL).
  'request.view-sensitive',

  // Recording what an applicant presented, and replacing it when it lapses.
  // Held apart from `request.intake` because a document is evidence the office
  // stays answerable for long after the request itself is settled.
  'document.record',
  // Opening or saving the file. The narrow grant: a clerk can see that a
  // certificate was verified, and read its masked number, without being able to
  // pull the scan of somebody's medical abstract off the system.
  'document.download',
  // There is no key for reading a document number in full: only its last four
  // characters are ever held (DL-183, RA 10173; RA 11055 for a PhilSys number).
  // The file, behind `document.download`, is the full evidence.

  'release.view',
  'release.schedule',
  'release.release',
  'release.void',

  'referral.view',
  'referral.manage',

  'report.view',
  'report.export-person-level',

  'audit.view',
  /**
   * Opening the recorded before-and-after values on an audit entry.
   *
   * Held apart from `audit.view` because the list is designed to be scrolled
   * and filtered by somebody reviewing other people's work, and a row that
   * quotes what changed discloses it to everyone who filters by date. Reading
   * that a record was updated is oversight; reading what it was updated *to*
   * is access to the record itself (`DL-114`).
   */
  'audit.view-detail',

  'staff.view',
  'staff.manage',

  /**
   * Saving a named filter for the whole office rather than for yourself.
   *
   * Held apart from the permission to read the list, because a shared view's
   * *name* describes a population to everybody who opens that screen ("VAWC
   * survivors, Santa Ana"), and it persists after whoever wrote it has moved
   * on. A personal view needs no grant; an office-wide one does (`DL-111`).
   */
  'saved-view.share',

  /*
   * FIELD VISITS — their own grants, as of TAB 03.
   *
   * The visit screens were guarded by `case.view` and this console had no
   * `visit.*` key at all, while the API has always had two. A role holding
   * `case.view` but not `visit.view` therefore saw the Field visits link, opened
   * it, and was refused by the server — the "hides the wrong things and reveals
   * the wrong things" failure this convergence exists to end.
   *
   * A visit is a record with its own lifecycle, screens and disclosure rules
   * (`DL-85`, `DL-86`). Borrowing a case permission for it was convenience.
   */
  'visit.view',
  'visit.manage',

  /*
   * Events, added by the late-phase command.
   *
   * Extending this array rather than starting a second RBAC is the whole point
   * of the guardrail TAB: `check:access` already holds every key against the
   * office reference in `docs/access/permission-matrix.md`, and a parallel
   * permission system would be invisible to it (`DL-122`).
   *
   * The command suggests `view_insights` in snake_case. It is written here in
   * the kebab-case every other key in this array uses, because "extend the
   * existing model" governs the *shape* as well as the location — one array
   * with two naming conventions is a model nobody can predict.
   *
   * The nine `newsfeed.*` keys that arrived beside these went with the newsfeed
   * (`DL-194`): the news residents read is Balita, under `news.write`.
   */
  'event.view',
  'event.create',
  'event.edit',
  'event.publish',
  'event.cancel',
  'event.archive',
  'event.manage-registrations',
  // Held apart from managing them: a registration list names residents who
  // said they would attend, and a file of it leaves the building (`DL-106`).
  'event.export-registrants',
  'event.mark-attendance',
  'event.view-insights',

  'settings.manage',

  /*
   * RESIDENTS' APP — the first key that is the server's own (`DL-167`).
   *
   * Spelled exactly as the Node API's `StaffCapability`, because `fromServerIdentity` keeps only
   * keys the server sends and one vocabulary is the rule (`DL-122`): a console key that merely
   * resembled it would be a grant nobody can ever hold. The server gives it to `admin` alone, so
   * here only the system administrator holds it — by holding every key — and no other role is
   * granted it in the mock either. Mutating, not a read: it approves or rejects an identity.
   */
  'verification.review',

  /*
   * THE OFFICE INBOX (`DL-168`) — the server's key, spelled as its `StaffCapability`.
   *
   * The server gives it to `admin`, and to `staff` **only while the account is assigned to an
   * office**: an unassigned staff account holds no key, and the console says why rather than
   * showing an empty inbox. Mutating — it replies to residents and closes conversations.
   */
  'office-inbox.manage',

  /*
   * USERS AND ROLES (`DL-168`) — the server's keys, spelled as its `StaffCapability`.
   *
   * Every residents' app account, residents included, and who among them is staff. The server
   * gives all three to `admin` alone, so here only the system administrator holds them — by
   * holding every key — and no role names them, in the mock either. `user.view` reads; the other
   * two change who may use this console.
   */
  'user.view',
  'user.change-role',
  'user.assign-office',

  /*
   * THE RESIDENTS' APP DIRECTORY (`DL-170`) — the server's keys, spelled as its `StaffCapability`.
   *
   * The offices, Tulong pages and hotlines residents read in the app. The server gives all three to
   * `admin` alone, so here only the system administrator holds them — by holding every key — and no
   * role names them, in the mock either. Mutating: each one changes what every resident sees.
   */
  'office.manage',
  'service.manage',
  'hotline.manage',

  /*
   * THE APP'S HOME SCREEN (`DL-170`) — the server's key, spelled as its `StaffCapability`. Its banners
   * and links; the server gives it to `admin` alone, so only the system administrator holds it, by
   * holding every key. Mutating: it changes the first screen every resident sees.
   */
  'home.manage',

  /*
   * THE APP'S SETTINGS (`DL-170`) — the server's key, spelled as its `StaffCapability`. The contact
   * details, the terms and privacy versions residents must accept, the oldest app allowed and the
   * feature flags; the server gives it to `admin` alone. Mutating: one change can make every
   * resident update the app or accept again.
   */
  'app-config.manage',

  /*
   * DIGITAL IDS (`DL-171`) — the server's keys, spelled as its `StaffCapability`.
   *
   * `digital-id.verify` checks the card a resident's QR code names; the server gives it to every
   * staff account and to `admin`, so here every role holds it. A read: it changes no record, though
   * the server notes each check in its own trail. `digital-id.manage` issues, suspends, revokes and
   * replaces cards; the server gives it to `admin` alone, so only the system administrator holds it,
   * by holding every key. Mutating: it decides whether a resident's card works.
   */
  'digital-id.verify',
  'digital-id.manage',

  /*
   * BALITA (`DL-171`) — the server's key, spelled as its `StaffCapability`. Writing, publishing and
   * pinning the news residents read in the app — the console's one news channel since the newsfeed
   * and its `newsfeed.*` keys were retired (`DL-194`). The server gives it to `admin`, and to
   * `staff` only while the account is assigned to an office — the same rule as
   * `office-inbox.manage` — so the roles that hold that key hold this one. Mutating: a published
   * article goes out in the municipality's name.
   */
  'news.write',

  /*
   * RESIDENTS' DOCUMENT REQUESTS (`DL-184`) — the server's keys, spelled as its `StaffCapability`.
   * "Issuance" because "document request" already names the office asking an applicant for a
   * document (`document.record`). The server gives both to `admin`, and to `staff` only while the
   * account is assigned to an office. `issuance-type.manage` keeps the office's catalogue — in the
   * role table, the head's alone, because a catalogue entry tells every resident what the office
   * issues and on what terms. `issuance-request.manage` reviews and moves residents' requests — the
   * roles that work at the office. Both mutating: every move is read by the resident.
   */
  'issuance-type.manage',
  'issuance-request.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * How much of the municipality a user may see. Enforced server-side too; the
 * client value exists so the UI does not offer filters the user cannot use.
 */
export type DataScope = 'all-barangays' | 'own-barangay' | 'assigned-cases';

export type StaffRole =
  | 'system-administrator'
  | 'mswdo-head'
  | 'social-worker'
  | 'intake-officer'
  | 'release-officer'
  | 'barangay-link'
  | 'auditor';

/**
 * The seven roles as a list, for reading a role id the server sends (`DL-173`: the API's
 * `OfficeRole` names the same ids). Reading one is not deciding from it — authorization asks about
 * the permissions the server resolved.
 */
export const STAFF_ROLES: readonly StaffRole[] = [
  'system-administrator',
  'mswdo-head',
  'social-worker',
  'intake-officer',
  'release-officer',
  'barangay-link',
  'auditor',
];

export interface RoleDefinition {
  readonly role: StaffRole;
  readonly label: string;
  readonly description: string;
  readonly scope: DataScope;
  readonly permissions: readonly Permission[];
}

const INTAKE_PERMISSIONS: readonly Permission[] = [
  'dashboard.view',
  'resident.view',
  // Intake verifies identity against a presented PhilSys card and runs the
  // means test, so this tier starts here and is inherited upward.
  'resident.view-sensitive',
  'resident.create',
  'resident.update',
  // Intake asks "has this office helped them before?" at the counter, and the
  // answer changes the conversation. Reading the history is intake work.
  'beneficiary.view',
  'household.view',
  'household.manage',
  'family.view',
  'family.manage',
  'case.view',
  'case.manage',
  'case.note',
  // Reading visit records. Until TAB 03 this came free with `case.view`; it is
  // now its own grant, and the roles that could see the screen before still can.
  'visit.view',
  'program.view',
  'request.view',
  'request.create',
  'request.intake',
  'document.record',
  'referral.view',
  // Mirrors the server (`DL-168`): every staff account assigned to an office answers that office's
  // residents. The roles that work at the MSWDO hold it; the barangay link, who works from a
  // barangay rather than at an office, and the auditor, whose role is read-only, do not.
  'office-inbox.manage',
  // Mirrors the server (`DL-171`): every staff account checks a resident's digital ID, and a staff
  // account at an office writes that office's Balita.
  'digital-id.verify',
  'news.write',
  // Mirrors the server (`DL-184`): a staff account at the office reviews residents' requests for the
  // documents it issues. The barangay link and the auditor hold no office key, so not this one.
  'issuance-request.manage',
];

const SOCIAL_WORKER_PERMISSIONS: readonly Permission[] = [
  ...INTAKE_PERMISSIONS,
  // The worker who visited the house is the authority on what is true there.
  'household.correct-vulnerability',
  // The case manager writes and reads the protected tier. Nobody else routinely
  // needs the content of a safety plan to do their job.
  'case-note.view-protected',
  // The worker who went to the house writes the record of it.
  'visit.manage',
  // Deliberately not held by the intake officer, who is usually the person
  // whose counter created the duplicate. Whether two records are one person is
  // then adjudicated by somebody other than whoever typed the second one.
  'beneficiary.review-duplicates',
  'request.assess',
  'request.endorse',
  'request.view-sensitive',
  'document.download',
  'referral.manage',
  'report.view',
];

export const ROLE_DEFINITIONS: Readonly<Record<StaffRole, RoleDefinition>> = {
  'system-administrator': {
    role: 'system-administrator',
    label: 'System administrator',
    description: 'Maintains accounts, roles and reference data. Not a case worker.',
    scope: 'all-barangays',
    permissions: [...PERMISSIONS],
  },
  'mswdo-head': {
    role: 'mswdo-head',
    label: 'MSWDO head',
    description: 'Approves or rejects endorsed requests and oversees the office.',
    scope: 'all-barangays',
    permissions: [
      ...SOCIAL_WORKER_PERMISSIONS,
      'resident.deactivate',
      'resident.export',
      'resident.import',
      'beneficiary.export',
      'case.close',
      'program.manage',
      'request.approve',
      'request.reject',
      'request.schedule',
      'request.close',
      'release.view',
      'release.schedule',
      'release.void',
      'report.export-person-level',
      'audit.view',
      'staff.view',
      'saved-view.share',

  /*
   * FIELD VISITS — their own grants, as of TAB 03.
   *
   * The visit screens were guarded by `case.view` and this console had no
   * `visit.*` key at all, while the API has always had two. A role holding
   * `case.view` but not `visit.view` therefore saw the Field visits link, opened
   * it, and was refused by the server — the "hides the wrong things and reveals
   * the wrong things" failure this convergence exists to end.
   *
   * A visit is a record with its own lifecycle, screens and disclosure rules
   * (`DL-85`, `DL-86`). Borrowing a case permission for it was convenience.
   */
  'visit.view',
  'visit.manage',
      // The head is the office's publishing authority: an event goes out in the
      // MSWDO's name, and the command's "Events Manager" maps onto the role that
      // already answers for what the office says.
      'event.view',
      'event.create',
      'event.edit',
      'event.publish',
      'event.cancel',
      'event.archive',
      'event.manage-registrations',
      'event.export-registrants',
      'event.mark-attendance',
      'event.view-insights',
      // The office's catalogue of documents it issues (`DL-184`): what every resident is told the
      // office issues and on what terms, so the role that answers for what the office says.
      'issuance-type.manage',
    ],
  },
  'social-worker': {
    role: 'social-worker',
    label: 'Social worker',
    description: 'Conducts assessments and case studies, then endorses requests.',
    scope: 'assigned-cases',
    permissions: SOCIAL_WORKER_PERMISSIONS,
  },
  'intake-officer': {
    role: 'intake-officer',
    label: 'Intake officer',
    description: 'Receives applicants, records requests and validates requirements.',
    scope: 'all-barangays',
    permissions: [...INTAKE_PERMISSIONS, 'resident.import'],
  },
  'release-officer': {
    role: 'release-officer',
    label: 'Release officer',
    description: 'Schedules payouts and releases approved assistance.',
    scope: 'all-barangays',
    // No case access at all. A payout is authorised by the approved request in
    // front of them; the family's case file is not part of paying it out.
    permissions: [
      'dashboard.view',
      'resident.view',
      'household.view',
      'family.view',
      'program.view',
      'request.view',
      'release.view',
      'release.schedule',
      'release.release',
      'report.view',
      // A staff account at the office, so it answers the office's residents, as on the server.
      'office-inbox.manage',
      'digital-id.verify',
      'news.write',
      'issuance-request.manage',
    ],
  },
  'barangay-link': {
    role: 'barangay-link',
    label: 'Barangay link',
    description: 'Barangay-based encoder. Sees only their own barangay.',
    scope: 'own-barangay',
    // Deliberately no case access. A barangay encoder files requests and keeps
    // the registry current; the casework record of their neighbours is not
    // theirs to read, and proximity is the reason to be stricter, not looser.
    permissions: [
      'dashboard.view',
      'resident.view',
      'household.view',
      'family.view',
      'resident.create',
      'program.view',
      'request.view',
      'request.create',
      'referral.view',
      // Every staff account checks a resident's digital ID on the server (`DL-171`).
      'digital-id.verify',
    ],
  },
  auditor: {
    role: 'auditor',
    label: 'Auditor',
    description: 'Read-only oversight across the whole municipality.',
    scope: 'all-barangays',
    // `case.view` and not `case-note.view-protected`: oversight is checking that
    // the office recorded a reason, assigned an owner and acted in time. None of
    // that requires reading a survivor's safety plan.
    permissions: [
      'dashboard.view',
      'resident.view',
      'household.view',
      'family.view',
      'case.view',
      'visit.view',
      'program.view',
      'request.view',
      // Reading the history, never adjudicating it: `beneficiary.review-duplicates`
      // would let oversight alter the very identities it is checking.
      'beneficiary.view',
      'document.download',
      'release.view',
      'referral.view',
      'report.view',
      'report.export-person-level',
      'audit.view',
      // The auditor, and not the head, may open recorded values. Oversight of
      // the office is checking that a reason was given and an owner assigned;
      // checking whether a figure was altered improperly is the audit remit
      // specifically, and it is why this role is read-only everywhere else
      // (`DL-114`).
      'audit.view-detail',
      'staff.view',
      // Oversight of what the office published, and nothing that changes it.
      // The command's "Read-only Executive" maps here rather than to a new role.
      'event.view',
      'event.view-insights',
      // Every staff account checks a resident's digital ID on the server (`DL-171`); a read.
      'digital-id.verify',
    ],
  },
};

export function permissionsForRole(role: StaffRole): readonly Permission[] {
  return ROLE_DEFINITIONS[role].permissions;
}

export function scopeForRole(role: StaffRole): DataScope {
  return ROLE_DEFINITIONS[role].scope;
}

/**
 * How a permission requirement is combined.
 * `every` — the user must hold all listed permissions.
 * `some`  — any one of them is enough (the default for nav entries).
 */
export type PermissionMatch = 'every' | 'some';

export interface PermissionRequirement {
  readonly permissions: readonly Permission[];
  readonly match: PermissionMatch;
}

export function requireAll(...permissions: readonly Permission[]): PermissionRequirement {
  return { permissions, match: 'every' };
}

export function requireAny(...permissions: readonly Permission[]): PermissionRequirement {
  return { permissions, match: 'some' };
}
