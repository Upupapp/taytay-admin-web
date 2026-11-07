import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthTokenHolder } from '../auth/auth-token.holder';
import { SessionStore } from '../auth/session.store';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { NotificationStore } from '../notifications/notification.store';
import { isApiFailure } from './api-failure';
import { apiHeadersInterceptor, httpErrorInterceptor } from './api.interceptors';

const BASE = 'https://api.example.gov.ph/api/v1';

/**
 * A credential is attached where it is meant to be read and nowhere else. The interceptor used to
 * decorate every request, so the bearer token would have gone to whatever origin a request named.
 */
describe('apiHeadersInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: `${BASE}/` } },
      ],
    });

    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
  });

  afterEach(() => http.verify());

  it('sends the token and the channel to the API', () => {
    client.get(`${BASE}/me`).subscribe();

    const { request } = http.expectOne(`${BASE}/me`);
    expect(request.headers.get('Authorization')).toBe('Bearer fixture-token');
    expect(request.headers.get('X-Client-Channel')).toBe('admin-console');
  });

  it.each([
    ['another origin', 'https://identitytoolkit.example.com/v1/accounts'],
    ['a host that only begins like the API', 'https://api.example.gov.ph.attacker.test/api/v1/me'],
    ['a path that only begins like the base', 'https://api.example.gov.ph/api/v1evil/me'],
    ['the console itself', '/assets/logo.svg'],
  ])('sends nothing to %s', (_what, url) => {
    client.get(url).subscribe();

    const { request } = http.expectOne(url);
    expect(request.headers.has('Authorization')).toBe(false);
    expect(request.headers.has('X-Client-Channel')).toBe(false);
  });
});

/**
 * `VERIFICATION_REQUIRED` is a resident's refusal (`DL-186`): an unverified resident asking for a
 * document. A staff console is never sent it, but a code it does not expect must still be read as a
 * refusal in the server's words — not dropped, not thrown inside the handler, and not mistaken for
 * the account lacking a grant.
 */
describe('httpErrorInterceptor — a code only residents are sent', () => {
  it('says the refusal in the server words and does not send the user to /forbidden', async () => {
    const error = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationStore, useValue: { error, warning: vi.fn() } },
        { provide: SessionStore, useValue: {} },
      ],
    });
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    let thrown: unknown = null;
    client
      .get(`${BASE}/me/issuance-requests`)
      .subscribe({ error: (failure: unknown) => (thrown = failure) });
    http.expectOne(`${BASE}/me/issuance-requests`).flush(
      {
        error: {
          code: 'VERIFICATION_REQUIRED',
          message: 'Finish verifying your account before asking for a document.',
          request_id: 'req-186',
        },
      },
      { status: 403, statusText: 'Forbidden' },
    );
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(isApiFailure(thrown) && thrown.code).toBe('VERIFICATION_REQUIRED');
    expect(navigate).not.toHaveBeenCalledWith(['/forbidden']);
    expect(error).toHaveBeenCalledWith(
      'Request refused',
      'Finish verifying your account before asking for a document. Reference req-186.',
    );
    http.verify();
  });
});
