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
  apiBaseUrl: 'https://taytay-api.139-162-51-165.sslip.io/api/v1',
  dataSource: 'http',
  // The browser API key of the staging Firebase project `taytay-lgu-ids-staging`, never
  // production's (`DL-169`). It is public client configuration, not a secret: it ships in every
  // browser that loads the console, and what protects an account is Firebase's own checks plus the
  // API verifying each ID token.
  firebaseWebApiKey: 'AIzaSyDY7x3dvT_R6bAEG-Xd1-L8YpeumYIORZk',
  mockLatencyMs: 0,
  // On in staging on purpose: this is where a developer needs the detail a caseworker must never
  // see, and the data here is synthetic.
  enableDevTools: true,
};
