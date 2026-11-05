import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, defer, map, throwError, type Observable } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  SignInError,
  type MfaCredentials,
  type SignInCredentials,
  type SignInMethod,
} from '@domain/index';

import type { IdentityGrant, IdentityPort, IdentitySignIn } from './identity.model';
import {
  invalidCredentials,
  secondFactorRefused,
  SIGN_IN_NOT_CONFIGURED,
  signInNotConfigured,
  signInThrottled,
  signInUnavailable,
} from './sign-in-messages';

/**
 * Staff sign-in through Firebase Authentication's REST API (`DL-166`).
 *
 * REST rather than the Firebase SDK, as `docs/integration/node-api-transport-design.md` §4
 * decided: no dependency, nothing written to web storage (the SDK's default persistence is
 * IndexedDB), and two private fields where the SDK would hand out an object any injector could
 * ask for its tokens. The cost is the protocol below, which is the one the SDK itself speaks.
 *
 * ## The shapes, and where each was read
 *
 * - Sign-in: `POST identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=…` with
 *   `{ email, password, returnSecureToken: true }`, answering `idToken`, `refreshToken` and
 *   `expiresIn` (seconds, as a string) —
 *   https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
 * - Refresh: `POST securetoken.googleapis.com/v1/token?key=…`, form-encoded
 *   `grant_type=refresh_token&refresh_token=…`, answering `id_token`, `refresh_token` and
 *   `expires_in` — https://firebase.google.com/docs/reference/rest/auth#section-refresh-token
 * - Errors: `{ error: { code, message } }`, and "the error code is obtained from the message
 *   field" — https://firebase.google.com/docs/reference/rest/auth#section-error-format
 * - `INVALID_LOGIN_CREDENTIALS`, which replaces the unknown-address and wrong-password codes when
 *   email enumeration protection is on (the default for projects created from 15 September 2023) —
 *   https://cloud.google.com/identity-platform/docs/admin/email-enumeration-protection
 * - A second factor: the sign-in answer carries `mfaPendingCredential` and `mfaInfo[]` instead of
 *   tokens — https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithPassword ;
 *   an enrolment is a TOTP one when it carries `totpInfo` (an empty object), identified by
 *   `mfaEnrollmentId` — https://cloud.google.com/identity-platform/docs/reference/rest/v1/MfaEnrollment ;
 *   and it is finished at `POST identitytoolkit.googleapis.com/v2/accounts/mfaSignIn:finalize`
 *   with `{ mfaPendingCredential, mfaEnrollmentId, totpVerificationInfo: { verificationCode } }`,
 *   answering `idToken` and `refreshToken` and **no** `expiresIn` —
 *   https://cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaSignIn/finalize .
 *   `mfaSignIn:start` carries only an SMS option, so a TOTP sign-in does not call it.
 *
 * TOTP needs the project upgraded to Identity Platform with TOTP enabled. Whether the office's
 * project is, nobody has confirmed; the flow is built to the published reference and has not been
 * exercised against a live project (`DL-166`).
 *
 * ## What it keeps, and where
 *
 * The **refresh token** lives in `#refreshToken` and nowhere else: no getter, never in a grant,
 * never in web storage (`check:auth`). It is long-lived, which is why it must die with the tab:
 * reload signs out, as ADR 0006 accepted. The **ID token** is not kept here at all — it is handed
 * to the staff adapter, which holds it in `AuthTokenHolder`. The pending second-factor credential
 * proves a password was right, so it stays in `#pending` too; the screen gets an opaque handle.
 *
 * ## Why the bare backend
 *
 * `new HttpClient(inject(HttpBackend))` sends these requests past every interceptor. The header
 * interceptor already confines the bearer token and `X-Client-Channel` to the API's base URL, and
 * this makes it structural as well: Google's endpoints are other origins and receive neither, and
 * the error interceptor does not report Google's refusals as the API's.
 */

const SIGN_IN_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const MFA_FINALIZE_URL = 'https://identitytoolkit.googleapis.com/v2/accounts/mfaSignIn:finalize';
const REFRESH_URL = 'https://securetoken.googleapis.com/v1/token';

/**
 * The codes that mean "these details do not open an account". `INVALID_EMAIL` joins the four the
 * reference lists, because the form's address check is deliberately permissive and Google's is
 * not: answering it with "unavailable, try again shortly" would send somebody back to retype the
 * same address. None of them is distinguishable on screen.
 */
