import { describeFailure, isApiFailure } from '@core/http/api-failure';

/**
 * Whether a refused referral act has already been said, in the server's words, by the HTTP layer.
 *
 * The interceptor says every refusal but a validation failure itself — a validation failure is the
 * form's to say, beside what was typed. Saying "That could not be saved" over a sentence the server
 * already gave is saying less, twice (`DL-185`).
 */
export function saidByTheHttpLayer(failure: unknown): boolean {
  return isApiFailure(failure) && failure.status !== 422 && failure.code !== 'VALIDATION_FAILED';
}

/**
 * The server's own sentence for a refusal — its field messages, where the error envelope carries
 * them — or the console's, for a failure raised here. `undefined` when there is nothing more to say
 * than the screen's own heading.
 */
export function failureDetail(failure: unknown): string | undefined {
  if (isApiFailure(failure)) {
    return describeFailure(failure);
  }
  return failure instanceof Error ? failure.message : undefined;
}
