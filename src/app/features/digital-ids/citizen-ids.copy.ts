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
    lead: 'Counted by the API under the search and barangay chosen below, whichever tab is open.',
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

  tabsLabel: 'Cards by status',
  allTab: 'All cards',

  search: 'Search',
  searchPlaceholder: 'Name or card number',
  searchHint:
    'At least two letters. A closed account’s name is not searched; its card number still is.',
  barangay: 'Barangay',
  allBarangays: 'All barangays',
  clear: 'Clear filters',
  order: 'Newest card first, as the API orders them.',

  caption: 'Cards the municipality has issued',
  columnResident: 'Resident',
  columnBarangay: 'Barangay',
  columnNumber: 'Card number',
  columnIssued: 'Issued',
  columnExpires: 'Expires',
  columnStatus: 'Status',
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
