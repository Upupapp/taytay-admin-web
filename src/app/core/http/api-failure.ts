import type { HttpErrorResponse } from '@angular/common/http';

/** `field -> [messages]`, ready for a form to render beside its inputs. */
export type ApiFieldErrors = Readonly<Record<string, readonly string[]>>;

/**
 * A failure, in the application's own terms.
 *
 * The API's error envelope is `{ error: { code, message, details, request_id } }`
 * and this is the only place it is read. Everything downstream — the
 * interceptor, a form rendering field errors, a screen explaining a refusal —
 * works from this shape, so no feature has to know what the wire looks like and
 * nothing has to parse the body twice.
 *
 * Kept in `core/http` beside the interceptor rather than in `data/http`: it is
 * not a wire type, it is what the wire has already been translated into, and
 * `core` is where the transport concerns of the whole application live. The
 * field-error shape is redeclared here rather than imported from
 * `data/http/api.contract`, because `core` does not depend on an adapter
 * (CLAUDE.md §4) — the two are the same shape for the same reason a translation
 * and its original are, not because one is derived from the other.
 */
export interface ApiFailure {
  /**
   * The API's stable machine-readable code, or `null` when the response never
   * reached the application — a CORS refusal, a dropped connection, a proxy
   * rejecting a body before Laravel saw it. Angular reports all of those as
   * status `0`, and they are genuinely different from a server that answered.
   */
  readonly code: string | null;
  readonly status: number;
  /** Safe to show. Never contains SQL, a stack trace or personal data. */
  readonly message: string;
  /** `field -> [messages]`, for a form to render beside its inputs. */
  readonly details: ApiFieldErrors | null;
  /** Matches the `X-Request-Id` header. What a caseworker quotes to support. */
  readonly requestId: string | null;
  /** Present on a `429`, read from `Retry-After`. */
  readonly retryAfterSeconds: number | null;
}

/**
 * Reads the API's error envelope out of an Angular transport error.
 *
 * Deliberately total: an unrecognised body, an HTML error page from a proxy, or
 * no body at all must produce a usable `ApiFailure` rather than throw inside an
 * error handler. A parser that can fail while explaining a failure turns one
 * broken screen into a blank one.
 */
export function readApiError(error: HttpErrorResponse): ApiFailure {
  const envelope = readEnvelope(error.error);

  return {
    code: envelope?.code ?? null,
    status: error.status,
    message: envelope?.message ?? fallbackMessage(error),
    details: envelope?.details ?? null,
    requestId: envelope?.request_id ?? error.headers.get('X-Request-Id'),
    retryAfterSeconds: readRetryAfter(error),
  };
}

interface WireError {
  readonly code: string;
  readonly message: string;
  readonly details?: ApiFieldErrors;
  readonly request_id?: string;
}

function readEnvelope(body: unknown): WireError | null {
  if (body === null || typeof body !== 'object' || !('error' in body)) {
    return null;
  }

  const error: unknown = (body as { error: unknown }).error;

  if (error === null || typeof error !== 'object') {
    return null;
  }

  const code: unknown = (error as { code?: unknown }).code;
  const message: unknown = (error as { message?: unknown }).message;

  if (typeof code !== 'string' || typeof message !== 'string') {
    return null;
  }

  const details: unknown = (error as { details?: unknown }).details;
  const requestId: unknown = (error as { request_id?: unknown }).request_id;

  return {
    code,
    message,
    details: isDetails(details) ? details : undefined,
    request_id: typeof requestId === 'string' ? requestId : undefined,
  };
}

function isDetails(value: unknown): value is ApiFieldErrors {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  return Object.values(value).every(
    (messages) => Array.isArray(messages) && messages.every((m) => typeof m === 'string'),
  );
}

/**
 * Status `0` is the one worth spelling out. It means the response never arrived
 * — a refused cross-origin request, a dropped connection, or a proxy rejecting
 * an over-large upload before the application could answer. "The server could
 * not be reached" is true of all three and is what the user can act on; TAB 09
 * makes the upload case say something more specific, because there the user can
 * do something about it.
 */
function fallbackMessage(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'The server could not be reached. Check the network connection.';
  }

  return `The request failed (${error.status} ${error.statusText}).`;
}

function readRetryAfter(error: HttpErrorResponse): number | null {
  const header = error.headers.get('Retry-After');

  if (header === null) {
    return null;
  }

  const seconds = Number(header);

  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Turns a failure into a sentence a caseworker can act on.
 *
 * `TAB 16` step 8: *"The server responded with 422 tells a caseworker nothing. It should name the
 * field, say what is wrong, and say what to do — assembled from the API's [details], which TAB 01
 * made available."*
 *
 * TAB 01 made `details` available and **nothing ever read it**. A validation failure showed the
 * envelope's generic sentence, so a form with one bad field said only that something was wrong,
 * on a screen with fourteen inputs.
 *
 * ## What it will not do
 *
 * It does not invent guidance. The API's messages are written for a person and are used verbatim;
 * this only assembles them and names the field they belong to. A layer that rephrased them would
 * be a second description of every validation rule in the system, drifting from the one that
 * actually refuses.
 *
 * Field names are humanised (`street_address` → "Street address") because the wire name is the
 * server's vocabulary, not the office's — but the *message* stays the server's, because that is
 * the sentence somebody wrote about that rule.
 */
export function describeFailure(failure: ApiFailure): string {
  const fields = Object.entries(failure.details ?? {});

  if (fields.length === 0) {
    return failure.message;
  }

  return fields
    .map(([field, messages]) => `${humaniseField(field)}: ${messages.join(' ')}`)
    .join('\n');
}

/**
 * `acknowledged_by_name` → `Acknowledged by name`.
 *
 * Deliberately mechanical rather than a lookup table. A table of nice names for every field in the
 * system is a table that goes stale silently — a renamed field keeps its old label and nobody
 * notices, because the label still reads fine.
 */
function humaniseField(field: string): string {
  const words = field.replace(/[._]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}
