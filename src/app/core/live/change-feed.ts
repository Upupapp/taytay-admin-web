import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

/**
 * The topics the API's change feed names (`DL-222`), as its contract lists them. A screen asks for
 * the topics its read counts, and the type keeps a misspelt one from compiling — a topic that
 * never matches is a screen that silently never updates.
 *
 * A topic the server sends and this list does not know is ignored; a topic here that the server
 * never sends only means that screen is refreshed on reconnect, resync and focus.
 */
export const LIVE_TOPICS = [
  // Public: every signed-in account.
  'news',
  'events',
  'home',
  'hotlines',
  'services',
  'offices',
  'app-config',
  // Owned: the account's own rows, or a staff member's under the staff rule.
  'account',
  'notifications',
  'verification',
  'threads',
  'digital-ids',
  'sector-applications',
  'issuance-requests',
  'event-registrations',
  'households',
  'consents',
  // Staff: only where the account's permissions read the list the topic names.
  'assistance-requests',
  'cases',
  'residents',
  'families',
  'beneficiaries',
  'programs',
  'referrals',
  'visits',
  'releases',
  'work',
  'users',
  'audit',
  'governance',
  'saved-views',
  'imports',
] as const;

export type LiveTopic = (typeof LIVE_TOPICS)[number];

/**
 * What the change feed says. **Topic names and nothing else** — no id, no count, no field of any
 * record (`DL-222`): a hint only tells a screen to ask again, through the same authorised read it
 * always uses.
 *
 * - `ready` comes first on every connection, naming every topic it can ever carry.
 * - `change` names topics that changed in the server's last coalescing window.
 * - `resync`: the server may have missed changes; re-read everything on screen.
 * - `expired`: the server is about to close the stream (token expiry, its own limit, or a change to
 *   the account); reconnect at once with a fresh token.
 */
export type ChangeFeedEvent =
  | { readonly kind: 'ready'; readonly topics: readonly string[] }
  | { readonly kind: 'change'; readonly topics: readonly string[] }
  | { readonly kind: 'resync' }
  | { readonly kind: 'expired' };

/**
 * One connection to the change feed per subscription. It completes when the server ends the
 * stream and errors when it cannot be opened or drops; reconnecting is `LiveUpdates`' decision.
 */
export interface ChangeFeed {
  open(): Observable<ChangeFeedEvent>;
}

/**
 * Bound only in the http adapter set, like `SESSION_REFRESHER`, and injected `{ optional: true }`:
 * the mock set has no server to push anything, so the console there is simply not live.
 */
export const CHANGE_FEED = new InjectionToken<ChangeFeed>('ChangeFeed');
