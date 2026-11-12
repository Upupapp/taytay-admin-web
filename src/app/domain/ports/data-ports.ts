import { InjectionToken } from '@angular/core';

/**
 * Every port this console reads through, by name — the unit in which an adapter set says what it
 * can and cannot serve (`DL-167`).
 *
 * Each key is its port's injection token in kebab case: `ASSISTANCE_REQUEST_REPOSITORY` is
 * `assistance-request`. Pairing them by spelling rather than by a third list is what lets
 * `check:unserved` hold the two together without a table somebody has to remember to edit.
 */
export const DATA_PORTS = [
  'resident',
  'household',
  'family',
  'case',
  'saved-view',
  'program',
  'assistance-request',
  'beneficiary',
  'field-visit',
  'release',
  'referral',
  'work',
  'report',
  'search',
  'governance',
  'event',
  'dashboard',
  'staff',
  'notification',
  'verification',
  'office-inbox',
  'office',
  'app-account',
  'directory-office',
  'tulong-service',
  'hotline',
  'home-screen',
  'app-config',
  'digital-id',
  'balita',
  'platform-audit',
  'issuance',
] as const;

export type DataPort = (typeof DATA_PORTS)[number];

/**
 * What each port holds, in the words a screen uses to say it is not served.
 *
 * The same words the unserved adapters put in their refusals, so the page that names every
 * withheld module and the error a stray call produces describe one gap the same way.
 */
export const DATA_PORT_HOLDINGS: Readonly<Record<DataPort, string>> = {
  resident: 'the resident registry',
  household: 'households',
  family: 'families and relationships',
  case: 'cases',
  'saved-view': 'saved views',
  program: 'programmes',
  'assistance-request': 'assistance requests',
  beneficiary: 'the beneficiary registry',
  'field-visit': 'field visits',
  release: 'releases and payouts',
  referral: 'referrals',
  work: 'work queues',
  report: 'reports',
  search: 'search',
  governance: 'staff accounts, the audit trail and privacy governance',
  event: 'events',
  dashboard: 'the dashboard',
  staff: 'the staff directory',
  notification: 'notifications',
  verification: 'ID verification requests',
  'office-inbox': 'the office inbox',
  office: 'the office directory',
  'app-account': 'app accounts and their roles',
  'directory-office': 'the app’s office directory',
  'tulong-service': 'the app’s Tulong pages',
  hotline: 'the app’s hotlines',
  'home-screen': 'the app’s home screen',
  'app-config': 'the app’s settings',
  'digital-id': 'residents’ digital IDs',
  balita: 'the app’s Balita',
  'platform-audit': 'the app’s audit trail',
  issuance: 'residents’ document requests and the document catalogue',
};

/**
 * What a secondary panel says in place of itself when its port is not served (`DL-175`).
 *
 * Defined once, beside the words it is built from, so every screen that degrades a panel states the
 * gap the same way the withheld-modules page and the unserved adapters do.
 *
 * The holdings are the sentence's object rather than its subject: they are a mix of singulars ("the
 * resident registry") and plurals ("field visits"), and a sentence that conjugates a verb for them
 * is wrong for half of them.
 *
 * Its last sentence is the point. A panel that reads as empty tells an officer the office has no
 * visits to this family; this one says the console never asked (`DL-112`).
 */
export function notConnectedSentence(port: DataPort): string {
  return (
    `Not connected yet: the office’s API does not serve ${DATA_PORT_HOLDINGS[port]}, so nothing ` +
    `is read or saved here. This is not a statement that there are none.`
  );
}

/**
 * Figures a **served** port's API does not send yet (`DL-210`): a panel the console draws for a
 * mock-up whose numbers or fields `GET /office/residents` and its neighbours do not carry.
 *
 * Not a port. Nothing is bound to an unserved adapter for these, so the gate's count of unserved
 * ports is untouched; the panel simply says, in the words a port gap uses, that the console never
 * asked — never that the office has none (`DL-112`).
 */
export const UNSERVED_FIGURES = {
  'sector-counts': 'counts of a sector’s members (by barangay, age band, benefit or ID)',
  'sector-attention':
    'which of a sector’s members need attention (an ID or a renewal due, a milestone birthday)',
  'sector-fields': 'a sector’s own fields (ID number, validity, social pension, disability type)',
  // `DL-211`. The API keeps no list of a card's past states, and its audit trail is read whole.
  'card-history':
    'a card’s history (when it was issued, suspended or replaced, and when it was checked)',
} as const satisfies Readonly<Record<string, string>>;

export type UnservedFigure = keyof typeof UNSERVED_FIGURES;

/** What a panel says in place of a figure the API does not send yet; the port gap's sentence. */
export function notSentSentence(figure: UnservedFigure): string {
  return (
    `Not connected yet: the office’s API does not send ${UNSERVED_FIGURES[figure]}, so nothing ` +
    `is read or shown here. This is not a statement that there are none.`
  );
}

/**
 * The ports the bound adapter set cannot serve — an empty list when it serves them all.
 *
 * **No default.** Both adapter sets bind it explicitly (`data-access.providers*.ts`): a set that
 * forgot to say would otherwise offer every link, and each one would end in a refusal the officer
 * reads as a broken screen or, worse, as an empty record (`DL-112`). A missing binding fails at the
 * first screen instead, where somebody notices.
 */
export const UNSERVED_PORTS = new InjectionToken<readonly DataPort[]>('UnservedPorts');
