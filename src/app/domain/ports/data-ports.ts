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
  'newsfeed',
  'event',
  'dashboard',
  'staff',
  'notification',
  'verification',
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
  newsfeed: 'the newsfeed',
  event: 'events',
  dashboard: 'the dashboard',
  staff: 'the staff directory',
  notification: 'notifications',
  verification: 'ID verification requests',
};

/**
 * The ports the bound adapter set cannot serve — an empty list when it serves them all.
 *
 * **No default.** Both adapter sets bind it explicitly (`data-access.providers*.ts`): a set that
 * forgot to say would otherwise offer every link, and each one would end in a refusal the officer
 * reads as a broken screen or, worse, as an empty record (`DL-112`). A missing binding fails at the
 * first screen instead, where somebody notices.
 */
export const UNSERVED_PORTS = new InjectionToken<readonly DataPort[]>('UnservedPorts');
