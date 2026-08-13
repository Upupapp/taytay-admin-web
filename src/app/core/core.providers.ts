import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ErrorHandler,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { provideDataAccess } from '@data/data-access.providers';
import type { AppEnvironment } from '@env/environment.model';

import { SessionStore } from './auth/session.store';
import { APP_ENVIRONMENT } from './config/app-environment.token';
import { GlobalErrorHandler } from './errors/global-error-handler';
import { apiHeadersInterceptor, httpErrorInterceptor } from './http/api.interceptors';
import { NotificationStore } from './notifications/notification.store';

/**
 * Everything the application shell needs before the first route renders.
 *
 * Composition happens here and nowhere else: features receive their
 * dependencies through domain tokens and never register providers of their own
 * for cross-cutting concerns.
 */
export function provideCore(environment: AppEnvironment): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: APP_ENVIRONMENT, useValue: environment },
    provideHttpClient(withInterceptors([apiHeadersInterceptor, httpErrorInterceptor])),
    provideDataAccess(environment),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(async () => {
      const session = inject(SessionStore);
      const notifications = inject(NotificationStore);
      // Resolve the session before the first guard runs, so route guards can
      // stay synchronous and never flash a redirect.
      await firstValueFrom(session.load());
      if (session.isAuthenticated()) {
        notifications.refresh();
      }
    }),
  ]);
}
