import type { DigitalIdAct } from '@domain/index';

/** Every sentence the digital IDs screen says (`DL-171`). */
export const DIGITAL_IDS_COPY = {
  page: {
    title: 'Citizen IDs',
    subtitle:
      'Residents carry this card in the Taytay app. Check the card a resident shows you, and keep the cards residents hold.',
  },

  check: {
    heading: 'Check a resident’s card',
    lead: 'Paste or type what the resident’s QR code holds, and the API says whose card it is and whether it is in force.',
    noCamera:
      'This console does not use the camera. A scanner that types into the field, or the code’s text copied from a scanning app, is enough.',
    label: 'The QR code’s contents',
    hint: 'Kept only until you press Check: the field is emptied as soon as the code is sent.',
    effectsLead: 'Before you check:',
    submit: 'Check this card',
    checking: 'Checking…',
    empty: 'Paste or type the code first.',
    tooLong: (max: number) => `That is longer than any code the app shows (${max} characters).`,
    refused: (reason: string) => `Not checked: ${reason}`,
    failed: 'The card could not be checked. Nothing was shown.',
    resultHeading: 'What the API says about this card',
    name: 'Name',
    noName: 'No name — the account has none, or it is closed.',
    status: 'Card',
    expiry: 'Expiry',
    expired: 'Expired',
    notExpired: 'Not expired',
    barangay: 'Barangay',
    noBarangay: 'None recorded',
    inForce:
      'The API says this card is active and not expired. Whether that settles what you are checking is your decision.',
    notInForce:
      'The API says this card is not in force. Whether that settles what you are checking is your decision.',
    clear: 'Clear the answer',
    cleared: 'The answer is cleared.',
    announced: 'The API answered. The answer is below.',
  },

  photo: {
    show: 'Show the photo on the card',
    hide: 'Hide the photo',
    warningHeading: 'Open this resident’s photo?',
    warning: [
      'This is a photograph of the resident’s face, from their identity verification.',
      'Open it only to compare it with the person in front of you, and close it when you have. It is not saved by this console.',
    ],
    confirm: 'Open the photo',
    cancel: 'Cancel',
    loading: 'Opening the photo…',
    failed: 'The photo could not be opened.',
    alt: (whose: string) => `The photo on the digital ID of ${whose}`,
  },

  manage: {
    heading: 'Residents’ cards',
    lead: 'Only a verified resident can hold a card. A card is issued and kept through the resident’s account; every card issued is on the Citizen ID list.',
    order:
      'Accounts are read a page at a time, newest first, and only the verified residents among them are shown.',
    caption: 'Verified residents',
    columnName: 'Name',
    columnEmail: 'Email',
    columnAction: 'Card',
    noName: 'No name given',
    noEmail: 'No email given',
    open: 'Open the card',
    openLabel: (name: string) => `Open the digital ID of ${name}`,
    read: (accounts: number, verified: number) =>
      `${verified} verified ${verified === 1 ? 'resident' : 'residents'} among the ${accounts} ${accounts === 1 ? 'account' : 'accounts'} read.`,
    moreAvailable: 'More accounts are available.',
    noMore: 'There are no more accounts.',
    showMore: 'Read more accounts',
    loadingMore: 'Reading more…',
    moreFailed: 'More accounts could not be read. Try again.',
    emptyHeading: 'No verified resident among these accounts',
    emptyMessage: 'Read more accounts, or verify a resident first under ID verification.',
    noManage: 'Keeping residents’ cards is for an administrator. You can check a card above.',
  },

  /** The card as the app draws it (`DL-211`): the words printed on it, and its label. */
  face: {
    label: (number: string) => `Taytay resident Digital ID, card ${number}`,
    province: 'Lalawigan ng Rizal',
    town: 'Municipality of Taytay',
    kind: 'Resident Digital ID',
    photoHidden: 'Photo hidden',
    name: 'Name',
    number: 'ID number',
    issued: 'Issued',
    expires: 'Expires',
  },

  panel: {
    heading: (name: string) => `Digital ID of ${name}`,
    loading: 'Reading the card…',
    failed: 'The card could not be read. Nothing is shown rather than a guess.',
    retry: 'Try again',
    none: 'This resident holds no current card.',
    noneWhy:
      'The API returns only an active or suspended card. A revoked card is not shown here; the Citizen ID list keeps it, as revoked.',
    number: 'Card number',
    numberNote: 'The municipality’s own number — not a national government identifier.',
    status: 'Status',
    issued: 'Issued',
    expires: 'Expires',
    pastExpiry: 'This card’s expiry has passed. The app shows no QR code for it.',
    cardHeading: 'Card',
    historyHeading: 'Card history',
    actsHeading: 'Change this card',
    effectsLead: (act: string) => `${act} — what it does:`,
    always: 'Whichever you choose:',
    act: {
      issue: 'Issue a card',
      suspend: 'Suspend the card',
      revoke: 'Revoke the card',
      reissue: 'Replace with a new card',
    } satisfies Record<DigitalIdAct, string>,
    confirmHeading: {
      issue: 'Issue a digital ID?',
      suspend: 'Suspend this card?',
      revoke: 'Revoke this card?',
      reissue: 'Replace this card?',
    } satisfies Record<DigitalIdAct, string>,
    confirm: {
      issue: 'Issue the card',
      suspend: 'Suspend it',
      revoke: 'Revoke it',
      reissue: 'Replace it',
    } satisfies Record<DigitalIdAct, string>,
    cancel: 'Keep it as it is',
    working: 'Sending…',
    outcome: {
      issue: 'The card was issued.',
      suspend: 'The card was suspended.',
      revoke: 'The card was revoked. It is no longer shown here.',
      reissue: 'The card was replaced. The new card is shown.',
    } satisfies Record<DigitalIdAct, string>,
    notDone: (reason: string) => `Nothing changed: ${reason}`,
    noAnswer: 'the API did not answer.',
    noActs: 'No act is open on this card.',
  },
} as const;
