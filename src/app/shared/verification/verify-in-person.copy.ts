/**
 * Copy for verifying a resident's account in person, at the counter (`DL-219`, `DL-23`).
 *
 * Every sentence keeps two things straight: the person is in front of the reader with a government
 * ID in their hand, and nothing about their face or body is taken here.
 */
export const VERIFY_IN_PERSON_COPY = {
  heading: 'Verify in person',
  intro:
    'For a resident at the counter with a government ID, such as one who declined the selfie. ' +
    'Check the ID against the person in front of you and against the name this account gives.',
  accountName: 'Name the account gives',

  idLegend: 'The ID the resident showed',
  idType: 'Kind of ID',
  idTypeChoose: 'Choose the kind of ID',
  lastFour: 'Last four characters of its number',
  lastFourHint:
    'Only these four are recorded, never the whole number. Letters and digits, as printed.',
  correctedLabel: 'The name as the ID shows it, if it is different',
  correctedHint:
    'Leave this empty when the ID shows the account’s name. Fill it in only when it shows ' +
    'another — after a marriage or a court order, for example — exactly as printed, up to 120 ' +
    'characters.',

  lead: 'What the server does when you verify:',
  /** The statement the button waits for, worded as an approval words it (`DL-197`). */
  statement: (name: string): string => `The ID shows the name “${name}”.`,
  statementHint:
    'Required. Tick it only with the ID in front of you. If it shows another name, type that ' +
    'name above first.',
  waiting:
    'To verify: choose the kind of ID, type the last four characters of its number, and tick ' +
    'that the ID shows the name.',

  cancel: 'Cancel',
  confirm: 'Verify in person',
  saving: 'Verifying…',
  notDone: (why: string): string => `The account was not verified. ${why}`,
  nothingChanged:
    'Nothing was changed. Close this and read the account again: it may have changed since it ' +
    'was shown.',
  failed: 'The server refused it or could not be reached.',
} as const;
