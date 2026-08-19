import type { AppEnvironment } from './environment.model';

/**
 * **local-api** — development against a backend running on this machine.
 *
 * The environment that catches what the mock cannot: real pagination shapes, real error envelopes,
 * real permission refusals. `tools/local-api.sh` in the backend repository stands the API up.
 */
export const environment: AppEnvironment = {
  name: 'local-api',
  production: false,
  appName: 'Taytay Social Welfare',
  apiBaseUrl: 'http://localhost:8000/api/v1',
  dataSource: 'http',
  mockLatencyMs: 0,
  enableDevTools: true,
};
