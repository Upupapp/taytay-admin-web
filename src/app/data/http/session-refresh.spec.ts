import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { SESSION_REFRESHER } from '@core/auth/session-refresher';
import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import type { ApiFailure } from '@core/http/api-failure';
import { apiHeadersInterceptor, httpErrorInterceptor } from '@core/http/api.interceptors';
import { ACCESS_CONTEXT, NOTIFICATION_REPOSITORY, STAFF_REPOSITORY } from '@domain/index';

import ME_STAFF from './fixtures/me-staff.json';
import { HttpNotificationRepository, HttpSessionRefresher, HttpStaffRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const SIGN_IN = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const REFRESH = 'https://securetoken.googleapis.com/v1/token';
const NOW = new Date('2026-11-05T01:00:00.000Z').getTime();

/**
 * Renewal before expiry, end to end (`DL-166`): the real interceptors, the real staff adapter and
 * refresher, the real Firebase provider — only the network is a test double.
 */
describe('renewing the session before its token lapses', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let session: SessionStore;
  let router: Router;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        { provide: ACCESS_CONTEXT, useExisting: SessionState },
        { provide: STAFF_REPOSITORY, useClass: HttpStaffRepository },
        { provide: NOTIFICATION_REPOSITORY, useClass: HttpNotificationRepository },
        { provide: SESSION_REFRESHER, useClass: HttpSessionRefresher },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Signed in for an hour.
    const signedIn = firstValueFrom(session.signIn({ email: 'staff.member@example.invalid', password: 'long-enough' }));
    http
      .expectOne((req) => req.url === SIGN_IN)
      .flush({ idToken: 'id-token-1', refreshToken: 'refresh-1', expiresIn: '3600' });
    http.expectOne(`${BASE}/me`).flush(ME_STAFF);
    expect(await signedIn).toBe(true);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('sends nothing to Google while the token has more than a minute left', () => {
    vi.setSystemTime(NOW + 3_500_000);
    client.get(`${BASE}/notifications`).subscribe();

    http.expectNone((req) => req.url === REFRESH);
    expect(http.expectOne(`${BASE}/notifications`).request.headers.get('Authorization')).toBe('Bearer id-token-1');
  });

  it('renews once for every request that finds the token about to lapse, then sends them all with the new one', async () => {
    vi.setSystemTime(NOW + 3_550_000);

    const first = firstValueFrom(client.get(`${BASE}/notifications`));
    const second = firstValueFrom(client.get(`${BASE}/me`));

    // One refresh in flight, shared; neither API request has left yet.
    const renewals = http.match((req) => req.url === REFRESH);
    expect(renewals).toHaveLength(1);
    http.expectNone(`${BASE}/notifications`);
    http.expectNone(`${BASE}/me`);

    renewals[0]?.flush({ id_token: 'id-token-2', refresh_token: 'refresh-2', expires_in: '3600' });

    for (const url of [`${BASE}/notifications`, `${BASE}/me`]) {
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer id-token-2');
      request.flush({ data: [], meta: {} });
    }
    await Promise.all([first, second]);

    // Renewed for another hour: the next request goes straight out.
    client.get(`${BASE}/notifications`).subscribe();
    http.expectNone((req) => req.url === REFRESH);
    http.expectOne(`${BASE}/notifications`);
  });

  it('ends the session when renewal is refused, and sends the waiting request nowhere', async () => {
    vi.setSystemTime(NOW + 3_590_000);

    const waiting = firstValueFrom(client.get(`${BASE}/notifications`));
    http
      .expectOne((req) => req.url === REFRESH)
      .flush({ error: { code: 400, message: 'TOKEN_EXPIRED' } }, { status: 400, statusText: 'Bad Request' });

    await expect(waiting).rejects.toSatisfy((failure: ApiFailure) => failure.code === 'UNAUTHENTICATED');
    http.expectNone(`${BASE}/notifications`);
    expect(TestBed.inject(AuthTokenHolder).hasToken()).toBe(false);
    expect(session.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in'], expect.anything());
  });

  it('never renews for a request that is not to the API', () => {
    vi.setSystemTime(NOW + 3_590_000);
    client.get('https://elsewhere.example.org/asset.json').subscribe();

    http.expectNone((req) => req.url === REFRESH);
    expect(http.expectOne('https://elsewhere.example.org/asset.json').request.headers.has('Authorization')).toBe(false);
  });
});
