import type { AppEnvironment } from './environment.model';

/**
 * **staging** — the real thing, against synthetic data.
 *
 * Its API host is deliberately distinct from production's. A staging build that could reach
 * production is a staging build that will eventually write to it, and the failure would look like
 * a data-entry mistake rather than a deployment one.
 */
export const environment: AppEnvironment = {
  name: 'staging',
  production: false,
  appName: 'Taytay Social Welfare (staging)',
  apiBaseUrl: 'https://api-staging.<approved-domain>/api/v1',
  dataSource: 'http',
  mockLatencyMs: 0,
  // On in staging on purpose: this is where a developer needs the detail a caseworker must never
  // see, and the data here is synthetic.
  enableDevTools: true,
};
