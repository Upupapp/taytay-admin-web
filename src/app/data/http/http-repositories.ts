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
  type AccountBarangay,
  type AccountRole,
  type AppAccount,
  type AppAccountId,
  type AppAccountRepository,
  type OfficeId,
  type OfficeRoleChange,
  HOTLINE_LIST_CAP,
  type DirectoryOffice,
  type DirectoryOfficeRepository,
  type Hotline,
  type HotlineChanges,
  type HotlineDraft,
  type HotlineId,
  type HotlineListing,
  type HotlineRepository,
  type OfficeChanges,
  type OfficeDraft,
  type ServiceChanges,
  type ServiceDraft,
  type TulongService,
  type TulongServiceId,
  type TulongServiceRepository,
  type BannerDraft,
  type BannerImageChange,
  type HomeBanner,
  type HomeBannerId,
  type HomePreview,
  type HomeScreenRepository,
  type LinkDraft,
  type QuickLink,
  type QuickLinkId,
  type AppConfig,
  type AppConfigChanges,
  type AppConfigRepository,
  type DigitalIdCard,
  type DigitalIdHolder,
  type DigitalIdId,
  type DigitalIdRepository,
  type BalitaArticle,
  type BalitaArticleId,
  type BalitaCategory,
  type BalitaChanges,
  type BalitaDraft,
  type BalitaRepository,
  type PlatformAuditEntry,
  type PlatformAuditRepository,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';
