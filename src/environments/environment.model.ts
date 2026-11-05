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
  /**
   * The Firebase project's **Web API key**, or `null` when none has been supplied for this build.
   *
   * A public identifier, not a secret: it names the Firebase project to Google's sign-in endpoints
   * and ships in every browser that opens the console, as it does in every Firebase web app. What
   * protects an account is the password and the API's verification of the ID token, never the
   * secrecy of this value. Its exposure is limited by restricting the key in Google Cloud to the
   * console's origins and to the Identity Toolkit and Token Service APIs — a manual step on the
   * deployment checklist (`DL-166`).
   *
   * `check:environments` classifies this one field by name and shape, so a credential is never let
   * through by a field name the credential rule happens to miss. Staging and production must name
   * **different** projects: a staging console signing into production identities is a staging
   * console holding production credentials.
   *
   * While it is `null`, the HTTP configuration says sign-in is not configured and sends nothing.
   */
  readonly firebaseWebApiKey: string | null;
  /** Artificial delay applied by mock repositories so loading states are exercised. */
  readonly mockLatencyMs: number;
  readonly enableDevTools: boolean;
}
