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

  'disbursement.view',
  'disbursement.schedule',
  'disbursement.release',
  'disbursement.void',

  'referral.view',
  'referral.manage',

  'report.view',
  'report.export',

  'audit.view',

  'staff.view',
  'staff.manage',

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
  'referral.view',
];

const SOCIAL_WORKER_PERMISSIONS: readonly Permission[] = [
  ...INTAKE_PERMISSIONS,
  // The worker who visited the house is the authority on what is true there.
  'household.correct-vulnerability',
  // The case manager writes and reads the protected tier. Nobody else routinely
  // needs the content of a safety plan to do their job.
  'case.view-protected-note',
  'request.assess',
  'request.endorse',
  'request.view-sensitive',
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
      'disbursement.view',
      'referral.view',
      'report.view',
      'report.export',
      'audit.view',
      'staff.view',
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
