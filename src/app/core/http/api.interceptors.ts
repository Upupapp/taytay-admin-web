import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { NotificationStore } from '../notifications/notification.store';

/**
 * Adds the headers every API call needs. Credentials travel in an
 * HTTP-only cookie set by the API, so no token is read or stored here —
 * see the "Secrets and credentials" rule in CLAUDE.md.
 */
export const apiHeadersInterceptor: HttpInterceptorFn = (request, next) =>
  next(
    request.clone({
      setHeaders: { Accept: 'application/json' },
      withCredentials: true,
    }),
  );

/**
 * Turns transport failures into one user-visible message and one navigation
 * decision, so no feature has to hand-roll error handling.
 */
export const httpErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const notifications = inject(NotificationStore);
  const router = inject(Router);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          void router.navigate(['/sign-in']);
        } else if (error.status === 403) {
          void router.navigate(['/forbidden']);
        } else {
          notifications.error('Request failed', describeHttpError(error));
        }
      }
      return throwError(() => error);
    }),
  );
};

function describeHttpError(error: HttpErrorResponse): string {
  const body: unknown = error.error;
  if (body !== null && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  if (error.status === 0) {
    return 'The server could not be reached. Check the network connection.';
  }
  return `The server responded with ${error.status} ${error.statusText}.`;
}
