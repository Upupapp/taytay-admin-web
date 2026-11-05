import type { Observable } from 'rxjs';

import type { MfaChallenge, MfaCredentials, SignInCredentials } from '@domain/index';

/**
 * What an identity provider hands the staff adapter: an ID token to present to the API, and when
 * it lapses.
 *
 * The provider never holds the ID token itself and never calls `AuthTokenHolder.hold()` — turning
 * a grant into a session is the staff adapter's act alone (`check:auth` rule 4). The refresh
 * token is not here: it stays in the provider's private field and is never handed to anybody.
 *
 * `expiresAt` is `null` when the lifetime is unknown or the credential does not lapse (the
 * development verifier's); a `null` expiry is never refreshed.
 */
export interface IdentityGrant {
  readonly idToken: string;
  readonly expiresAt: Date | null;
}

/** The first step's answer: a grant, or a second factor still owed. */
export type IdentitySignIn =
  | { readonly kind: 'signed-in'; readonly grant: IdentityGrant }
  | { readonly kind: 'second-factor'; readonly challenge: MfaChallenge };

/**
 * What both identity providers offer the staff adapter.
 *
 * Two classes named `IdentityProvider` exist — the Firebase one and the development verifier — and
 * `angular.json` decides which a build contains. The adapter holds the provider through this
 * interface so that both are type-checked against the same contract, whichever file was swapped in.
 */
export interface IdentityPort {
  signIn(credentials: SignInCredentials): Observable<IdentitySignIn>;
  finalizeMfa(credentials: MfaCredentials): Observable<IdentityGrant>;
  refresh(): Observable<IdentityGrant>;
  forget(): void;
}
