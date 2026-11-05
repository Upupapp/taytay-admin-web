import { Injectable } from '@angular/core';
import { defer, of, throwError, type Observable } from 'rxjs';

import { SignInError, type SignInCredentials, type SignInMethod } from '@domain/index';

import type { IdentityGrant, IdentityPort, IdentitySignIn } from './identity.model';
import { invalidCredentials } from './sign-in-messages';

/**
 * The development verifier's identity provider — **`local-api` only** (`DL-166`).
 *
 * `angular.json` swaps this file in for `identity.provider.ts` in the `local-api` configuration and
 * in no other, the technique `DL-136` uses for the mock adapters: a production or staging build
 * never imports it, so it cannot ship by a runtime flag being wrong. `check:bundle` fails a
 * production artefact that contains its wording, and the production API refuses `mock:` tokens
 * whatever reaches it — two independent guards.
 *
 * ## What it does
 *
 * The backend in development (`AUTH_VERIFIER=mock`) accepts `Authorization: Bearer
 * mock:<role>:<subject>`, with the role one of `registered|verified|staff|admin` and the subject
 * `[A-Za-z0-9._-]{1,64}`. This provider composes that credential from the typed email and the
 * role chosen on screen, and the API verifies it like any other: `GET me` still decides who this
 * is, and a resident's role is still refused. It is a credential presented to the API, not a
 * local identity — there is no path here that produces a signed-in user without the API's answer.
 *
 * The role is recorded only the first time a subject reaches the API; after that the API's own
 * record wins, and an administrator changes it with `PATCH /admin/users/{id}/role`. The screen says
 * so, because "I chose admin and I am staff" is otherwise a mystery.
 *
 * The password is not read. No token literal is committed: every credential is composed at run time
 * from what was typed.
 */
@Injectable({ providedIn: 'root' })
export class IdentityProvider implements IdentityPort {
  signIn(credentials: SignInCredentials): Observable<IdentitySignIn> {
    return defer(() => {
      const subject = developmentSubject(credentials.email);

      if (subject === null) {
        return throwError(() => invalidCredentials());
      }

      // Least privilege when nothing was chosen.
      const role = credentials.developmentRoleClaim ?? 'staff';
      const grant: IdentityGrant = { idToken: `mock:${role}:${subject}`, expiresAt: null };

      return of<IdentitySignIn>({ kind: 'signed-in', grant });
    });
  }

  finalizeMfa(): Observable<never> {
    return throwError(
      () => new SignInError('unavailable', 'The development verifier has no second factor. Sign in again.'),
    );
  }

  /** Never asked: a development credential has no expiry, and a `null` expiry is never refreshed. */
  refresh(): Observable<never> {
    return throwError(
      () => new SignInError('unavailable', 'A development credential cannot be renewed. Sign in again.'),
    );
  }

  forget(): void {
    // Nothing is kept here: the composed credential went to the staff adapter, and there is no
    // refresh token in development.
  }
}

/**
 * The subject the development credential names: the email lower-cased, `@` read as `.`, anything
 * outside the backend's `[A-Za-z0-9._-]` dropped, cut to 64. `null` when nothing is left.
 */
export function developmentSubject(email: string): string | null {
  const subject = email
    .trim()
    .toLowerCase()
    .replace(/@/g, '.')
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 64);

  return subject === '' ? null : subject;
}

/** Bound to `SIGN_IN_METHOD` by the HTTP adapter set, in place of the Firebase one. */
export function identitySignInMethod(): SignInMethod {
  return {
    kind: 'development-verifier',
    roleClaims: ['staff', 'admin'],
    explanation: [
      'Development mock verifier: this build signs in to a local API that accepts development ' +
        'credentials. Nothing checks the password — it is not sent anywhere.',
      'The role you choose is recorded only the first time this email address reaches the API. ' +
        'After that the API keeps the role it already holds, and only an administrator can change it.',
    ],
  };
}
