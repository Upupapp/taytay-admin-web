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
  mediaFor,
  SignInError,
  type CursorPage,
  type CursorRequest,
  type AppNotification,
  type AuthenticatedUser,
  type MfaCredentials,
  type NotificationId,
  type NotificationRepository,
  type SignInCredentials,
  type SignInOutcome,
  type StaffRepository,
  type VerificationFilter,
  type VerificationImageKind,
  type VerificationRepository,
  type VerificationRequest,
  type VerificationRequestId,
  type InboxListing,
  type MediaId,
  type Office,
  type OfficeInboxRepository,
  type OfficeRepository,
  type OfficeThread,
  type OfficeThreadId,
  type ThreadMessage,
  type AccountRole,
  type AppAccount,
  type AppAccountId,
  type AppAccountRepository,
  type OfficeId,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';
import type { IdentityGrant, IdentityPort } from './identity/identity.model';
import { IdentityProvider } from './identity/identity.provider';
import { invalidCredentials, signInUnavailable } from './identity/sign-in-messages';
import { toServerIdentity } from './mappers/me.mapper';
import { toNotification } from './mappers/notification.mapper';
import { toAppAccount } from './mappers/app-account.mapper';
import { toOffice } from './mappers/office.mapper';
import { toOfficeThread, toPostedMessage, toThreadMessage } from './mappers/office-thread.mapper';
import { toVerificationRequest } from './mappers/verification.mapper';
import { list } from './mappers/wire';
import { unserved } from './unserved-repositories';

/**
 * The adapters the Node API actually serves.
 *
 * Three ports of twenty-one: the signed-in account and its inbox — and sign-in itself, through the
 * identity provider in `identity/` (`DL-166`) — and residents' ID verification review
 * (`DL-167`). Every other port is bound in the `http` configuration to an adapter that makes no request and says so (`unserved-repositories.ts`,
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

/**
 * Residents' ID verification review (`DL-167`) — the first port the Node API serves because the
 * resource *is* the thing the port names, not something with the same word on it.
 *
 * Admin only on the server (`verification.review`); the route guard mirrors it, and the API refuses
 * anybody else whatever this console shows.
 */
@Injectable()
export class HttpVerificationRepository implements VerificationRepository {
  private readonly api = inject(ApiClient);

  /**
   * One cursor page, read **whole or not at all**: a request the mapper cannot read refuses the
   * page. Dropping it would show one fewer resident waiting for an answer, with no error anywhere —
   * and that resident would wait indefinitely for a review nobody can see is owed.
   */
  list(
    filter: VerificationFilter,
    page: CursorRequest,
  ): Observable<CursorPage<VerificationRequest>> {
    return this.api
      .cursorPage(API_ENDPOINTS.verificationRequests, page, { status: filter.status ?? undefined })
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readVerification) })));
  }

  approve(id: VerificationRequestId, note: string): Observable<VerificationRequest> {
    return this.api
      .post(`${API_ENDPOINTS.verificationRequests}/${id}/approve`, { notes: note })
      .pipe(map(readVerification));
  }

  /** `notes` is the reason the resident reads in the app (`issues` on their copy). */
  reject(id: VerificationRequestId, reason: string): Observable<VerificationRequest> {
    return this.api
      .post(`${API_ENDPOINTS.verificationRequests}/${id}/reject`, { notes: reason })
      .pipe(map(readVerification));
  }

  /**
   * The bytes, with the bearer token in a header (`ApiClient.blob`). An image the request does not
   * carry is refused here, without a request, rather than asked for by a missing id.
   */
  openImage(request: VerificationRequest, kind: VerificationImageKind): Observable<Blob> {
    const media = mediaFor(request, kind);

    return media === null
      ? throwError(() => new Error('This request carries no such image.'))
      : this.api.blob(`${API_ENDPOINTS.media}/${media}/content`);
  }
}

function readVerification(wire: unknown): VerificationRequest {
  const request = toVerificationRequest(wire);

  if (request === null) {
    throw new Error(
      'A verification request from the server could not be read, so none is shown rather than ' +
        'some: a request left out of this list would wait for a review nobody knows is owed.',
    );
  }

  return request;
}

/**
 * The office inbox (`DL-168`): residents writing to an office, answered by its staff.
 *
 * `office-inbox.manage` on the server — staff while assigned to an office, and administrators. Which
 * conversations come back is the server's decision; nothing here filters by office.
 */
@Injectable()
export class HttpOfficeInboxRepository implements OfficeInboxRepository {
  private readonly api = inject(ApiClient);

  /**
   * One page, read whole or not at all — and an empty first page **asked about** before it is
   * believed.
   *
   * `GET threads` answers a staff account with no office with an empty page, which is also what an
   * office nobody has written to receives. So when the first page is empty the adapter asks `GET me`
   * whether this account has an office, and answers `no-office` if it has none: an officer told "no
   * conversations" concludes residents are quiet, when the truth is that this account cannot see
   * them. A later empty page needs no question — the first page already answered it.
   */
  list(page: CursorRequest): Observable<InboxListing> {
    return this.api.cursorPage(API_ENDPOINTS.threads, page).pipe(
      map((answer): CursorPage<OfficeThread> => ({ ...answer, items: answer.items.map(readThread) })),
      switchMap((answer) => {
        const listing: InboxListing = { kind: 'threads', page: answer };
        if (answer.items.length > 0 || (page.cursor ?? null) !== null) {
          return of(listing);
        }
        return this.api
          .item(API_ENDPOINTS.me)
          .pipe(
            map((me): InboxListing =>
              toServerIdentity(me)?.awaitingOffice === true ? { kind: 'no-office' } : listing,
            ),
          );
      }),
    );
  }

