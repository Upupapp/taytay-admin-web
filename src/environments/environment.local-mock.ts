import type { AppEnvironment } from './environment.model';

/**
 * **local-mock** — development against in-memory adapters, no backend running.
 *
 * Kept deliberately (`DL-136`). It is the offline path and the fast feature-test double, and
 * deleting it to "force realism" would mean every UI change needed a database, a seeded registry
 * and a running API. What it must never be is *selectable by a production build*, which is what
 * `check:environments` enforces.
 */
export const environment: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Taytay Social Welfare',
  // Present but unused while `dataSource` is `mock`. Kept accurate so switching one field is all
  // it takes to become `local-api`.
  apiBaseUrl: 'http://localhost:8000/api/v1',
  dataSource: 'mock',
  mockLatencyMs: 250,
  enableDevTools: true,
};