import type { IdentityGrant, IdentityPort } from './identity/identity.model';
import { IdentityProvider } from './identity/identity.provider';
import { invalidCredentials, signInUnavailable } from './identity/sign-in-messages';
import { toServerIdentity } from './mappers/me.mapper';
import { toNotification } from './mappers/notification.mapper';
import {
  toAccountBarangay,
  toAppAccount,
  toWireOfficeRoleChange,
} from './mappers/app-account.mapper';
import {
  toDigitalIdCard,
  toDigitalIdHolder,
  toWireDigitalIdVerify,
} from './mappers/digital-id.mapper';
import {
  toBalitaArticle,
  toBalitaCategory,
  toWireNewsPatch,
  toWireNewsWrite,
} from './mappers/balita.mapper';
import { toPlatformAuditEntry } from './mappers/platform-audit.mapper';
import { toOffice } from './mappers/office.mapper';
import {
  toDirectoryOffice,
  toWireOfficeChanges,
  toWireOfficeDraft,
} from './mappers/directory-office.mapper';
import { toHotline } from './mappers/hotline.mapper';
import { toAppConfig, toWireAppConfigChanges } from './mappers/app-config.mapper';
import {
  toHomeBanner,
  toHomePreview,
  toQuickLink,
  toStoredMedia,
  toWireMediaUpload,
} from './mappers/home.mapper';
import {
  toTulongService,
  toWireServiceChanges,
  toWireServiceDraft,
  toWireServiceImage,
} from './mappers/tulong-service.mapper';
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

  /** The reason travels with the change; the server keeps it in the office-role history (`DL-173`). */
  assignOfficeRole(id: AppAccountId, change: OfficeRoleChange): Observable<AppAccount> {
    return this.api
      .patch(`${API_ENDPOINTS.adminUsers}/${id}/office-role`, toWireOfficeRoleChange(change))
      .pipe(map(readAccount));
  }

  /**
   * Whole or not at all: a barangay missing from the picker is one nobody can confine a barangay
   * link to, and the absence would read as the municipality not having it.
   */
  barangays(): Observable<readonly AccountBarangay[]> {
    return this.api.list(API_ENDPOINTS.barangays).pipe(
      map((rows) =>
        rows.map((row) => {
          const barangay = toAccountBarangay(row);
          if (barangay === null) {
            throw new Error('A barangay from the server could not be read, so none is offered.');
          }
          return barangay;
        }),
      ),
    );
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

/* ── the residents' app directory (`DL-170`) ─────────────────────────────── */

/**
 * The office directory, written. Admin only on the server (`office.manage`); read through the public
 * `GET offices`, a page at a time. A create or a change is a **form**, because it may carry the
 * banner — and the server refuses a form whose banner is too large or not an image, as
 * `APP_IMAGE_POLICY` says before anything is sent.
 */
@Injectable()
export class HttpDirectoryOfficeRepository implements DirectoryOfficeRepository {
  private readonly api = inject(ApiClient);

  /** One page, read whole or not at all: an office the mapper cannot read refuses the page. */
  list(page: CursorRequest): Observable<CursorPage<DirectoryOffice>> {
    return this.api
      .cursorPage(API_ENDPOINTS.offices, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readDirectoryOffice) })));
  }

  create(draft: OfficeDraft, banner: Blob | null): Observable<DirectoryOffice> {
    return this.api
      .postForm(API_ENDPOINTS.adminOffices, toWireOfficeDraft(draft, banner))
      .pipe(map(readDirectoryOffice));
  }

  update(id: OfficeId, changes: OfficeChanges, banner: Blob | null): Observable<DirectoryOffice> {
    return this.api
      .patchForm(`${API_ENDPOINTS.adminOffices}/${id}`, toWireOfficeChanges(changes, banner))
      .pipe(map(readDirectoryOffice));
  }

  remove(id: OfficeId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminOffices}/${id}`).pipe(map(() => undefined));
  }
}

/**
 * Tulong pages (`service.manage`). The list is the residents' own — `GET services`, which leaves out
 * a page hidden from the catalogue — because the API has no other; one page is read by its address,
 * which answers hidden ones too.
 */
@Injectable()
export class HttpTulongServiceRepository implements TulongServiceRepository {
  private readonly api = inject(ApiClient);

  list(page: CursorRequest): Observable<CursorPage<TulongService>> {
    return this.api
      .cursorPage(API_ENDPOINTS.services, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readTulongService) })));
  }

  /** A `404` is "no page at that address"; anything else is a failure, never an absence. */
  find(slug: string): Observable<TulongService | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.services}/${encodeURIComponent(slug)}`)
      .pipe(map((wire) => (wire === null ? null : readTulongService(wire))));
  }

  create(draft: ServiceDraft): Observable<TulongService> {
    return this.api
      .post(API_ENDPOINTS.adminServices, toWireServiceDraft(draft))
      .pipe(map(readTulongService));
  }

  update(id: TulongServiceId, changes: ServiceChanges): Observable<TulongService> {
    return this.api
      .patch(`${API_ENDPOINTS.adminServices}/${id}`, toWireServiceChanges(changes))
      .pipe(map(readTulongService));
  }

  replaceImage(id: TulongServiceId, image: Blob): Observable<TulongService> {
    return this.api
      .postForm(`${API_ENDPOINTS.adminServices}/${id}/media`, toWireServiceImage(image))
      .pipe(map(readTulongService));
  }

  remove(id: TulongServiceId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminServices}/${id}`).pipe(map(() => undefined));
  }
}

/**
 * Hotlines (`hotline.manage`). The admin list is every line, shown and hidden, answered whole and
 * capped by the server at `HOTLINE_LIST_CAP` with no word of more — so an answer that long says it
 * may be incomplete rather than presenting itself as the whole.
 */
@Injectable()
export class HttpHotlineRepository implements HotlineRepository {
  private readonly api = inject(ApiClient);

  list(): Observable<HotlineListing> {
    return this.api.list(API_ENDPOINTS.adminHotlines).pipe(
      map((items) => ({
        hotlines: items.map(readHotline),
        mayBeIncomplete: items.length >= HOTLINE_LIST_CAP,
      })),
    );
  }

  create(draft: HotlineDraft): Observable<Hotline> {
    return this.api
      .post(API_ENDPOINTS.adminHotlines, {
        name: draft.name,
        number: draft.number,
        category: draft.category,
        sort_order: draft.sortOrder,
        active: draft.active,
      })
      .pipe(map(readHotline));
  }

  /** A field left `undefined` is not serialised, so only what changed is sent. */
  update(id: HotlineId, changes: HotlineChanges): Observable<Hotline> {
    return this.api
      .patch(`${API_ENDPOINTS.adminHotlines}/${id}`, {
        name: changes.name,
        number: changes.number,
        category: changes.category,
        sort_order: changes.sortOrder,
        active: changes.active,
      })
      .pipe(map(readHotline));
  }

  remove(id: HotlineId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminHotlines}/${id}`).pipe(map(() => undefined));
  }
}

function readDirectoryOffice(wire: unknown): DirectoryOffice {
  const office = toDirectoryOffice(wire);

  if (office === null) {
    throw new Error(
      'An office from the server could not be read, so the list is not shown rather than shown ' +
        'without it: an office missing here reads as one the app does not list.',
    );
  }

  return office;
}

