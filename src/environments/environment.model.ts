/** Which repository adapter set is wired into the injector at bootstrap. */
export type DataSourceKind = 'mock' | 'http';

export interface AppEnvironment {
  readonly production: boolean;
  readonly appName: string;
  readonly apiBaseUrl: string;
  readonly dataSource: DataSourceKind;
  /** Artificial delay applied by mock repositories so loading states are exercised. */
  readonly mockLatencyMs: number;
  readonly enableDevTools: boolean;
}
