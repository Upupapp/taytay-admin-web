import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { RETURN_URL_PARAM } from '../access/access.guards';
import { APP_ENVIRONMENT } from '../config/app-environment.token';

import { readApiError, type ApiFailure } from './api-failure';
import { AuthTokenHolder } from '../auth/auth-token.holder';
import { SESSION_REFRESHER } from '../auth/session-refresher';
import { SessionStore } from '../auth/session.store';
import { NotificationStore } from '../notifications/notification.store';

/**
 * How close to its expiry a token is renewed rather than sent. A minute covers a request that
 * leaves now and is verified a few seconds later, on a server whose clock is not this one's.
 */
export const REFRESH_MARGIN_MS = 60_000;

/**
 * The headers an API call carries — and only an API call.
 *
 * This used to decorate **every** request `HttpClient` made, so the bearer token would have gone
 * to whatever origin a request named: an asset host, a map tile server, the identity provider the
 * next change signs in through. A credential is attached where it is meant to be read and nowhere
 * else, so the decision is made on the URL — the API's base, followed by a path separator, so that
 * `https://api.example.ph.attacker.test` and `…/api/v1evil` are not mistaken for it.
 *
 * `withCredentials: true` used to be set here as well, and it was the single most expensive line
 * in the console. The API authenticates with a bearer token and its CORS policy sends no
 * `Access-Control-Allow-Credentials`, so a credentialed request is refused **by the browser**: a
 * status `0`, nothing for an interceptor to handle, only a message in the developer console. It is
 * removed rather than made conditional — there is no configuration in which it is correct against
 * this API, and the fix is never to widen the server.
 *
 * `X-Client-Channel` is telemetry and presentation default only, never authority. It is one of the
 * four headers the API's CORS policy allows; any header outside that list fails the preflight of
 * every request that carries it (`check:contract`).
 *
 * The bearer token comes from `AuthTokenHolder`, which keeps it in a private field and exposes no
 * getter. This interceptor never reads, stores or logs the token itself — it asks for a header and
 * attaches whatever it is given. The identity provider's own calls to Google never pass through
 * here at all: they go out on the bare `HttpBackend` (`DL-166`).
 */
export const apiHeadersInterceptor: HttpInterceptorFn = (request, next) => {
  const base = inject(APP_ENVIRONMENT).apiBaseUrl.replace(/\/+$/, '');

  if (request.url !== base && !request.url.startsWith(`${base}/`)) {
    return next(request);
  }

  const tokens = inject(AuthTokenHolder);
  const refresher = inject(SESSION_REFRESHER, { optional: true });

  // Read when the request leaves, not when the interceptor ran: after a renewal the header must
  // carry the new token, never the one that prompted it.
  const decorated = (): HttpRequest<unknown> =>
    request.clone({
      setHeaders: {
        Accept: 'application/json',
        'X-Client-Channel': 'admin-console',
        ...tokens.authorization(),
      },
    });

  /*
   * A token about to lapse is renewed first, on demand (`DL-166`): no timer, nothing in the
   * background (`DL-118`). Every request that finds it near expiry awaits the same renewal.
   *
   * When it cannot be renewed the session is over, and this request is **not sent** — sent with a
   * dying token it would be refused, and sent without one it would be an unauthenticated request
   * the API can only refuse. It fails as the API's own 401 would, and leaves for sign-in the same
   * way, with the current screen as the return address.
   */
  if (refresher === null || !tokens.expiresWithin(REFRESH_MARGIN_MS)) {
    return next(decorated());
  }

  const session = inject(SessionStore);
  const router = inject(Router);

  return refresher.refresh().pipe(
    catchError(() => {
      returnToSignIn(session, router);
      return throwError(() => SESSION_LAPSED);
    }),
    switchMap(() => next(decorated())),
  );
};

/** What a request refused before it left says: the API's own code for it, and no request id. */
const SESSION_LAPSED: ApiFailure = {
  code: 'UNAUTHENTICATED',
  status: 401,
  message: 'Your session has ended and could not be renewed. Sign in again to continue.',
  details: null,
  requestId: null,
  retryAfterSeconds: null,
};

/**
 * Ends the session locally and goes to sign-in, carrying the current URL so the user comes back
 * to the screen they were on. Local only: `signOut()` would call `POST auth/sign-out` with a
 * credential that no longer works.
 */
function returnToSignIn(session: SessionStore, router: Router): void {
  session.endExpiredSession();
  void router.navigate(['/sign-in'], {
    queryParams: { [RETURN_URL_PARAM]: router.url },
  });
}

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
       * an error page from something in front of the API, still has to send the
       * user somewhere sensible.
       */
      switch (failure.code ?? codeFromStatus(failure.status)) {
        case 'UNAUTHENTICATED':
          /*
           * The token is gone or the server refused it. End the session
           * locally without a round-trip: `signOut()` would call
           * `POST auth/sign-out` with the credential that was just rejected,
           * and answer 401 again.
           *
           * The current URL is carried so the user comes back to the screen
           * they were on rather than the dashboard. What it does **not** yet
           * carry is unsaved work — see the deferred item in TAB 02's report.
           */
          returnToSignIn(session, router);
          break;

        case 'FORBIDDEN':
          void router.navigate(['/forbidden']);
          break;

        case 'VALIDATION_FAILED':
          // The form owns this one: it renders `details` beside the fields.
          // A toast as well would say the same thing twice, less usefully.
          break;

        // `INVALID_STATE_TRANSITION` had its own warning here. The Node API
        // never sends it — a refused transition there is a `CONFLICT`, which
        // is also what a closed account receives on every write — so the case
        // is gone rather than kept for a code that cannot arrive.

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
