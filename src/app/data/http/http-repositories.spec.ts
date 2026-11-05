import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  asId,
  HOTLINE_LIST_CAP,
  SignInError,
  type AppAccountId,
  type HomeBannerId,
  type HotlineId,
  type TulongServiceId,
  type MediaId,
  type NotificationId,
  type OfficeId,
  type OfficeThreadId,
  type QuickLinkId,
  type VerificationRequestId,
} from '@domain/index';

import ME_ADMIN from './fixtures/me-admin.json';
import ME_RESIDENT from './fixtures/me-resident.json';
import ME_STAFF from './fixtures/me-staff.json';
import NOTIFICATION_READ from './fixtures/notification-read.json';
import NOTIFICATIONS_PAGE_1 from './fixtures/notifications-page-1.json';
import NOTIFICATIONS_PAGE_2 from './fixtures/notifications-page-2.json';
import NOTIFICATIONS_READ_ALL from './fixtures/notifications-read-all.json';
import SIGNED_OUT from './fixtures/signed-out.json';
import VERIFICATION_APPROVED from './fixtures/verification-approved.json';
import VERIFICATION_REJECTED from './fixtures/verification-rejected.json';
import VERIFICATION_PAGE from './fixtures/verification-requests-page.json';
import OFFICES_PAGE from './fixtures/offices-page.json';
import THREAD from './fixtures/thread.json';
import THREAD_MESSAGES_PAGE from './fixtures/thread-messages-page.json';
import THREAD_REPLY from './fixtures/thread-reply.json';
import THREADS_PAGE from './fixtures/threads-page.json';
import USER_OFFICE_ASSIGNED from './fixtures/user-office-assigned.json';
import USER_ROLE_CHANGED from './fixtures/user-role-changed.json';
import USERS_PAGE from './fixtures/users-page.json';
import DELETED from './fixtures/deleted.json';
import HOTLINE from './fixtures/hotline.json';
import HOTLINES from './fixtures/hotlines.json';
import OFFICE from './fixtures/office.json';
import SERVICE from './fixtures/service.json';
import SERVICES_PAGE from './fixtures/services-page.json';
import BANNER from './fixtures/banner.json';
import BANNERS from './fixtures/banners.json';
import HOME from './fixtures/home.json';
import LINK from './fixtures/link.json';
import LINKS from './fixtures/links.json';
import MEDIA from './fixtures/media.json';
import APP_CONFIG from './fixtures/app-config.json';
import {
  HttpAppAccountRepository,
  HttpAppConfigRepository,
  HttpDirectoryOfficeRepository,
  HttpHomeScreenRepository,
  HttpHotlineRepository,
  HttpNotificationRepository,
  HttpOfficeInboxRepository,
  HttpOfficeRepository,
  HttpSessionRefresher,
  HttpStaffRepository,
  HttpTulongServiceRepository,
  HttpVerificationRepository,
} from './http-repositories';
import { toHomeBanner } from './mappers/home.mapper';
import { toThreadMessage } from './mappers/office-thread.mapper';
import { toVerificationRequest } from './mappers/verification.mapper';
import { UnservedError } from './unserved-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const SIGN_IN = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const FINALIZE = 'https://identitytoolkit.googleapis.com/v2/accounts/mfaSignIn:finalize';
const REFRESH = 'https://securetoken.googleapis.com/v1/token';
const CREDENTIALS = { email: 'staff.member@example.invalid', password: 'a-password-of-sufficient-length' };
const UNIFORM_REFUSAL =
  'Those sign-in details were not recognised. Check the email address and password, then try again.';

/**
 * The two ports the Node API serves, exercised against fixtures composed from the vendored spec
 * (`fixtures/fixtures.spec.ts` holds each one to its schema) rather than against what the adapter's
 * author expected to receive.
 */
