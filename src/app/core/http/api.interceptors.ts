import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { RETURN_URL_PARAM } from '../access/access.guards';

import { readApiError, type ApiFailure } from './api-failure';
import { AuthTokenHolder } from '../auth/auth-token.holder';
import { SessionStore } from '../auth/session.store';
import { NotificationStore } from '../notifications/notification.store';

/**
 * The headers every API call carries.
 *
 * `withCredentials: true` used to be set here, and it was the single most
 * expensive line in the console. The API authenticates with a first-party
 * bearer token and sets `supports_credentials => false` (ADR 0005, ADR 0006),
 * so a credentialed request against an origin that does not answer
 * `Access-Control-Allow-Credentials` is refused **by the browser**. That is a
 * CORS failure, not a `401`: nothing reaches this application to be handled, no
 * interceptor sees a status, and the only symptom is a console message. It is
 * removed rather than made conditional — there is no configuration in which it
 * is correct against this API.
 *
 * The fix is never to widen the server. Enabling `supports_credentials`,
 * widening CORS or turning on Sanctum stateful domains would each make the
 * request succeed and each was refused deliberately.
 *
 * `X-Client-Channel` is telemetry and presentation default only, never
 * authority (`conventions.md` §2, backend constitution Article 3.3). Sending it
 * grants nothing; not sending it recorded every staff request as an unknown
 * channel, which is a gap in the audit trail rather than a cosmetic one.
 *
 * The bearer token comes from `AuthTokenHolder`, which keeps it in a private
 * field and exposes no getter. This interceptor never reads, stores or logs the
 * token itself — it asks for a header and attaches whatever it is given.
 */
export const apiHeadersInterceptor: HttpInterceptorFn = (request, next) => {
  const tokens = inject(AuthTokenHolder);

  return next(
    request.clone({
      setHeaders: {
        Accept: 'application/json',
        'X-Client-Channel': 'admin-console',
        ...tokens.authorization(),
      },
    }),
  );
};

/**
 * Turns a failure into one user-visible message and one navigation decision, so
 * no feature has to hand-roll error handling.
 *
 * What changed in TAB 01: this reads the envelope the API actually sends.
 * It previously looked for `{ message }`, which this API has never returned —
 * so every failure fell through to "The server responded with 422", the
 * field-level `details` a form needed were dropped on the floor, and the
 * `request_id` a caseworker would quote to a support desk was never shown.
 *
 * The parsed failure is rethrown in place of the raw `HttpErrorResponse` so a
 * form can read `details` without re-parsing the body, and so nothing
 * downstream has to know the wire shape.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const notifications = inject(NotificationStore);
  const router = inject(Router);
  const session = inject(SessionStore);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      const failure = readApiError(error);

      /*
       * Branch on `code`, never on `message` — the message is written for
       * operators and may be reworded at any time (`conventions.md` §4).
       *
       * The status is the fallback rather than the primary, and only where the
       * envelope is missing: a refusal that never reached the application, or
       * an error page from something in front of Laravel, still has to send the
       * user somewhere sensible.
       */
      switch (failure.code ?? codeFromStatus(failure.status)) {
        case 'UNAUTHENTICATED':
          /*
           * The token is gone or the server refused it. End the session
           * locally without a round-trip: `signOut()` would call
           * `DELETE auth/tokens/current` with the credential that was just
           * rejected, and answer 401 again.
           *
           * The current URL is carried so the user comes back to the screen
           * they were on rather than the dashboard. What it does **not** yet
           * carry is unsaved work — see the deferred item in TAB 02's report.
           */
          session.endExpiredSession();
          void router.navigate(['/sign-in'], {
            queryParams: { [RETURN_URL_PARAM]: router.url },
          });
          break;

        case 'FORBIDDEN':
          void router.navigate(['/forbidden']);
          break;

        case 'VALIDATION_FAILED':
          // The form owns this one: it renders `details` beside the fields.
          // A toast as well would say the same thing twice, less usefully.
          break;

        case 'INVALID_STATE_TRANSITION':
          // A domain outcome, not a transport fault. Somebody else moved the
          // record on while this screen was open, and the user needs to be
          // told what happened rather than that "the server responded with
          // 409".
          notifications.warning('That change no longer applies', describeFailure(failure));
          break;

        case 'RATE_LIMITED':
          notifications.warning('Too many requests', describeFailure(failure));
          break;

        default:
          notifications.error('Request failed', describeFailure(failure));
      }

      return throwError(() => failure);
    }),
  );
};

/**
 * Only for a response that carried no envelope. Anything richer would be
 * guessing at a body that was never sent.
 */
function codeFromStatus(status: number): string | null {
  switch (status) {
    case 401:
      return 'UNAUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    default:
      return null;
  }
}

/**
 * One sentence a caseworker can act on, plus the id they would be asked for.
 */
function describeFailure(failure: ApiFailure): string {
  const parts = [failure.message];

  if (failure.code === 'RATE_LIMITED' && failure.retryAfterSeconds !== null) {
    parts.push(`Try again in ${failure.retryAfterSeconds} seconds.`);
  }

  if (failure.requestId !== null) {
    parts.push(`Reference ${failure.requestId}.`);
  }

  return parts.join(' ');
}