const REFUSED_CREDENTIALS = new Set([
  'INVALID_LOGIN_CREDENTIALS',
  'EMAIL_NOT_FOUND',
  'INVALID_PASSWORD',
  'USER_DISABLED',
  'INVALID_EMAIL',
]);

const THROTTLED = 'TOO_MANY_ATTEMPTS_TRY_LATER';

/** What the second step needs and the screen must not see. */
interface PendingSecondFactor {
  readonly handle: string;
  readonly credential: string;
  readonly enrollmentId: string;
}

@Injectable({ providedIn: 'root' })
export class IdentityProvider implements IdentityPort {
  readonly #http = new HttpClient(inject(HttpBackend));
  readonly #key: string | null = inject(APP_ENVIRONMENT).firebaseWebApiKey;
  #refreshToken: string | null = null;
  #pending: PendingSecondFactor | null = null;
  #attempts = 0;

  /** Email and password. A second factor, if the account has one, is answered as still owed. */
  signIn(credentials: SignInCredentials): Observable<IdentitySignIn> {
    return defer(() => {
      const key = this.#key;

      if (!key) {
        return throwError(() => signInNotConfigured());
      }

      // A new attempt abandons whatever an earlier one left behind.
      this.forget();

      return this.#http
        .post<unknown>(
          SIGN_IN_URL,
          { email: credentials.email, password: credentials.password, returnSecureToken: true },
          { params: { key } },
        )
        .pipe(
          map((body) => this.#firstFactor(body)),
          catchError((error: unknown) => throwError(() => refusal(error, 'password'))),
        );
    });
  }

  /** The TOTP code, against the attempt `signIn` left pending. Single use, whatever the answer. */
  finalizeMfa(credentials: MfaCredentials): Observable<IdentityGrant> {
    return defer(() => {
      const key = this.#key;
      const pending = this.#pending;
      this.#pending = null;

      if (!key) {
        return throwError(() => signInNotConfigured());
      }

      if (pending === null || pending.handle !== credentials.challenge) {
        return throwError(() => secondFactorRefused());
      }

      return this.#http
        .post<unknown>(
          MFA_FINALIZE_URL,
          {
            mfaPendingCredential: pending.credential,
            mfaEnrollmentId: pending.enrollmentId,
            totpVerificationInfo: { verificationCode: credentials.code.trim() },
          },
          { params: { key } },
        )
        .pipe(
          map((body) => {
            const idToken = text(body, 'idToken');
            const refreshToken = text(body, 'refreshToken');

            if (idToken === null || refreshToken === null) {
              throw signInUnavailable();
            }

            this.#refreshToken = refreshToken;
            // The finalize answer states no lifetime, so it is read from the token's own `exp`.
            return { idToken, expiresAt: expiryClaimOf(idToken) };
          }),
          catchError((error: unknown) => throwError(() => refusal(error, 'second-factor'))),
        );
    });
  }

  /**
   * A fresh ID token for the refresh token held here. Fails without a request when there is none.
   *
   * Google may rotate the refresh token, so the one it answers with replaces the one sent.
   */
  refresh(): Observable<IdentityGrant> {
    return defer(() => {
      const key = this.#key;
      const refreshToken = this.#refreshToken;

      if (!key || refreshToken === null) {
        return throwError(() => signInUnavailable());
      }

      const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });

      return this.#http
        .post<unknown>(REFRESH_URL, form.toString(), {
          params: { key },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
        .pipe(
          map((body) => {
            const idToken = text(body, 'id_token');
            const rotated = text(body, 'refresh_token');

            if (idToken === null || rotated === null) {
              throw signInUnavailable();
            }

            this.#refreshToken = rotated;
            return { idToken, expiresAt: expiryIn(text(body, 'expires_in')) };
          }),
          catchError((error: unknown) => throwError(() => refusal(error, 'refresh'))),
        );
    });
  }

  /**
   * Forgets the refresh token and any pending second factor. Local only: revocation is the API's
   * `POST auth/sign-out`, which the staff adapter calls before this.
   */
  forget(): void {
    this.#refreshToken = null;
    this.#pending = null;
  }

  #firstFactor(body: unknown): IdentitySignIn {
    const pendingCredential = text(body, 'mfaPendingCredential');

    if (pendingCredential !== null) {
      const enrollmentId = totpEnrollmentOf(body);

      if (enrollmentId === null) {
        // Enrolled with a text message only. The console has no SMS step, and pretending the
        // password was wrong would send somebody to reset a password that works.
        throw new SignInError(
          'unavailable',
          'Your account uses a second factor this console cannot accept yet. Contact the MSWDO administrator.',
        );
      }

      this.#attempts += 1;
      const handle = `second-factor-${this.#attempts}`;
      this.#pending = { handle, credential: pendingCredential, enrollmentId };

      // Google does not publish how long a pending credential lasts, so no expiry is shown: an
      // invented one is a countdown somebody trusts (`0` means "not stated" to the screen).
      return { kind: 'second-factor', challenge: { challenge: handle, expiresInMinutes: 0 } };
    }

    const idToken = text(body, 'idToken');
    const refreshToken = text(body, 'refreshToken');

    if (idToken === null || refreshToken === null) {
      throw signInUnavailable();
    }

    this.#refreshToken = refreshToken;
    return { kind: 'signed-in', grant: { idToken, expiresAt: expiryIn(text(body, 'expiresIn')) } };
  }
}