function readTulongService(wire: unknown): TulongService {
  const service = toTulongService(wire);

  if (service === null) {
    throw new Error(
      'A Tulong page from the server could not be read — one of its contacts, places or lists is ' +
        'in a form this console does not know — so none is shown rather than one that a save ' +
        'would quietly cut short.',
    );
  }

  return service;
}

function readHotline(wire: unknown): Hotline {
  const hotline = toHotline(wire);

  if (hotline === null) {
    throw new Error(
      'A hotline from the server could not be read, so the list is not shown rather than shown ' +
        'without it: a number missing here is one nobody checks.',
    );
  }

  return hotline;
}

/* ── the app's home screen (`DL-170`) ────────────────────────────────────── */

/**
 * The home screen's banners and links (`home.manage`), and what the app is given now (`GET home`).
 *
 * A banner's image is stored first, through `POST media`, and the banner then names it — two
 * requests, because that is how the API takes an image for a banner. If the second is refused, the
 * first has already stored the image; nothing in the API removes it, and the effects say so before
 * the button (`HOME_EFFECTS.imageUpload`).
 */
@Injectable()
export class HttpHomeScreenRepository implements HomeScreenRepository {
  private readonly api = inject(ApiClient);

  /** Every banner, shown and hidden, answered whole; one the mapper cannot read refuses the list. */
  banners(): Observable<readonly HomeBanner[]> {
    return this.api.list(API_ENDPOINTS.adminBanners).pipe(map((items) => items.map(readBanner)));
  }

  createBanner(draft: BannerDraft, image: Blob | null): Observable<HomeBanner> {
    return this.storedImage(image).pipe(
      switchMap((media) =>
        this.api.post(API_ENDPOINTS.adminBanners, {
          title: draft.title,
          media_id: media,
          href: draft.href,
          sort_order: draft.sortOrder,
          active: draft.active,
        }),
      ),
      map(readBanner),
    );
  }

  /**
   * The spec's `PATCH` body is `BannerWrite`, which requires `title`, so the title is always sent.
   * The image is named only when it changes: `undefined` leaves it, `null` removes it.
   */
  updateBanner(id: HomeBannerId, draft: BannerDraft, image: BannerImageChange): Observable<HomeBanner> {
    const media: Observable<MediaId | null | undefined> =
      image.kind === 'replace'
        ? this.storedImage(image.image)
        : of(image.kind === 'remove' ? null : undefined);
    return media.pipe(
      switchMap((mediaId) =>
        this.api.patch(`${API_ENDPOINTS.adminBanners}/${id}`, {
          title: draft.title,
          media_id: mediaId,
          href: draft.href,
          sort_order: draft.sortOrder,
          active: draft.active,
        }),
      ),
      map(readBanner),
    );
  }

