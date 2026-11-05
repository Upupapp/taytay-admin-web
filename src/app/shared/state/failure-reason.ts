/**
 * The sentence a refusal carries — an `Error` from a mock adapter, an `ApiFailure` from the HTTP
 * error interceptor — or `null` when it carries none.
 *
 * Only ever the server's or the adapter's own words, which name no record field: a screen that says
 * why an act was not done must not repeat what was being sent, because that is often what a
 * resident wrote (`DL-167`, `DL-168`).
 */
export function failureReason(failure: unknown): string | null {
  const message: unknown =
    failure !== null && typeof failure === 'object' ? Reflect.get(failure, 'message') : undefined;
  return typeof message === 'string' && message.trim() !== '' ? message : null;
}
