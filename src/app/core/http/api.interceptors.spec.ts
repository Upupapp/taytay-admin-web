import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthTokenHolder } from '../auth/auth-token.holder';
import { SessionStore } from '../auth/session.store';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { NotificationStore } from '../notifications/notification.store';
import { isApiFailure, isNotFound } from './api-failure';
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

/**
 * `DL-196`: the interceptor navigates only when the session is over. A `403` used to send the whole
 * app to `/forbidden` — and a barangay link opening a resident's record lost the record because its
 * home-visits panel was refused, and a refused save lost the form (dry run 2026-11-09, defects 1
 * and 2). A not-found read raised a "Request failed" notice per read over the screen's own
 * not-found message (defect 4).
 */
describe('httpErrorInterceptor — where a refusal is said (DL-196)', () => {
  const REFUSED = {
    error: {
      code: 'FORBIDDEN',
      message: 'Your role does not open home visits.',
      request_id: 'r-1',
    },
  };
  const MISSING = { error: { code: 'NOT_FOUND', message: 'That resident was not found.' } };

  function setUp() {
    const error = vi.fn();
    const endExpiredSession = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationStore, useValue: { error, warning: vi.fn() } },
        { provide: SessionStore, useValue: { endExpiredSession } },
      ],
    });
    return {
      client: TestBed.inject(HttpClient),
      http: TestBed.inject(HttpTestingController),
      navigate: vi.spyOn(TestBed.inject(Router), 'navigate'),
      error,
      endExpiredSession,
    };
  }

  async function answer(
    http: HttpTestingController,
    method: string,
    url: string,
    body: object,
    status: number,
  ): Promise<void> {
    http.expectOne({ method, url }).flush(body, { status, statusText: 'Refused' });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('says nothing and goes nowhere on a refused read: the screen says it in place', async () => {
    const { client, http, navigate, error } = setUp();
    let thrown: unknown = null;
    client
      .get(`${BASE}/office/visits`)
      .subscribe({ error: (failure: unknown) => (thrown = failure) });
    await answer(http, 'GET', `${BASE}/office/visits`, REFUSED, 403);

    expect(navigate).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(isApiFailure(thrown) && thrown.message).toBe('Your role does not open home visits.');
    http.verify();
  });

  it('keeps a refused write on its form, and says the refusal once in the server words', async () => {
    const { client, http, navigate, error } = setUp();
    client.post(`${BASE}/office/residents`, {}).subscribe({ error: () => undefined });
    await answer(http, 'POST', `${BASE}/office/residents`, REFUSED, 403);

    expect(navigate).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      'Request refused',
      'Your role does not open home visits. Reference r-1.',
    );
    http.verify();
  });

  it('refuses without an envelope the same way: a bare 403 navigates nowhere', async () => {
    const { client, http, navigate } = setUp();
    client.get(`${BASE}/office/visits`).subscribe({ error: () => undefined });
    http
      .expectOne(`${BASE}/office/visits`)
      .flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(navigate).not.toHaveBeenCalled();
    http.verify();
  });

  it('leaves a read that found nothing to the screen, as a not-found every adapter recognises', async () => {
    const { client, http, error } = setUp();
    let thrown: unknown = null;
    client
      .get(`${BASE}/office/residents/nobody`)
      .subscribe({ error: (failure: unknown) => (thrown = failure) });
    await answer(http, 'GET', `${BASE}/office/residents/nobody`, MISSING, 404);

    expect(error).not.toHaveBeenCalled();
    expect(isNotFound(thrown)).toBe(true);
    http.verify();
  });

  it('says a write to something gone, since no screen reads it as an absence', async () => {
    const { client, http, error } = setUp();
    client
      .post(`${BASE}/office/residents/nobody/sectors`, {})
      .subscribe({ error: () => undefined });
    await answer(http, 'POST', `${BASE}/office/residents/nobody/sectors`, MISSING, 404);

    expect(error).toHaveBeenCalledWith('Request failed', 'That resident was not found.');
    http.verify();
  });

  it('still ends a session the server no longer accepts, and goes to sign-in', async () => {
    const { client, http, navigate, endExpiredSession } = setUp();
    client.get(`${BASE}/me`).subscribe({ error: () => undefined });
    await answer(
      http,
      'GET',
      `${BASE}/me`,
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in again.' } },
      401,
    );

    expect(endExpiredSession).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/sign-in'], expect.anything());
    http.verify();
  });
});
