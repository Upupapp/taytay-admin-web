import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import { SignInError, type SignInFailureReason } from '@domain/index';

import { IdentityProvider, identitySignInMethod } from './identity.provider';
import type { IdentityGrant, IdentitySignIn } from './identity.model';
import { SIGN_IN_NOT_CONFIGURED } from './sign-in-messages';

const KEY = 'test-web-api-key';
const SIGN_IN = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const FINALIZE = 'https://identitytoolkit.googleapis.com/v2/accounts/mfaSignIn:finalize';
const REFRESH = 'https://securetoken.googleapis.com/v1/token';
const NOW = new Date('2026-11-05T01:00:00.000Z');
const CREDENTIALS = { email: 'staff.member@example.invalid', password: 'a-password-of-sufficient-length' };

/** An unsigned token with an `exp` claim — enough for the provider to read its lifetime. */
function tokenExpiringAt(seconds: number): string {
  const payload = btoa(JSON.stringify({ exp: seconds })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${payload}.signature`;
}

/** Google's error envelope, as the REST reference documents it. */
function googleError(message: string): { error: { code: number; message: string } } {
  return { error: { code: 400, message } };
}

function setUp(key: string | null): { provider: IdentityProvider; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      // The real header interceptor is installed, so a test can prove it never reaches Google.
      provideHttpClient(withInterceptors([apiHeadersInterceptor])),
      provideHttpClientTesting(),
      {
        provide: APP_ENVIRONMENT,
        useValue: { apiBaseUrl: 'https://api.example.gov.ph/api/v1', dataSource: 'http', firebaseWebApiKey: key },
      },
    ],
  });

  return { provider: TestBed.inject(IdentityProvider), http: TestBed.inject(HttpTestingController) };
}

async function refusedWith(source: Promise<unknown>): Promise<SignInError> {
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

describe('the Firebase identity provider', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  describe('without a key', () => {
    it('says sign-in is not configured, and sends nothing', async () => {
      const { provider } = setUp(null);

      const refusal = await refusedWith(firstValueFrom(provider.signIn(CREDENTIALS)));

      expect(refusal.reason).toBe('unavailable');
      expect(refusal.message).toBe(SIGN_IN_NOT_CONFIGURED);
    });

    it('tells the sign-in screen so before anybody types', () => {
      setUp(null);

      expect(TestBed.runInInjectionContext(identitySignInMethod)).toEqual({
        kind: 'not-configured',
        explanation: SIGN_IN_NOT_CONFIGURED,
      });
    });

    it('offers a password form once a key exists', () => {
      setUp(KEY);

      expect(TestBed.runInInjectionContext(identitySignInMethod)).toEqual({ kind: 'password' });
    });
  });

  describe('signing in', () => {
    it('posts the documented body to signInWithPassword and returns the grant, keeping the refresh token', async () => {
      const { provider, http } = setUp(KEY);
      const answer = firstValueFrom(provider.signIn(CREDENTIALS));

      const request = http.expectOne((req) => req.url === SIGN_IN);
      expect(request.request.method).toBe('POST');
      expect(request.request.params.get('key')).toBe(KEY);
      expect(request.request.body).toEqual({ ...CREDENTIALS, returnSecureToken: true });
      request.flush({ idToken: 'id-token-1', refreshToken: 'refresh-1', expiresIn: '3600', localId: 'uid-1' });

      const result: IdentitySignIn = await answer;
      expect(result).toEqual({
        kind: 'signed-in',
        grant: { idToken: 'id-token-1', expiresAt: new Date(NOW.getTime() + 3_600_000) },
      });
      // The refresh token is nowhere in what was handed out.
      expect(JSON.stringify(result)).not.toContain('refresh-1');
    });

    it('sends Google neither the API bearer token nor the client channel header, and no credentials', async () => {
      const { provider, http } = setUp(KEY);
      TestBed.inject(AuthTokenHolder).hold('api-bearer-token', null);
      const answer = firstValueFrom(provider.signIn(CREDENTIALS));

      const request = http.expectOne((req) => req.url === SIGN_IN);
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.headers.has('X-Client-Channel')).toBe(false);
      expect(request.request.withCredentials).toBe(false);
      request.flush({ idToken: 'id-token-1', refreshToken: 'refresh-1', expiresIn: '3600' });
      await answer;
    });

    it.each([
      'INVALID_LOGIN_CREDENTIALS',
      'EMAIL_NOT_FOUND',
      'INVALID_PASSWORD',
      'USER_DISABLED',
      'INVALID_EMAIL',
    ])('answers %s with the one uniform message', async (code) => {
      const { provider, http } = setUp(KEY);
      const answer = firstValueFrom(provider.signIn(CREDENTIALS));

      http.expectOne((req) => req.url === SIGN_IN).flush(googleError(code), { status: 400, statusText: 'Bad Request' });
      const refusal = await refusedWith(answer);

      expect(refusal.reason).toBe<SignInFailureReason>('invalid-credentials');
      expect(refusal.message).toBe(
        'Those sign-in details were not recognised. Check the email address and password, then try again.',
      );
      expect(refusal.message).not.toContain(code);
    });

    it('answers a throttle as throttled, without inventing how long to wait', async () => {
      const { provider, http } = setUp(KEY);
      const answer = firstValueFrom(provider.signIn(CREDENTIALS));

      http
        .expectOne((req) => req.url === SIGN_IN)
        .flush(googleError('TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled.'), {
          status: 400,
          statusText: 'Bad Request',
        });
      const refusal = await refusedWith(answer);

      expect(refusal.reason).toBe('throttled');
      expect(refusal.retryAfterSeconds).toBeNull();
    });

    it.each([
      ['an unrecognised code', () => googleError('OPERATION_NOT_ALLOWED'), 400],
      ['a server failure', () => null, 503],
    ])('answers %s as unavailable', async (_label, body, status) => {
      const { provider, http } = setUp(KEY);
      const answer = firstValueFrom(provider.signIn(CREDENTIALS));

      http.expectOne((req) => req.url === SIGN_IN).flush(body(), { status, statusText: 'Failed' });

      expect((await refusedWith(answer)).reason).toBe('unavailable');
    });

    it('answers a connection that never reached Google as unavailable', async () => {
      const { provider, http } = setUp(KEY);
      const answer = firstValueFrom(provider.signIn(CREDENTIALS));

      http.expectOne((req) => req.url === SIGN_IN).error(new ProgressEvent('error'));

      expect((await refusedWith(answer)).reason).toBe('unavailable');
    });

    it('refuses an answer that carries no tokens rather than holding nothing', async () => {
      const { provider, http } = setUp(KEY);
      const answer = firstValueFrom(provider.signIn(CREDENTIALS));

      http.expectOne((req) => req.url === SIGN_IN).flush({ localId: 'uid-1' });

      expect((await refusedWith(answer)).reason).toBe('unavailable');
    });
  });

  describe('refreshing', () => {
    async function signedIn(): Promise<{ provider: IdentityProvider; http: HttpTestingController }> {
      const context = setUp(KEY);
      const answer = firstValueFrom(context.provider.signIn(CREDENTIALS));
      context.http
        .expectOne((req) => req.url === SIGN_IN)
        .flush({ idToken: 'id-token-1', refreshToken: 'refresh-1', expiresIn: '3600' });
      await answer;
      return context;
    }

    it('exchanges the refresh token, form-encoded, and keeps the one Google rotates in', async () => {
      const { provider, http } = await signedIn();

      const first = firstValueFrom(provider.refresh());
      const request = http.expectOne((req) => req.url === REFRESH);
      expect(request.request.method).toBe('POST');
      expect(request.request.params.get('key')).toBe(KEY);
      expect(request.request.headers.get('Content-Type')).toBe('application/x-www-form-urlencoded');
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.body).toBe('grant_type=refresh_token&refresh_token=refresh-1');
      request.flush({ id_token: 'id-token-2', refresh_token: 'refresh-2', expires_in: '3600', token_type: 'Bearer' });

      const grant: IdentityGrant = await first;
      expect(grant).toEqual({ idToken: 'id-token-2', expiresAt: new Date(NOW.getTime() + 3_600_000) });

      const second = firstValueFrom(provider.refresh());
      const rotated = http.expectOne((req) => req.url === REFRESH);
      expect(rotated.request.body).toBe('grant_type=refresh_token&refresh_token=refresh-2');
      rotated.flush({ id_token: 'id-token-3', refresh_token: 'refresh-3', expires_in: '3600' });

      expect((await second).idToken).toBe('id-token-3');
    });

    it('cannot refresh without having signed in, and asks nobody', async () => {
      const { provider } = setUp(KEY);

      expect((await refusedWith(firstValueFrom(provider.refresh()))).reason).toBe('unavailable');
    });

    it('forgets the refresh token when told to, so nothing can renew the session afterwards', async () => {
      const { provider } = await signedIn();

      provider.forget();

      await refusedWith(firstValueFrom(provider.refresh()));
    });

    it('reports a refused refresh as a failure', async () => {
      const { provider, http } = await signedIn();
      const answer = firstValueFrom(provider.refresh());

      http.expectOne((req) => req.url === REFRESH).flush(googleError('TOKEN_EXPIRED'), { status: 400, statusText: 'Bad Request' });

      expect((await refusedWith(answer)).reason).toBe('unavailable');
    });
  });

  describe('a second factor', () => {
    const PENDING = 'pending-credential-1';

    async function firstFactor(
      mfaInfo: readonly unknown[],
    ): Promise<{ provider: IdentityProvider; http: HttpTestingController; result: IdentitySignIn }> {
      const context = setUp(KEY);
      const answer = firstValueFrom(context.provider.signIn(CREDENTIALS));
      context.http
        .expectOne((req) => req.url === SIGN_IN)
        .flush({ mfaPendingCredential: PENDING, mfaInfo, localId: 'uid-1', email: CREDENTIALS.email });
      return { ...context, result: await answer };
    }

    const TOTP_AND_SMS = [
      { mfaEnrollmentId: 'sms-enrollment', phoneInfo: '+63*******01' },
      { mfaEnrollmentId: 'totp-enrollment', totpInfo: {} },
    ];

    it('answers as still owed, with an opaque handle and no invented expiry', async () => {
      const { result } = await firstFactor(TOTP_AND_SMS);

      expect(result.kind).toBe('second-factor');
      if (result.kind === 'second-factor') {
        expect(result.challenge.expiresInMinutes).toBe(0);
        // The pending credential proves a password was right; the screen never sees it.
        expect(JSON.stringify(result)).not.toContain(PENDING);
      }
    });

    it('finalizes the TOTP enrolment with the documented body, reading the lifetime from the token', async () => {
      const { provider, http, result } = await firstFactor(TOTP_AND_SMS);
      if (result.kind !== 'second-factor') {
        throw new Error('expected a second factor');
      }
      const exp = Math.floor(NOW.getTime() / 1000) + 3600;

      const answer = firstValueFrom(provider.finalizeMfa({ challenge: result.challenge.challenge, code: ' 123456 ' }));
      const request = http.expectOne((req) => req.url === FINALIZE);
      expect(request.request.params.get('key')).toBe(KEY);
      expect(request.request.headers.has('Authorization')).toBe(false);
      expect(request.request.body).toEqual({
        mfaPendingCredential: PENDING,
        mfaEnrollmentId: 'totp-enrollment',
        totpVerificationInfo: { verificationCode: '123456' },
      });
      request.flush({ idToken: tokenExpiringAt(exp), refreshToken: 'refresh-after-mfa' });

      expect((await answer).expiresAt).toEqual(new Date(exp * 1000));
    });

    it('refuses a wrong code, and the attempt is spent', async () => {
      const { provider, http, result } = await firstFactor(TOTP_AND_SMS);
      if (result.kind !== 'second-factor') {
        throw new Error('expected a second factor');
      }
      const credentials = { challenge: result.challenge.challenge, code: '000000' };

      const answer = firstValueFrom(provider.finalizeMfa(credentials));
      http.expectOne((req) => req.url === FINALIZE).flush(googleError('INVALID_MFA_CODE'), { status: 400, statusText: 'Bad Request' });
      expect((await refusedWith(answer)).reason).toBe('second-factor-refused');

      // Retyping against the dead attempt sends nothing.
      expect((await refusedWith(firstValueFrom(provider.finalizeMfa(credentials)))).reason).toBe('second-factor-refused');
    });

    it('refuses a handle it never issued, and sends nothing', async () => {
      const { provider } = await firstFactor(TOTP_AND_SMS);

      const refusal = await refusedWith(firstValueFrom(provider.finalizeMfa({ challenge: 'forged', code: '123456' })));

      expect(refusal.reason).toBe('second-factor-refused');
    });

    it('says plainly when the only second factor is one this console cannot take', async () => {
      const context = setUp(KEY);
      const answer = firstValueFrom(context.provider.signIn(CREDENTIALS));
      context.http
        .expectOne((req) => req.url === SIGN_IN)
        .flush({ mfaPendingCredential: PENDING, mfaInfo: [TOTP_AND_SMS[0]] });

      const refusal = await refusedWith(answer);
      expect(refusal.reason).toBe('unavailable');
      expect(refusal.message).toMatch(/second factor this console cannot accept/);
    });
  });
});
