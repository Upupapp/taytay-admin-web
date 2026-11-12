import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { readApiError } from '@core/http/api-failure';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  ASSISTANCE_HISTORY_NOT_YOURS,
  asId,
  asIsoDate,
  centavos,
  describeMembershipChange,
  HOTLINE_LIST_CAP,
  isAppConfigRefusal,
  isCommandCenterTaken,
  isInPersonRefused,
  isFamilyDraftInvalid,
  isHouseholdCompositionError,
  isRelationshipInvalid,
  isTransferRefused,
  VULNERABILITY_FACTOR_CODES,
  PERMISSIONS,
  SignInError,
  toProgramDraft,
  type AppAccountId,
  type BarangayId,
  type FamilyDraft,
  type FamilyId,
  type HouseholdId,
  type ProgramId,
  type RelationshipId,
  type ResidentDraft,
  type ResidentId,
  type SavedViewId,
  type BalitaArticleId,
  type DigitalIdId,
  type HomeBannerId,
  type HotlineId,
  type TulongServiceId,
  type MediaId,
  type NotificationId,
  type OfficeId,
  type OfficeThreadId,
  type QuickLinkId,
  type VerificationRequestId,
  WriteIntent,
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
import VERIFICATION_SUPERSEDED from './fixtures/verification-superseded.json';
import IN_PERSON_VERIFICATION from './fixtures/in-person-verification.json';
import OFFICES_PAGE from './fixtures/offices-page.json';
import THREAD from './fixtures/thread.json';
import THREAD_MESSAGES_PAGE from './fixtures/thread-messages-page.json';
import THREAD_REPLY from './fixtures/thread-reply.json';
import THREADS_PAGE from './fixtures/threads-page.json';
import USER_OFFICE_ASSIGNED from './fixtures/user-office-assigned.json';
import USER_OFFICE_ROLE_CHANGED from './fixtures/user-office-role-changed.json';
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
import DIGITAL_ID_CARD from './fixtures/digital-id-card.json';
import DIGITAL_ID_HOLDER from './fixtures/digital-id-holder.json';
import NEWS from './fixtures/news.json';
import NEWS_PAGE from './fixtures/news-page.json';
import NEWS_CATEGORIES from './fixtures/news-categories.json';
import AUDIT_PAGE from './fixtures/audit-page.json';
import OFFICE_RESIDENT from './fixtures/office-resident.json';
import OFFICE_RESIDENTS_PAGE from './fixtures/office-residents-page.json';
import OFFICE_HOUSEHOLD from './fixtures/office-household.json';
import OFFICE_HOUSEHOLD_CONFLICT from './fixtures/office-household-conflict.json';
import OFFICE_HOUSEHOLDS_PAGE from './fixtures/office-households-page.json';
import OFFICE_FAMILIES_PAGE from './fixtures/office-families-page.json';
import OFFICE_FAMILY from './fixtures/office-family.json';
import OFFICE_FAMILY_CONFLICT from './fixtures/office-family-conflict.json';
import OFFICE_RELATIONSHIP from './fixtures/office-relationship.json';
import OFFICE_RELATIONSHIP_HISTORY from './fixtures/office-relationship-history.json';
import OFFICE_RESIDENT_FAMILIES from './fixtures/office-resident-families.json';
import OFFICE_PROGRAM from './fixtures/office-program.json';
import OFFICE_PROGRAM_REFUSAL from './fixtures/office-program-refusal.json';
import OFFICE_PROGRAM_TEMPLATES from './fixtures/office-program-templates.json';
import OFFICE_PROGRAMS_PAGE from './fixtures/office-programs-page.json';
import OFFICE_REQUIREMENT_TEMPLATE from './fixtures/office-requirement-template.json';
import OFFICE_REQUIREMENT_TEMPLATE_REFUSAL from './fixtures/office-requirement-template-refusal.json';
import OFFICE_REQUIREMENT_TEMPLATES from './fixtures/office-requirement-templates.json';
import SAVED_VIEW from './fixtures/saved-view.json';
import SAVED_VIEWS from './fixtures/saved-views.json';
import {
  HttpAppAccountRepository,
  HttpAppConfigRepository,
  HttpBalitaRepository,
  HttpDigitalIdRepository,
  HttpDirectoryOfficeRepository,
  HttpFamilyRepository,
  HttpHomeScreenRepository,
  HttpHotlineRepository,
  HttpHouseholdRepository,
  HttpNotificationRepository,
  HttpOfficeInboxRepository,
  HttpOfficeRepository,
  HttpPlatformAuditRepository,
  HttpResidentRepository,
  HttpProgramRepository,
  HttpSavedViewRepository,
  HttpSessionRefresher,
  HttpStaffRepository,
  HttpTulongServiceRepository,
  HttpVerificationRepository,
} from './http-repositories';
import { toFamilyRefusal } from './mappers/family.mapper';
import { toHomeBanner } from './mappers/home.mapper';
import { toHouseholdRefusal } from './mappers/household.mapper';
import { toAssistanceProgram } from './mappers/program.mapper';
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
        HttpDigitalIdRepository,
        HttpBalitaRepository,
        HttpPlatformAuditRepository,
        HttpResidentRepository,
        HttpHouseholdRepository,
        HttpFamilyRepository,
        HttpProgramRepository,
        HttpSavedViewRepository,
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

      // An administrator holds every key the server has (DL-173): sixteen platform capabilities
      // with a console key of the same name, and the casework keys. `household.view-counts` has no
      // console key: it is kept aside as unknown and grants nothing. The nine `newsfeed.*` keys left
      // the API too (taytay-backend 12431a3, DL-194), so `/me` no longer sends them.
      expect([...(identity?.permissions ?? [])].sort()).toEqual([...PERMISSIONS].sort());
      expect(identity?.unknownPermissions).toEqual(['household.view-counts']);
      // The server names the office role now, so the console's own label is the one shown.
      expect(identity?.role).toBe('system-administrator');
      expect(identity?.roleLabel).toBe('System administrator');
      expect(identity?.scope).toBe('all-barangays');
      // An administrator acts for every office, so it is never waiting for one.
      expect(identity?.awaitingOffice).toBe(false);
    });

    it('grants a staff account only the keys the server sent that the console knows', async () => {
      tokens.hold('fixture-token', null);
      const user = firstValueFrom(staff.currentUser());

      http.expectOne(`${BASE}/me`).flush(ME_STAFF);
      const identity = await user;

      // A staff account at an office with no office role holds the office-bound keys, the document
      // request keys among them (`DL-184`).
      expect([...(identity?.permissions ?? [])].sort()).toEqual([
        'digital-id.verify',
        'issuance-request.manage',
        'issuance-type.manage',
        'news.write',
        'office-inbox.manage',
      ]);
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
          // The server keys a staff account at an office holds that the console knows (DL-168,
          // DL-171, DL-184).
          expect([...result.user.permissions].sort()).toEqual([
            'digital-id.verify',
            'issuance-request.manage',
            'issuance-type.manage',
            'news.write',
            'office-inbox.manage',
          ]);
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

        expect((await user).roleLabel).toBe('System administrator');
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
      // What the account gives, for the reviewer to check against the ID (DL-197).
      expect(answer.items.map((item) => item.account)).toEqual([
        { name: 'Ana Cruz', birthDate: '1990-05-01' },
        { name: null, birthDate: null },
      ]);
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

    it('approves with the note in notes, and sends back the name and birth date it confirmed', async () => {
      const id = asId<VerificationRequestId>(VERIFICATION_APPROVED.data.id);
      const decided = firstValueFrom(
        verification.approve(id, 'Selfie matches the ID photo.', {
          name: 'Ana Cruz',
          birthDate: asIsoDate('1990-05-01'),
        }),
      );

      const request = http.expectOne({
        method: 'POST',
        url: `${BASE}/admin/verification-requests/${id}/approve`,
      });
      expect(request.request.body).toEqual({
        notes: 'Selfie matches the ID photo.',
        confirmed_name: 'Ana Cruz',
        confirmed_birthdate: '1990-05-01',
      });
      request.flush(VERIFICATION_APPROVED);

      const answer = await decided;
      expect(answer.status).toBe('approved');
      expect(answer.account).toBeNull();
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

    it('asks for no selfie the server erased (DL-218)', async () => {
      const request = toVerificationRequest({
        ...VERIFICATION_PAGE.data[0],
        selfie_erased_at: '2026-11-11T09:00:00.000Z',
      });
      if (request === null) throw new Error('fixture unreadable');

      await expect(firstValueFrom(verification.openImage(request, 'selfie'))).rejects.toThrow(
        /erased/,
      );
      http.expectNone(`${BASE}/media/${request.images.selfie}/content`);
    });

    it('asks for the superseded requests by the status the API lists them under', async () => {
      const page = firstValueFrom(verification.list({ status: 'superseded' }, { limit: 20 }));

      const request = http.expectOne((r) => r.url === `${BASE}/admin/verification-requests`);
      expect(request.request.params.get('status')).toBe('superseded');
      request.flush({ data: [VERIFICATION_SUPERSEDED.data], meta: VERIFICATION_PAGE.meta });

      const answer = await page;
      expect(answer.items.map((item) => item.status)).toEqual(['superseded']);
    });

    describe('verifying an account in person (DL-219)', () => {
      const account = asId<AppAccountId>(IN_PERSON_VERIFICATION.data.user_id);
      const check = {
        idType: 'philid',
        idLastFour: '4C7K',
        confirmedName: 'Ana Cruz',
        correctedName: null,
      } as const;
      const url = `${BASE}/admin/users/${account}/in-person-verifications`;

      it('posts the check as JSON with the key in the body, and no image', async () => {
        const intent = new WriteIntent();
        const done = firstValueFrom(verification.verifyInPerson(account, check, intent));

        const sent = http.expectOne(url);
        expect(sent.request.method).toBe('POST');
        expect(sent.request.body).toEqual({
          idempotency_key: intent.key,
          id_type: 'philid',
          id_last_four: '4C7K',
          confirmed_name: 'Ana Cruz',
          id_shows_name: true,
        });
        expect(sent.request.body).not.toBeInstanceOf(FormData);
        expect(sent.request.headers.has('Idempotency-Key')).toBe(false);
        sent.flush(IN_PERSON_VERIFICATION, { status: 201, statusText: 'Created' });

        expect((await done).supersededRequestId).toBe(
          IN_PERSON_VERIFICATION.data.superseded_request_id,
        );
      });

      it.each([
        [403, 'FORBIDDEN', 'You cannot verify your own account.', 'forbidden'],
        [404, 'NOT_FOUND', 'That user was not found.', 'conflict'],
        [409, 'CONFLICT', 'This account is already verified.', 'conflict'],
      ] as const)(
        'reads a %i as the domain’s refusal, in the server’s words',
        async (status, code, message, kind) => {
          const done = firstValueFrom(
            verification.verifyInPerson(account, check, new WriteIntent()),
          );
          http
            .expectOne(url)
            .flush(
              { error: { code, message, details: {}, request_id: 'r' } },
              { status, statusText: code },
            );

          const refusal: unknown = await done.catch((error: unknown) => error);
          expect(isInPersonRefused(refusal)).toBe(true);
          expect(refusal).toMatchObject({ message, kind, fields: {} });
        },
      );

      it('reads a 422 with the fields it names, in the domain’s terms', async () => {
        const done = firstValueFrom(verification.verifyInPerson(account, check, new WriteIntent()));
        http.expectOne(url).flush(
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'The request could not be validated.',
              details: { id_last_four: ['Only the last four characters of the ID number.'] },
              request_id: 'r',
            },
          },
          { status: 422, statusText: 'Unprocessable Entity' },
        );

        const refusal: unknown = await done.catch((error: unknown) => error);
        expect(refusal).toMatchObject({
          kind: 'invalid',
          fields: { idLastFour: 'Only the last four characters of the ID number.' },
        });
      });
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

    it('sends a reply as the body the API reads, with the screen’s key, and nothing else', async () => {
      const words = 'Please bring the death certificate and a valid ID.';
      const intent = new WriteIntent();
      const sent = firstValueFrom(inbox.reply(threadId, words, intent));

      const request = http.expectOne({
        method: 'POST',
        url: `${BASE}/threads/${threadId}/messages`,
      });
      // In the body, never a header: the CORS policy allows four request headers (DL-188).
      expect(request.request.body).toEqual({ body: words, idempotency_key: intent.key });
      expect(request.request.headers.has('Idempotency-Key')).toBe(false);
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

    it('gives an office role with its barangay and the reason, trimmed, as the API reads them (DL-173)', async () => {
      const barangay = asId<BarangayId>(USER_OFFICE_ROLE_CHANGED.data.scope_barangay_id);
      const given = firstValueFrom(
        accounts.assignOfficeRole(accountId, {
          role: 'barangay-link',
          barangayId: barangay,
          reason: '  Encodes for San Juan.  ',
        }),
      );

      const request = http.expectOne({
        method: 'PATCH',
        url: `${BASE}/admin/users/${accountId}/office-role`,
      });
      expect(request.request.body).toEqual({
        office_role: 'barangay-link',
        scope_barangay_id: barangay,
        reason: 'Encodes for San Juan.',
      });
      request.flush(USER_OFFICE_ROLE_CHANGED);

      const account = await given;
      expect(account.officeRole).toBe('barangay-link');
      expect(account.scopeBarangayId).toBe(barangay);
    });

    it('corrects a verified name with the name shown and the statement that the ID was seen (DL-198)', async () => {
      const corrected = firstValueFrom(
        accounts.correctName(accountId, { name: '  Ana Cruz Reyes ', previousName: 'Ana Cruz' }),
      );

      const request = http.expectOne({
        method: 'POST',
        url: `${BASE}/admin/users/${accountId}/name-corrections`,
      });
      expect(request.request.body).toEqual({
        name: 'Ana Cruz Reyes',
        previous_name: 'Ana Cruz',
        id_checked: true,
      });
      request.flush(USER_ROLE_CHANGED);

      expect((await corrected).id).toBe(USER_ROLE_CHANGED.data.id);
    });

    it('reads the barangays whole, as the API keys them, and refuses a list it cannot read', async () => {
      const listed = firstValueFrom(accounts.barangays());
      http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush({
        data: [{ id: '7d1e0c55-2f6a-4b8e-9c3d-5a6b7c8d9e01', code: 'SJ', name: 'San Juan' }],
        meta: {},
      });
      expect(await listed).toEqual([{ id: '7d1e0c55-2f6a-4b8e-9c3d-5a6b7c8d9e01', name: 'San Juan' }]);

      const broken = firstValueFrom(accounts.barangays());
      http
        .expectOne({ method: 'GET', url: `${BASE}/barangays` })
        .flush({ data: [{ id: null, code: 'X', name: 'Nowhere' }], meta: {} });
      await expect(broken).rejects.toThrow(/could not be read/);
    });
  });

  describe('the office resident registry (DL-174)', () => {
    let residents: HttpResidentRepository;
    const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
    const SAN_JUAN_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04';
    const BARANGAYS = {
      data: [
        { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
        { id: SAN_JUAN_API, code: 'san-juan', name: 'San Juan' },
      ],
      meta: {},
    };
    const savedId = asId<ResidentId>(OFFICE_RESIDENT.data.id);

    const barangays = (): void => {
      http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
    };

    const draft = (): ResidentDraft => ({
      name: { first: ' Maria ', middle: 'Santos', last: 'Dela Cruz', suffix: '' },
      sex: 'female',
      birthDate: asIsoDate('1990-04-02'),
      civilStatus: 'married',
      address: {
        barangayId: asId<BarangayId>('brgy-dolores'),
        purokOrSitio: 'Purok 3',
        streetAddress: '12 Rizal Ave.',
      },
      contact: { mobile: '09170000103', email: null },
      sectors: ['senior-citizen'],
      philsysLastFour: '1290',
      monthlyIncome: centavos(850050),
      householdId: null,
    });

    beforeEach(() => {
      residents = TestBed.inject(HttpResidentRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads a cursor page as the server redacted it, naming barangays as this console does', async () => {
      const page = firstValueFrom(residents.list({}, { limit: 20, cursor: null }));
      barangays();
      const request = http.expectOne((r) => r.url === `${BASE}/office/residents`);
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(OFFICE_RESIDENTS_PAGE);

      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.nextCursor).toBe(OFFICE_RESIDENTS_PAGE.meta.pagination.next_cursor);
      const [masked, plain] = answer.items;
      // The server sent the surname and an initial; nothing here can print more.
      expect(masked?.listedName).toBe('Villanueva, R.');
      expect(masked?.fullName).toBe('Villanueva, R.');
      expect(masked?.isProtected).toBe(true);
      expect(masked?.withheld).toEqual(['protectedSectors', 'contact', 'exactAddress']);
      expect(masked?.resident.address.barangayId).toBe('brgy-dolores');
      expect(masked?.resident.monthlyIncome).toEqual(centavos(320000));
      expect(plain?.listedName).toBe('Ygot Jr., Jose Ramos');
      expect(plain?.resident.address.barangayId).toBe('brgy-san-juan');
      expect(plain?.resident.sectors).toEqual(['senior-citizen', 'pwd']);
    });

    it('sends the filter as the API names it, and the barangay as the API keys it', async () => {
      const page = firstValueFrom(
        residents.list(
          {
            search: '  dela cruz ',
            barangayId: asId<BarangayId>('brgy-san-juan'),
            sector: 'pwd',
            ageGroup: 'senior',
            includeInactive: true,
          },
          { limit: 20, cursor: 'abc' },
        ),
      );
      barangays();
      const request = http.expectOne((r) => r.url === `${BASE}/office/residents`);
      const params = request.request.params;
      expect(params.keys().sort()).toEqual(
        ['age_group', 'barangay_id', 'cursor', 'include_inactive', 'limit', 'q', 'sector'].sort(),
      );
      expect(params.get('q')).toBe('dela cruz');
      expect(params.get('barangay_id')).toBe(SAN_JUAN_API);
      expect(params.get('include_inactive')).toBe('true');
      request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      expect((await page).items).toEqual([]);
    });

    it('asks nothing for a one-letter search or a household it cannot filter by', async () => {
      await expect(
        firstValueFrom(residents.list({ search: 'm' }, { limit: 20, cursor: null })),
      ).rejects.toThrow(/two letters/);
      // The API holds households now; the registry list simply is not filtered by one.
      await expect(
        firstValueFrom(
          residents.list({ householdId: asId<HouseholdId>('h-1') }, { limit: 20, cursor: null }),
        ),
      ).rejects.toThrow(/cannot be filtered by household.*household record/);
    });

    it('refuses the page rather than leave out a record it cannot read', async () => {
      const [first, second] = OFFICE_RESIDENTS_PAGE.data;
      const unreadable = [
        { ...second, sectors: ['senior-citizen', 'astronaut'] },
        { ...second, withheld: ['birth_date'] },
        // A barangay the API has and this console does not name: placed nowhere, not guessed at.
        { ...second, barangay_id: '00000000-0000-4000-8000-000000000000' },
      ];
      for (const [index, broken] of unreadable.entries()) {
        const page = firstValueFrom(residents.list({}, { limit: 20, cursor: null }));
        if (index === 0) {
          // Read once per adapter and kept.
          barangays();
        }
        http
          .expectOne((r) => r.url === `${BASE}/office/residents`)
          .flush({ ...OFFICE_RESIDENTS_PAGE, data: [first, broken] });
        await expect(page).rejects.toThrow(/could not be read/);
      }
    });

    it('reads one record, and a 404 as nobody it may see', async () => {
      const found = firstValueFrom(residents.getById(savedId));
      barangays();
      http.expectOne({ method: 'GET', url: `${BASE}/office/residents/${savedId}` }).flush(OFFICE_RESIDENT);
      expect((await found)?.resident.philsysLastFour).toBe('1290');

      const missing = firstValueFrom(residents.getById(asId<ResidentId>('nobody')));
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/residents/nobody` })
        .flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
      expect(await missing).toBeNull();
    });

    it('creates with the flat body the API reads: centavos, no sectors, no household', async () => {
      const created = firstValueFrom(residents.create(draft()));
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${BASE}/office/residents` });
      expect(request.request.body).toEqual({
        first_name: 'Maria',
        middle_name: 'Santos',
        last_name: 'Dela Cruz',
        suffix: null,
        sex: 'female',
        birth_date: '1990-04-02',
        civil_status: 'married',
        barangay_id: DOLORES_API,
        purok_or_sitio: 'Purok 3',
        street_address: '12 Rizal Ave.',
        mobile: '09170000103',
        email: null,
        philsys_last_four: '1290',
        monthly_income_centavos: 850050,
      });
      request.flush(OFFICE_RESIDENT);
      expect((await created).id).toBe(savedId);
    });

    it('validates before sending, as the form and the mock do', async () => {
      await expect(
        firstValueFrom(residents.create({ ...draft(), philsysLastFour: '123456789012' })),
      ).rejects.toThrow(/need correcting/);
    });

    it('updates with the same body, at the record', async () => {
      const updated = firstValueFrom(residents.update(savedId, draft()));
      barangays();
      const request = http.expectOne({ method: 'PATCH', url: `${BASE}/office/residents/${savedId}` });
      expect(Object.keys(request.request.body as object)).not.toContain('sectors');
      request.flush(OFFICE_RESIDENT);
      expect((await updated).name.last).toBe('Dela Cruz');
    });

    it('retires and restores through two routes, each with its reason', async () => {
      const retired = firstValueFrom(residents.setActive(savedId, false, '  Moved to Antipolo. '));
      barangays();
      const retire = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/residents/${savedId}/deactivate`,
      });
      expect(retire.request.body).toEqual({ reason: 'Moved to Antipolo.' });
      retire.flush({ ...OFFICE_RESIDENT, data: { ...OFFICE_RESIDENT.data, is_active: false } });
      expect((await retired).isActive).toBe(false);

      const restored = firstValueFrom(residents.setActive(savedId, true, 'Returned.'));
      const restore = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/residents/${savedId}/reactivate`,
      });
      expect(restore.request.body).toEqual({ reason: 'Returned.' });
      restore.flush(OFFICE_RESIDENT);
      expect((await restored).isActive).toBe(true);
    });

    it('records and ends a sector, each as its own act with a reason', async () => {
      const recorded = firstValueFrom(residents.recordSector(savedId, 'pwd', ' PWD ID seen. '));
      const record = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/residents/${savedId}/sectors`,
      });
      expect(record.request.body).toEqual({ sector: 'pwd', reason: 'PWD ID seen.' });
      record.flush(OFFICE_RESIDENT);
      await recorded;

      const ended = firstValueFrom(residents.endSector(savedId, 'pwd', 'Card expired.'));
      const end = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/residents/${savedId}/sectors/pwd/end`,
      });
      expect(end.request.body).toEqual({ reason: 'Card expired.' });
      end.flush(OFFICE_RESIDENT);
      await ended;
    });
  });

  describe('the office household register (casework phase 1c)', () => {
    let households: HttpHouseholdRepository;
    const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
    const SAN_JUAN_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04';
    const BARANGAYS = {
      data: [
        { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
        { id: SAN_JUAN_API, code: 'san-juan', name: 'San Juan' },
      ],
      meta: {},
    };
    const householdId = asId<HouseholdId>(OFFICE_HOUSEHOLD.data.household.id);
    const HEAD = asId<ResidentId>(OFFICE_HOUSEHOLD.data.members[0]?.resident.id ?? '');
    const CHILD = asId<ResidentId>(OFFICE_HOUSEHOLD.data.members[1]?.resident.id ?? '');

    const barangays = (): void => {
      http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
    };

    beforeEach(() => {
      households = TestBed.inject(HttpHouseholdRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads a cursor page as the server redacted it, saying what was withheld', async () => {
      const page = firstValueFrom(households.list({}, { limit: 20, cursor: null }));
      barangays();
      const request = http.expectOne((r) => r.url === `${BASE}/office/households`);
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(OFFICE_HOUSEHOLDS_PAGE);

      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.nextCursor).toBe(OFFICE_HOUSEHOLDS_PAGE.meta.pagination.next_cursor);
      const [protectedRow, plain] = answer.items;
      expect(protectedRow?.isProtected).toBe(true);
      expect(protectedRow?.withheld).toEqual(['exactAddress', 'monthlyIncome']);
      expect(protectedRow?.household.address.streetAddress).toBeNull();
      expect(protectedRow?.household.address.barangayId).toBe('brgy-dolores');
      expect(protectedRow?.headName).toBe('Dela Cruz, Maria Santos');
      expect(protectedRow?.memberCount).toBe(2);
      expect(protectedRow?.band).toBe('elevated');
      expect(plain?.household.address.barangayId).toBe('brgy-san-juan');
      expect(plain?.withheld).toEqual([]);
      // A list row carries no member list: it is not the household's members, so it is not one.
      expect(plain?.household).not.toHaveProperty('members');
    });

    it('sends the filter as the API names it, and the barangay as the API keys it', async () => {
      const page = firstValueFrom(
        households.list(
          {
            search: '  rizal ',
            barangayId: asId<BarangayId>('brgy-san-juan'),
            indigentOnly: true,
            minimumBand: 'elevated',
          },
          { limit: 20, cursor: 'abc' },
        ),
      );
      barangays();
      const request = http.expectOne((r) => r.url === `${BASE}/office/households`);
      const params = request.request.params;
      expect(params.keys().sort()).toEqual(
        ['barangay_id', 'cursor', 'indigent', 'limit', 'minimum_band', 'q'].sort(),
      );
      expect(params.get('q')).toBe('rizal');
      expect(params.get('barangay_id')).toBe(SAN_JUAN_API);
      expect(params.get('indigent')).toBe('true');
      expect(params.get('minimum_band')).toBe('elevated');
      request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      expect((await page).items).toEqual([]);
    });

    it('asks nothing for a one-character search, which the API would refuse', async () => {
      await expect(
        firstValueFrom(households.list({ search: 'h' }, { limit: 20, cursor: null })),
      ).rejects.toThrow(/two characters/);
    });

    it('reads a record whole: members redacted, indicators withheld, the trail in words', async () => {
      const found = firstValueFrom(households.getById(householdId));
      barangays();
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/households/${householdId}` })
        .flush(OFFICE_HOUSEHOLD);
      const detail = await found;

      expect(detail?.withheld).toEqual(['exactAddress', 'monthlyIncome']);
      expect(detail?.household.monthlyIncome).toBeNull();
      expect(detail?.household.members).toEqual([
        { residentId: HEAD, role: 'head' },
        { residentId: CHILD, role: 'child' },
      ]);
      const child = detail?.members[1];
      expect(child?.isHead).toBe(false);
      expect(child?.view.listedName).toBe('Dela Cruz, J.');
      expect(child?.view.resident.householdId).toBe(householdId);

      const factors = detail?.snapshot.factors ?? [];
      expect(factors.map((factor) => factor.code)).toEqual([...VULNERABILITY_FACTOR_CODES]);
      for (const code of ['no-income-recorded', 'income-below-threshold', 'protected-member']) {
        expect(factors.find((factor) => factor.code === code)?.state).toBe('withheld');
      }
      const corrected = factors.find((factor) => factor.code === 'solo-parent-head');
      expect(corrected?.origin).toBe('corrected');
      expect(corrected?.computedState).toBe('absent');
      expect(corrected?.correction?.actorName).toBe('Ana Reyes');
      expect(detail?.snapshot.band).toBe('elevated');

      const trail = detail?.audit ?? [];
      expect(trail.map((entry) => entry.action)).toEqual([
        'factor-corrected',
        'membership-changed',
        'membership-changed',
        'created',
      ]);
      // Worded where the mock words it, with the reason kept apart.
      expect(trail[1]?.summary).toBe(
        describeMembershipChange({ kind: 'add-member', residentId: CHILD, role: 'child' }),
      );
      expect(trail[1]?.reason).toBe('Home visit 5 November: her son lives with her.');
      expect(trail[1]?.actorName).not.toBe('');
      expect(trail[3]?.summary).toBe('registered the household');
      expect(trail[3]?.reason).toBeNull();
      expect(trail[0]?.entityId).toBe(householdId);
    });

    it('refuses a record whose indicators cannot be read exactly', async () => {
      const snapshot = OFFICE_HOUSEHOLD.data.snapshot;
      const broken = [
        // A threshold other than the one this console cites beside the figures.
        { ...snapshot, poverty_threshold: { ...snapshot.poverty_threshold, annual_per_capita_centavos: 1 } },
        // An indicator missing reads as one that does not apply.
        { ...snapshot, factors: snapshot.factors.slice(1) },
      ];
      for (const [index, wrong] of broken.entries()) {
        const found = firstValueFrom(households.getById(householdId));
        if (index === 0) {
          barangays();
        }
        http
          .expectOne({ method: 'GET', url: `${BASE}/office/households/${householdId}` })
          .flush({ ...OFFICE_HOUSEHOLD, data: { ...OFFICE_HOUSEHOLD.data, snapshot: wrong } });
        await expect(found).rejects.toThrow(/could not be read/);
      }
    });

    it('reads a 404 as nobody it may see', async () => {
      const missing = firstValueFrom(households.getById(asId<HouseholdId>('nowhere')));
      barangays();
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/households/nowhere` })
        .flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
      expect(await missing).toBeNull();
    });

    it('registers with the flat body the API reads, in centavos', async () => {
      const created = firstValueFrom(
        households.create({
          barangayId: asId<BarangayId>('brgy-dolores'),
          purokOrSitio: '  ',
          streetAddress: ' 12 Rizal Ave. ',
          headResidentId: HEAD,
          monthlyIncome: centavos(850_050),
          isIndigent: true,
        }),
      );
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${BASE}/office/households` });
      expect(request.request.body).toEqual({
        barangay_id: DOLORES_API,
        purok_or_sitio: null,
        street_address: '12 Rizal Ave.',
        head_resident_id: HEAD,
        monthly_income_centavos: 850_050,
        is_indigent: true,
      });
      request.flush(OFFICE_HOUSEHOLD, { status: 201, statusText: 'Created' });
      expect((await created).household.id).toBe(householdId);
    });

    it('sends membership as intents, corrections and withdrawals each with a reason', async () => {
      const changed = firstValueFrom(
        households.changeMembership(
          householdId,
          [
            { kind: 'add-member', residentId: CHILD, role: 'child' },
            { kind: 'set-head', residentId: HEAD },
          ],
          '  Home visit. ',
        ),
      );
      barangays();
      const membership = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/households/${householdId}/membership`,
      });
      expect(membership.request.body).toEqual({
        changes: [
          { kind: 'add-member', resident_id: CHILD, role: 'child' },
          { kind: 'set-head', resident_id: HEAD },
        ],
        reason: 'Home visit.',
      });
      membership.flush(OFFICE_HOUSEHOLD);
      await changed;

      const corrected = firstValueFrom(
        households.correctFactor(householdId, 'pwd-member', 'present', 'PWD ID seen at the visit.'),
      );
      const correction = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/households/${householdId}/corrections`,
      });
      expect(correction.request.body).toEqual({
        code: 'pwd-member',
        state: 'present',
        reason: 'PWD ID seen at the visit.',
      });
      correction.flush(OFFICE_HOUSEHOLD);
      await corrected;

      const withdrawn = firstValueFrom(
        households.clearCorrection(householdId, 'pwd-member', 'Card was not his.'),
      );
      const withdrawal = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/households/${householdId}/corrections/pwd-member/withdraw`,
      });
      expect(withdrawal.request.body).toEqual({ reason: 'Card was not his.' });
      withdrawal.flush(OFFICE_HOUSEHOLD);
      await withdrawn;
    });

    it('never sends "withheld" as a correction: it is a reading, not a state', async () => {
      await expect(
        firstValueFrom(households.correctFactor(householdId, 'pwd-member', 'withheld', 'A reason here.')),
      ).rejects.toThrow(/present, absent or unknown/);
    });

    it('reads a refused composition as the domain’s problems, and anything else in the server’s words', () => {
      const failure = (body: unknown) =>
        readApiError(
          new HttpErrorResponse({ error: body, status: 409, statusText: 'Conflict' }),
        );

      const refused = toHouseholdRefusal(failure(OFFICE_HOUSEHOLD_CONFLICT));
      expect(isHouseholdCompositionError(refused)).toBe(true);
      if (isHouseholdCompositionError(refused)) {
        expect(refused.problems).toEqual([
          {
            code: 'member-in-another-household',
            residentId: OFFICE_HOUSEHOLD_CONFLICT.error.details['member-in-another-household'][0],
          },
        ]);
      }

      const unfamiliar = toHouseholdRefusal(
        failure({
          error: {
            ...OFFICE_HOUSEHOLD_CONFLICT.error,
            message: 'Something this console has no words for.',
            details: { 'household-on-fire': [] },
          },
        }),
      );
      expect(isHouseholdCompositionError(unfamiliar)).toBe(false);
      expect(unfamiliar?.message).toBe('Something this console has no words for.');

      const noDetails = toHouseholdRefusal(
        failure({
          error: {
            code: 'CONFLICT',
            message: 'No correction of that factor stands to withdraw.',
            details: {},
            request_id: 'req-2',
          },
        }),
      );
      expect(noDetails?.message).toBe('No correction of that factor stands to withdraw.');

      // Not a conflict: passed on untouched, for the screen's own handling.
      expect(toHouseholdRefusal(readApiError(new HttpErrorResponse({ status: 403 })))).toBeNull();
    });
  });

  describe('families and the relationships between people (casework phase 1c)', () => {
    let families: HttpFamilyRepository;
    const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
    const SAN_JUAN_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04';
    const BARANGAYS = {
      data: [
        { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
        { id: SAN_JUAN_API, code: 'san-juan', name: 'San Juan' },
      ],
      meta: {},
    };
    const familyId = asId<FamilyId>(OFFICE_FAMILY.data.family.id);
    const MARIA = asId<ResidentId>(OFFICE_FAMILY.data.members[0]?.resident.id ?? '');
    const J = asId<ResidentId>(OFFICE_FAMILY.data.members[1]?.resident.id ?? '');
    const PEDRO = asId<ResidentId>(OFFICE_FAMILY.data.members[2]?.resident.id ?? '');
    const UNNAMED = 'A staff account with no name on record';

    const barangays = (): void => {
      http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
    };

    beforeEach(() => {
      families = TestBed.inject(HttpFamilyRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads a cursor page as the server redacted it, a family between addresses included', async () => {
      const page = firstValueFrom(families.list({}, { limit: 20, cursor: null }));
      barangays();
      const request = http.expectOne((r) => r.url === `${BASE}/office/families`);
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(OFFICE_FAMILIES_PAGE);

      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.nextCursor).toBe(OFFICE_FAMILIES_PAGE.meta.pagination.next_cursor);
      const [housed, unhoused] = answer.items;
      expect(housed?.family.name).toBe('Dela Cruz family');
      expect(housed?.headName).toBe('Dela Cruz, Maria Santos');
      expect(housed?.householdReference).toBe('HH-2026-000014');
      expect(housed?.barangayId).toBe('brgy-dolores');
      expect(housed?.memberCount).toBe(2);
      expect(housed?.relationshipCount).toBe(1);
      // Every period kept, the closed one too (DL-48).
      expect(housed?.family.members.map((member) => member.leftOn)).toEqual([
        null,
        null,
        '2026-11-06',
      ]);
      // Between addresses is an answer, not a gap (DL-47).
      expect(unhoused?.family.householdId).toBeNull();
      expect(unhoused?.householdReference).toBeNull();
      expect(unhoused?.barangayId).toBeNull();
      expect(unhoused?.headName).toBe('Santos, Rosa');
    });

    it('sends the filter as the API names it, and asks nothing for one character', async () => {
      const page = firstValueFrom(
        families.list(
          {
            search: '  cruz ',
            barangayId: asId<BarangayId>('brgy-san-juan'),
            householdId: asId<HouseholdId>('3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e01'),
            unhousedOnly: true,
            includeDissolved: true,
          },
          { limit: 20, cursor: 'abc' },
        ),
      );
      barangays();
      const request = http.expectOne((r) => r.url === `${BASE}/office/families`);
      const params = request.request.params;
      expect(params.keys().sort()).toEqual(
        ['barangay_id', 'cursor', 'household_id', 'include_dissolved', 'limit', 'q', 'unhoused'].sort(),
      );
      expect(params.get('q')).toBe('cruz');
      expect(params.get('barangay_id')).toBe(SAN_JUAN_API);
      expect(params.get('unhoused')).toBe('true');
      expect(params.get('include_dissolved')).toBe('true');
      request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      expect((await page).items).toEqual([]);

      await expect(
        firstValueFrom(families.list({ search: 'c' }, { limit: 20, cursor: null })),
      ).rejects.toThrow(/two characters/);
    });

    it('draws the graph the mock draws: generations from the head, edges from each side', async () => {
      const found = firstValueFrom(families.getById(familyId));
      barangays();
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/families/${familyId}` })
        .flush(OFFICE_FAMILY);
      const detail = await found;

      const node = (id: ResidentId) =>
        detail?.graph.nodes.find((candidate) => candidate.view.resident.id === id);
      expect(node(MARIA)?.role).toBe('head');
      expect(node(MARIA)?.generation).toBe(0);
      expect(node(J)?.generation).toBe(1);
      expect(node(J)?.edges.map((edge) => [edge.kind, edge.otherName])).toEqual([
        ['child-of', 'Dela Cruz, Maria Santos'],
      ]);
      // A former member stays on the record, marked as former, with the link that ended.
      expect(node(PEDRO)?.isCurrentMember).toBe(false);
      expect(node(PEDRO)?.role).toBeNull();
      expect(node(PEDRO)?.edges.map((edge) => [edge.kind, edge.isCurrent])).toEqual([
        ['spouse-of', false],
      ]);
      expect(detail?.graph.edges).toHaveLength(2);
      // Topmost generation first, as the mock orders them.
      expect(detail?.graph.nodes.map((candidate) => candidate.generation)).toEqual([0, 0, 1]);

      expect(detail?.othersInHousehold.map((other) => other.family.name)).toEqual(['Reyes family']);
      expect(detail?.audit).toEqual([]);
    });

    it('says what the server withheld beside a protected member, never a blank', async () => {
      const found = firstValueFrom(families.getById(familyId));
      barangays();
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/families/${familyId}` })
        .flush(OFFICE_FAMILY);
      const detail = await found;
      const nodes = detail?.graph.nodes ?? [];

      const child = nodes.find((candidate) => candidate.view.resident.id === J);
      expect(child?.view.isProtected).toBe(true);
      expect(child?.view.listedName).toBe('Dela Cruz, J.');
      // Her mother and the man who left are not protected; their streets are hers, so withheld.
      for (const id of [MARIA, PEDRO]) {
        const member = nodes.find((candidate) => candidate.view.resident.id === id);
        expect(member?.view.isProtected).toBe(false);
        expect(member?.view.resident.address.streetAddress).toBeNull();
        expect(member?.view.withheld).toContain('exactAddress');
      }
    });

    it('reads the history newest first, in the person’s words, naming an unnamed author', async () => {
      const found = firstValueFrom(families.getById(familyId));
      barangays();
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/families/${familyId}` })
        .flush(OFFICE_FAMILY);
      const history = (await found)?.history ?? [];

      expect(history.map((event) => event.kind)).toEqual([
        'member-role-changed',
        'resident-transferred',
        'member-joined',
        'member-joined',
        'member-joined',
        'family-formed',
      ]);
      const left = history[1];
      expect(left?.subject.residentId).toBe(PEDRO);
      expect(left?.subject.familyId).toBe(familyId);
      expect(left?.subject.toFamilyId).toBeNull();
      expect(left?.reason).toBe('Home visit 6 November: he has moved out.');
      expect(left?.actorName).toBe(UNNAMED);
      expect(history[0]?.actorName).toBe('Ana Reyes');
    });

    it('refuses a record it cannot read whole, and reads a 404 as nobody it may see', async () => {
      const broken = firstValueFrom(families.getById(familyId));
      barangays();
      http.expectOne({ method: 'GET', url: `${BASE}/office/families/${familyId}` }).flush({
        ...OFFICE_FAMILY,
        data: {
          ...OFFICE_FAMILY.data,
          history: [{ ...OFFICE_FAMILY.data.history[0], kind: 'family-renamed' }],
        },
      });
      await expect(broken).rejects.toThrow(/could not be read/);

      const missing = firstValueFrom(families.getById(asId<FamilyId>('nowhere')));
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/families/nowhere` })
        .flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
      expect(await missing).toBeNull();
    });

    it('records a family with the strict body the API reads, and asks nothing for an invalid one', async () => {
      const draft: FamilyDraft = {
        name: '  Dela Cruz family ',
        householdId: asId<HouseholdId>('3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e01'),
        formedOn: asIsoDate('2026-11-06'),
        members: [
          { residentId: MARIA, role: 'head' },
          { residentId: J, role: 'child' },
        ],
      };
      const created = firstValueFrom(families.create(draft, '  Recorded at intake. '));
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${BASE}/office/families` });
      expect(request.request.body).toEqual({
        name: 'Dela Cruz family',
        household_id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e01',
        formed_on: '2026-11-06',
        members: [
          { resident_id: MARIA, role: 'head' },
          { resident_id: J, role: 'child' },
        ],
        reason: 'Recorded at intake.',
      });
      request.flush(OFFICE_FAMILY, { status: 201, statusText: 'Created' });
      expect((await created).family.id).toBe(familyId);

      const refused: unknown = await firstValueFrom(
        families.create({ ...draft, members: [] }, ' '),
      ).catch((error: unknown) => error);
      expect(isFamilyDraftInvalid(refused)).toBe(true);
    });

    it('reads a person’s families and their history whole, at the resident', async () => {
      const listed = firstValueFrom(families.familiesOf(MARIA));
      barangays();
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/residents/${MARIA}/families` })
        .flush(OFFICE_RESIDENT_FAMILIES);
      expect((await listed).map((summary) => summary.family.id)).toEqual([familyId]);

      const history = firstValueFrom(families.historyForResident(MARIA));
      http
        .expectOne({
          method: 'GET',
          url: `${BASE}/office/residents/${MARIA}/relationship-history`,
        })
        .flush(OFFICE_RELATIONSHIP_HISTORY);
      const events = await history;
      expect(events.map((event) => event.kind)).toEqual([
        'member-role-changed',
        'relationship-ended',
        'relationship-recorded',
        'member-joined',
      ]);
      expect(events[1]?.subject.relationshipKind).toBe('spouse-of');
      expect(events[1]?.subject.otherResidentId).toBe(MARIA);
      expect(events[2]?.actorName).toBe(UNNAMED);
    });

    it('records a relationship at its subject, a standing one included, and ends it with a reason', async () => {
      const recorded = firstValueFrom(
        families.recordRelationship(MARIA, J, 'parent-of', ' Birth certificate. '),
      );
      const request = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/residents/${MARIA}/relationships`,
      });
      expect(request.request.body).toEqual({
        to_resident_id: J,
        kind: 'parent-of',
        reason: 'Birth certificate.',
      });
      request.flush(OFFICE_RELATIONSHIP, { status: 201, statusText: 'Created' });
      expect((await recorded).kind).toBe('parent-of');

      // Already on file is already done: 200 with the standing one is the same success (DL-51).
      const again = firstValueFrom(
        families.recordRelationship(MARIA, J, 'parent-of', 'Birth certificate.'),
      );
      http
        .expectOne({ method: 'POST', url: `${BASE}/office/residents/${MARIA}/relationships` })
        .flush(OFFICE_RELATIONSHIP, { status: 200, statusText: 'OK' });
      expect((await again).id).toBe(OFFICE_RELATIONSHIP.data.id);

      const relationshipId = asId<RelationshipId>(OFFICE_RELATIONSHIP.data.id);
      const ended = firstValueFrom(families.endRelationship(J, relationshipId, ' Adopted out. '));
      const end = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/residents/${J}/relationships/${relationshipId}/end`,
      });
      expect(end.request.body).toEqual({ reason: 'Adopted out.' });
      end.flush({ data: { ...OFFICE_RELATIONSHIP.data, until: '2026-11-06' }, meta: {} });
      expect((await ended).until).toBe('2026-11-06');

      const self: unknown = await firstValueFrom(
        families.recordRelationship(MARIA, MARIA, 'sibling-of', 'A reason.'),
      ).catch((error: unknown) => error);
      expect(isRelationshipInvalid(self)).toBe(true);
    });

    it('moves a person in one request, and changes a role answering the family itself', async () => {
      const moved = firstValueFrom(
        families.transferResident({
          residentId: PEDRO,
          fromFamilyId: familyId,
          toFamilyId: null,
          role: 'partner',
          moveHousehold: false,
          reason: ' Home visit 6 November: he has moved out. ',
        }),
      );
      barangays();
      const transfer = http.expectOne({ method: 'POST', url: `${BASE}/office/families/transfers` });
      expect(transfer.request.body).toEqual({
        resident_id: PEDRO,
        from_family_id: familyId,
        to_family_id: null,
        role: 'partner',
        move_household: false,
        reason: 'Home visit 6 November: he has moved out.',
      });
      transfer.flush(OFFICE_FAMILY);
      expect((await moved).family.id).toBe(familyId);

      const role = firstValueFrom(families.changeMemberRole(familyId, MARIA, 'head', 'She heads it.'));
      const change = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/families/${familyId}/members/${MARIA}/role`,
      });
      expect(change.request.body).toEqual({ role: 'head', reason: 'She heads it.' });
      change.flush(OFFICE_FAMILY);
      expect((await role).id).toBe(familyId);

      const unexplained: unknown = await firstValueFrom(
        families.transferResident({
          residentId: PEDRO,
          fromFamilyId: familyId,
          toFamilyId: null,
          role: 'partner',
          moveHousehold: false,
          reason: 'left',
        }),
      ).catch((error: unknown) => error);
      expect(isTransferRefused(unexplained)).toBe(true);
    });

    it('reads a refusal as the domain’s problems, and anything else in the server’s words', () => {
      const failure = (body: unknown) =>
        readApiError(new HttpErrorResponse({ error: body, status: 409, statusText: 'Conflict' }));

      const orphan = toFamilyRefusal(failure(OFFICE_FAMILY_CONFLICT), 'transfer');
      expect(isTransferRefused(orphan)).toBe(true);
      if (isTransferRefused(orphan)) {
        expect(orphan.problems).toEqual([{ code: 'would-orphan-head', residentId: MARIA }]);
      }

      const conflict = (details: Record<string, string[]>, message: string) =>
        failure({ error: { ...OFFICE_FAMILY_CONFLICT.error, message, details } });

      // Asked to take the household along, and the person heads it: a household rule, refused in
      // the server's words rather than re-worded into a transfer problem it is not.
      const heads = toFamilyRefusal(
        conflict(
          { 'head-cannot-be-removed': [MARIA] },
          'This person heads their household. Name another head there before moving them out of it.',
        ),
        'transfer',
      );
      expect(isTransferRefused(heads)).toBe(false);
      expect(heads?.message).toContain('heads their household');

      const reversed = toFamilyRefusal(
        conflict({ 'contradicts-existing': [J] }, 'That relationship reverses a parent link.'),
        'relationship',
      );
      expect(isRelationshipInvalid(reversed)).toBe(true);

      const twice = toFamilyRefusal(
        conflict({ 'duplicate-member': [J], 'resident-not-found': [] }, 'Not as stated.'),
        'family',
      );
      expect(isFamilyDraftInvalid(twice)).toBe(true);
      if (isFamilyDraftInvalid(twice)) {
        expect(twice.problems).toEqual([
          { code: 'duplicate-member', residentId: J },
          { code: 'resident-not-found', residentId: null },
        ]);
      }

      const ended = toFamilyRefusal(
        failure({
          error: {
            code: 'CONFLICT',
            message: 'That relationship has already ended.',
            details: {},
            request_id: 'req-3',
          },
        }),
        'relationship',
      );
      expect(ended?.message).toBe('That relationship has already ended.');

      // Not a conflict: passed on untouched, for the screen's own handling.
      expect(toFamilyRefusal(readApiError(new HttpErrorResponse({ status: 403 })), 'transfer')).toBeNull();
    });
  });

  describe('a resident’s profile, over the two registers (casework phase 1c)', () => {
    let residents: HttpResidentRepository;
    const BARANGAYS = {
      data: [{ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01', code: 'dolores', name: 'Dolores' }],
      meta: {},
    };
    const HEAD = asId<ResidentId>(OFFICE_HOUSEHOLD.data.members[0]?.resident.id ?? '');
    const CHILD = OFFICE_HOUSEHOLD.data.members[1]?.resident.id ?? '';
    const householdId = OFFICE_HOUSEHOLD.data.household.id;
    const HEAD_RECORD = {
      data: OFFICE_HOUSEHOLD.data.members[0]?.resident,
      meta: {},
    };

    beforeEach(() => {
      residents = TestBed.inject(HttpResidentRepository);
      tokens.hold('fixture-token', null);
    });

    it('finds the household the resident is in, and everyone else in it', async () => {
      const profile = firstValueFrom(residents.getProfile(HEAD));
      http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
      http.expectOne({ method: 'GET', url: `${BASE}/office/residents/${HEAD}` }).flush(HEAD_RECORD);
      const lookup = http.expectOne((r) => r.url === `${BASE}/office/households`);
      expect(lookup.request.params.get('resident_id')).toBe(HEAD);
      expect(lookup.request.params.get('limit')).toBe('1');
      lookup.flush({
        ...OFFICE_HOUSEHOLDS_PAGE,
        data: OFFICE_HOUSEHOLDS_PAGE.data.slice(0, 1),
        meta: { pagination: { has_more: false, next_cursor: null } },
      });
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/households/${householdId}` })
        .flush(OFFICE_HOUSEHOLD);
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/residents/${HEAD}/assistance-history` })
        .flush({ data: { readable: false, because: ASSISTANCE_HISTORY_NOT_YOURS }, meta: {} });

      const answer = await profile;
      expect(answer?.household?.id).toBe(householdId);
      expect(answer?.view.resident.householdId).toBe(householdId);
      expect(answer?.householdMembers.kind).toBe('read');
      if (answer?.householdMembers.kind === 'read') {
        expect(answer.householdMembers.members.map((member) => member.view.resident.id)).toEqual([
          CHILD,
        ]);
      }
      // Never an empty history: a reader not shown it is told so, and empty would say "never helped".
      expect(answer?.history).toEqual({
        kind: 'unavailable',
        because: ASSISTANCE_HISTORY_NOT_YOURS,
      });
    });

    it('says the resident is in no household when the register places them in none', async () => {
      const profile = firstValueFrom(residents.getProfile(HEAD));
      http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
      http.expectOne({ method: 'GET', url: `${BASE}/office/residents/${HEAD}` }).flush(HEAD_RECORD);
      http
        .expectOne((r) => r.url === `${BASE}/office/households`)
        .flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/residents/${HEAD}/assistance-history` })
        .flush({ data: { readable: false, because: ASSISTANCE_HISTORY_NOT_YOURS }, meta: {} });

      const answer = await profile;
      expect(answer?.household).toBeNull();
      expect(answer?.householdMembers).toEqual({ kind: 'read', members: [] });
    });

    it('answers a resident it may not see as nobody, and asks nothing more', async () => {
      const profile = firstValueFrom(residents.getProfile(asId<ResidentId>('nobody')));
      http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
      http
        .expectOne({ method: 'GET', url: `${BASE}/office/residents/nobody` })
        .flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
      expect(await profile).toBeNull();
    });
  });

  describe('programmes (casework phase 1d, DL-176)', () => {
    let programs: HttpProgramRepository;

    beforeEach(() => {
      programs = TestBed.inject(HttpProgramRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads a cursor page by name, with the filters the API declares', async () => {
      const page = firstValueFrom(
        programs.list(
          { search: ' medical ', category: 'crisis-intervention', status: 'active' },
          { limit: 20, cursor: null },
        ),
      );
      const request = http.expectOne((r) => r.url === `${BASE}/office/programs`);
      expect(request.request.params.get('q')).toBe('medical');
      expect(request.request.params.get('category')).toBe('crisis-intervention');
      expect(request.request.params.get('status')).toBe('active');
      request.flush(OFFICE_PROGRAMS_PAGE);

      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.nextCursor).toBe(OFFICE_PROGRAMS_PAGE.meta.pagination.next_cursor);
      const [aics, senior] = answer.items;
      // Whose programme it is, read from the record and never defaulted (DL-65).
      expect(aics?.responsibility).toEqual({
        administeredBy: 'dswd',
        fundsHeldBy: 'dswd',
        lguRole: 'referrer',
        statement: OFFICE_PROGRAMS_PAGE.data[0]?.responsibility.statement,
        sources: [
          {
            title: 'DSWD — AICS is a DSWD service',
            url: 'https://aics.dswd.gov.ph/aics-program/',
            verifiedOn: null,
          },
        ],
      });
      expect(aics?.maximumGrant).toBeNull();
      expect(aics?.guidance.map((guideline) => guideline.weight)).toEqual(['expected', 'usual']);
      expect(senior?.maximumGrant).toEqual({ centavos: 100000, currency: 'PHP' });
      expect(senior?.eligibility.requiredSectors).toEqual(['senior-citizen']);
      expect(senior?.reviewWindow?.provenance).toBe('convention-pending-confirmation');
    });

    it('asks nothing for a one-letter search the API would refuse', async () => {
      await expect(
        firstValueFrom(programs.list({ search: 'm' }, { limit: 20, cursor: null })),
      ).rejects.toThrow(/at least two letters/);
      http.expectNone(`${BASE}/office/programs`);
    });

    it('refuses a programme whose responsibility it cannot read, rather than default it', async () => {
      const page = firstValueFrom(programs.list({}, { limit: 20, cursor: null }));
      const [first] = OFFICE_PROGRAMS_PAGE.data;
      http.expectOne((r) => r.url === `${BASE}/office/programs`).flush({
        ...OFFICE_PROGRAMS_PAGE,
        data: [{ ...first, responsibility: { ...first?.responsibility, lgu_role: 'decider' } }],
      });
      await expect(page).rejects.toThrow(/could not be read/);
    });

    it('reads one programme, and an absent one as absent', async () => {
      const id = OFFICE_PROGRAM.data.id;
      const one = firstValueFrom(programs.getById(asId<ProgramId>(id)));
      http.expectOne(`${BASE}/office/programs/${id}`).flush(OFFICE_PROGRAM);
      expect((await one)?.code).toBe('PRG-0001');

      const missing = firstValueFrom(programs.getById(asId<ProgramId>(id)));
      http
        .expectOne(`${BASE}/office/programs/${id}`)
        .flush(null, { status: 404, statusText: 'Not Found' });
      expect(await missing).toBeNull();
    });

    it('reads the active programmes in full for a picker', async () => {
      const active = firstValueFrom(programs.listActive());
      const request = http.expectOne((r) => r.url === `${BASE}/office/programs`);
      expect(request.request.params.get('status')).toBe('active');
      request.flush({
        ...OFFICE_PROGRAMS_PAGE,
        meta: { pagination: { has_more: false, next_cursor: null } },
      });
      expect((await active).map((program) => program.code)).toEqual(['PRG-0001', 'PRG-0002']);
    });

    it('reads a programme’s document set under it, a conditional one with its circumstances', async () => {
      const id = OFFICE_PROGRAM.data.id;
      const templates = firstValueFrom(programs.listRequirementTemplates(asId<ProgramId>(id)));
      http
        .expectOne(`${BASE}/office/programs/${id}/requirement-templates`)
        .flush(OFFICE_PROGRAM_TEMPLATES);
      const [template] = await templates;
      expect(template?.code).toBe('aics-standard-sample');
      expect(
        template?.requirements.find((entry) => entry.obligation === 'conditional')?.appliesWhen,
      ).toBe('When somebody other than the applicant files the request on their behalf.');
    });

    it('saves the whole draft in the API’s words, creating with POST and changing with PATCH', async () => {
      const program = toAssistanceProgram(OFFICE_PROGRAM.data);
      if (program === null) {
        throw new Error('The programme fixture could not be read.');
      }
      const draft = { ...toProgramDraft(program), legalBasis: '  ' };
      const unsent = [
        'id',
        'code',
        'effective_from',
        'effective_to',
        'created_at',
        'created_by',
        'updated_at',
        'updated_by',
      ];

      const changed = firstValueFrom(
        programs.save(draft, program.id, '  The ceiling was raised by ordinance.  '),
      );
      const patch = http.expectOne({
        method: 'PATCH',
        url: `${BASE}/office/programs/${program.id}`,
      });
      expect(patch.request.body).toEqual({
        ...Object.fromEntries(
          Object.entries(OFFICE_PROGRAM.data).filter(([key]) => !unsent.includes(key)),
        ),
        legal_basis: null,
        // Kept beside the version it explains (DL-177).
        reason: 'The ceiling was raised by ordinance.',
      });
      patch.flush(OFFICE_PROGRAM);
      expect((await changed).id).toBe(program.id);

      const created = firstValueFrom(programs.save(draft, null, 'Recorded from the 2026 budget.'));
      const post = http.expectOne({ method: 'POST', url: `${BASE}/office/programs` });
      expect(post.request.body.reason).toBe('Recorded from the 2026 budget.');
      post.flush(OFFICE_PROGRAM, { status: 201, statusText: 'Created' });
      expect((await created).code).toBe('PRG-0001');
    });

    it('passes the server’s refusal of a misdescribed programme on', async () => {
      const program = toAssistanceProgram(OFFICE_PROGRAM.data);
      if (program === null) {
        throw new Error('The programme fixture could not be read.');
      }
      const saved = firstValueFrom(
        programs.save(toProgramDraft(program), program.id, 'Recorded as ours.'),
      );
      http
        .expectOne({ method: 'PATCH', url: `${BASE}/office/programs/${program.id}` })
        .flush(OFFICE_PROGRAM_REFUSAL, { status: 422, statusText: 'Unprocessable Entity' });
      await expect(saved).rejects.toBeTruthy();
    });

    it('reads every requirement template whole, a retired one with when and what it still reaches', async () => {
      const listed = firstValueFrom(programs.listTemplates());
      const request = http.expectOne(`${BASE}/office/requirement-templates`);
      expect(request.request.params.keys()).toEqual([]);
      request.flush(OFFICE_REQUIREMENT_TEMPLATES);

      const [active, retired] = await listed;
      expect(active?.status).toBe('active');
      expect(active?.programCount).toBe(3);
      expect(active?.audit.createdBy).toBeNull();
      expect(retired?.status).toBe('retired');
      expect(retired?.retiredAt).toBe('2026-11-05T08:30:00.000Z');
      expect(retired?.programCount).toBe(1);
    });

    it('refuses a template whose count or status it cannot read, rather than default either', async () => {
      const [first] = OFFICE_REQUIREMENT_TEMPLATES.data;
      // A zero would say a change reaches nobody; an assumed "active" would offer a retired one.
      for (const broken of [
        { ...first, program_count: null },
        { ...first, status: 'archived' },
      ]) {
        const listed = firstValueFrom(programs.listTemplates());
        http
          .expectOne(`${BASE}/office/requirement-templates`)
          .flush({ ...OFFICE_REQUIREMENT_TEMPLATES, data: [broken] });
        await expect(listed).rejects.toThrow(/could not be read/);
      }
    });

    it('records a template with its code and reason, and changes one with its documents whole', async () => {
      const draft = {
        code: ' aics-standard-sample ',
        name: 'AICS standard documents (sample)',
        description: '',
        requirements: [
          {
            code: 'authorization-letter',
            label: 'Authorization letter',
            obligation: 'conditional' as const,
            appliesWhen: 'When somebody else files on the applicant’s behalf.',
            notes: '  ',
          },
        ],
      };

      const created = firstValueFrom(programs.saveTemplate(draft, null, 'A shared set for AICS.'));
      const post = http.expectOne({ method: 'POST', url: `${BASE}/office/requirement-templates` });
      expect(post.request.body).toEqual({
        code: 'aics-standard-sample',
        name: 'AICS standard documents (sample)',
        description: '',
        requirements: [
          {
            code: 'authorization-letter',
            label: 'Authorization letter',
            obligation: 'conditional',
            applies_when: 'When somebody else files on the applicant’s behalf.',
            notes: null,
          },
        ],
        reason: 'A shared set for AICS.',
      });
      post.flush(OFFICE_REQUIREMENT_TEMPLATE, { status: 201, statusText: 'Created' });
      expect((await created).programCount).toBe(3);

      const changed = firstValueFrom(
        programs.saveTemplate(draft, 'aics-standard-sample', 'The letter is asked for in words.'),
      );
      const patch = http.expectOne({
        method: 'PATCH',
        url: `${BASE}/office/requirement-templates/aics-standard-sample`,
      });
      // No code on a change: it never changes. The documents whole: the server replaces them whole.
      expect(Object.keys(patch.request.body)).toEqual([
        'name',
        'description',
        'requirements',
        'reason',
      ]);
      patch.flush(OFFICE_REQUIREMENT_TEMPLATE);
      expect((await changed).code).toBe('aics-standard-sample');
    });

    it('retires a template with a reason, and passes a refusal on in the server’s words', async () => {
      const retired = firstValueFrom(
        programs.retireTemplate('aics-standard-sample', 'Superseded by the 2026 set.'),
      );
      const retire = http.expectOne({
        method: 'POST',
        url: `${BASE}/office/requirement-templates/aics-standard-sample/retire`,
      });
      expect(retire.request.body).toEqual({ reason: 'Superseded by the 2026 set.' });
      retire.flush({
        ...OFFICE_REQUIREMENT_TEMPLATE,
        data: {
          ...OFFICE_REQUIREMENT_TEMPLATE.data,
          status: 'retired',
          retired_at: '2026-11-06T04:00:00.000Z',
        },
      });
      expect((await retired).status).toBe('retired');

      const refused = firstValueFrom(
        programs.saveTemplate(
          { code: 'x-set', name: 'A set', description: '', requirements: [] },
          null,
          'Trying.',
        ),
      ).catch((failure: unknown) => failure);
      http
        .expectOne({ method: 'POST', url: `${BASE}/office/requirement-templates` })
        .flush(OFFICE_REQUIREMENT_TEMPLATE_REFUSAL, {
          status: 422,
          statusText: 'Unprocessable Entity',
        });
      const failure = await refused;
      expect(failure).toBeInstanceOf(HttpErrorResponse);
      if (failure instanceof HttpErrorResponse) {
        expect(readApiError(failure).details?.['condition-without-circumstances']).toEqual([
          'A conditional document must state, in words, when it is needed.',
        ]);
      }
    });

    it('refuses utilization it cannot read whole, rather than showing part of it', async () => {
      const all = firstValueFrom(programs.utilizationSummary());
      http
        .expectOne(`${BASE}/office/program-utilization`)
        .flush({ data: { readable: true, rows: [{ program_id: 'x', withheld: false }] }, meta: {} });
      await expect(all).rejects.toThrow(/a programme missing from the figures/);
    });
  });

  describe('saved views (casework phase 1c, DL-111)', () => {
    let views: HttpSavedViewRepository;

    beforeEach(() => {
      views = TestBed.inject(HttpSavedViewRepository);
      tokens.hold('fixture-token', null);
    });

    it('reads one list’s views whole, saying whose each is', async () => {
      const listed = firstValueFrom(views.listFor('residents'));
      const request = http.expectOne((r) => r.url === `${BASE}/office/saved-views`);
      expect(request.request.params.get('resource')).toBe('residents');
      expect(request.request.params.keys()).toEqual(['resource']);
      request.flush(SAVED_VIEWS);

      const [shared, own] = await listed;
      expect(shared?.isShared).toBe(true);
      expect(shared?.params).toEqual({ barangay: 'brgy-dolores', ageGroup: 'senior' });
      expect(own?.isShared).toBe(false);
      expect(own?.ownerId).toBe(SAVED_VIEWS.data[1]?.owner_id);
      expect(own?.audit.createdAt).toBe(SAVED_VIEWS.data[1]?.created_at);
    });

    it('refuses the list rather than guess whose a view is', async () => {
      const listed = firstValueFrom(views.listFor('residents'));
      http
        .expectOne((r) => r.url === `${BASE}/office/saved-views`)
        .flush({ ...SAVED_VIEWS, data: [{ ...SAVED_VIEWS.data[0], is_shared: 'yes' }] });
      await expect(listed).rejects.toThrow(/could not be read/);
    });

    it('saves with the body the API reads, and asks nothing for a name it would refuse', async () => {
      const saved = firstValueFrom(
        views.create({
          resource: 'households',
          name: '  Indigent, elevated or above ',
          params: { indigent: 'true', band: 'elevated' },
          isShared: false,
        }),
      );
      const request = http.expectOne({ method: 'POST', url: `${BASE}/office/saved-views` });
      expect(request.request.body).toEqual({
        resource: 'households',
        name: 'Indigent, elevated or above',
        params: { indigent: 'true', band: 'elevated' },
        is_shared: false,
      });
      request.flush(SAVED_VIEW, { status: 201, statusText: 'Created' });
      expect((await saved).resource).toBe('households');

      await expect(
        firstValueFrom(
          views.create({ resource: 'households', name: '   ', params: {}, isShared: false }),
        ),
      ).rejects.toThrow(/name of 1 to 60/);
    });

    it('takes a view away at its address', async () => {
      const id = asId<SavedViewId>(SAVED_VIEW.data.id);
      const removed = firstValueFrom(views.remove(id));
      http
        .expectOne({ method: 'DELETE', url: `${BASE}/office/saved-views/${id}` })
        .flush({ data: { id, deleted: true }, meta: {} });
      await expect(removed).resolves.toBeUndefined();
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
          kind: 'police',
          sortOrder: 2,
          active: true,
        }),
      );
      const post = http.expectOne({ method: 'POST', url: `${BASE}/admin/hotlines` });
      expect(post.request.body).toEqual({
        name: 'Police station',
        number: '(02) 8000 0112',
        category: 'Emergency',
        kind: 'police',
        sort_order: 2,
        active: true,
      });
      post.flush(HOTLINE, { status: 201, statusText: 'Created' });
      expect((await created).id).toBe(hotlineId);
      expect((await created).kind).toBe('police');

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

  describe('a hotline’s kind (DL-217)', () => {
    const hotlineId = asId<HotlineId>(HOTLINE.data.id);

    beforeEach(() => tokens.hold('fixture-token', null));

    it('reads each line’s kind, and refuses a line whose kind it does not know', async () => {
      const hotlines = TestBed.inject(HttpHotlineRepository);
      const listing = firstValueFrom(hotlines.list());
      http.expectOne(`${BASE}/admin/hotlines`).flush(HOTLINES);
      expect((await listing).hotlines.map((line) => line.kind)).toEqual(['disaster', 'medical']);

      const [line] = HOTLINES.data;
      const unknown = firstValueFrom(hotlines.list()).catch((failure: unknown) => failure);
      http.expectOne(`${BASE}/admin/hotlines`).flush({
        ...HOTLINES,
        data: [{ ...line, kind: 'ambulance' }],
      });
      expect(await unknown).toBeInstanceOf(Error);
    });

    it('sends a change of kind, and hands a second command center back as the domain’s refusal', async () => {
      const hotlines = TestBed.inject(HttpHotlineRepository);
      const changed = firstValueFrom(
        hotlines.update(hotlineId, { kind: 'command-center' }),
      ).catch((failure: unknown) => failure);
      const patch = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/hotlines/${hotlineId}` });
      expect(JSON.parse(JSON.stringify(patch.request.body))).toEqual({ kind: 'command-center' });
      patch.flush(
        {
          error: {
            code: 'CONFLICT',
            message: 'An active command-center hotline already exists.',
            request_id: 'fixture-request',
          },
        },
        { status: 409, statusText: 'Conflict' },
      );

      const refusal = await changed;
      expect(isCommandCenterTaken(refusal)).toBe(true);
      expect(refusal instanceof Error ? refusal.message : null).toBe(
        'An active command-center hotline already exists.',
      );
    });

    it('passes any other refusal on as it came', async () => {
      const hotlines = TestBed.inject(HttpHotlineRepository);
      const changed = firstValueFrom(hotlines.update(hotlineId, { name: '' })).catch(
        (failure: unknown) => failure,
      );
      http.expectOne(`${BASE}/admin/hotlines/${hotlineId}`).flush(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The request could not be validated.',
            request_id: 'fixture-request',
          },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      expect(isCommandCenterTaken(await changed)).toBe(false);
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

    it('reads the review time and sends it whole under its own key (DL-205)', async () => {
      const settings = TestBed.inject(HttpAppConfigRepository);
      const changed = firstValueFrom(
        settings.change({ verificationReviewWorkingDays: { min: 1, max: 1 } }),
      );
      const patch = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/app/config` });
      expect(JSON.parse(JSON.stringify(patch.request.body))).toEqual({
        verification_review_working_days: { min: 1, max: 1 },
      });
      patch.flush(APP_CONFIG);

      expect((await changed).verificationReviewWorkingDays).toEqual({ min: 2, max: 5 });
    });

    it('reads the biometric consent, and publishes it with its version (DL-216)', async () => {
      const settings = TestBed.inject(HttpAppConfigRepository);
      const changed = firstValueFrom(
        settings.change({
          biometricConsent: { version: '2026-11', bodyMarkdown: 'The consent the LGU approved.' },
        }),
      );
      const patch = http.expectOne({ method: 'PATCH', url: `${BASE}/admin/app/config` });
      expect(JSON.parse(JSON.stringify(patch.request.body))).toEqual({
        biometric_consent: { version: '2026-11', body_markdown: 'The consent the LGU approved.' },
      });
      patch.flush(APP_CONFIG);

      expect((await changed).biometricConsent?.version).toBe('placeholder');
    });

    it('hands the server’s refusal of a review time on by the input it is about (DL-205)', async () => {
      const settings = TestBed.inject(HttpAppConfigRepository);
      const changed = firstValueFrom(
        settings.change({ verificationReviewWorkingDays: { min: 5, max: 2 } }),
      ).catch((failure: unknown) => failure);
      http.expectOne({ method: 'PATCH', url: `${BASE}/admin/app/config` }).flush(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The request could not be validated.',
            details: {
              'verification_review_working_days.max': [
                'The fewest working days cannot be more than the most.',
              ],
            },
            request_id: 'fixture-request',
          },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      const refusal = await changed;
      expect(isAppConfigRefusal(refusal)).toBe(true);
      if (isAppConfigRefusal(refusal)) {
        expect(refusal.message).toBe('The request could not be validated.');
        expect(refusal.reviewTime).toEqual([
          { field: 'max', message: 'The fewest working days cannot be more than the most.' },
        ]);
      }
    });

    it('passes any other refusal on as it came', async () => {
      const settings = TestBed.inject(HttpAppConfigRepository);
      const changed = firstValueFrom(settings.change({ supportEmail: 'not-an-address' })).catch(
        (failure: unknown) => failure,
      );
      http.expectOne({ method: 'PATCH', url: `${BASE}/admin/app/config` }).flush(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The request could not be validated.',
            details: { support_email: ['Invalid email'] },
          },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

      const refusal = await changed;
      expect(isAppConfigRefusal(refusal)).toBe(false);
      expect(refusal).toBeInstanceOf(HttpErrorResponse);
    });
  });

  describe('residents’ digital IDs (DL-171)', () => {
    beforeEach(() => tokens.hold('fixture-token', null));

    it('sends the code in the body, trimmed, and reads only what the API answers', async () => {
      const cards = TestBed.inject(HttpDigitalIdRepository);
      const answer = firstValueFrom(cards.check('  example.qr.payload \n'));
      const sent = http.expectOne({ method: 'POST', url: `${BASE}/digital-id/verify` });
      expect(sent.request.body).toEqual({ token: 'example.qr.payload' });
      sent.flush(DIGITAL_ID_HOLDER);

      expect(await answer).toEqual({
        name: 'Fixture Resident',
        photo: '33333333-3333-4333-8333-333333333333',
        status: 'suspended',
        expired: false,
        barangayName: 'San Juan',
      });
    });

    it('reads an account’s card, and a 404 as no current card', async () => {
      const cards = TestBed.inject(HttpDigitalIdRepository);
      const account = asId<AppAccountId>('0f1e2d3c-4b5a-4968-8776-655443322102');
      const held = firstValueFrom(cards.cardOf(account));
      http
        .expectOne({ method: 'GET', url: `${BASE}/admin/users/${account}/digital-id` })
        .flush(DIGITAL_ID_CARD);
      expect((await held)?.number).toBe('TAY-2026-000123');

      const none = firstValueFrom(cards.cardOf(account));
      http
        .expectOne(`${BASE}/admin/users/${account}/digital-id`)
        .flush(
          { error: { code: 'NOT_FOUND', message: 'That digital ID was not found.' } },
          { status: 404, statusText: 'Not Found' },
        );
      expect(await none).toBeNull();
    });

    it('issues with no photo named, and acts on a card by its own id', async () => {
      const cards = TestBed.inject(HttpDigitalIdRepository);
      const account = asId<AppAccountId>('0f1e2d3c-4b5a-4968-8776-655443322102');
      const card = asId<DigitalIdId>('5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c01');

      const issued = firstValueFrom(cards.issue(account));
      const issue = http.expectOne({
        method: 'POST',
        url: `${BASE}/admin/users/${account}/digital-id`,
      });
      expect(issue.request.body).toEqual({});
      issue.flush(DIGITAL_ID_CARD);
      await issued;

      for (const act of ['suspend', 'revoke', 'reissue'] as const) {
        const done = firstValueFrom(cards[act](card));
        const request = http.expectOne({
          method: 'POST',
          url: `${BASE}/admin/digital-ids/${card}/${act}`,
        });
        expect(request.request.body).toEqual({});
        request.flush(DIGITAL_ID_CARD);
        expect((await done).id).toBe('5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c01');
      }
    });

    it('reads the photo as bytes with the token in a header, never in the address', async () => {
      const cards = TestBed.inject(HttpDigitalIdRepository);
      const photo = firstValueFrom(
        cards.openPhoto(asId<MediaId>('33333333-3333-4333-8333-333333333333')),
      );
      const request = http.expectOne(`${BASE}/media/33333333-3333-4333-8333-333333333333/content`);
      expect(request.request.responseType).toBe('blob');
      expect(request.request.urlWithParams).not.toContain('token');
      request.flush(new Blob(['x']));
      expect(await photo).toBeInstanceOf(Blob);
    });
  });

  describe('Balita (DL-171)', () => {
    beforeEach(() => tokens.hold('fixture-token', null));
    const ARTICLE = asId<BalitaArticleId>('7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c41');

    it('reads the residents’ list a page at a time, and never a cover’s address', async () => {
      const news = TestBed.inject(HttpBalitaRepository);
      const page = firstValueFrom(news.list({ limit: 20, cursor: null }));
      http.expectOne((request) => request.url === `${BASE}/news`).flush(NEWS_PAGE);
      const answer = await page;

      expect(answer.items.map((article) => article.pinned)).toEqual([true, false]);
      expect(answer.items[0]?.hasCover).toBe(true);
      expect(answer.hasMore).toBe(true);
      expect(JSON.stringify(answer)).not.toContain('example.invalid');
    });

    it('reads one by its address, and a 404 as none the reader can open', async () => {
      const news = TestBed.inject(HttpBalitaRepository);
      const one = firstValueFrom(news.get(ARTICLE));
      http.expectOne(`${BASE}/news/${ARTICLE}`).flush(NEWS);
      expect((await one)?.title).toBe('Fixture advisory');

      const none = firstValueFrom(news.get(ARTICLE));
      http
        .expectOne(`${BASE}/news/${ARTICLE}`)
        .flush(
          { error: { code: 'NOT_FOUND', message: 'That article was not found.' } },
          { status: 404, statusText: 'Not Found' },
        );
      expect(await none).toBeNull();
    });

    it('reads the five categories', async () => {
      const news = TestBed.inject(HttpBalitaRepository);
      const categories = firstValueFrom(news.categories());
      http.expectOne(`${BASE}/news/categories`).flush(NEWS_CATEGORIES);
      expect((await categories).map((category) => category.slug)).toEqual([
        'abiso',
        'advisory',
        'negosyo',
        'safety',
        'events',
      ]);
    });

    it('writes as a form, the cover beside the words, and only what changed', async () => {
      const news = TestBed.inject(HttpBalitaRepository);
      const cover = new Blob(['x'], { type: 'image/png' });
      const created = firstValueFrom(
        news.create(
          { title: ' Title ', body: 'Words', category: null, officeId: null, status: 'draft' },
          cover,
        ),
      );
      const post = http.expectOne({ method: 'POST', url: `${BASE}/news` });
      const form = post.request.body as FormData;
      expect(form.get('title')).toBe('Title');
      expect(form.get('status')).toBe('draft');
      expect(form.has('office_id')).toBe(false);
      expect(form.has('category')).toBe(false);
      expect(form.get('cover')).toBeInstanceOf(Blob);
      post.flush(NEWS);
      await created;

      const updated = firstValueFrom(news.update(ARTICLE, { status: 'published' }, null));
      const patch = http.expectOne({ method: 'PATCH', url: `${BASE}/news/${ARTICLE}` });
      const changes = patch.request.body as FormData;
      expect([...changes.keys()]).toEqual(['status']);
      patch.flush(NEWS);
      await updated;
    });

    it('pins and unpins at one address, and reads the cover as bytes', async () => {
      const news = TestBed.inject(HttpBalitaRepository);
      const pinned = firstValueFrom(news.pin(ARTICLE));
      http.expectOne({ method: 'POST', url: `${BASE}/news/${ARTICLE}/pin` }).flush(NEWS);
      await pinned;
      const unpinned = firstValueFrom(news.unpin(ARTICLE));
      http.expectOne({ method: 'DELETE', url: `${BASE}/news/${ARTICLE}/pin` }).flush(NEWS);
      await unpinned;

      const cover = firstValueFrom(news.openCover(ARTICLE));
      const request = http.expectOne(`${BASE}/news/${ARTICLE}/cover`);
      expect(request.request.responseType).toBe('blob');
      request.flush(new Blob(['x']));
      expect(await cover).toBeInstanceOf(Blob);
    });
  });

  describe('the app’s audit trail (DL-171)', () => {
    beforeEach(() => tokens.hold('fixture-token', null));

    it('reads a page newest first, every row whole, and nothing beside a row', async () => {
      const trail = TestBed.inject(HttpPlatformAuditRepository);
      const page = firstValueFrom(trail.list({ limit: 50, cursor: null }));
      const request = http.expectOne((candidate) => candidate.url === `${BASE}/admin/audit`);
      expect(request.request.params.get('limit')).toBe('50');
      request.flush(AUDIT_PAGE);
      const answer = await page;

      expect(answer.items.map((entry) => entry.action)).toEqual([
        'user.role_changed',
        'app.config_updated',
      ]);
      expect(answer.items[1]?.actorId).toBeNull();
      expect(answer.hasMore).toBe(true);
    });

    it('refuses the page rather than showing it with a row missing', async () => {
      const trail = TestBed.inject(HttpPlatformAuditRepository);
      const page = firstValueFrom(trail.list({ limit: 50, cursor: null }));
      http
        .expectOne((candidate) => candidate.url === `${BASE}/admin/audit`)
        .flush({ ...AUDIT_PAGE, data: [{ ...AUDIT_PAGE.data[0], action: '' }] });
      await expect(page).rejects.toThrow('could not be read');
    });
  });
});
