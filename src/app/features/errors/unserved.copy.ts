/**
 * Copy for the page that names every module the connected API cannot serve (`DL-167`, `DL-23`).
 *
 * Every sentence here has one job: to stop an officer reading an absent module as an absent
 * record (`DL-112`). So it says what is missing is a **server**, that nothing was asked for, and
 * that nothing was deleted — and it never says "no records", "empty" or "none found", which are
 * claims about the office this page cannot make.
 */
export const UNSERVED_COPY = {
  heading: 'Not connected yet',
  subtitle: 'Parts of this console that are not connected to the office system yet.',

  everythingServed: 'Every part of this console is connected to the office system.',
  // With nothing withheld, "Not connected yet" would contradict the page's only finding.
  everythingHeading: 'Every part is connected',
  everythingSubtitle: 'What this console can open, now that all of it is connected.',

  meaningHeading: 'What this means',
  meaning: [
    'The modules below are left out of the menu because the office system this console is ' +
      'connected to has no way to answer them yet. Their addresses bring you here instead.',
    'This is not a list of empty records. Nothing was asked for and nothing was deleted: there is ' +
      'nothing yet to ask. Until the module is connected, this console cannot tell whether the ' +
      'office holds such records.',
    'Each module returns to the menu, unchanged, once the office system can answer it.',
  ],

  modulesHeading: 'Left out of the menu',
  needs: (missing: readonly string[]): string => `It needs ${joinWords(missing)}.`,

  portsHeading: 'What this console is not connected to yet',
  portsLead:
    'In full, these are not connected yet, so no screen that depends on one of them can open:',
  portSentence: (holding: string): string =>
    `${holding.charAt(0).toUpperCase()}${holding.slice(1)}.`,

  availableHeading: 'What you can open',
  nothingAvailable:
    'Nothing in the menu that your account may open is connected to the office system yet. Your ' +
    'inbox, under the bell at the top of the page, still works.',
  // `DL-168`: the server's own reason this account cannot open the office inbox, said where it lands.
  awaitingOffice:
    'Your account is staff but is not assigned to an office, so the office inbox — which shows ' +
    'an office’s conversations with residents — is not open to you. An administrator assigns ' +
    'staff accounts to offices, under Users and roles; once you are assigned, sign in again.',
} as const;

/** "a", "a and b", "a, b and c" — a sentence, not a comma-separated dump. */
function joinWords(words: readonly string[]): string {
  if (words.length <= 1) {
    return words[0] ?? '';
  }
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`;
}
