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
  subtitle: 'Parts of this console that the API it is connected to does not serve.',

  everythingServed: 'Every part of this console is served by the API it is connected to.',

  meaningHeading: 'What this means',
  meaning: [
    'The modules below are left out of the menu because the API this console is connected to has ' +
      'no way to answer them yet. Their addresses bring you here instead.',
    'This is not a list of empty records. Nothing was asked for and nothing was deleted: there is ' +
      'no server to ask. Whether the office holds such records cannot be told from this console ' +
      'until one exists.',
    'Each module returns to the menu, unchanged, once the API serves what it reads.',
  ],

  modulesHeading: 'Left out of the menu',
  needs: (missing: readonly string[]): string => `It needs ${joinWords(missing)}.`,

  portsHeading: 'What the API does not serve',
  portsLead: 'In full, these are not served, so no screen that depends on one of them can open:',
  portSentence: (holding: string): string =>
    `${holding.charAt(0).toUpperCase()}${holding.slice(1)}.`,

  availableHeading: 'What you can open',
  nothingAvailable:
    'Nothing in the menu that your account may open is served by this API yet. Your inbox, under ' +
    'the bell at the top of the page, still works.',
} as const;

/** "a", "a and b", "a, b and c" — a sentence, not a comma-separated dump. */
function joinWords(words: readonly string[]): string {
  if (words.length <= 1) {
    return words[0] ?? '';
  }
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1] ?? ''}`;
}
