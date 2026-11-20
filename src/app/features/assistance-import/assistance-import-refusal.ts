import { isApiFailure } from '@core/http/api-failure';

/**
 * The server's own sentences beside a refusal (`DL-228`) — what a record would lack, which column is
 * taken — flattened into lines under the refusal. Never a code, and never a field name on its own.
 */
export function refusalLines(failure: unknown): readonly string[] {
  if (!isApiFailure(failure) || failure.details === null) return [];
  return Object.values(failure.details).flat();
}
