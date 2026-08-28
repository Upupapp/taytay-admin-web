import type { ResidentDraftField, ResidentDraftRule, ResidentField } from '@domain/index';

/**
 * Every user-facing string for the registry, in one typed place (`DL-23`).
 *
 * Two of these maps are keyed by domain unions, so adding a withheld field or a
 * validation rule without wording it becomes a compile error rather than a blank
 * space on a screen.
 */
export const RESIDENTS_COPY = {
  list: {
    title: 'Residents',
    subtitle: 'The registry every case, payout and referral is filed against.',
    caption: 'Residents registered with the MSWDO',
    search: 'Search',
    searchPlaceholder: 'Name, address or mobile number',
    searchHint: 'Searches names, street addresses, barangay and mobile numbers.',
    barangay: 'Barangay',
    allBarangays: 'All barangays',
    sector: 'Sector',
    allSectors: 'All sectors',
    ageGroup: 'Age group',
    allAges: 'All ages',
    includeInactive: 'Include retired records',
    clear: 'Clear filters',
    create: 'Register a resident',
    emptyHeading: 'No residents yet',
    emptyMessage: 'Residents appear here once they have been registered at intake.',
    noResultsHeading: 'No residents match those filters',
    noResultsMessage: 'Try a different spelling, or clear the filters to see every record.',
    columnResident: 'Resident',
    columnBarangay: 'Barangay',
    columnAge: 'Age',
    columnSectors: 'Sectors',
    columnStatus: 'Status',
    retired: 'Retired',
    active: 'Active',
    restricted: 'Restricted',
    none: '—',
  },

  detail: {
    subtitleFallback: 'Resident record',
    edit: 'Edit record',
    retire: 'Retire record',
    restore: 'Restore to active registry',
    retireConfirmHeading: 'Retire this record?',
    retireConfirmBody:
      'The record stays on file and keeps its history. It is hidden from the active registry until it is restored.',
    retireConfirm: 'Retire record',
    restoreConfirmHeading: 'Restore this record?',
    restoreConfirmBody: 'The resident will appear in the active registry again.',
    restoreConfirm: 'Restore record',
    cancel: 'Cancel',
    notFoundHeading: 'That resident is not available',
    notFoundMessage:
      'The record does not exist, or it is outside the part of the municipality you cover.',
    backToList: 'Back to residents',

    identityHeading: 'Identity',
    addressHeading: 'Address',
    contactHeading: 'Contact',
    householdHeading: 'Household',
    familyHeading: 'Family members',
    casesHeading: 'Assistance requests',
    payoutsHeading: 'Payouts',
    referralsHeading: 'Referrals',
    recordHeading: 'Record',

    born: 'Date of birth',
    age: 'Age',
    sex: 'Sex',
    civilStatus: 'Civil status',
    philsys: 'PhilSys (last 4)',
    monthlyIncome: 'Monthly income',
    sectors: 'Sectors',
    mobile: 'Mobile',
    email: 'Email',
    barangay: 'Barangay',
    purok: 'Purok or sitio',
    street: 'Street address',
    householdReference: 'Household number',
    householdIncome: 'Household income',
    indigent: 'Classified indigent',
    yes: 'Yes',
    no: 'No',
    created: 'Registered',
    updated: 'Last updated',

    noHousehold: 'This resident is not linked to a household.',
    noFamily: 'No other members are recorded in this household.',
    noCases: 'No assistance request has been filed for this resident.',
    noPayouts: 'No payout has been recorded for this resident.',
    noReferrals: 'This resident has not been referred to a partner office.',

    totalReleased: 'Total released',
    openCases: 'Open requests',
    lastActivity: 'Last activity',
    caseCount: 'Requests on file',

    protectedHeading: 'Protected record',
    protectedBody:
      'This person is recorded under a sector protected by RA 9262 or RA 9344. Handle the record accordingly.',
    withheldHeading: 'Hidden by your role',
    withheldBody:
      'These details exist on the record but were not sent to this screen. Ask the MSWDO head if you need them for a case.',
  },

  form: {
    createTitle: 'Register a resident',
    createSubtitle: 'Add a person to the municipal registry.',
    editTitle: 'Edit resident',
    editSubtitle: 'Correct the details on an existing record.',
    save: 'Save record',
    saving: 'Saving…',
    cancel: 'Cancel',

    nameHeading: 'Name',
    first: 'First name',
    middle: 'Middle name',
    last: 'Last name',
    suffix: 'Suffix',

    personalHeading: 'Personal details',
    birthDate: 'Date of birth',
    sex: 'Sex',
    civilStatus: 'Civil status',
    philsys: 'PhilSys — last four digits only',
    philsysHint: 'The full PhilSys number is never recorded here (RA 11055).',
    monthlyIncome: 'Monthly income (₱)',

    addressHeading: 'Address',
    barangay: 'Barangay',
    purok: 'Purok or sitio',
    street: 'Street address',

    contactHeading: 'Contact',
    mobile: 'Mobile number',
    email: 'Email address',

    sectorsHeading: 'Sectors',
    sectorsHint: 'Tick every sector that applies. These drive programme eligibility.',
    sectorsRestricted:
      'Protected sectors are not offered here. Recording one requires the sensitive-records permission.',
    sectorBasisLabel: 'How was this established?',
    sectorBasisHint:
      'Name what you saw — a Senior Citizen ID, a PWD card, a Solo Parent ID. This is recorded against your name with the sector.',
    sectorBasisRequired: 'Say how these sectors were established before saving.',
    /**
     * Named individually rather than counted.
     *
     * "2 sectors could not be recorded" tells a clerk to check all of them; naming the two tells
     * them which. A safeguarding sector refused for want of the sensitive grant is the likeliest
     * case, and it is the one where a vague message costs the most.
     */
    sectorsNotRecorded: (sectors: readonly string[]): string =>
      `The record was saved, but ${sectors.join(' and ')} could not be recorded. Nothing about those sectors was kept — record them from the resident's page.`,

    problemsHeading: 'Check these before saving',
    savedCreate: 'Resident registered.',
    savedUpdate: 'Resident record updated.',
    optional: 'Optional',
  },

  /** Keyed by the domain union, so a new field cannot ship unworded. */
  withheldField: {
    philsysLastFour: 'PhilSys reference',
    monthlyIncome: 'Monthly income',
    protectedSectors: 'Protected sector membership',
    contact: 'Contact details',
    exactAddress: 'Street address',
  } satisfies Record<ResidentField, string>,

  fieldLabel: {
    first: 'First name',
    last: 'Last name',
    birthDate: 'Date of birth',
    barangayId: 'Barangay',
    streetAddress: 'Street address',
    philsysLastFour: 'PhilSys last four digits',
    mobile: 'Mobile number',
    email: 'Email address',
  } satisfies Record<ResidentDraftField, string>,

  rule: {
    required: 'is required.',
    'not-a-date': 'is not a date we can read.',
    'in-the-future': 'cannot be in the future.',
    'implausibly-old': 'gives an age no one has reached.',
    'must-be-four-digits': 'must be exactly four digits, or left blank.',
    'not-a-mobile-number': 'does not look like a Philippine mobile number.',
    'not-an-email': 'does not look like an email address.',
  } satisfies Record<ResidentDraftRule, string>,
} as const;