  thread(id: OfficeThreadId): Observable<OfficeThread> {
    return this.api.item(`${API_ENDPOINTS.threads}/${id}`).pipe(map(readThread));
  }

  /** Newest first, as the server orders them. A message it cannot read refuses the page. */
  messages(id: OfficeThreadId, page: CursorRequest): Observable<CursorPage<ThreadMessage>> {
    return this.api
      .cursorPage(`${API_ENDPOINTS.threads}/${id}/messages`, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readMessage) })));
  }

  /** The words as typed; the server trims them and refuses a closed conversation with `409`. */
  reply(id: OfficeThreadId, body: string): Observable<ThreadMessage> {
    return this.api
      .post(`${API_ENDPOINTS.threads}/${id}/messages`, { body })
      .pipe(map(readPosted));
  }

  markRead(id: OfficeThreadId): Observable<OfficeThread> {
    return this.api.post(`${API_ENDPOINTS.threads}/${id}/read`, {}).pipe(map(readThread));
  }

  /** No body: the server accepts none, so there is no reason to send (`THREAD_CLOSE_EFFECTS`). */
  close(id: OfficeThreadId): Observable<OfficeThread> {
    return this.api.post(`${API_ENDPOINTS.threads}/${id}/close`, {}).pipe(map(readThread));
  }

  /**
   * The bytes, with the bearer token in a header (`ApiClient.blob`). An image the message does not
   * carry is refused here, without a request, rather than fetched by an id from somewhere else.
   */
  openAttachment(message: ThreadMessage, media: MediaId): Observable<Blob> {
    return message.attachments.includes(media)
      ? this.api.blob(`${API_ENDPOINTS.media}/${media}/content`)
      : throwError(() => new Error('This message carries no such image.'));
  }
}

/** The office directory, read in full (`DL-161`): a picker missing an office says it does not exist. */
@Injectable()
export class HttpOfficeRepository implements OfficeRepository {
  private readonly api = inject(ApiClient);

  list(): Observable<readonly Office[]> {
    return this.api.everyPage(API_ENDPOINTS.offices).pipe(map((items) => items.map(readOffice)));
  }
}

/**
 * Users and roles (`DL-168`): every residents' app account, and who among them is staff.
 *
 * Admin only on the server (`user.view`, `user.change-role`, `user.assign-office`). The role is sent
 * as the domain holds it — the domain's four roles are the API's own `RoleChange` values.
 */
@Injectable()
export class HttpAppAccountRepository implements AppAccountRepository {
  private readonly api = inject(ApiClient);

  /** One page, read whole or not at all: an account the mapper cannot read refuses the page. */
  list(page: CursorRequest): Observable<CursorPage<AppAccount>> {
    return this.api
      .cursorPage(API_ENDPOINTS.adminUsers, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readAccount) })));
  }

  changeRole(id: AppAccountId, role: AccountRole): Observable<AppAccount> {
    return this.api.patch(`${API_ENDPOINTS.adminUsers}/${id}/role`, { role }).pipe(map(readAccount));
  }

  assignOffice(id: AppAccountId, office: OfficeId | null): Observable<AppAccount> {
    return this.api
      .patch(`${API_ENDPOINTS.adminUsers}/${id}/office`, { office_id: office })
      .pipe(map(readAccount));
  }
}

function readAccount(wire: unknown): AppAccount {
  const account = toAppAccount(wire);

  if (account === null) {
    throw new Error(
      'An account from the server could not be read, so none is shown rather than some: an ' +
        'account left out of this list is one nobody can see is staff.',
    );
  }

  return account;
}

function readThread(wire: unknown): OfficeThread {
  const thread = toOfficeThread(wire);

  if (thread === null) {
    throw new Error(
      'A conversation from the server could not be read, so none is shown rather than some: a ' +
        'conversation left out of this inbox is a resident nobody knows is waiting.',
    );
  }

  return thread;
}

function readMessage(wire: unknown): ThreadMessage {
  const message = toThreadMessage(wire);

  if (message === null) {
    throw new Error(
      'A message from the server could not be read, so the conversation is not shown rather than ' +
        'shown with a gap in it.',
    );
  }

  return message;
}

function readPosted(wire: unknown): ThreadMessage {
  const message = toPostedMessage(wire);

  if (message === null) {
    throw new Error(
      'The server accepted the reply, but its answer could not be read. Open the conversation ' +
        'again to see it before sending anything twice.',
    );
  }

  return message;
}

function readOffice(wire: unknown): Office {
  const office = toOffice(wire);

  if (office === null) {
    throw new Error(
      'An office from the server could not be read, so the list is not shown rather than shown ' +
        'without it: an office missing from a list reads as one that does not exist.',
    );
  }

  return office;
}