  removeBanner(id: HomeBannerId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminBanners}/${id}`).pipe(map(() => undefined));
  }

  /**
   * A banner's image, as bytes, with the bearer token in a header (`ApiClient.blob`) — for a banner
   * hidden from the app as well, which the public image route would not answer.
   */
  bannerImage(banner: HomeBanner): Observable<Blob> {
    return banner.mediaId === null
      ? throwError(() => new Error('This banner has no image.'))
      : this.api.blob(`${API_ENDPOINTS.media}/${banner.mediaId}/content`);
  }

  links(): Observable<readonly QuickLink[]> {
    return this.api.list(API_ENDPOINTS.adminLinks).pipe(map((items) => items.map(readLink)));
  }

  createLink(draft: LinkDraft): Observable<QuickLink> {
    return this.api
      .post(API_ENDPOINTS.adminLinks, {
        label: draft.label,
        href: draft.href,
        sort_order: draft.sortOrder,
      })
      .pipe(map(readLink));
  }

  updateLink(id: QuickLinkId, draft: LinkDraft): Observable<QuickLink> {
    return this.api
      .patch(`${API_ENDPOINTS.adminLinks}/${id}`, {
        label: draft.label,
        href: draft.href,
        sort_order: draft.sortOrder,
      })
      .pipe(map(readLink));
  }

  removeLink(id: QuickLinkId): Observable<void> {
    return this.api.delete(`${API_ENDPOINTS.adminLinks}/${id}`).pipe(map(() => undefined));
  }

  preview(): Observable<HomePreview> {
    return this.api.item(API_ENDPOINTS.home).pipe(
      map((wire) => {
        const preview = toHomePreview(wire);
        if (preview === null) {
          throw new Error(
            'The home screen from the server could not be read, so no preview is shown rather than ' +
              'one that differs from what residents see.',
          );
        }
        return preview;
      }),
    );
  }

  /** Stores the image and answers its id, or answers `null` at once when there is none. */
  private storedImage(image: Blob | null): Observable<MediaId | null> {
    if (image === null) {
      return of(null);
    }
    return this.api.postForm(API_ENDPOINTS.media, toWireMediaUpload(image)).pipe(
      map((wire) => {
        const media = toStoredMedia(wire);
        if (media === null) {
          throw new Error(
            'The image was stored, but the server’s answer could not be read, so the banner was not ' +
              'saved. The image stays stored, unused.',
          );
        }
        return media;
      }),
    );
  }
}

function readBanner(wire: unknown): HomeBanner {
  const banner = toHomeBanner(wire);

  if (banner === null) {
    throw new Error(
      'A banner from the server could not be read, so the list is not shown rather than shown ' +
        'without it: a banner missing here may still be on every resident’s home screen.',
    );
  }

  return banner;
}

function readLink(wire: unknown): QuickLink {
  const link = toQuickLink(wire);

  if (link === null) {
    throw new Error(
      'A link from the server could not be read, so the list is not shown rather than shown ' +
        'without it: a link missing here is still on every resident’s home screen.',
    );
  }

  return link;
}

/* ── the app's settings (`DL-170`) ───────────────────────────────────────── */

/**
 * The residents' app's settings: read where every app reads them (`GET app/config`, public), changed
 * through `PATCH admin/app/config` (`app-config.manage`) with only what changed.
 */
@Injectable()
export class HttpAppConfigRepository implements AppConfigRepository {
  private readonly api = inject(ApiClient);

  read(): Observable<AppConfig> {
    return this.api.item(API_ENDPOINTS.appConfig).pipe(map(readAppConfig));
  }

  change(changes: AppConfigChanges): Observable<AppConfig> {
    return this.api
      .patch(API_ENDPOINTS.adminAppConfig, toWireAppConfigChanges(changes))
      .pipe(map(readAppConfig));
  }
}

function readAppConfig(wire: unknown): AppConfig {
  const config = toAppConfig(wire);

  if (config === null) {
    throw new Error(
      'The app’s settings from the server could not be read, so none are shown rather than some: a ' +
        'setting shown as not set would be saved as not set by the next change.',
    );
  }

  return config;
}

/**
 * Residents' digital IDs (`DL-171`). A check is `digital-id.verify` — staff and administrators on the
 * server; the rest is `digital-id.manage`, administrators alone.
 *
 * **Nothing about a check is kept here.** The code goes in the body of one request and the answer is
 * returned to the screen that asked; no field, cache or log in this adapter holds either.
 */
@Injectable()
export class HttpDigitalIdRepository implements DigitalIdRepository {
  private readonly api = inject(ApiClient);

  check(payload: string): Observable<DigitalIdHolder> {
    return this.api
      .post(API_ENDPOINTS.digitalIdVerify, toWireDigitalIdVerify(payload))
      .pipe(map(readHolder));
  }

  /** A `404` is "no current card" — the API's answer for none and for one only revoked. */
  cardOf(account: AppAccountId): Observable<DigitalIdCard | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.adminUsers}/${account}/digital-id`)
      .pipe(map((wire) => (wire === null ? null : readCard(wire))));
  }

  /** No photo is named, so the API uses the resident's latest approved verification selfie. */
  issue(account: AppAccountId): Observable<DigitalIdCard> {
    return this.api
      .post(`${API_ENDPOINTS.adminUsers}/${account}/digital-id`, {})
      .pipe(map(readCard));
  }

  suspend(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.api
      .post(`${API_ENDPOINTS.adminDigitalIds}/${card}/suspend`, {})
      .pipe(map(readCard));
  }

  revoke(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.api.post(`${API_ENDPOINTS.adminDigitalIds}/${card}/revoke`, {}).pipe(map(readCard));
  }

  reissue(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.api
      .post(`${API_ENDPOINTS.adminDigitalIds}/${card}/reissue`, {})
      .pipe(map(readCard));
  }

  openPhoto(photo: MediaId): Observable<Blob> {
    return this.api.blob(`${API_ENDPOINTS.media}/${photo}/content`);
  }
}

