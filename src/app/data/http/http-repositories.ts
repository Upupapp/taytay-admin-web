import { inject, Injectable } from '@angular/core';
import {
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
  type Observable,
} from 'rxjs';

import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import type { SessionRefresher } from '@core/auth/session-refresher';
import {
  fromServerIdentity,
  SignInError,
  type AppNotification,
  type AuthenticatedUser,
  type MfaCredentials,
  type NotificationId,
  type NotificationRepository,
  type SignInCredentials,
  type SignInOutcome,
  type StaffRepository,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';
import type { IdentityGrant, IdentityPort } from './identity/identity.model';
import { IdentityProvider } from './identity/identity.provider';
import { invalidCredentials, signInUnavailable } from './identity/sign-in-messages';
import { toServerIdentity } from './mappers/me.mapper';
import { toNotification } from './mappers/notification.mapper';
import { list } from './mappers/wire';
import { unserved } from './unserved-repositories';

/**
 * The adapters the Node API actually serves.
 *
 * Two ports of twenty: the signed-in account and its inbox — and sign-in itself, through the
 * identity provider in `identity/` (`DL-166`). Every other port is bound in the
 * `http` configuration to an adapter that makes no request and says so (`unserved-repositories.ts`,
 * `DL-164`, `DL-165`). The Laravel adapters that stood here called forty paths of an API that was
 * retired on 2026-10-20; they are recoverable from git at `990edfa` and nowhere else, because code
 * kept "for later" against a server that no longer exists is a surface nothing is reading.
 *
 * Every read goes through a mapper: a generic on `ApiClient` is an assertion, not a conversion
 * (`check:mapper-adoption`).
 */

@Injectable()
export class HttpStaffRepository implements StaffRepository {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(AuthTokenHolder);
  private readonly identity: IdentityPort = inject(IdentityProvider);

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
      map((wire) => {
        const identity = toServerIdentity(wire);

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
    return this.identity.signIn(credentials).pipe(
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
      map((wire) => {
        const identity = toServerIdentity(wire);

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

/**
 * Renews the ID token from the identity provider's refresh token, once per renewal however many
 * requests are waiting for it (`SESSION_REFRESHER`, `DL-166`).
 *
 * Here rather than in the provider because holding a token is the staff adapters' act alone
 * (`check:auth` rule 4). On failure the credential is dropped — a session that cannot be renewed
 * is over — and the interceptor ends it and sends nobody's request.
 */
@Injectable()
export class HttpSessionRefresher implements SessionRefresher {
  private readonly tokens = inject(AuthTokenHolder);
  private readonly identity: IdentityPort = inject(IdentityProvider);
  private inFlight: Observable<void> | null = null;

  refresh(): Observable<void> {
    this.inFlight ??= this.identity.refresh().pipe(
      tap((grant) => this.tokens.hold(grant.idToken, grant.expiresAt)),
      map((): void => undefined),
      catchError((error: unknown) => {
        this.tokens.clear();
        this.identity.forget();
        return throwError(() => error);
      }),
      finalize(() => {
        this.inFlight = null;
      }),
      // Shared, and replayed to a caller that arrives as it finishes: one refresh token spent once.
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.inFlight;
  }
}

@Injectable()
export class HttpNotificationRepository implements NotificationRepository {
  private readonly api = inject(ApiClient);

  /**
   * The whole inbox, or an error — never the first page of it shown as all of it.
   *
   * The route is cursor-paged and the port answers with one list, so every page is read
   * (`everyPage` refuses past a thousand rows rather than truncating, `DL-161`). An inbox that long
   * is a port that should become paged, not a list to cut short.
   */
  listForCurrentUser(): Observable<readonly AppNotification[]> {
    return this.api
      .everyPage(API_ENDPOINTS.notifications)
      .pipe(map((rows) => list(rows, toNotification)));
  }

  markRead(id: NotificationId): Observable<AppNotification> {
    return this.api.post(`${API_ENDPOINTS.notifications}/${id}/read`, {}).pipe(
      map((wire) => {
        const notification = toNotification(wire);

        if (notification === null) {
          throw new Error('The server marked that message read, and its answer could not be read.');
        }

        return notification;
      }),
    );
  }

  /**
   * `POST notifications/read` answers with how many it changed, not with the inbox, so the inbox is
   * read again rather than assumed: a count says nothing about which rows a screen still shows.
   */
  markAllRead(): Observable<readonly AppNotification[]> {
    return this.api
      .post(`${API_ENDPOINTS.notifications}/read`, {})
      .pipe(switchMap(() => this.listForCurrentUser()));
  }
}
