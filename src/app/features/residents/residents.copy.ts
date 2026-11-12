import type {
  ResidentDraftField,
  ResidentDraftRule,
  ResidentField,
  VulnerabilitySector,
} from '@domain/index';

/**
 * Every user-facing string for the registry, in one typed place (`DL-23`).
 *
 * Two of these maps are keyed by domain unions, so adding a withheld field or a
 * validation rule without wording it becomes a compile error rather than a blank
 * space on a screen.
 */
export const RESIDENTS_COPY = {
  list: {
    title: 'Citizen registry',
    subtitle:
      'Every citizen the office has on file: where they live and which sectors they belong to. Every case, payout and referral is filed against it.',
    caption: 'Residents registered with the MSWDO',
    search: 'Search',
    searchPlaceholder: 'Surname or given name',
    // Names only (`DL-174`, `DL-109`): a match on an address or a number would say what is in a
    // record the screen does not show, and a protected record's given name is not matched for a
    // reader shown only its initial.
    searchHint:
      'Searches surnames and given names — every word you type must match. Addresses and numbers are not searched.',
    barangay: 'Barangay',
    allBarangays: 'All barangays',
    sector: 'Sector',
    allSectors: 'All sectors',
    allSectorsTab: 'All citizens',
    // The tabs' short labels (CitizenRegistry mock-up): one row that never wraps, so "PWD".
    sectorTabs: {
      'senior-citizen': 'Senior citizens',
      pwd: 'PWD',
      'solo-parent': 'Solo parents',
      'four-ps': '4Ps',
      'indigenous-people': 'Indigenous people',
      unemployed: 'Unemployed',
      'out-of-school-youth': 'Out-of-school youth',
      'vawc-survivor': 'VAWC survivors',
      cicl: 'CICL',
      'displaced-worker': 'Displaced workers',
    } satisfies Readonly<Record<VulnerabilitySector, string>>,
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
    order: 'Alphabetical by surname, then given name.',
    shown: (count: number) => `${count} shown.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every resident matching these filters.',
    showMore: 'Show more',
    tryAgain: 'Try again',
    loadingMore: 'Loading more…',
    moreFailed:
      'The next residents could not be loaded. The ones above are still correct; try again.',
  },

  /** The sector pages (`DL-210`): what each says around the registry's list narrowed to it. */
  sector: {
    pagesLabel: 'Sector pages',
    figuresHeading: 'In numbers',
    attentionHeading: 'Needs attention',
    columnEnd: 'End membership',
    end: 'End',
    endLabel: (name: string, sector: string) => `End ${name}’s membership of ${sector}`,
    emptyMessage:
      'A person appears here once this sector is recorded on their registry record, with what was checked.',
    noMore: 'That is everybody in this sector matching these filters.',
    addHeading: (sector: string) => `Add somebody to ${sector}`,
    endHeading: (name: string, sector: string) => `End ${name}’s membership of ${sector}`,
    whoLabel: 'Who is this for?',
    addReason: 'What was checked',
    endReason: 'Why it ends',
    endHint:
      'Say why, for example the ID was not renewed or the child turned 18. It is kept with the change.',
    effectsLead: 'What this does:',
    addEffects: [
      'The sector is recorded on the person’s registry record, and they are listed on this page.',
      'What you checked is kept in the sector’s history, with your name.',
      'This console sends nothing to the resident.',
    ],
    endEffects: [
      'The person is no longer listed in this sector. Their registry record stays as it is.',
      'The membership stays in the sector’s history, with your reason and your name: nothing is deleted.',
      'This console sends nothing to the resident.',
    ],
    needPerson: 'Choose the person first.',
    needReason: 'Say what was checked, or why it ends, before you confirm.',
    confirmAdd: 'Add to the sector',
    confirmEnd: 'End membership',
    cancel: 'Cancel',
    working: 'Saving…',
    added: (name: string, sector: string) => `${name} was added to ${sector}.`,
    ended: (name: string, sector: string) => `${name}’s membership of ${sector} was ended.`,
    failed: 'The change was not saved, and nothing was recorded. Try again.',
  },

  detail: {
    visitsHeading: 'Home visits',
    noVisits: 'No home visit has been recorded for this person.',
    visitPurpose: 'Purpose',
    familiesHeading: 'Families',
    noFamilies: 'This person is not recorded in any family.',
    headedBy: 'Headed by',
    kinshipHeading: 'How this changed',
    kinshipHint:
      'Every recorded change, newest first, with who made it and why. Nothing here is ever removed — a relationship that ended is shown as ended, not deleted.',
    noKinshipHistory: 'No changes have been recorded.',
    // Said in the panel's place rather than an empty list, which would read as "none recorded".
    visitsNotOpen: 'Your role does not open home visits, so none were read for this record.',
    familiesNotOpen: 'Your role does not open families, so none were read for this record.',
    panelRefused: (reason: string) => `This part of the record was not read. ${reason}`,
    panelUnread: 'The server did not answer for it. The rest of the record is shown.',
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
    statusReasonLabel: 'Reason',
    statusReasonHint:
      'Required. Kept with the change on the record, with your name, for whoever reads it next.',
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
    /** Stands for the three headings above when the history could not be read at all. */
    historyHeading: 'Assistance requests, payouts and referrals',
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
    goodsReceived: (count: number): string =>
      `+ ${count} ${count === 1 ? 'release' : 'releases'} of goods, counted rather than valued`,
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
    saveFailedHeading: 'Not saved',
    /** The server's words when it gave any; what was typed is kept either way (`DL-196`). */
    saveFailed: (reason: string | null, refused: boolean) =>
      [
        refused ? 'The save was refused, and nothing was saved.' : 'The record could not be saved.',
        reason,
        'What you typed is still on the form.',
      ]
        .filter((part): part is string => part !== null)
        .join(' '),
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

/**
 * The three sectors that have a page of their own (`DL-210`), in the order the tabs list them. Each
 * is a literal route, `residents/sectors/<sector>`, so an unknown sector is the not-found page
 * rather than a list read with a parameter nobody checked.
 */
export const SECTOR_PAGE_SECTORS = [
  'senior-citizen',
  'pwd',
  'solo-parent',
] as const satisfies readonly VulnerabilitySector[];

export type SectorPageSector = (typeof SECTOR_PAGE_SECTORS)[number];

export interface SectorPageCopy {
  readonly title: string;
  readonly tab: string;
  /** The sector as the object of a sentence: "added to the senior citizen sector". */
  readonly phrase: string;
  readonly subtitle: string;
  readonly add: string;
  readonly listHeading: string;
  readonly emptyHeading: string;
  readonly evidenceHint: string;
}

// Membership is what the office recorded, with what it checked; a page never derives it from an
// age or a field, so none of these says "everyone aged 60".
export const SECTOR_PAGES: Readonly<Record<SectorPageSector, SectorPageCopy>> = {
  'senior-citizen': {
    title: 'Senior citizens',
    tab: 'Senior citizens',
    phrase: 'the senior citizen sector',
    subtitle:
      'Residents recorded in the senior citizen sector (RA 9994, the Expanded Senior Citizens Act).',
    add: 'Add a senior citizen',
    listHeading: 'Senior citizens on the registry',
    emptyHeading: 'No senior citizen is recorded yet',
    evidenceHint:
      'Say what you checked, for example a Senior Citizen ID or a birth certificate. It is kept in the sector’s history.',
  },
  pwd: {
    title: 'Persons with disability',
    tab: 'PWD',
    phrase: 'the PWD sector',
    subtitle:
      'Residents recorded in the persons with disability sector (RA 7277 as amended by RA 10754).',
    add: 'Add a person with disability',
    listHeading: 'Persons with disability on the registry',
    emptyHeading: 'No person with disability is recorded yet',
    evidenceHint:
      'Say what you checked, for example a PWD ID or a medical certificate. It is kept in the sector’s history.',
  },
  'solo-parent': {
    title: 'Solo parents',
    tab: 'Solo parents',
    phrase: 'the solo parent sector',
    subtitle: 'Residents recorded in the solo parent sector (RA 8972 as amended by RA 11861).',
    add: 'Add a solo parent',
    listHeading: 'Solo parents on the registry',
    emptyHeading: 'No solo parent is recorded yet',
    evidenceHint:
      'Say what you checked, for example a Solo Parent ID. It is kept in the sector’s history.',
  },
};