describe('the Node adapters', () => {
  let http: HttpTestingController;
  let tokens: AuthTokenHolder;
  let staff: HttpStaffRepository;
  let notifications: HttpNotificationRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpStaffRepository,
        HttpNotificationRepository,
        HttpSessionRefresher,
        HttpVerificationRepository,
        HttpOfficeInboxRepository,
        HttpOfficeRepository,
        HttpAppAccountRepository,
        HttpDirectoryOfficeRepository,
        HttpTulongServiceRepository,
        HttpHotlineRepository,
        HttpHomeScreenRepository,
        HttpAppConfigRepository,
      ],
    });

    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(AuthTokenHolder);
    staff = TestBed.inject(HttpStaffRepository);
    notifications = TestBed.inject(HttpNotificationRepository);
  });

  afterEach(() => http.verify());

  describe('the signed-in account', () => {
    it('asks nothing without a token, so a reload does not bounce through a 401', async () => {
      expect(await firstValueFrom(staff.currentUser())).toBeNull();
    });

    it('grants only what the server sent, and only the keys this console knows', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      http.expectOne({ method: 'GET', url: `${BASE}/me` }).flush(ME_ADMIN);
      const identity = await user;

      // `audit.view`, `verification.review` (DL-167), `office-inbox.manage` and the three `user.*`
      // keys (DL-168), and the directory's three, `home.manage` and `app-config.manage` (DL-170) are
      // the capabilities with a console key of the same name; the rest are kept aside as unknown.
      expect([...(identity?.permissions ?? [])].sort()).toEqual([
        'app-config.manage',
        'audit.view',
        'home.manage',
        'hotline.manage',
        'office-inbox.manage',
        'office.manage',
        'service.manage',
        'user.assign-office',
        'user.change-role',
        'user.view',
        'verification.review',
      ]);
      expect(identity?.unknownPermissions).not.toContain('user.view');
      expect(identity?.unknownPermissions).toContain('digital-id.manage');
      expect(identity?.roleLabel).toBe('Administrator');
      // An administrator acts for every office, so it is never waiting for one.
      expect(identity?.awaitingOffice).toBe(false);
    });

    it('grants a staff account only the keys the server sent that the console knows', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      http.expectOne(`${BASE}/me`).flush(ME_STAFF);
      const identity = await user;

      expect([...(identity?.permissions ?? [])]).toEqual(['office-inbox.manage']);
      expect(identity?.roleLabel).toBe('Staff');
      expect(identity?.awaitingOffice).toBe(false);
    });

    it('says a staff account with no office is waiting for one, and grants it no inbox (DL-168)', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      // What the server sends such an account: no office, and so neither office-bound key.
      http.expectOne(`${BASE}/me`).flush({
        ...ME_STAFF,
        data: {
          ...ME_STAFF.data,
          office_id: null,
          permissions: ['household.view-counts', 'digital-id.verify'],
        },
      });
      const identity = await user;

      expect(identity?.awaitingOffice).toBe(true);
      expect(identity?.permissions.has('office-inbox.manage')).toBe(false);
    });

    it('reads no personal field, and never the home barangay as a scope', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      http.expectOne(`${BASE}/me`).flush(ME_STAFF);
      const identity = await user;
      const said = JSON.stringify({ ...identity, permissions: [...(identity?.permissions ?? [])] });

      expect(identity?.barangayId).toBeNull();
      expect(identity?.scope).toBe('assigned-cases');
      for (const personal of [
        ME_STAFF.data.birthdate,
        ME_STAFF.data.mobile,
        ME_STAFF.data.address,
        ME_STAFF.data.street,
        ME_STAFF.data.purok,
        ME_STAFF.data.barangay_id,
      ]) {
        expect(said).not.toContain(personal);
      }
    });

    it('treats a resident account as signed out, and drops the token without revoking it', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      http.expectOne(`${BASE}/me`).flush(ME_RESIDENT);

      expect(await user).toBeNull();
      expect(tokens.hasToken()).toBe(false);
      http.expectNone(`${BASE}/auth/sign-out`);
    });

    it('treats a closed account as signed out', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      http.expectOne(`${BASE}/me`).flush({ ...ME_STAFF, data: { ...ME_STAFF.data, closed: true } });

      expect(await user).toBeNull();
    });

    describe('signing in (DL-166)', () => {
      /** Answers Google's sign-in with tokens, as a correct password would. */
      function passwordAccepted(): void {
        http
          .expectOne((req) => req.url === SIGN_IN)
          .flush({ idToken: 'id-token-1', refreshToken: 'refresh-1', expiresIn: '3600', localId: 'uid-1' });
      }

      async function refusal(source: Promise<unknown>): Promise<SignInError> {
        try {
          await source;
        } catch (error: unknown) {
          if (error instanceof SignInError) {
            return error;
          }
          throw error;
        }
        throw new Error('expected a refusal');
      }

      it('signs a staff member in: Google proves the password, the API says who it is', async () => {
        const outcome = firstValueFrom(staff.signIn(CREDENTIALS));

        passwordAccepted();
        const me = http.expectOne(`${BASE}/me`);
        // The ID token is presented to the API — and only to the API.
        expect(me.request.headers.get('Authorization')).toBe('Bearer id-token-1');
        me.flush(ME_STAFF);

        const result = await outcome;
        expect(result.kind).toBe('authenticated');
        if (result.kind === 'authenticated') {
          expect(result.user.roleLabel).toBe('Staff');
          expect(result.user.role).toBeNull();
          // The one server key a staff account at an office holds that the console knows (DL-168).
          expect([...result.user.permissions]).toEqual(['office-inbox.manage']);
        }
        expect(tokens.hasToken()).toBe(true);
      });

      it('refuses a resident with the wrong-password message, drops everything locally, and revokes nothing', async () => {
        const outcome = firstValueFrom(staff.signIn(CREDENTIALS));

        passwordAccepted();
        http.expectOne(`${BASE}/me`).flush(ME_RESIDENT);

        const refused = await refusal(outcome);
        expect(refused.reason).toBe('invalid-credentials');
        expect(refused.message).toBe(UNIFORM_REFUSAL);
        expect(tokens.hasToken()).toBe(false);
        // Revoking would sign the resident out of the app on their phone.
        http.expectNone(`${BASE}/auth/sign-out`);

        // And the refresh token went with it: nothing can renew a session that was never granted.
        await refusal(firstValueFrom(TestBed.inject(HttpSessionRefresher).refresh()));
        http.expectNone((req) => req.url === REFRESH);
      });

      it('refuses a closed staff account the same way', async () => {
        const outcome = firstValueFrom(staff.signIn(CREDENTIALS));

        passwordAccepted();
        http.expectOne(`${BASE}/me`).flush({ ...ME_STAFF, data: { ...ME_STAFF.data, closed: true } });

        expect((await refusal(outcome)).message).toBe(UNIFORM_REFUSAL);
        expect(tokens.hasToken()).toBe(false);
        http.expectNone(`${BASE}/auth/sign-out`);
      });

      it('says sign-in is unavailable when the API cannot answer, and keeps no token', async () => {
        const outcome = firstValueFrom(staff.signIn(CREDENTIALS));

        passwordAccepted();
        http.expectOne(`${BASE}/me`).flush(null, { status: 503, statusText: 'Service Unavailable' });

        expect((await refusal(outcome)).reason).toBe('unavailable');
        expect(tokens.hasToken()).toBe(false);
      });

      it('passes a wrong password through as the uniform refusal, without asking the API', async () => {
        const outcome = firstValueFrom(staff.signIn(CREDENTIALS));

        http
          .expectOne((req) => req.url === SIGN_IN)
          .flush({ error: { code: 400, message: 'INVALID_LOGIN_CREDENTIALS' } }, { status: 400, statusText: 'Bad Request' });

        expect((await refusal(outcome)).message).toBe(UNIFORM_REFUSAL);
        http.expectNone(`${BASE}/me`);
      });

      it('completes a second factor, then asks the API who it is', async () => {
        const outcome = firstValueFrom(staff.signIn(CREDENTIALS));
        http
          .expectOne((req) => req.url === SIGN_IN)
          .flush({ mfaPendingCredential: 'pending-1', mfaInfo: [{ mfaEnrollmentId: 'totp-1', totpInfo: {} }] });

        const first = await outcome;
        if (first.kind !== 'mfa-required') {
          throw new Error('expected a second factor');
        }
        expect(tokens.hasToken()).toBe(false);

        const user = firstValueFrom(staff.completeMfa({ challenge: first.challenge.challenge, code: '123456' }));
        http.expectOne((req) => req.url === FINALIZE).flush({ idToken: 'id-token-mfa', refreshToken: 'refresh-mfa' });
        const me = http.expectOne(`${BASE}/me`);
        expect(me.request.headers.get('Authorization')).toBe('Bearer id-token-mfa');
        me.flush(ME_ADMIN);

        expect((await user).roleLabel).toBe('Administrator');
      });

      it('makes the identity provider forget the refresh token at sign-out', async () => {
        const outcome = firstValueFrom(staff.signIn(CREDENTIALS));
        passwordAccepted();
        http.expectOne(`${BASE}/me`).flush(ME_STAFF);
        await outcome;

        const done = firstValueFrom(staff.signOut());
        http.expectOne(`${BASE}/auth/sign-out`).flush(SIGNED_OUT);
        await done;

        await refusal(firstValueFrom(TestBed.inject(HttpSessionRefresher).refresh()));
        http.expectNone((req) => req.url === REFRESH);
      });
    });

    it('revokes with the credential it is revoking, then drops it', async () => {
      tokens.hold('fixture-token', null);
      const done = firstValueFrom(staff.signOut());

      const request = http.expectOne({ method: 'POST', url: `${BASE}/auth/sign-out` });
      expect(tokens.hasToken()).toBe(true);
      request.flush(SIGNED_OUT);

      await done;
      expect(tokens.hasToken()).toBe(false);
    });

    it('drops the token when the server could not confirm, and still reports the failure', async () => {
      tokens.hold('fixture-token', null);
      const done = firstValueFrom(staff.signOut());

      http
        .expectOne(`${BASE}/auth/sign-out`)
        .flush(
          {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Try again.',
              details: {},
              request_id: 'r',
            },
          },
          { status: 503, statusText: 'Service Unavailable' },
        );

      await expect(done).rejects.toBeTruthy();
      expect(tokens.hasToken()).toBe(false);
    });

    it('does not ask the server to revoke a token it does not hold', async () => {
      await firstValueFrom(staff.signOut());
    });

    it('refuses the staff directory without a request, because no route is the staff directory', async () => {
      await expect(firstValueFrom(staff.list())).rejects.toBeInstanceOf(UnservedError);
      await expect(firstValueFrom(staff.getById())).rejects.toBeInstanceOf(UnservedError);
    });
  });

  describe('the inbox', () => {
    it('reads every cursor page and maps each row', async () => {
      const inbox = firstValueFrom(notifications.listForCurrentUser());

      const first = http.expectOne(
        (r) => r.url === `${BASE}/notifications` && !r.params.has('cursor'),
      );
      expect(first.request.params.get('limit')).toBe('50');
      first.flush(NOTIFICATIONS_PAGE_1);

      const second = http.expectOne(
        (r) => r.params.get('cursor') === NOTIFICATIONS_PAGE_1.meta.pagination.next_cursor,
      );
      second.flush(NOTIFICATIONS_PAGE_2);

      const rows = await inbox;
      expect(rows.map((row) => row.kind)).toEqual(['general', 'decision', 'general']);
      expect(rows.every((row) => row.severity === 'info' && row.action === null)).toBe(true);
      expect(rows[1]?.readAt).toBe('2026-11-03T05:00:00.000Z');
    });

    it('marks one read through POST notifications/{id}/read', async () => {
      const id = asId<NotificationId>(NOTIFICATION_READ.data.id);
      const updated = firstValueFrom(notifications.markRead(id));

      http
        .expectOne({ method: 'POST', url: `${BASE}/notifications/${id}/read` })
        .flush(NOTIFICATION_READ);

      expect((await updated).readAt).toBe('2026-11-05T01:00:00.000Z');
    });

    it('marks all read and reads the inbox again, because the answer is a count', async () => {
      const inbox = firstValueFrom(notifications.markAllRead());

      http
        .expectOne({ method: 'POST', url: `${BASE}/notifications/read` })
        .flush(NOTIFICATIONS_READ_ALL);
      http.expectOne((r) => r.url === `${BASE}/notifications`).flush(NOTIFICATIONS_PAGE_2);

      expect(await inbox).toHaveLength(1);
    });
  });

  describe('ID verification review (DL-167)', () => {
    let verification: HttpVerificationRepository;

    beforeEach(() => {
      verification = TestBed.inject(HttpVerificationRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads one cursor page, filtered by status, and says more are available', async () => {
      const page = firstValueFrom(verification.list({ status: 'pending' }, { limit: 20 }));

      const request = http.expectOne((r) => r.url === `${BASE}/admin/verification-requests`);
      expect(request.request.method).toBe('GET');
      expect(request.request.params.keys().sort()).toEqual(['limit', 'status']);
      expect(request.request.params.get('status')).toBe('pending');
      request.flush(VERIFICATION_PAGE);

      const answer = await page;
      expect(answer.items.map((item) => item.idType)).toEqual(['drivers-license', 'umid']);
      expect(answer.hasMore).toBe(true);
      expect(answer.nextCursor).toBe(VERIFICATION_PAGE.meta.pagination.next_cursor);
    });

    it('sends no status at all for every status, and the cursor it was given', async () => {
      const page = firstValueFrom(verification.list({ status: null }, { limit: 20, cursor: 'c-2' }));

      const request = http.expectOne((r) => r.url === `${BASE}/admin/verification-requests`);
      expect(request.request.params.keys().sort()).toEqual(['cursor', 'limit']);
      request.flush(VERIFICATION_PAGE);
      await page;
    });

    it('refuses the page rather than leaving out a request it cannot read', async () => {
      const page = firstValueFrom(verification.list({ status: 'pending' }, { limit: 20 }));
      const [first, second] = VERIFICATION_PAGE.data;

      http
        .expectOne((r) => r.url === `${BASE}/admin/verification-requests`)
        .flush({ ...VERIFICATION_PAGE, data: [first, { ...second, selfie_media_id: null }] });

      await expect(page).rejects.toThrow(/could not be read/);
    });

    it('approves with the note in notes, which the resident never sees', async () => {
      const id = asId<VerificationRequestId>(VERIFICATION_APPROVED.data.id);
      const decided = firstValueFrom(verification.approve(id, 'Selfie matches the ID photo.'));

      const request = http.expectOne({
        method: 'POST',
        url: `${BASE}/admin/verification-requests/${id}/approve`,
      });
      expect(request.request.body).toEqual({ notes: 'Selfie matches the ID photo.' });
      request.flush(VERIFICATION_APPROVED);

      expect((await decided).status).toBe('approved');
    });

    it('rejects with the reason in notes, which is what the resident reads', async () => {
      const id = asId<VerificationRequestId>(VERIFICATION_REJECTED.data.id);
      const reason = 'The licence has expired. Please send a current government ID.';
      const decided = firstValueFrom(verification.reject(id, reason));

      const request = http.expectOne({
        method: 'POST',
        url: `${BASE}/admin/verification-requests/${id}/reject`,
      });
      expect(request.request.body).toEqual({ notes: reason });
      request.flush(VERIFICATION_REJECTED);

      expect((await decided).reviewNote).toBe(reason);
    });

    it('reads an image as bytes, with the token in a header and never in the address', async () => {
      const request = toVerificationRequest(VERIFICATION_PAGE.data[0]);
      if (request === null) throw new Error('fixture unreadable');
      const image = firstValueFrom(verification.openImage(request, 'selfie'));

      const sent = http.expectOne(`${BASE}/media/${request.images.selfie}/content`);
      expect(sent.request.method).toBe('GET');
      expect(sent.request.responseType).toBe('blob');
      expect(sent.request.headers.get('Authorization')).toBe('Bearer fixture-token');
      expect(sent.request.urlWithParams).not.toMatch(/token/i);
      sent.flush(new Blob(['jpeg bytes'], { type: 'image/jpeg' }));

      expect(await image).toBeInstanceOf(Blob);
    });

    it('asks for no image a request does not carry', async () => {
      const request = toVerificationRequest(VERIFICATION_PAGE.data[1]);
      if (request === null) throw new Error('fixture unreadable');

      await expect(firstValueFrom(verification.openImage(request, 'id-back'))).rejects.toThrow(
        /no such image/,
      );
    });
  });

  describe('the office inbox (DL-168)', () => {
    let inbox: HttpOfficeInboxRepository;
    const threadId = asId<OfficeThreadId>(THREAD.data.id);

    beforeEach(() => {
      inbox = TestBed.inject(HttpOfficeInboxRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads one cursor page, newest activity first, with no filter of its own', async () => {
      const listing = firstValueFrom(inbox.list({ limit: 20 }));

      const request = http.expectOne((r) => r.url === `${BASE}/threads`);
      expect(request.request.method).toBe('GET');
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(THREADS_PAGE);

      const answer = await listing;
      if (answer.kind !== 'threads') throw new Error('expected threads');
      expect(answer.page.items.map((thread) => thread.subject)).toEqual([
        'Requirements for burial assistance',
        'Solo parent ID renewal',
      ]);
      expect(answer.page.hasMore).toBe(true);
      expect(answer.page.nextCursor).toBe(THREADS_PAGE.meta.pagination.next_cursor);
    });

    it('keeps no preview of what the resident wrote', async () => {
      const listing = firstValueFrom(inbox.list({ limit: 20 }));
      http.expectOne((r) => r.url === `${BASE}/threads`).flush(THREADS_PAGE);

      const said = JSON.stringify(await listing);
      for (const row of THREADS_PAGE.data) {
        expect(said).not.toContain(row.last_message_preview);
      }
    });

    it('asks whether an empty first page means the account has no office, and says so', async () => {
      const listing = firstValueFrom(inbox.list({ limit: 20 }));

      http
        .expectOne((r) => r.url === `${BASE}/threads`)
        .flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      http.expectOne(`${BASE}/me`).flush({
        ...ME_STAFF,
        data: { ...ME_STAFF.data, office_id: null, permissions: ['household.view-counts'] },
      });

      expect(await listing).toEqual({ kind: 'no-office' });
    });

    it('believes an empty first page once the account turns out to have an office', async () => {
      const listing = firstValueFrom(inbox.list({ limit: 20 }));

      http
        .expectOne((r) => r.url === `${BASE}/threads`)
        .flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      http.expectOne(`${BASE}/me`).flush(ME_STAFF);

      const answer = await listing;
      expect(answer.kind === 'threads' ? answer.page.items : null).toEqual([]);
    });

    it('asks nothing more about an empty later page — the first one already answered', async () => {
      const listing = firstValueFrom(inbox.list({ limit: 20, cursor: 'c-2' }));

      http
        .expectOne((r) => r.url === `${BASE}/threads`)
        .flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      http.expectNone(`${BASE}/me`);

      expect((await listing).kind).toBe('threads');
    });

    it('refuses the page rather than leaving out a conversation it cannot read', async () => {
      const listing = firstValueFrom(inbox.list({ limit: 20 }));
      const [first, second] = THREADS_PAGE.data;

      http
        .expectOne((r) => r.url === `${BASE}/threads`)
        .flush({ ...THREADS_PAGE, data: [first, { ...second, status: 'archived' }] });

      await expect(listing).rejects.toThrow(/could not be read/);
    });

    it('reads one conversation and its messages by id', async () => {
      const thread = firstValueFrom(inbox.thread(threadId));
      http.expectOne({ method: 'GET', url: `${BASE}/threads/${threadId}` }).flush(THREAD);
      expect((await thread).officeSlug).toBe('mswdo');

      const messages = firstValueFrom(inbox.messages(threadId, { limit: 20 }));
      const request = http.expectOne((r) => r.url === `${BASE}/threads/${threadId}/messages`);
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(THREAD_MESSAGES_PAGE);
      const page = await messages;
      expect(page.items.map((message) => message.attachments.length)).toEqual([1, 0]);
    });

    it('sends a reply as the body the API reads, and nothing else', async () => {
      const words = 'Please bring the death certificate and a valid ID.';
      const sent = firstValueFrom(inbox.reply(threadId, words));

      const request = http.expectOne({
        method: 'POST',
        url: `${BASE}/threads/${threadId}/messages`,
      });
      expect(request.request.body).toEqual({ body: words });
      request.flush(THREAD_REPLY, { status: 201, statusText: 'Created' });

      expect((await sent).body).toBe(words);
    });

    it('marks read and closes with an empty body — the server keeps no reason', async () => {
      const read = firstValueFrom(inbox.markRead(threadId));
      const readRequest = http.expectOne({
        method: 'POST',
        url: `${BASE}/threads/${threadId}/read`,
      });
      expect(readRequest.request.body).toEqual({});
      readRequest.flush(THREAD);
      expect((await read).unreadCount).toBe(0);

      const closed = firstValueFrom(inbox.close(threadId));
      const closeRequest = http.expectOne({
        method: 'POST',
        url: `${BASE}/threads/${threadId}/close`,
      });
      expect(closeRequest.request.body).toEqual({});
      closeRequest.flush({ ...THREAD, data: { ...THREAD.data, status: 'closed' } });
      expect((await closed).status).toBe('closed');
    });

    it('reads an attachment as bytes, with the token in a header and never in the address', async () => {
      const message = toThreadMessage(THREAD_MESSAGES_PAGE.data[0]);
      if (message === null) throw new Error('fixture unreadable');
      const [media] = message.attachments;
      if (media === undefined) throw new Error('fixture has no attachment');
      const image = firstValueFrom(inbox.openAttachment(message, media));

      const sent = http.expectOne(`${BASE}/media/${media}/content`);
      expect(sent.request.responseType).toBe('blob');
      expect(sent.request.headers.get('Authorization')).toBe('Bearer fixture-token');
      expect(sent.request.urlWithParams).not.toMatch(/token/i);
      sent.flush(new Blob(['jpeg bytes'], { type: 'image/jpeg' }));

      expect(await image).toBeInstanceOf(Blob);
    });

    it('asks for no image the message does not carry', async () => {
      const message = toThreadMessage(THREAD_MESSAGES_PAGE.data[1]);
      if (message === null) throw new Error('fixture unreadable');

      await expect(
        firstValueFrom(inbox.openAttachment(message, asId<MediaId>('someone-elses-image'))),
      ).rejects.toThrow(/no such image/);
    });
  });

  describe('the office directory (DL-168)', () => {
    it('reads every page of it, at the largest page the server allows', async () => {
      const offices = firstValueFrom(TestBed.inject(HttpOfficeRepository).list());

      const request = http.expectOne((r) => r.url === `${BASE}/offices`);
      expect(request.request.params.get('limit')).toBe('50');
      request.flush(OFFICES_PAGE);

      expect((await offices).map((office) => office.shortName)).toEqual(['MSWDO', null]);
    });
  });

  describe('users and roles (DL-168)', () => {
    let accounts: HttpAppAccountRepository;
    const accountId = asId<AppAccountId>(USER_ROLE_CHANGED.data.id);

    beforeEach(() => {
      accounts = TestBed.inject(HttpAppAccountRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads one cursor page and keeps only name, email, role and office', async () => {
      const page = firstValueFrom(accounts.list({ limit: 20 }));

      const request = http.expectOne((r) => r.url === `${BASE}/admin/users`);
      expect(request.request.method).toBe('GET');
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(USERS_PAGE);

      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.items.map((account) => account.role)).toEqual(['staff', 'registered']);
      const said = JSON.stringify(answer);
      for (const personal of [USERS_PAGE.data[0]?.mobile, USERS_PAGE.data[0]?.barangay_id]) {
        expect(said).not.toContain(personal);
      }
    });

    it('refuses the page rather than leaving out an account whose role it does not know', async () => {
      const page = firstValueFrom(accounts.list({ limit: 20 }));
      const [first, second] = USERS_PAGE.data;

      http
        .expectOne((r) => r.url === `${BASE}/admin/users`)
        .flush({ ...USERS_PAGE, data: [first, { ...second, role: 'guest' }] });

      await expect(page).rejects.toThrow(/could not be read/);
    });

    it('changes a role with the body the API reads, and nothing else', async () => {
      const changed = firstValueFrom(accounts.changeRole(accountId, 'staff'));

      const request = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/users/${accountId}/role` });
      expect(request.request.body).toEqual({ role: 'staff' });
      request.flush(USER_ROLE_CHANGED);

      expect((await changed).role).toBe('staff');
    });

    it('assigns an office by id, and clears it with null', async () => {
      const office = asId<OfficeId>(USER_OFFICE_ASSIGNED.data.office_id);
      const assigned = firstValueFrom(accounts.assignOffice(accountId, office));
      const request = http.expectOne({
        method: 'PATCH',
        url: `${BASE}/admin/users/${accountId}/office`,
      });
      expect(request.request.body).toEqual({ office_id: office });
      request.flush(USER_OFFICE_ASSIGNED);
      expect((await assigned).officeId).toBe(office);

      const cleared = firstValueFrom(accounts.assignOffice(accountId, null));
      const clearRequest = http.expectOne({
        method: 'PATCH',
        url: `${BASE}/admin/users/${accountId}/office`,
      });
      expect(clearRequest.request.body).toEqual({ office_id: null });
      clearRequest.flush(USER_ROLE_CHANGED);
      expect((await cleared).officeId).toBeNull();
    });
  });

  describe('the residents’ app directory (DL-170)', () => {
    const officeId = asId<OfficeId>(OFFICE.data.id);
    const serviceId = asId<TulongServiceId>(SERVICE.data.id);
    const hotlineId = asId<HotlineId>(HOTLINE.data.id);
    const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });

    beforeEach(() => tokens.hold('fixture-token', null));

    /** The fields a form request carried, as text or as a file's type. */
    function formOf(body: unknown): Record<string, string> {
      expect(body).toBeInstanceOf(FormData);
      const fields: Record<string, string> = {};
      if (body instanceof FormData) {
        body.forEach((value, name) => {
          fields[name] = typeof value === 'string' ? value : `file:${value.type}`;
        });
      }
      return fields;
    }

    it('reads the office directory a page at a time, from the public list', async () => {
      const offices = TestBed.inject(HttpDirectoryOfficeRepository);
      const page = firstValueFrom(offices.list({ limit: 20, cursor: null }));

      const request = http.expectOne((r) => r.url === `${BASE}/offices`);
      expect(request.request.params.get('limit')).toBe('20');
      request.flush(OFFICES_PAGE);

      expect((await page).items.map((office) => office.slug)).toEqual(['mswdo', 'mho']);
    });

    it('creates an office as a form, leaving out what was not given, with the banner as a file', async () => {
      const offices = TestBed.inject(HttpDirectoryOfficeRepository);
      const created = firstValueFrom(
        offices.create(
          {
            name: 'Persons with Disability Affairs Office',
            slug: 'pdao',
            shortName: 'PDAO',
            category: null,
            description: null,
            head: null,
            hours: null,
            phone: null,
            email: null,
            address: null,
            latitude: 14.5574,
            longitude: 121.1323,
          },
          png(),
        ),
      );

      const request = http.expectOne({ method: 'POST', url: `${BASE}/admin/offices` });
      expect(formOf(request.request.body)).toEqual({
        name: 'Persons with Disability Affairs Office',
        slug: 'pdao',
        short_name: 'PDAO',
        latitude: '14.5574',
        longitude: '121.1323',
        banner: 'file:image/png',
      });
      // The browser writes the multipart boundary; a Content-Type set here would lose it.
      expect(request.request.headers.has('Content-Type')).toBe(false);
      expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-token');
      request.flush(OFFICE, { status: 201, statusText: 'Created' });

      expect((await created).hasBanner).toBe(true);
    });

    it('changes an office with only what OfficePatch declares', async () => {
      const offices = TestBed.inject(HttpDirectoryOfficeRepository);
      const changed = firstValueFrom(offices.update(officeId, { slug: 'pdao-office' }, null));

      const request = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/offices/${officeId}` });
      expect(formOf(request.request.body)).toEqual({ slug: 'pdao-office' });
      request.flush(OFFICE);

      expect((await changed).id).toBe(officeId);
    });

    it('deletes an office, and passes the server’s refusal on in its own words', async () => {
      const offices = TestBed.inject(HttpDirectoryOfficeRepository);
      const removed = firstValueFrom(offices.remove(officeId));
      http.expectOne({ method: 'DELETE', url: `${BASE}/admin/offices/${officeId}` }).flush(DELETED);
      await expect(removed).resolves.toBeUndefined();

      const refused = firstValueFrom(offices.remove(officeId));
      http
        .expectOne({ method: 'DELETE', url: `${BASE}/admin/offices/${officeId}` })
        .flush(
          {
            error: {
              code: 'CONFLICT',
              message: 'That office still has staff or other records.',
              details: {},
              request_id: 'req-1',
            },
          },
          { status: 409, statusText: 'Conflict' },
        );
      await expect(refused).rejects.toBeTruthy();
    });

    it('reads the Tulong catalogue a page at a time, and one page by its address', async () => {
      const services = TestBed.inject(HttpTulongServiceRepository);
      const page = firstValueFrom(services.list({ limit: 20, cursor: null }));
      http.expectOne((r) => r.url === `${BASE}/services`).flush(SERVICES_PAGE);
      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.items).toHaveLength(2);

      const hidden = firstValueFrom(services.find('typhoon-relief-2025'));
      http.expectOne({ method: 'GET', url: `${BASE}/services/typhoon-relief-2025` }).flush(SERVICE);
      expect((await hidden)?.hiddenFromList).toBe(true);
    });

    it('says a missing page is missing, and a failure is a failure', async () => {
      const services = TestBed.inject(HttpTulongServiceRepository);
      const missing = firstValueFrom(services.find('nothing-here'));
      http
        .expectOne(`${BASE}/services/nothing-here`)
        .flush(
          { error: { code: 'NOT_FOUND', message: 'Not found.', details: {}, request_id: 'r' } },
          { status: 404, statusText: 'Not Found' },
        );
      expect(await missing).toBeNull();

      const failed = firstValueFrom(services.find('pwd-id'));
      http.expectOne(`${BASE}/services/pwd-id`).flush(null, { status: 500, statusText: 'Error' });
      await expect(failed).rejects.toBeTruthy();
    });

    it('sends a Tulong change as JSON with only what changed, and the picture as a form', async () => {
      const services = TestBed.inject(HttpTulongServiceRepository);
      const changed = firstValueFrom(services.update(serviceId, { hiddenFromList: false, badge: null }));
      const patch = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/services/${serviceId}` });
      expect(JSON.parse(JSON.stringify(patch.request.body))).toEqual({
        hidden_from_list: false,
        badge: null,
      });
      patch.flush(SERVICE);
      expect((await changed).id).toBe(serviceId);

      const pictured = firstValueFrom(services.replaceImage(serviceId, png()));
      const upload = http.expectOne({
        method: 'POST',
        url: `${BASE}/admin/services/${serviceId}/media`,
      });
      expect(formOf(upload.request.body)).toEqual({ file: 'file:image/png' });
      upload.flush(SERVICE);
      await pictured;

      const removed = firstValueFrom(services.remove(serviceId));
      http.expectOne({ method: 'DELETE', url: `${BASE}/admin/services/${serviceId}` }).flush(DELETED);
      await expect(removed).resolves.toBeUndefined();
    });

    it('reads every hotline, and says when the answer is as long as the cap', async () => {
      const hotlines = TestBed.inject(HttpHotlineRepository);
      const listing = firstValueFrom(hotlines.list());
      http.expectOne({ method: 'GET', url: `${BASE}/admin/hotlines` }).flush(HOTLINES);
      expect(await listing).toMatchObject({ mayBeIncomplete: false });

      const capped = firstValueFrom(hotlines.list());
      const [line] = HOTLINES.data;
      http.expectOne(`${BASE}/admin/hotlines`).flush({
        ...HOTLINES,
        data: Array.from({ length: HOTLINE_LIST_CAP }, (_, index) => ({
          ...line,
          id: `9b8a7c6d-5e4f-4a3b-8c2d-${String(index).padStart(12, '0')}`,
        })),
      });
      expect((await capped).mayBeIncomplete).toBe(true);
    });

    it('creates, changes and deletes a hotline with the body the API reads', async () => {
      const hotlines = TestBed.inject(HttpHotlineRepository);
      const created = firstValueFrom(
        hotlines.create({
          name: 'Police station',
          number: '(02) 8000 0112',
          category: 'Emergency',
          sortOrder: 2,
          active: true,
        }),
      );
      const post = http.expectOne({ method: 'POST', url: `${BASE}/admin/hotlines` });
      expect(post.request.body).toEqual({
        name: 'Police station',
        number: '(02) 8000 0112',
        category: 'Emergency',
        sort_order: 2,
        active: true,
      });
      post.flush(HOTLINE, { status: 201, statusText: 'Created' });
      expect((await created).id).toBe(hotlineId);

      const changed = firstValueFrom(hotlines.update(hotlineId, { active: false }));
      const patch = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/hotlines/${hotlineId}` });
      expect(JSON.parse(JSON.stringify(patch.request.body))).toEqual({ active: false });
      patch.flush(HOTLINE);
      await changed;

      const removed = firstValueFrom(hotlines.remove(hotlineId));
      http.expectOne({ method: 'DELETE', url: `${BASE}/admin/hotlines/${hotlineId}` }).flush(DELETED);
      await expect(removed).resolves.toBeUndefined();
    });
  });

  describe('the home screen (DL-170)', () => {
    const png = () => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    const DRAFT = { title: 'Supplementary feeding resumes', href: null, sortOrder: 2, active: true };

    beforeEach(() => tokens.hold('fixture-token', null));

    it('reads every banner and link whole, from the admin lists', async () => {
      const home = TestBed.inject(HttpHomeScreenRepository);
      const banners = firstValueFrom(home.banners());
      http.expectOne({ method: 'GET', url: `${BASE}/admin/home/banners` }).flush(BANNERS);
      expect((await banners).map((banner) => banner.active)).toEqual([true, false]);

      const links = firstValueFrom(home.links());
      http.expectOne({ method: 'GET', url: `${BASE}/admin/home/links` }).flush(LINKS);
      expect((await links).map((link) => link.label)).toEqual(['Tulong']);
    });

    it('stores the image first, as a form, and then the banner naming it', async () => {
      const home = TestBed.inject(HttpHomeScreenRepository);
      const created = firstValueFrom(home.createBanner(DRAFT, png()));

      const upload = http.expectOne({ method: 'POST', url: `${BASE}/media` });
      expect(upload.request.body).toBeInstanceOf(FormData);
      expect(upload.request.body instanceof FormData ? upload.request.body.has('file') : false).toBe(
        true,
      );
      upload.flush(MEDIA, { status: 201, statusText: 'Created' });

      const post = http.expectOne({ method: 'POST', url: `${BASE}/admin/home/banners` });
      expect(post.request.body).toEqual({
        title: 'Supplementary feeding resumes',
        media_id: MEDIA.data.id,
        href: null,
        sort_order: 2,
        active: true,
      });
      post.flush(BANNER, { status: 201, statusText: 'Created' });
      expect((await created).mediaId).toBe(MEDIA.data.id);
    });

    it('sends no image request when there is none, and keeps the title on every change', async () => {
      const home = TestBed.inject(HttpHomeScreenRepository);
      const bannerId = asId<HomeBannerId>(BANNER.data.id);

      const kept = firstValueFrom(home.updateBanner(bannerId, DRAFT, { kind: 'keep' }));
      const keep = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/home/banners/${bannerId}` });
      // `undefined` is left out by the serialiser, so a kept image is not named at all.
      expect(JSON.parse(JSON.stringify(keep.request.body))).toEqual({
        title: 'Supplementary feeding resumes',
        href: null,
        sort_order: 2,
        active: true,
      });
      keep.flush(BANNER);
      await kept;

      const removed = firstValueFrom(home.updateBanner(bannerId, DRAFT, { kind: 'remove' }));
      const remove = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/home/banners/${bannerId}` });
      expect(remove.request.body).toMatchObject({ title: DRAFT.title, media_id: null });
      remove.flush(BANNER);
      await removed;

      const deleted = firstValueFrom(home.removeBanner(bannerId));
      http
        .expectOne({ method: 'DELETE', url: `${BASE}/admin/home/banners/${bannerId}` })
        .flush(DELETED);
      await expect(deleted).resolves.toBeUndefined();
    });

    it('does not save the banner when the image is refused', async () => {
      const home = TestBed.inject(HttpHomeScreenRepository);
      const created = firstValueFrom(home.createBanner(DRAFT, png()));

      http.expectOne(`${BASE}/media`).flush(
        {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'That file is larger than 5 MB.',
            details: {},
            request_id: 'r',
          },
        },
        { status: 413, statusText: 'Payload Too Large' },
      );
      await expect(created).rejects.toBeTruthy();
      http.expectNone(`${BASE}/admin/home/banners`);
    });

    it('reads a banner’s image as bytes through the media route, with the token in a header', async () => {
      const home = TestBed.inject(HttpHomeScreenRepository);
      const [banner] = BANNERS.data;
      const shown = toHomeBanner(banner);
      if (shown === null) throw new Error('The fixture banner is unreadable.');

      const bytes = firstValueFrom(home.bannerImage(shown));
      const request = http.expectOne(`${BASE}/media/${shown.mediaId}/content`);
      expect(request.request.responseType).toBe('blob');
      expect(request.request.headers.get('Authorization')).toBe('Bearer fixture-token');
      request.flush(new Blob(['x'], { type: 'image/png' }));
      expect((await bytes).size).toBe(1);
    });

    it('writes a link with the body the API reads', async () => {
      const home = TestBed.inject(HttpHomeScreenRepository);
      const linkId = asId<QuickLinkId>(LINK.data.id);

      const created = firstValueFrom(
        home.createLink({ label: 'Hotlines', href: 'https://home.example.test/hotlines', sortOrder: 2 }),
      );
      const post = http.expectOne({ method: 'POST', url: `${BASE}/admin/home/links` });
      expect(post.request.body).toEqual({
        label: 'Hotlines',
        href: 'https://home.example.test/hotlines',
        sort_order: 2,
      });
      post.flush(LINK, { status: 201, statusText: 'Created' });
      await created;

      const changed = firstValueFrom(
        home.updateLink(linkId, { label: 'Hotlines', href: 'https://home.example.test/x', sortOrder: 3 }),
      );
      http.expectOne({ method: 'PATCH', url: `${BASE}/admin/home/links/${linkId}` }).flush(LINK);
      await changed;

      const removed = firstValueFrom(home.removeLink(linkId));
      http.expectOne({ method: 'DELETE', url: `${BASE}/admin/home/links/${linkId}` }).flush(DELETED);
      await expect(removed).resolves.toBeUndefined();
    });

    it('previews the home screen as the app is given it', async () => {
      const home = TestBed.inject(HttpHomeScreenRepository);
      const preview = firstValueFrom(home.preview());
      http.expectOne({ method: 'GET', url: `${BASE}/home` }).flush(HOME);

      expect(await preview).toMatchObject({ hotlines: 1, news: 1 });
    });
  });

  describe('the app’s settings (DL-170)', () => {
    beforeEach(() => tokens.hold('fixture-token', null));

    it('reads the settings where every app reads them', async () => {
      const settings = TestBed.inject(HttpAppConfigRepository);
      const config = firstValueFrom(settings.read());
      http.expectOne({ method: 'GET', url: `${BASE}/app/config` }).flush(APP_CONFIG);

      expect((await config).featureFlags.map((flag) => flag.key)).toEqual([
        'show_digital_id',
        'tulong_catalogue',
      ]);
    });

    it('sends only what changed, with null to clear and to delete a flag', async () => {
      const settings = TestBed.inject(HttpAppConfigRepository);
      const changed = firstValueFrom(
        settings.change({
          minimumAppVersion: '2.0',
          supportEmail: null,
          featureFlags: [{ key: 'tulong_catalogue', value: null }],
        }),
      );
      const patch = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/app/config` });
      expect(JSON.parse(JSON.stringify(patch.request.body))).toEqual({
        support_email: null,
        minimum_app_version: '2.0',
        feature_flags: { tulong_catalogue: null },
      });
      patch.flush(APP_CONFIG);
      await changed;
    });
  });
});
