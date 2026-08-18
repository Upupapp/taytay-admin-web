import type { AppEnvironment } from './environment.model';

/**
 * Default (production) environment.
 *
 * `apiBaseUrl` is an **absolute origin plus `/api/v1`**. The relative `/api`
 * this file used to carry assumed the console and the API share an origin; the
 * topology is cross-origin by design — `admin.<domain>` calling `api.<domain>`
 * (ADR 0004) — so a relative path resolved against the static host and every
 * call 404'd before it reached Laravel.
 *
 * The placeholder domain is deliberate: a real hostname is a deployment fact,
 * and TAB 12 owns the environment matrix that supplies it and fails the build
 * when a production configuration still points at a placeholder, at `localhost`,
 * or at mock data.
 *
 * `dataSource` is still `'mock'`. TAB 01 settles the envelope; the adapters are
 * repointed in TAB 05 and the flag is flipped, per environment, in TAB 12.
 * Flipping it before the adapters are repointed would 404 every screen.
 */
export const environment: AppEnvironment = {
  production: true,
  appName: 'Taytay Social Welfare',
  apiBaseUrl: 'https://api.<approved-domain>/api/v1',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};