/**
 * How this build signs in: with a password, or — with no key supplied — not at all, said plainly.
 * Bound to `SIGN_IN_METHOD` by the HTTP adapter set.
 */
export function identitySignInMethod(): SignInMethod {
  return inject(APP_ENVIRONMENT).firebaseWebApiKey
    ? { kind: 'password' }
    : { kind: 'not-configured', explanation: SIGN_IN_NOT_CONFIGURED };
}

type Step = 'password' | 'second-factor' | 'refresh';

/**
 * A Google refusal, in the console's terms. Never Google's own message: it is written for
 * developers and some of its codes say whether an address has an account.
 */
function refusal(error: unknown, step: Step): SignInError {
  if (error instanceof SignInError) {
    return error;
  }

  if (!(error instanceof HttpErrorResponse)) {
    return signInUnavailable();
  }

  const code = googleCode(error.error);

  if (code === THROTTLED) {
    return signInThrottled();
  }

  if (step === 'password' && code !== null && REFUSED_CREDENTIALS.has(code)) {
    return invalidCredentials();
  }

  // The same key and project already answered the password step, so a 400 here is a refusal of
  // what was submitted — the code, or a pending credential that has lapsed — and not configuration.
  if (step === 'second-factor' && error.status === 400) {
    return secondFactorRefused();
  }

  return signInUnavailable();
}

/** `TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account…` → `TOO_MANY_ATTEMPTS_TRY_LATER`. */
function googleCode(body: unknown): string | null {
  const error = member(body, 'error');
  const message = member(error, 'message');

  if (typeof message !== 'string') {
    return null;
  }

  return message.split(/[\s:]/, 1)[0] ?? null;
}

/** The first enrolment that is a TOTP one, by the presence of `totpInfo`. */
function totpEnrollmentOf(body: unknown): string | null {
  const enrollments = member(body, 'mfaInfo');

  if (!Array.isArray(enrollments)) {
    return null;
  }

  for (const enrollment of enrollments as readonly unknown[]) {
    const id = text(enrollment, 'mfaEnrollmentId');

    if (id !== null && typeof member(enrollment, 'totpInfo') === 'object') {
      return id;
    }
  }

  return null;
}

/** `"3600"` → an hour from now. Anything unreadable is an unknown lifetime, never a guessed one. */
function expiryIn(seconds: string | null): Date | null {
  const value = Number(seconds);

  return seconds !== null && Number.isFinite(value) && value > 0 ? new Date(Date.now() + value * 1000) : null;
}

/**
 * The `exp` claim — seconds since the epoch — of an ID token
 * (https://firebase.google.com/docs/auth/admin/verify-id-tokens). Read for scheduling only; the
 * API verifies the token, and nothing here trusts a claim for anything else.
 */
function expiryClaimOf(idToken: string): Date | null {
  try {
    const payload = idToken.split('.')[1];

    if (payload === undefined) {
      return null;
    }

    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const exp = member(JSON.parse(json) as unknown, 'exp');

    return typeof exp === 'number' && Number.isFinite(exp) ? new Date(exp * 1000) : null;
  } catch {
    return null;
  }
}

function member(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

function text(value: unknown, key: string): string | null {
  const found = member(value, key);
  return typeof found === 'string' && found !== '' ? found : null;
}
