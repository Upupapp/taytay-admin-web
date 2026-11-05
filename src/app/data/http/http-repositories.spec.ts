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
  SignInError,
  type MediaId,
  type NotificationId,
  type OfficeThreadId,
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
import {
  HttpNotificationRepository,
  HttpOfficeInboxRepository,
  HttpOfficeRepository,
  HttpSessionRefresher,
  HttpStaffRepository,
  HttpVerificationRepository,
} from './http-repositories';
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

      // `audit.view`, `verification.review` (DL-167) and `office-inbox.manage` (DL-168) are the
      // capabilities with a console key of the same name; the rest are kept aside as unknown,
      // never translated.
      expect([...(identity?.permissions ?? [])].sort()).toEqual([
        'audit.view',
        'office-inbox.manage',
        'verification.review',
      ]);
      expect(identity?.unknownPermissions).not.toContain('verification.review');
      expect(identity?.unknownPermissions).toContain('user.view');
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
});
