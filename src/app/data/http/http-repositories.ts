import { inject, Injectable } from '@angular/core';
import { finalize, map, of, switchMap, throwError, type Observable } from 'rxjs';

import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import {
  fromServerIdentity,
  SignInError,
  type AppNotification,
  type AuthenticatedUser,
  type NotificationId,
  type NotificationRepository,
  type SignInOutcome,
  type StaffRepository,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';
import { toServerIdentity } from './mappers/me.mapper';
import { toNotification } from './mappers/notification.mapper';
import { list } from './mappers/wire';
import { unserved } from './unserved-repositories';

/**
 * The adapters the Node API actually serves.
 *
 * Two ports of twenty: the signed-in account and its inbox. Every other port is bound in the
 * `http` configuration to an adapter that makes no request and says so (`unserved-repositories.ts`,
 * `DL-164`, `DL-165`). The Laravel adapters that stood here called forty paths of an API that was
 * retired on 2026-10-20; they are recoverable from git at `990edfa` and nowhere else, because code
 * kept "for later" against a server that no longer exists is a surface nothing is reading.
 *
 * Every read goes through a mapper: a generic on `ApiClient` is an assertion, not a conversion
 * (`check:mapper-adoption`).
 */

/**
 * What the sign-in form says until the identity provider is connected.
 *
 * The Node API has no sign-in route: a staff member signs in with Firebase and presents the ID
 * token, and the console's Firebase sign-in is the next change, not this one. Until it lands, the
 * honest answer is that sign-in is not connected — "try again shortly" would send somebody back to
 * a form that cannot succeed.
 */
const SIGN_IN_NOT_CONNECTED =
  'Sign-in is not available yet: this console cannot sign in to the new server until its ' +
  'identity provider is connected. Contact the MSWDO administrator.';

@Injectable()
export class HttpStaffRepository implements StaffRepository {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(AuthTokenHolder);

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

  signIn(): Observable<SignInOutcome> {
    return throwError(() => new SignInError('unavailable', SIGN_IN_NOT_CONNECTED));
  }

  completeMfa(): Observable<AuthenticatedUser> {
    return throwError(() => new SignInError('unavailable', SIGN_IN_NOT_CONNECTED));
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
      return of(undefined);
    }

    return this.api.post(API_ENDPOINTS.signOut, {}).pipe(
      map(() => undefined),
      finalize(() => this.tokens.clear()),
    );
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
