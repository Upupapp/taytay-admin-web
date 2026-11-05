import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthTokenHolder } from '../auth/auth-token.holder';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { apiHeadersInterceptor } from './api.interceptors';

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
