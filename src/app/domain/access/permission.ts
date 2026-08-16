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
  'case.view-protected-note',
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
  // Reading a document number in full rather than masked to its last four
  // characters. Separate again, because a number is disclosive on its own.
  'document.view-full-number',

  'disbursement.view',
  'disbursement.schedule',
  'disbursement.release',
  'disbursement.void',

  'referral.view',
  'referral.manage',

  'report.view',
  'report.export',

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
  'view.share',

  /*
   * Newsfeed and Events, added by the late-phase command.
   *
   * Extending this array rather than starting a second RBAC is the whole point
   * of the guardrail TAB: `check:access` already holds every key against the
   * office reference in `docs/access/permission-matrix.md`, and a parallel
   * permission system would be invisible to it (`DL-122`).
   *
   * The command suggests `moderate_comments` and `view_insights` in snake_case.
   * They are written here in the kebab-case every other key in this array uses,
   * because "extend the existing model" governs the *shape* as well as the
   * location — one array with two naming conventions is a model nobody can
   * predict.
   */
  'newsfeed.view',
  'newsfeed.create',
  'newsfeed.edit',
  // Publishing is held apart from editing throughout this application, and a
  // post is the one artefact here that reaches residents directly.
  'newsfeed.publish',
  'newsfeed.schedule',
  'newsfeed.archive',
  'newsfeed.pin',
  // Hiding somebody's comment is a disclosure decision about a resident's own
  // words, not a formatting one.
  'newsfeed.moderate-comments',
  'newsfeed.view-insights',

  'events.view',
  'events.create',
  'events.edit',
  'events.publish',
  'events.cancel',
  'events.archive',
  'events.manage-registrations',
  // Held apart from managing them: a registration list names residents who
  // said they would attend, and a file of it leaves the building (`DL-106`).
  'events.export-registrations',
  'events.mark-attendance',
  'events.view-insights',

  'settings.manage',
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
  | 'disbursement-officer'
  | 'barangay-link'
  | 'auditor';

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
  'program.view',
  'request.view',
  'request.create',
  'request.intake',
  'document.record',
  'referral.view',
];

const SOCIAL_WORKER_PERMISSIONS: readonly Permission[] = [
  ...INTAKE_PERMISSIONS,
  // The worker who visited the house is the authority on what is true there.
  'household.correct-vulnerability',
  // The case manager writes and reads the protected tier. Nobody else routinely
  // needs the content of a safety plan to do their job.
  'case.view-protected-note',
  // Deliberately not held by the intake officer, who is usually the person
  // whose counter created the duplicate. Whether two records are one person is
  // then adjudicated by somebody other than whoever typed the second one.
  'beneficiary.review-duplicates',
  'request.assess',
  'request.endorse',
  'request.view-sensitive',
  'document.download',
  'document.view-full-number',
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
      'beneficiary.export',
      'case.close',
      'program.manage',
      'request.approve',
      'request.reject',
      'request.schedule',
      'request.close',
      'disbursement.view',
      'disbursement.schedule',
      'disbursement.void',
      'report.export',
      'audit.view',
      'staff.view',
      'view.share',
      // The head is the office's publishing authority: a post or an event goes
      // out in the MSWDO's name, and the command's "Newsfeed Manager" and
      // "Events Manager" map onto the role that already answers for what the
      // office says.
      'newsfeed.view',
      'newsfeed.create',
      'newsfeed.edit',
      'newsfeed.publish',
      'newsfeed.schedule',
      'newsfeed.archive',
      'newsfeed.pin',
      'newsfeed.moderate-comments',
      'newsfeed.view-insights',
      'events.view',
      'events.create',
      'events.edit',
      'events.publish',
      'events.cancel',
      'events.archive',
      'events.manage-registrations',
      'events.export-registrations',
      'events.mark-attendance',
      'events.view-insights',
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
    permissions: INTAKE_PERMISSIONS,
  },
  'disbursement-officer': {
    role: 'disbursement-officer',
    label: 'Disbursement officer',
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
      'disbursement.view',
      'disbursement.schedule',
      'disbursement.release',
      'report.view',
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
    ],
  },
  auditor: {
    role: 'auditor',
    label: 'Auditor',
    description: 'Read-only oversight across the whole municipality.',
    scope: 'all-barangays',
    // `case.view` and not `case.view-protected-note`: oversight is checking that
    // the office recorded a reason, assigned an owner and acted in time. None of
    // that requires reading a survivor's safety plan.
    permissions: [
      'dashboard.view',
      'resident.view',
      'household.view',
      'family.view',
      'case.view',
      'program.view',
      'request.view',
      // Reading the history, never adjudicating it: `beneficiary.review-duplicates`
      // would let oversight alter the very identities it is checking.
      'beneficiary.view',
      'document.download',
      'disbursement.view',
      'referral.view',
      'report.view',
      'report.export',
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
      'newsfeed.view',
      'newsfeed.view-insights',
      'events.view',
      'events.view-insights',
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
