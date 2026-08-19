import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, inject, Injectable } from '@angular/core';

import { describeFailure, readApiError } from '@core/http/api-failure';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import { NotificationStore } from '../notifications/notification.store';

/**
 * Last-resort handler. Uncaught errors become one visible, non-technical
 * message; the detail goes to the console only outside production so a
 * beneficiary's data can never leak through a stack trace on screen.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly notifications = inject(NotificationStore);
  private readonly environment = inject(APP_ENVIRONMENT);

  handleError(error: unknown): void {
    if (!this.environment.production) {
      console.error(error);
    }

    this.notifications.error('Something went wrong', this.describe(error));
  }

  /**
   * The message a caseworker reads, and — where there is one — the reference that leads to the
   * server-side trace.
   *
   * `TAB 15` step 9: *"The API returns X-Request-Id on every response; log it in the console's
   * error reporting so a caseworker's screenshot leads directly to the server-side trace and the
   * audit entry."*
   *
   * It has to be **on the screen**, not in a log. This console ships no telemetry — nothing is
   * sent to an analytics property or a crash reporter, deliberately — so the only artefact that
   * travels from a caseworker to whoever can help is a screenshot or a sentence read down a
   * phone. A reference that lives anywhere else does not survive that trip.
   *
   * The id itself is opaque: a correlation handle, carrying no name, no case and nothing about a
   * resident. That is what makes it safe to put on screen at all.
   */
  private describe(error: unknown): string {
    const base =
      'The action could not be completed. Please try again, and report this if it keeps happening.';

    if (!(error instanceof HttpErrorResponse)) {
      return base;
    }

    const failure = readApiError(error);

    /*
     * A validation failure names its fields. `describeFailure` assembles the API's own per-field
     * messages, so a form with one bad field says which one rather than saying that something,
     * somewhere, was wrong.
     */
    const described = describeFailure(failure);
    const body = described === failure.message ? base : described;

    return failure.requestId === null ? body : `${body} Quote reference ${failure.requestId}.`;
  }
}
