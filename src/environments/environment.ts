import type { AppEnvironment } from './environment.model';

/**
 * **production**.
 *
 * ── THIS FILE USED TO SAY `dataSource: 'mock'` ───────────────────────────────────────
 *
 * A production configuration pointing at mock data, which is the exact combination TAB 12 names
 * as having shipped once already. Nothing failed, because nothing checked: the build succeeded,
 * the bundle was valid, and the application served invented residents to whoever opened it.
 *
 * `check:environments` now fails the build on it, which is why this file can no longer be wrong
 * quietly.
 */
export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  appName: 'Taytay Social Welfare',
  apiBaseUrl: 'https://api.<approved-domain>/api/v1',
  dataSource: 'http',
  // No key has been supplied for the production Firebase project. Until a person supplies one, the
  // console says sign-in is not configured and sends nothing (`DL-166`).
  firebaseWebApiKey: null,
  mockLatencyMs: 0,
  enableDevTools: false,
};
