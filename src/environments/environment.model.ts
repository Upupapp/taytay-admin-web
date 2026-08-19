/** Which repository adapter set is wired into the injector at bootstrap. */
export type DataSourceKind = 'mock' | 'http';

/** Which of the four configurations this bundle was built from. */
export type EnvironmentName = 'local-mock' | 'local-api' | 'staging' | 'production';

export interface AppEnvironment {
  /**
   * Named so a bundle can say what it is.
   *
   * `production: boolean` alone cannot distinguish `local-mock` from `local-api`, or `staging`
   * from `production` — and "which build is this?" is the first question asked when something is
   * wrong in an environment nobody can attach a debugger to.
   */
  readonly name: EnvironmentName;
  readonly production: boolean;
  readonly appName: string;
  readonly apiBaseUrl: string;
  readonly dataSource: DataSourceKind;
  /** Artificial delay applied by mock repositories so loading states are exercised. */
  readonly mockLatencyMs: number;
  readonly enableDevTools: boolean;
}
