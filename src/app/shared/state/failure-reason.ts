import { describeFailure, isApiFailure } from '@core/http/api-failure';

/**
 * The sentence a refusal carries — an `Error` from a mock adapter, an `ApiFailure` from the HTTP
 * error interceptor — or `null` when it carries none.
 *
 * Only ever the server's or the adapter's own words, which name no record field: a screen that says
 * why an act was not done must not repeat what was being sent, because that is often what a
 * resident wrote (`DL-167`, `DL-168`).
 *
 * A validation refusal says which field and what is wrong with it, in the API's own sentences
 * (`describeFailure`): its envelope's "The request could not be validated" named nothing, so a form
 * with one field too long could not be put right (flow audit 5, `DL-290`). The API's sentences name
 * the rule, never the value sent.
 */
export function failureReason(failure: unknown): string | null {
  if (
    isApiFailure(failure) &&
    failure.code === 'VALIDATION_FAILED' &&
    Object.keys(failure.details ?? {}).length > 0
  ) {
    return describeFailure(failure);
  }
  const message: unknown =
    failure !== null && typeof failure === 'object' ? Reflect.get(failure, 'message') : undefined;
  return typeof message === 'string' && message.trim() !== '' ? message : null;
}
