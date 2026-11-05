import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

/**
 * Renews the access token before it lapses (`DL-166`).
 *
 * Asked by the header interceptor, on demand, when an API request is about to go out with a token
 * that expires within a minute — never by a timer, and never in the background (`DL-118`): a tab
 * nobody is using does not keep renewing a credential.
 *
 * `refresh()` emits once and completes when a new token is held, and every caller during one
 * renewal shares the same request: three requests leaving together must not spend the refresh
 * token three times. It fails when the session cannot be renewed, having dropped the credential;
 * ending the session is then the interceptor's act.
 *
 * Optional: the mock adapter set binds nothing, because its sessions do not lapse.
 */
export interface SessionRefresher {
  refresh(): Observable<void>;
}

export const SESSION_REFRESHER = new InjectionToken<SessionRefresher>('SessionRefresher');
