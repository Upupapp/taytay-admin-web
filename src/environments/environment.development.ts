import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  appName: 'Taytay Social Welfare',
  /** The version lives in the path, never in a header (`conventions.md` §1). */
  apiBaseUrl: 'http://localhost:8000/api/v1',
  dataSource: 'mock',
  mockLatencyMs: 250,
  enableDevTools: true,
};
