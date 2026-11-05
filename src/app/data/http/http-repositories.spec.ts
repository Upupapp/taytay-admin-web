import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import { asId, SignInError, type NotificationId } from '@domain/index';

import ME_ADMIN from './fixtures/me-admin.json';
import ME_RESIDENT from './fixtures/me-resident.json';
import ME_STAFF from './fixtures/me-staff.json';
import NOTIFICATION_READ from './fixtures/notification-read.json';
import NOTIFICATIONS_PAGE_1 from './fixtures/notifications-page-1.json';
import NOTIFICATIONS_PAGE_2 from './fixtures/notifications-page-2.json';
import NOTIFICATIONS_READ_ALL from './fixtures/notifications-read-all.json';
import SIGNED_OUT from './fixtures/signed-out.json';
import { HttpNotificationRepository, HttpSessionRefresher, HttpStaffRepository } from './http-repositories';
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

      // `audit.view` is the one capability with a console key of the same name.
      expect([...(identity?.permissions ?? [])]).toEqual(['audit.view']);
      expect(identity?.unknownPermissions).toContain('verification.review');
      expect(identity?.roleLabel).toBe('Administrator');
    });

    it('grants nothing a staff role would suggest when the server sent no matching key', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      http.expectOne(`${BASE}/me`).flush(ME_STAFF);
      const identity = await user;

      expect(identity?.permissions.size).toBe(0);
      expect(identity?.roleLabel).toBe('Staff');
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
          expect(result.user.permissions.size).toBe(0);
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
});
