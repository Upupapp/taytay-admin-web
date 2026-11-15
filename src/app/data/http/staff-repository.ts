import { inject, Injectable } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  throwError,
  type Observable,
} from 'rxjs';

import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import {
  SignInError,
  type MfaCredentials,
  type SignInCredentials,
  type SignInOutcome,
} from '@domain/access/credentials';
import {
  fromServerIdentity,
  type AuthenticatedUser,
  type ServerIdentity,
} from '@domain/access/staff-user';
import type { StaffRepository } from '@domain/ports/repositories';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';
import type { IdentityGrant, IdentityPort } from './identity/identity.model';
import { IdentityProvider } from './identity/identity.provider';
import { invalidCredentials, signInUnavailable } from './identity/sign-in-messages';
import { confinesToOneBarangay, toServerIdentity } from './mappers/me.mapper';
import { toBarangayIndex, type BarangayIndex } from './mappers/resident.mapper';
import { unserved } from './unserved-repositories';

/*
 * The staff adapter and the barangay join it reads, apart from the other adapters (`DL-224`).
 *
 * Sign-in and the session it restores are the one thing the console needs before its first screen,
 * so this is the one adapter bound eagerly; every other port's adapter is fetched by `lazyPort` on
 * its first question. A module is bundled whole wherever it is imported, so the eager adapter has
 * to live in a module of its own, or every adapter would be in the first download again. The
 * repository checks read this file with `http-repositories.ts` as one adapter set.
 */

/**
 * `GET barangays`, joined to `TAYTAY_BARANGAYS` by name — one join for the resident and household
 * adapters, so a barangay reads the same on both.
 *
 * Whole or not at all, and read once per adapter: a barangay missing from the join is one whose
 * records the console could not place, and it refuses them rather than guessing. A failed read is
 * not kept, so the next call asks again. Created in an adapter's field initialiser, where `inject`
 * is allowed.
 */
export class BarangayJoin {
  private readonly api = inject(ApiClient);
  private index$: Observable<BarangayIndex> | null = null;

  read(): Observable<BarangayIndex> {
    this.index$ ??= this.api.list(API_ENDPOINTS.barangays).pipe(
      map((rows) => toBarangayIndex(rows)),
      catchError((error: unknown) => {
        this.index$ = null;
        return throwError(() => error);
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.index$;
  }
}

@Injectable()
export class HttpStaffRepository implements StaffRepository {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(AuthTokenHolder);
  private readonly identity: IdentityPort = inject(IdentityProvider);
  // A barangay link's barangay arrives as the API's id; the console knows it by its own.
  private readonly barangayJoin = new BarangayJoin();

  /**
   * `GET me`, read — with the barangay a barangay link serves translated to the console's id.
   * `GET barangays` is asked only for that account: nobody else's answer names a barangay.
   */
  private identify(wire: unknown): Observable<ServerIdentity | null> {
    return confinesToOneBarangay(wire)
      ? this.barangayJoin.read().pipe(map((barangays) => toServerIdentity(wire, barangays)))
      : of(toServerIdentity(wire, null));
  }

  /**
   * `GET admin/users` lists every account in the residents' app, not the office's staff, and only
   * an administrator may read it — the same word on a different population (`DL-164`). A staff
   * directory built on it would list residents as colleagues.
   */
  list(): Observable<never> {
    return unserved('the staff directory');
  }

  getById(): Observable<never> {
    return unserved('the staff directory');
  }

  /**
   * Who the server says the caller is — or `null`, which is also the answer for an account that
   * may not hold a console session (a resident, or a closed account).
   *
   * Refusing such an account drops the token **locally only**. Revoking it would sign that person
   * out of the residents' app on their phone, for having opened the wrong website.
   */
  currentUser(): Observable<AuthenticatedUser | null> {
    if (!this.tokens.hasToken()) {
      // Without a token there is nothing to ask about, and an unauthenticated GET would answer 401
      // and bounce the user to sign-in through the error interceptor on every reload.
      return of(null);
    }

    return this.api.item(API_ENDPOINTS.me).pipe(
      switchMap((wire) => this.identify(wire)),
      map((identity) => {
        if (identity === null) {
          this.tokens.clear();
          return null;
        }

        return fromServerIdentity(identity);
      }),
    );
  }

  /**
   * Firebase sign-in, then the API's own answer about who that is (`DL-166`).
   *
   * The identity provider proves the password; only `GET me` says whether the account may hold a
   * console session. The ID token is held **before** that request, because the request is how it is
   * presented — and dropped, locally, if the answer is no.
   */
  signIn(credentials: SignInCredentials): Observable<SignInOutcome> {
    return this.identity
      .signIn(credentials)
      .pipe(
        switchMap((first) =>
          first.kind === 'second-factor'
            ? of<SignInOutcome>({ kind: 'mfa-required', challenge: first.challenge })
            : this.establish(first.grant).pipe(
                map((user): SignInOutcome => ({ kind: 'authenticated', user })),
              ),
        ),
      );
  }

  completeMfa(credentials: MfaCredentials): Observable<AuthenticatedUser> {
    return this.identity.finalizeMfa(credentials).pipe(switchMap((grant) => this.establish(grant)));
  }

  /**
   * `POST auth/sign-out` revokes every refresh token the account holds, and the token here is
   * dropped once the API has answered — **whatever it answered**.
   *
   * The request goes first, so it is sent with the credential it is revoking; clearing before it
   * would send it unauthenticated and revoke nothing. But the token is not kept on a failure. The
   * Laravel console did keep it, because a personal access token lived until somebody revoked it;
   * a Firebase ID token expires within the hour on its own, and keeping it in memory after the
   * person asked to leave — on a shared office computer — protects nobody. The failure still
   * propagates, so the screen can say the server did not confirm (`DL-165`).
   */
  signOut(): Observable<void> {
    if (!this.tokens.hasToken()) {
      this.identity.forget();
      return of(undefined);
    }

    return this.api.post(API_ENDPOINTS.signOut, {}).pipe(
      map(() => undefined),
      finalize(() => {
        this.tokens.clear();
        // The refresh token too: revoked by the request above, and of no use to anybody after it.
        this.identity.forget();
      }),
    );
  }

  /**
   * Holds the grant, asks the API who it belongs to, and refuses an account that may not hold a
   * console session.
   *
   * A resident's account or a closed one gets the **same** message as a wrong password, and its
   * credentials are dropped **locally only**. Revoking them would sign that resident out of the
   * app on their phone for having typed their password into the wrong website — and would tell
   * whoever typed it that the address has an account.
   */
  private establish(grant: IdentityGrant): Observable<AuthenticatedUser> {
    return defer(() => {
      this.tokens.hold(grant.idToken, grant.expiresAt);

      return this.api.item(API_ENDPOINTS.me);
    }).pipe(
      switchMap((wire) => this.identify(wire)),
      map((identity) => {
        if (identity === null) {
          throw invalidCredentials();
        }

        return fromServerIdentity(identity);
      }),
      catchError((error: unknown) => {
        this.tokens.clear();
        this.identity.forget();
        // The API's own failure was already reported by the error interceptor; the form says only
        // that sign-in did not complete.
        return throwError(() => (error instanceof SignInError ? error : signInUnavailable()));
      }),
    );
  }
}
