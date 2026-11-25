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
    /* The board's "Accounts by role" figures (DL-232): open accounts, whole. */
    figuresLabel: 'Accounts by role',
    figures: {
      residents: { label: 'Resident accounts', hint: 'Residents and verified residents.' },
      verified: {
        label: 'Verified residents',
        hint: 'Verified through an ID review or in person.',
      },
      staff: {
        label: 'Staff and administrators',
        hint: (staff: number, admins: number) =>
          `${staff} staff · ${admins} ${admins === 1 ? 'administrator' : 'administrators'}`,
      },
      noOffice: { label: 'Staff with no office', hint: 'They answer no office’s inbox yet.' },
    },
    order: 'Newest accounts first, as the system sends them.',
    minimum:
      'Shown: name, email, role and office — what deciding who is staff needs. The system also ' +
      'sends a mobile number and a home barangay, which this screen does not show.',
    columnName: 'Name',
    columnEmail: 'Email',
    columnRole: 'Role',
    columnOffice: 'Office',
    columnAction: 'Manage',
    // "Recorded", not "given": a staff account is never asked for either (DL-239).
    noName: 'No name recorded',
    noEmail: 'No email recorded',
    noOffice: 'None',
    officeUnused: (office: string): string => `${office} (unused while not staff)`,
    you: 'You',
    manage: 'Manage',
    manageLabel: (who: string): string => `Manage ${who}`,
    // The button's name when an account has neither: never "Manage No name recorded".
    unnamedAccount: 'the account with no name or email',
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
    emptyMessage: 'The system returned no accounts.',
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
    // DL-239: a staff account is made at its first sign-in, with no profile.
    staffNameMissing:
      'A staff account gets its name from its holder’s own profile, and nobody has entered one ' +
      'for this account yet. This console does not set it.',
    email: 'Email',
    role: 'Role',
    office: 'Office',

    roleHeading: 'Role',
    roleLegend: 'Change the role to',
    current: '(current)',
    roleLead: 'What the system does if you change it to',
    roleAlways: 'Whichever role you choose:',
    roleConfirm: (label: string): string => `Change the role to ${label}`,
    roleChanging: 'Changing…',
    ownAccount:
      'This is your own account. The system refuses a change to your own role; another ' +
      'administrator can make it.',
    noRoleGrant: 'Your account may see roles but not change them.',

    officeHeading: 'Office',
    officeLabel: 'Office this staff account answers for',
    officeNone: 'No office',
    officeLead: 'What the system does:',
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
    failed: 'The system refused it or could not be reached.',
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
      'This is your own account. The system refuses a change to your own office role; another ' +
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
    lead: (role: string): string => `What the system does if you give the account ${role}:`,
    leadNone: 'What the system does if you take the office role away:',
    always: 'Whichever you choose:',
    reasonLabel: 'Why (required)',
    reasonHint: (max: number): string =>
      `Kept by the system with the change, with your name and the time. Up to ${max} characters.`,
    confirm: (role: string): string => `Give the office role ${role}`,
    confirmNone: 'Take the office role away',
    saving: 'Saving…',
    saved: (role: string): string => `Office role changed to ${role}.`,
    cleared: 'The office role was taken away.',
    notDone: (why: string): string => `That was not done. ${why}`,
    failed: 'The system refused it or could not be reached.',
  },

  /** Verifying a resident's account in person, at the counter (`DL-219`). */
  inPerson: {
    heading: 'Verify in person',
    intro:
      'For a resident at the counter with a government ID — for example one who declined the ' +
      'selfie, which the app takes only with its own consent. No photo or biometric data is taken.',
    ownAccount: 'This is your own account. The system refuses to verify your own account.',
    noName:
      'The account gives no name, so there is nothing to check an ID against. The resident adds ' +
      'the name printed on their ID in the app first.',
    open: 'Verify in person…',
    done: 'Verified in person. The account is now a verified resident account.',
    doneSuperseded:
      'Verified in person. The account is now a verified resident account; its waiting ID review ' +
      'was closed and its selfie erased.',
  },

  /** Correcting a verified account's name at the counter (`DL-198`). */
  nameCorrection: {
    heading: 'Correct the name',
    intro:
      'This account’s name was checked against the resident’s ID, so the resident cannot change ' +
      'it in the app. Correct it here only with a government ID in front of you that shows the ' +
      'new name — after a marriage or a court order, for example.',
    ownAccount: 'This is your own account. The system refuses a correction to your own name.',
    nameLabel: 'The name as the ID shows it',
    nameHint: 'Exactly as printed on the ID, up to 120 characters.',
    lead: 'What the system does if you correct it:',
    statement: 'I have seen a government ID that shows this name.',
    confirm: 'Correct the name',
    saving: 'Saving…',
    saved: (name: string): string => `The name is now ${name}.`,
    notDone: (why: string): string => `That was not done. ${why}`,
    failed: 'The system refused it or could not be reached.',
  },

  /** Linking a verified account to its registry record after the verification (`DL-260`). */
  registryLink: {
    heading: 'Registry record',
    ownAccount: 'This is your own account. The system refuses a link made by its own holder.',
    reading: 'Reading the account’s registry link…',
    readFailed:
      'The account’s registry link could not be read. Close this panel and open it again.',
    linked: 'This account is linked to a registry record. The link stays as it is.',
    openRecord: 'Open the record',
    unlinked:
      'This account is not linked to any registry record, so the resident’s My requests stay ' +
      'empty and she cannot apply for Tulong from the app. Link it with an ID that shows the ' +
      'account’s verified name in front of you.',
    open: 'Link to a registry record',
    dialogHeading: 'Link this account to a registry record',
    dialogIntro:
      'Choose the record that is this person, or make one. The system compares names and says ' +
      'how much they resemble; it decides nothing.',
    statement: (name: string): string =>
      `I have a government ID in front of me that shows the name ${name}, and the person it belongs to.`,
    cancel: 'Cancel',
    confirm: 'Link the account',
    saving: 'Linking…',
    done: (corrected: number): string =>
      corrected === 0
        ? 'The account is linked to the registry record.'
        : `The account is linked, and ${corrected} ${corrected === 1 ? 'detail' : 'details'} of the record ` +
          'corrected to the ID. What it said before is kept in its history. Tell the resident what ' +
          'was corrected.',
    notDone: (why: string): string => `The account was not linked. ${why}`,
    failed: 'The system refused it or could not be reached.',
  },
} as const;
