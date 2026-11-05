import { InjectionToken } from '@angular/core';

import type { SignInMethod } from '../access/credentials';

/**
 * How this build signs somebody in (`DL-166`).
 *
 * Defaults to `password`, which is what the mock adapter set offers: it is bound explicitly only
 * by the HTTP adapter set, where the answer depends on which identity provider `angular.json`
 * swapped in and whether a key was supplied for this environment.
 */
export const SIGN_IN_METHOD = new InjectionToken<SignInMethod>('SignInMethod', {
  providedIn: 'root',
  factory: (): SignInMethod => ({ kind: 'password' }),
});
