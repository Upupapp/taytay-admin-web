import type {
  AccountLinkDecisionKind,
  AccountLinkProblem,
  RegistryMatchAttribute,
  RegistryMatchOutcome,
  RegistryMatchStrength,
} from '@domain/index';

/**
 * Copy for deciding which registry record a verified app account is (`DL-228`).
 *
 * Every choice says what it does **before** the button: what the resident then reads in the app
 * follows the record the account is linked to, and a choice the reviewer cannot make is said rather
 * than hidden. A match is described in words — never a value (`DL-73`).
 */
export const ACCOUNT_LINK_COPY = {
  heading: 'Registry record',
  intro:
    'With the ID in hand, say which of the office’s registry records this person is. The ' +
    'resident’s My requests and applications in the app follow the record the account is linked ' +
    'to.',
  loading: 'Looking for registry records with this name…',
  failedHeading: 'The registry records could not be read',
  retry: 'Try again',
  failedHint:
    'You can still make a record from this account or leave it unlinked. To link it to a record, ' +
    'try reading the records again.',
  alreadyLinked:
    'This account is already linked to a registry record. Approving keeps that link; nothing ' +
    'about it is decided here.',
  openRecord: 'Open the record',
  noMatches:
    'No registry record has this name. Make a record from the account, or leave it unlinked and ' +
    'say why.',
  legend: 'What should verifying do with the registry?',
  linkTo: (label: string): string => `Link to ${label}`,
  heldByOther:
    'Another app account holds this record, so the server would refuse a link to it. Open the ' +
    'record to see whose it is.',
  strength: {
    strong: 'Strong resemblance',
    moderate: 'Some resemblance',
    weak: 'Weak resemblance',
  } satisfies Record<RegistryMatchStrength, string>,
  strengthHint: 'The resemblance only orders the list. It decides nothing; you do.',
  attribute: {
    surname: 'Surname',
    'given-name': 'Given name',
    barangay: 'Barangay',
    mobile: 'Mobile number',
    'birth-date': 'Birth date',
    sex: 'Sex',
  } satisfies Record<RegistryMatchAttribute, string>,
  outcome: {
    same: 'the same',
    similar: 'similar',
    differs: 'different',
    'not-comparable': 'cannot be compared',
  } satisfies Record<RegistryMatchOutcome, string>,
  create: 'Make a registry record from this account',
  createHint:
    'For a person the office has never recorded. The record takes the verified name, and the ' +
    'account’s barangay, purok and mobile number.',
  leave: 'Leave the account unlinked for now',
  leaveHint: 'When you cannot yet say which record this person is. Say why.',

  reason: 'Why',
  reasonHint: 'Kept with your name. Up to 500 characters.',
  reasonOptional: 'Why (optional)',
  reasonOptionalHint:
    'Kept with your name. Without one, the record says it was made from the account at ' +
    'verification.',
  nameHint: (name: string): string =>
    `Split the verified name, “${name}”, into the registry’s parts: the same words, nothing ` +
    'added. The server refuses a split that is not that name.',
  firstName: 'Given name',
  middleName: 'Middle name (optional)',
  lastName: 'Surname',
  suffix: 'Suffix (optional)',
  sex: 'Sex, as the ID shows it',
  sexFromAccount: 'As the account gives it',
  sexes: { female: 'Female', male: 'Male' },
  birthDate: 'Birth date, as the ID shows it (optional)',
  birthDateHint: 'Leave empty to use the account’s. The server refuses when neither gives one.',
  civilStatus: 'Civil status',
  civilStatusChoose: 'Choose the civil status',
  street: 'Street address (optional)',
  streetHint: 'Leave empty to use the account’s street or address.',

  /** Said before the button, for the choice made (`DL-228`). */
  effect: {
    link: (label: string): string =>
      `Verifying links this account to ${label}. The resident’s My requests and applications in ` +
      'the app then show what the office holds on that record. The link and your reason are kept.',
    create:
      'Verifying makes a registry record from this account — the verified name, the account’s ' +
      'barangay, purok and mobile number, and what you give above — and links the account to it. ' +
      'No email, PhilSys digits or income is written.',
    'leave-unlinked':
      'Verifying links nothing. The resident’s My requests and applications stay empty until the ' +
      'office links the account, here or by approving a sector application. Your reason is kept.',
  } satisfies Record<AccountLinkDecisionKind, unknown>,
  refusedTogether:
    'A refused link refuses the verification too: nothing is verified until the registry choice ' +
    'is accepted.',

  problem: {
    choose: 'Choose what verifying does with the registry.',
    'choose-record': 'Choose the record to link to.',
    'record-held': 'Another app account holds that record. Choose another, or another choice.',
    reason: 'Say why, in a sentence.',
    'reason-too-long': 'The reason is at most 500 characters.',
    'first-name': 'Give the given name.',
    'last-name': 'Give the surname.',
    'name-too-long': 'A name part is at most 100 characters, a suffix at most 20.',
    'civil-status': 'Choose the civil status.',
    'birth-date': 'Give the birth date as a date, or leave it empty.',
    'street-too-long': 'The street address is at most 200 characters.',
  } satisfies Record<AccountLinkProblem, string>,

  /** What an approval recorded, said on a decided request. */
  recorded: {
    link: 'Linked to a registry record at verification.',
    create: 'A registry record was made from this account at verification, and linked.',
    'leave-unlinked': 'Left unlinked at verification, with a reason.',
  } satisfies Record<AccountLinkDecisionKind, string>,
} as const;