function readCard(wire: unknown): DigitalIdCard {
  const card = toDigitalIdCard(wire);

  if (card === null) {
    throw new Error(
      'The card from the server could not be read, so it is not shown: a card with a guessed status ' +
        'or expiry is one somebody acts on wrongly.',
    );
  }

  return card;
}

function readHolder(wire: unknown): DigitalIdHolder {
  const holder = toDigitalIdHolder(wire);

  if (holder === null) {
    throw new Error(
      'The answer about this card could not be read, so nothing is shown rather than part of it.',
    );
  }

  return holder;
}

/**
 * Balita (`news.write`, `DL-171`). The list is the residents' own — `GET news`, published only —
 * because the API has no other; a draft is read by its address, which answers one to its office's
 * staff and to administrators. Writes are forms, because the cover travels with the words.
 */
@Injectable()
export class HttpBalitaRepository implements BalitaRepository {
  private readonly api = inject(ApiClient);

  /** One page, read whole or not at all: an article the mapper cannot read refuses the page. */
  list(page: CursorRequest): Observable<CursorPage<BalitaArticle>> {
    return this.api
      .cursorPage(API_ENDPOINTS.news, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readArticle) })));
  }

  /** A `404` — no such article, or a draft the reader may not see — is `null`. */
  get(id: BalitaArticleId): Observable<BalitaArticle | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.news}/${encodeURIComponent(id)}`)
      .pipe(map((wire) => (wire === null ? null : readArticle(wire))));
  }

  categories(): Observable<readonly BalitaCategory[]> {
    return this.api.list(API_ENDPOINTS.newsCategories).pipe(
      map((items) =>
        items.map(toBalitaCategory).filter((item): item is BalitaCategory => item !== null),
      ),
    );
  }

  create(draft: BalitaDraft, cover: Blob | null): Observable<BalitaArticle> {
    return this.api
      .postForm(API_ENDPOINTS.news, toWireNewsWrite(draft, cover))
      .pipe(map(readArticle));
  }

  update(id: BalitaArticleId, changes: BalitaChanges, cover: Blob | null): Observable<BalitaArticle> {
    return this.api
      .patchForm(`${API_ENDPOINTS.news}/${id}`, toWireNewsPatch(changes, cover))
      .pipe(map(readArticle));
  }

  pin(id: BalitaArticleId): Observable<BalitaArticle> {
    return this.api.post(`${API_ENDPOINTS.news}/${id}/pin`, {}).pipe(map(readArticle));
  }

  unpin(id: BalitaArticleId): Observable<BalitaArticle> {
    return this.api.delete(`${API_ENDPOINTS.news}/${id}/pin`).pipe(map(readArticle));
  }

  openCover(id: BalitaArticleId): Observable<Blob> {
    return this.api.blob(`${API_ENDPOINTS.news}/${id}/cover`);
  }
}

function readArticle(wire: unknown): BalitaArticle {
  const article = toBalitaArticle(wire);

  if (article === null) {
    throw new Error(
      'An article from the server could not be read, so none is shown rather than some: an ' +
        'article left out of this list is one nobody here knows residents are reading.',
    );
  }

  return article;
}

/**
 * The API's audit trail (`audit.view`, `DL-171`) — administrators alone on the server. Read-only:
 * this adapter has no write, because the trail has none.
 */
@Injectable()
export class HttpPlatformAuditRepository implements PlatformAuditRepository {
  private readonly api = inject(ApiClient);

  /**
   * One page, read whole or not at all: a row the mapper cannot read refuses the page. A trail with a
   * row quietly missing is one that cannot be trusted about any row.
   */
  list(page: CursorRequest): Observable<CursorPage<PlatformAuditEntry>> {
    return this.api
      .cursorPage(API_ENDPOINTS.adminAudit, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readAuditEntry) })));
  }
}

function readAuditEntry(wire: unknown): PlatformAuditEntry {
  const entry = toPlatformAuditEntry(wire);

  if (entry === null) {
    throw new Error(
      'A row of the audit trail could not be read, so the page is not shown rather than shown ' +
        'without it: a trail with a row missing cannot be trusted about the others.',
    );
  }

  return entry;
}
