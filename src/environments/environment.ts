import type { AppEnvironment } from './environment.model';

/**
 * Default (production) environment.
 *
 * `dataSource` is deliberately still `'mock'`: this workspace has no backend yet.
 * Flipping it to `'http'` is the *only* change required once the API exists —
 * no component, route or feature file references mock data directly.
 */
export const environment: AppEnvironment = {
  production: true,
  appName: 'Taytay Social Welfare',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};
