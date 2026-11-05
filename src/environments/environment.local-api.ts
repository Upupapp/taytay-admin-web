import type { AppEnvironment } from './environment.model';

/**
 * **local-api** — development against a backend running on this machine.
 *
 * The environment that catches what the mock cannot: real pagination shapes, real error envelopes,
 * real permission refusals. The Node API listens on port 3000: in `taytay-backend`,
 * `docker compose up -d --wait`, `npm run migrate`, then `npm run dev`.
 */
export const environment: AppEnvironment = {
  name: 'local-api',
  production: false,
  appName: 'Taytay Social Welfare',
  apiBaseUrl: 'http://localhost:3000/api/v1',
  dataSource: 'http',
  mockLatencyMs: 0,
  enableDevTools: true,
};
