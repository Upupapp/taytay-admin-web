import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { safeReturnUrl, RETURN_URL_PARAM } from '@core/access/access.guards';
import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { ACCESS_CONTEXT, NOTIFICATION_REPOSITORY, STAFF_REPOSITORY } from '@domain/index';
import type { AppNotification, NotificationRepository } from '@domain/index';
import { MockStaffRepository, MOCK_MFA_CODE } from '@data/mock/mock-staff.repository';
import type { AppEnvironment } from '@env/environment.model';
import { of, type Observable } from 'rxjs';

import { AUTH_COPY } from './auth.copy';
import { SignInPage } from './sign-in-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

const notifications: NotificationRepository = {
  listForCurrentUser: (): Observable<readonly AppNotification[]> => of([]),
  markRead: (): Observable<AppNotification> => {
    throw new Error('not used');
  },
  markAllRead: (): Observable<readonly AppNotification[]> => of([]),
};

@Component({ template: 'stub' })
class StubPage {}

/** A real seeded staff address, so sign-in is exercised end to end. */
const KNOWN_EMAIL = 'teodoro.lim@taytay.example.gov.ph';
const ANY_PASSWORD = 'a-password-of-sufficient-length';

async function setUp(): Promise<ComponentFixture<SignInPage>> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'sign-in', component: SignInPage },
        { path: 'dashboard', component: StubPage },
        { path: 'residents', component: StubPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useClass: MockStaffRepository },
      { provide: NOTIFICATION_REPOSITORY, useValue: notifications },
    ],
  });
  await TestBed.inject(Router).navigateByUrl('/sign-in');
  const fixture = TestBed.createComponent(SignInPage);
  await fixture.whenStable();
  return fixture;
}

function type(fixture: ComponentFixture<SignInPage>, selector: string, value: string): void {
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector);
  if (!input) {
    throw new Error(`no input for ${selector}`);
  }
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

async function submit(fixture: ComponentFixture<SignInPage>): Promise<void> {
  (fixture.nativeElement as HTMLElement)
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { cancelable: true }));
  await fixture.whenStable();
}

/**
 * The whole sign-in, both steps.
 *
 * Every staff account has a second factor — the mock adapter issues a challenge
 * for the same reason the API does, so the offline path cannot skip a control
 * the real one applies. A test that only submitted the password would be
 * asserting a flow that does not exist.
 */
async function signInFully(fixture: ComponentFixture<SignInPage>): Promise<void> {
  await submit(fixture);
  type(fixture, '#sign-in-code', MOCK_MFA_CODE);
  await submit(fixture);
}

/* ── WCAG 3.3.8 Accessible Authentication ─────────────────────────────────── */

describe('sign-in meets WCAG 2.2 §3.3.8 Accessible Authentication (AA)', () => {
  it('lets a password manager fill both fields', async () => {
    // Remembering a password is a cognitive function test. The satisfier this
    // screen relies on is Mechanism — password-manager support — which needs
    // these exact autocomplete tokens.
    const element = (await setUp()).nativeElement as HTMLElement;
    expect(element.querySelector('#sign-in-email')?.getAttribute('autocomplete')).toBe('username');
    expect(element.querySelector('#sign-in-password')?.getAttribute('autocomplete')).toBe(
      'current-password',
    );
  });

  it('never blocks paste', async () => {
    // A paste handler would defeat password managers and re-impose the
    // cognitive function test.
    const fixture = await setUp();
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('onpaste');
    expect(html).not.toContain('paste)');
  });

  it('offers a show-password mechanism', async () => {
    const fixture = await setUp();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector<HTMLButtonElement>('.field__toggle');

    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    expect(element.querySelector('#sign-in-password')?.getAttribute('type')).toBe('password');

    toggle?.click();
    await fixture.whenStable();

    expect(element.querySelector('.field__toggle')?.getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('#sign-in-password')?.getAttribute('type')).toBe('text');
  });

  it('presents no puzzle, CAPTCHA or transcription step', async () => {
    const text = ((await setUp()).nativeElement as HTMLElement).textContent?.toLowerCase() ?? '';
    for (const banned of ['captcha', 'puzzle', 'verify you are human', 'type the characters']) {
      expect(text).not.toContain(banned);
    }
  });

  it('labels both fields', async () => {
    const element = (await setUp()).nativeElement as HTMLElement;
    expect(element.querySelector('label[for="sign-in-email"]')).not.toBeNull();
    expect(element.querySelector('label[for="sign-in-password"]')).not.toBeNull();
  });
});

/* ── no self-registration ─────────────────────────────────────────────────── */

describe('no admin self-registration', () => {
  it('offers no registration or sign-up control', async () => {
    const element = (await setUp()).nativeElement as HTMLElement;
    const text = element.textContent?.toLowerCase() ?? '';
    expect(text).not.toContain('sign up');
    expect(text).not.toContain('create an account');
    expect(text).not.toContain('register');

    const links = Array.from(element.querySelectorAll('a')).map(
      (a) => a.getAttribute('href') ?? '',
    );
    for (const href of links) {
      expect(href).not.toMatch(/register|signup|sign-up/i);
    }
  });

  it('states how accounts are actually issued', async () => {
    const element = (await setUp()).nativeElement as HTMLElement;
    expect(element.textContent).toContain(AUTH_COPY.noSelfRegistration);
  });

  it('exposes no register method on the repository port', () => {
    // Structural, not cosmetic: there is nothing to call even if a screen
    // wanted to.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
        { provide: ACCESS_CONTEXT, useExisting: SessionState },
        MockStaffRepository,
      ],
    });
    const repository = TestBed.inject(MockStaffRepository) as unknown as Record<string, unknown>;
    for (const name of ['register', 'signUp', 'createAccount']) {
      expect(repository[name]).toBeUndefined();
    }
  });
});

