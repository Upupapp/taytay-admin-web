import { ErrorHandler, inject, Injectable } from '@angular/core';

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
    this.notifications.error(
      'Something went wrong',
      'The action could not be completed. Please try again, and report this if it keeps happening.',
    );
  }
}
