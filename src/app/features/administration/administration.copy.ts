/**
 * Screen wording for user management, the audit trail and data governance.
 *
 * Three sentences are load-bearing. **"Not built"** is said plainly rather than
 * implied by a disabled button, because an administrator who fills in a form
 * reasonably believes it worked. **"No schedule recorded"** never appears as a
 * zero or a blank. And the audit list's own notice says why values are absent,
 * so their absence reads as a rule rather than as a missing feature.
 */
export const ADMIN_COPY = {
  staff: {
    title: 'Staff and roles',
    subtitle: 'Who holds an account, what it covers, and whether it is active.',
    roles: 'Permission matrix',
    audit: 'Audit trail',

    search: 'Search',
    searchPlaceholder: 'Name, unit or employee ID',
    includeInactive: 'Include deactivated accounts',

    columnName: 'Name',
    columnRole: 'Role',
    columnUnit: 'Unit',
    columnScope: 'Covers',
    columnStatus: 'Status',
    columnLastSignIn: 'Last signed in',

    active: 'Active',
    inactive: 'Deactivated',
    never: 'Never',
    allBarangays: 'All barangays',
    extraGrants: 'grants beyond the role',

    provisioningHeading: 'Adding an account',
    resetHeading: 'Resetting access',

    deactivate: 'Deactivate',
    reactivate: 'Reactivate',
    statusReason: 'Why',
    statusReasonHint: 'Recorded in the audit trail against your name. Required.',
    confirm: 'Save',
    cancel: 'Cancel',
    statusChanged: 'Account updated.',
    statusFailed: 'That could not be saved.',

    emptyHeading: 'No accounts match',
    emptyMessage: 'Try a wider search, or include deactivated accounts.',
  },

  roles: {
    title: 'Permission matrix',
    subtitle: 'Every permission in the system, and which roles hold it.',
    back: 'Back to staff',

    notice:
      'A permission is a grant, never a restriction. An account holds what its role gives it, ' +
      'plus anything granted individually — nothing is ever taken away by adding a grant.',

    separationHeading: 'Separation of duties',
    separationBody:
      'No role other than the system administrator both approves a request and releases its ' +
      'money. This is asserted by a test, so it cannot regress quietly.',

    columnPermission: 'Permission',
    holds: 'Holds',
    doesNotHold: 'Does not hold',
    sensitiveFlag: 'Sensitive',
    readOnly: 'Read only',
  },

  audit: {
    title: 'Audit trail',
    subtitle: 'Who accessed or changed a record, and when.',
    back: 'Back to staff',

    valuesNotice:
      'Rows say what changed and how sensitive it was — never what it changed to. Opening the ' +
      'recorded values is a separate permission, and doing so is itself recorded.',

    search: 'Search',
    searchPlaceholder: 'Summary, actor or record type',
    action: 'Action',
    allActions: 'Any action',
    entity: 'Record type',
    allEntities: 'Any record type',
    sensitiveOnly: 'Only entries touching sensitive information',
    clear: 'Clear filters',

    coverage: 'Showing',
    changedFields: 'Fields changed',
    sensitiveBadge: 'Sensitive',
    reason: 'Reason given',
    noReason: 'No reason was required for this action.',
    source: 'From',

    openValues: 'Show recorded values',
    hideValues: 'Hide values',
    valuesHeading: 'Recorded values',
    before: 'Before',
    after: 'After',
    noValues: 'No values were recorded for this entry.',
    cannotOpenValues:
      'Your account can read the trail but not the recorded values. Ask the data protection ' +
      'officer if you need them.',

    emptyHeading: 'Nothing recorded under this filter',
    emptyMessage: 'Try a wider date range, or clear the filters.',
  },

  governance: {
    title: 'Data governance',
    subtitle: 'What the office holds, how sensitive it is, and what it has not yet decided.',
    back: 'Back to staff',

    classificationHeading: 'What the office holds',
    classificationNotice:
      'Labels follow RA 10173. Sensitive personal information is restricted by statute, not by ' +
      'office preference.',
    columnRecord: 'Record type',
    columnClassification: 'Classification',
    columnHolds: 'What is kept',
    basisHeading: 'Statutory basis',

    retentionHeading: 'Retention and disposal',
    retentionAwaiting: 'record types have no schedule recorded',

    correctionHeading: 'Correction requests',
    correctionNotice:
      'A correction is raised, considered and answered — never applied silently. Whichever way ' +
      'it goes, the request and the reason stay on file.',
    correctionRaisedBy: 'Raised by',
    correctionOutcome: 'Outcome',
    correctionPending: 'Not yet answered.',
    correctionEmpty: 'No correction requests on file.',

    notBuiltHeading: 'Not built yet',
  },
} as const;
