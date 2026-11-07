import type { AccountVerificationStatus } from '@domain/index';

/**
 * Copy for users and roles (`DL-168`, `DL-23`).
 *
 * Every sentence keeps two things straight: most of these accounts are residents, shown no more than
 * a decision about staff needs; and a change of role or office says what the server will do before
 * anybody presses the button.
 */
export const ACCOUNTS_COPY = {
  list: {
    title: 'Users and roles',
    subtitle:
      'Every account in the residents’ app — residents and staff — and who may use this console.',
    caption: 'Accounts',
    order: 'Newest accounts first, as the server sends them.',
    minimum:
      'Shown: name, email, role and office — what deciding who is staff needs. The server also ' +
      'sends a mobile number and a home barangay, which this screen does not show.',
    columnName: 'Name',
    columnEmail: 'Email',
    columnRole: 'Role',
    columnOffice: 'Office',
    columnAction: 'Manage',
    noName: 'No name given',
    noEmail: 'No email given',
    noOffice: 'None',
    officeUnused: (office: string): string => `${office} (unused while not staff)`,
    you: 'You',
    manage: 'Manage',
    manageLabel: (who: string): string => `Manage ${who}`,
    officesUnnamed:
      'The office directory could not be loaded, so offices are shown by their identifier and none ' +
      'can be assigned until it loads.',
    verification: 'Verification',
    everyAccount: 'Every account, residents and staff',
    verificationLabels: {
      unverified: 'Not verified',
      pending: 'Waiting for an ID review',
      verified: 'Verified',
      rejected: 'Not accepted',
    } satisfies Record<AccountVerificationStatus, string>,
    verificationNote: (status: string): string =>
      `Showing residents’ app accounts that are not closed and whose verification is “${status}” — ` +
      'the accounts the dashboard counts under it. Staff accounts are not listed while a ' +
      'verification is chosen.',
    emptyHeading: 'No accounts',
    emptyMessage: 'The server returned no accounts.',
    shown: (count: number): string =>
      count === 1 ? 'Showing 1 account.' : `Showing ${count} accounts.`,
    moreAvailable: 'More are available.',
    noMore: 'That is all of them.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next accounts could not be loaded. The ones above are still correct.',
    drawerHeading: 'Manage an account',
  },

  panel: {
    detailsHeading: 'The account',
    name: 'Name',
    email: 'Email',
    role: 'Role',
    office: 'Office',

    roleHeading: 'Role',
    roleLegend: 'Change the role to',
    current: '(current)',
    roleLead: 'What the server does if you change it to',
    roleAlways: 'Whichever role you choose:',
    roleConfirm: (label: string): string => `Change the role to ${label}`,
    roleChanging: 'Changing…',
    ownAccount:
      'This is your own account. The server refuses a change to your own role; another ' +
      'administrator can make it.',
    noRoleGrant: 'Your account may see roles but not change them.',

    officeHeading: 'Office',
    officeLabel: 'Office this staff account answers for',
    officeNone: 'No office',
    officeLead: 'What the server does:',
    officeConfirmAssign: (office: string): string => `Assign to ${office}`,
    officeConfirmClear: 'Remove the office link',
    officeSaving: 'Saving…',
    officeUnchanged: 'Choose a different office to change it.',
    officeNotStaff:
      'Only a staff account can be linked to an office. Change the role to Staff first.',
    officeKept: (office: string): string =>
      `Linked to ${office}, unused while the account is not staff. It applies again if the ` +
      'account becomes staff.',
    officesLoading: 'Loading the office directory…',
    officesFailed: 'The office directory could not be loaded, so no office can be assigned.',
    noOfficeGrant: 'Your account may see offices but not assign them.',

    roleChanged: (label: string): string => `Role changed to ${label}.`,
    officeAssigned: (office: string): string => `Assigned to ${office}.`,
    officeCleared: 'The office link was removed.',
    notDone: (why: string): string => `That was not done. ${why}`,
    failed: 'The server refused it or could not be reached.',
  },

  /** The office role (`DL-173`): which of the office's jobs a staff account does. */
  officeRole: {
    heading: 'Office role',
    now: (role: string): string => `Now: ${role}.`,
    nowNone: 'Now: none. The account holds no casework permission.',
    confinedTo: (barangay: string): string => `Confined to ${barangay}.`,
    confinedUnnamed: 'Confined to one barangay, which the list could not name.',
    administrator:
      'An administrator is the system administrator: it holds every permission by holding the ' +
      'Administrator role. That is the account role, above, not an office role.',
    notStaff: 'Only a staff account holds an office role. Change the role to Staff first.',
    ownAccount:
      'This is your own account. The server refuses a change to your own office role; another ' +
      'administrator can make it.',
    noGrant: 'Your account may see office roles but not change them.',
    legend: 'Give the account the office role',
    current: '(current)',
    none: 'No office role',
    noneHint: 'Withdraws every casework permission. The account stays staff.',
    scope: {
      'all-barangays': 'Sees every barangay.',
      'own-barangay': 'Sees one barangay only, chosen below.',
      'assigned-cases': 'Sees only the cases assigned to it.',
    },
    barangayLabel: 'The barangay this barangay link works in',
    barangayChoose: 'Choose a barangay',
    barangaysLoading: 'Loading the barangays…',
    barangaysFailed: 'The barangays could not be loaded, so a barangay link cannot be given yet.',
    lead: (role: string): string => `What the server does if you give the account ${role}:`,
    leadNone: 'What the server does if you take the office role away:',
    always: 'Whichever you choose:',
    reasonLabel: 'Why (required)',
    reasonHint: (max: number): string =>
      `Kept by the server with the change, with your name and the time. Up to ${max} characters.`,
    confirm: (role: string): string => `Give the office role ${role}`,
    confirmNone: 'Take the office role away',
    saving: 'Saving…',
    saved: (role: string): string => `Office role changed to ${role}.`,
    cleared: 'The office role was taken away.',
    notDone: (why: string): string => `That was not done. ${why}`,
    failed: 'The server refused it or could not be reached.',
  },
} as const;
