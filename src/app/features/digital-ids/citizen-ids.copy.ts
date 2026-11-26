import {
  CARD_VALIDITY_DAYS,
  DIGITAL_ID_EXPIRING_DAYS,
  type DigitalIdListStatus,
} from '@domain/index';

/** Every sentence the Citizen IDs list says (`DL-212`). */
export const CITIZEN_IDS_COPY = {
  title: 'Citizen ID list',
  subtitle:
    'Residents carry this card in the Taytay app: the municipality’s own card, shown with a QR code. It is not a national government identifier, and only a verified resident can hold one.',
  check: 'Check a card',
  checkHeading: 'Check a resident’s card',
  issue: 'Issue a card',

  noManage:
    'Keeping the cards is for administrators. You can check the card a resident shows you with “Check a card”.',

  lifecycle: {
    heading: 'Where the cards stand',
    lead: 'Counted by the system under the search and barangay chosen below, whichever tab is open.',
    overlap: `A card expiring within ${DIGITAL_ID_EXPIRING_DAYS} days is still active, so it is counted in both.`,
    failed: 'The counts could not be read, so none is shown: a wrong count is worse than none.',
  },

  /** The stages of the strip, in the order a card passes through them. */
  stages: {
    active: { label: 'Active', hint: 'Shown in the app with a QR code' },
    expiring: {
      label: `Expiring in ${DIGITAL_ID_EXPIRING_DAYS} days`,
      hint: `Replace the card to give ${CARD_VALIDITY_DAYS} more days`,
    },
    expired: { label: 'Past their date', hint: 'Active, but cannot be presented' },
    suspended: { label: 'Suspended', hint: 'No QR code; cannot be made active again' },
    revoked: { label: 'Revoked', hint: 'Ended for good' },
  } satisfies Record<DigitalIdListStatus, { label: string; hint: string }>,

  /* From sign-up to card, ahead of the card stages (DL-232): the whole app, whatever is filtered. */
  funnel: {
    appAccounts: { label: 'Signed up on the app', hint: 'Open resident accounts' },
    pending: { label: 'Sent an ID for review', hint: 'Waiting for the office' },
    oldest: (when: string) => `Oldest waiting since ${when}`,
    verified: { label: 'Verified residents', hint: 'Can hold a card' },
    note: 'Counted for the whole app; the search, barangay and tab below do not narrow these three.',
  },

  /* Read after a figure by a screen reader: where it leads (DL-273). */
  figureLinks: {
    allAccounts: 'Open the account list; it shows staff accounts too',
    reviewQueue: 'Open the ID review queue',
    verifiedAccounts: 'Open these accounts in the account list',
    stageTab: 'Show these cards in the list below',
  },

  tabsLabel: 'Cards by status',
  allTab: 'All cards',
  noCardTab: 'Verified, no card',

  /* The verified residents holding no card (DL-232): accounts, not cards. */
  noCard: {
    caption: 'Verified residents with no card',
    lead: 'Accounts verified by the office that hold no active or suspended card. A revoked card is no card.',
    columnResident: 'Resident',
    columnEmail: 'Email',
    columnAction: 'Action',
    issue: 'Issue a card',
    issueLabel: (name: string) => `Issue a card to ${name}`,
    noName: 'No name on the account',
    noEmail: 'No email',
    emptyHeading: 'Every verified resident holds a card',
    emptyMessage: 'A resident appears here once verified, until a card is issued.',
    error: 'The verified residents with no card could not be read.',
    shown: (count: number) => `${count} ${count === 1 ? 'resident' : 'residents'} shown.`,
    noMore: 'That is every verified resident with no card.',
    moreFailed: 'The next residents could not be read. The ones above are still correct.',
  },

  search: 'Search',
  searchPlaceholder: 'Name or card number',
  searchHint:
    'At least two letters. A closed account’s name is not searched; its card number still is.',
  barangay: 'Barangay',
  allBarangays: 'All barangays',
  clear: 'Clear filters',
  order: 'Newest card first, as the system orders them.',

  caption: 'Cards the municipality has issued',
  columnResident: 'Resident',
  columnBarangay: 'Barangay',
  columnNumber: 'Card number',
  columnIssued: 'Issued',
  columnExpires: 'Expires',
  columnStatus: 'Status',
  columnVerified: 'Verified',
  notVerified: '—',
  columnAction: 'Action',
  noName: 'Name not shown: the account is closed',
  noBarangay: 'None recorded',
  pastDate: 'Past its date',
  open: 'Open the card',
  openLabel: (name: string) => `Open the card of ${name}`,
  recordHeading: (name: string) => `Citizen ID of ${name}`,
  closedHolder: 'a closed account',

  emptyHeading: 'No cards yet',
  emptyMessage: 'No card has been issued. Issue the first from a verified resident’s account.',
  noResultsHeading: 'No cards match',
  noResultsMessage: 'No card matches this status, search and barangay. Try fewer filters.',
  tryAgain: 'Try again',

  shown: (count: number) => `${count} ${count === 1 ? 'card' : 'cards'} shown.`,
  moreAvailable: 'More are available.',
  noMore: 'That is every card under these filters.',
  showMore: 'Show more',
  loadingMore: 'Loading…',
  moreFailed: 'The next cards could not be read. The ones above are still correct.',
} as const;
