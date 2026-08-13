import { InjectionToken } from '@angular/core';

import type { AppEnvironment } from '@env/environment.model';

/**
 * Environment values are consumed through this token, never by importing
 * `environments/environment` from feature code. That keeps components testable
 * (override the token) and keeps build-time file replacement in one place.
 */
export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('AppEnvironment');