/* ── credential handling ──────────────────────────────────────────────────── */

describe('credential handling', () => {
  it('signs a known staff member in and lands them on the dashboard', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', KNOWN_EMAIL);
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await signInFully(fixture);

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/dashboard');
  });

  it('does not sign anybody in on the password alone', async () => {
    // The password is one factor. Until the code is accepted there is no
    // session, and no guard may treat this state as one.
    const fixture = await setUp();
    type(fixture, '#sign-in-email', KNOWN_EMAIL);
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await submit(fixture);

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    expect(TestBed.inject(SessionStore).status()).toBe('second-factor-required');
  });

  it('asks for the code in one labelled, paste-friendly field', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', KNOWN_EMAIL);
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await submit(fixture);

    const element = fixture.nativeElement as HTMLElement;
    const code = element.querySelector('#sign-in-code');

    expect(code).not.toBeNull();
    expect(code?.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code?.hasAttribute('onpaste')).toBe(false);
    // One field, not six that auto-advance: split boxes are announced as six
    // unlabelled inputs and strand anybody who mistypes.
    expect(element.querySelectorAll('input[name="one-time-code"]')).toHaveLength(1);
    expect(element.querySelector('label[for="sign-in-code"]')).not.toBeNull();
  });

  it('refuses a wrong code without saying which half was wrong', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', KNOWN_EMAIL);
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await submit(fixture);
    type(fixture, '#sign-in-code', '999999');
    await submit(fixture);

    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });

  it('gives the same message for an unknown address as for a bad password', async () => {
    // Anything more specific would let the page be used to discover which
    // municipal addresses exist.
    const fixture = await setUp();
    type(fixture, '#sign-in-email', 'nobody@taytay.example.gov.ph');
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await submit(fixture);

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      AUTH_COPY.invalidCredentials,
    );
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });

  it('never echoes the submitted address back in the failure', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', 'nobody@taytay.example.gov.ph');
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await submit(fixture);

    const alert = (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]');
    expect(alert?.textContent).not.toContain('nobody@');
  });

  it('validates shape before attempting a sign-in', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', 'not-an-email');
    type(fixture, '#sign-in-password', 'short');
    await submit(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(AUTH_COPY.emailRequired);
    expect(text).toContain(AUTH_COPY.passwordRequired);
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
  });

  it('announces failures through a live region', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', 'not-an-email');
    await submit(fixture);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
  });

  it('clears the message once the user starts correcting it', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', 'not-an-email');
    await submit(fixture);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();

    type(fixture, '#sign-in-email', KNOWN_EMAIL);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
  });

  it('returns the user to where they were headed', async () => {
    TestBed.resetTestingModule();
    const fixture = await setUp();
    await TestBed.inject(Router).navigateByUrl(`/sign-in?${RETURN_URL_PARAM}=/residents`);
    await fixture.whenStable();

    type(fixture, '#sign-in-email', KNOWN_EMAIL);
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await signInFully(fixture);

    expect(TestBed.inject(Router).url).toBe('/residents');
  });
});

/* ── return-url safety ────────────────────────────────────────────────────── */

describe('safeReturnUrl', () => {
  it('accepts an absolute in-app path', () => {
    expect(safeReturnUrl('/residents')).toBe('/residents');
    expect(safeReturnUrl('/administration/audit?page=2')).toBe('/administration/audit?page=2');
  });

  it('rejects an absolute external URL', () => {
    // Otherwise the sign-in page becomes an open redirect.
    expect(safeReturnUrl('https://elsewhere.example/steal')).toBeNull();
    expect(safeReturnUrl('http://elsewhere.example')).toBeNull();
  });

  it('rejects a protocol-relative URL', () => {
    expect(safeReturnUrl('//elsewhere.example')).toBeNull();
  });

  it('rejects a loop back to sign-in', () => {
    expect(safeReturnUrl('/sign-in')).toBeNull();
  });

  it('rejects nothing at all', () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl('')).toBeNull();
    expect(safeReturnUrl('   ')).toBeNull();
  });
});

/* ── session lifecycle ────────────────────────────────────────────────────── */

describe('session lifecycle', () => {
  it('starts anonymous rather than pre-signed-in', async () => {
    await setUp();
    const session = TestBed.inject(SessionStore);
    await firstValueFrom(session.load());
    expect(session.isAuthenticated()).toBe(false);
    expect(session.user()).toBeNull();
  });

  it('drops the identity on sign-out', async () => {
    const fixture = await setUp();
    type(fixture, '#sign-in-email', KNOWN_EMAIL);
    type(fixture, '#sign-in-password', ANY_PASSWORD);
    await signInFully(fixture);

    const session = TestBed.inject(SessionStore);
    expect(session.isAuthenticated()).toBe(true);

    await firstValueFrom(session.signOut());
    expect(session.isAuthenticated()).toBe(false);
    expect(TestBed.inject(SessionState).currentUser()).toBeNull();
  });
});
