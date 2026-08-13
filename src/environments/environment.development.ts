import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
  production: false,
  appName: 'Taytay Social Welfare',
  apiBaseUrl: 'http://localhost:8000/api',
  dataSource: 'mock',
  mockLatencyMs: 250,
  enableDevTools: true,
};
