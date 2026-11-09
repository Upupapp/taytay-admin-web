import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { isNotFound, readApiError } from './api-failure';

/*
 * Written out rather than imported from `data/http/fixtures`, because `core` does not reach into an
 * adapter (CLAUDE.md §4). The same bodies are held to the vendored spec in `fixtures.spec.ts`.
 */
const RATE_LIMITED = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Try again shortly.',
    details: { retry_after: 42 },
    request_id: 'req-fixture-0001',
  },
};

const VALIDATION_FAILED = {
  error: {
    code: 'VALIDATION_FAILED',
    message: 'The request could not be validated.',
    details: { name: ['String must contain at least 1 character(s)'] },
    request_id: 'req-fixture-0002',
  },
};

const CODE_LOCKED = {
  error: {
    code: 'code_locked',
    message: 'That code is locked.',
    details: { attempts_remaining: 0, retry_after: 900 },
    request_id: 'req-fixture-0003',
  },
};

/**
 * The console previously looked for `{ message }`, which this API has never
 * sent. Every failure therefore rendered "The server responded with 422", the
 * field-level detail a form needed was dropped, and the `request_id` a
 * caseworker would be asked to quote was never shown.
 */

function errorResponse(body: unknown, status = 422, headers = new HttpHeaders()) {
  return new HttpErrorResponse({ error: body, status, statusText: 'Unprocessable Content', headers });
}

describe('readApiError', () => {
  it('reads the envelope the API actually sends', () => {
    const failure = readApiError(
      errorResponse({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The given data was invalid.',
          details: { email: ['The email field is required.'] },
          request_id: '01JBEXAMPLE',
        },
      }),
    );

    expect(failure.code).toBe('VALIDATION_FAILED');
    expect(failure.message).toBe('The given data was invalid.');
    expect(failure.details).toEqual({ email: ['The email field is required.'] });
    expect(failure.requestId).toBe('01JBEXAMPLE');
  });

  it('keeps field details, so a form can render them beside its inputs', () => {
    const failure = readApiError(
      errorResponse({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The given data was invalid.',
          details: { 'household.members': ['At least one member is required.'] },
        },
      }),
    );

    expect(failure.details?.['household.members']).toEqual(['At least one member is required.']);
  });

  it('falls back to the X-Request-Id header when the body carries no id', () => {
    const failure = readApiError(
      errorResponse(
        { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } },
        500,
        new HttpHeaders({ 'X-Request-Id': '01JBHEADER' }),
      ),
    );

    expect(failure.requestId).toBe('01JBHEADER');
  });

  it('falls back to Retry-After when a same-origin proxy answers without an envelope', () => {
    const failure = readApiError(
      errorResponse(
        '<html>429 Too Many Requests</html>',
        429,
        new HttpHeaders({ 'Retry-After': '30' }),
      ),
    );

    expect(failure.code).toBeNull();
    expect(failure.retryAfterSeconds).toBe(30);
  });

  /**
   * Across origins the browser hides `Retry-After` — the API exposes only `X-Request-Id` — so the
   * wait has to come from the envelope, or a throttled officer is never told how long.
   */
  it('reads the wait from details.retry_after, which a browser can see', () => {
    const failure = readApiError(errorResponse(RATE_LIMITED, 429));

    expect(failure.code).toBe('RATE_LIMITED');
    expect(failure.retryAfterSeconds).toBe(42);
    expect(failure.details).toBeNull();
    expect(failure.requestId).toBe('req-fixture-0001');
  });

  it('keeps the field messages and leaves the counters out, instead of discarding both', () => {
    const failure = readApiError(
      errorResponse({
        error: {
          ...VALIDATION_FAILED.error,
          details: { ...VALIDATION_FAILED.error.details, attempts_remaining: 2 },
        },
      }),
    );

    expect(failure.details).toEqual({ name: ['String must contain at least 1 character(s)'] });
  });

  it('reads a counter-only refusal as no field errors and a wait', () => {
    const failure = readApiError(errorResponse(CODE_LOCKED, 422));

    expect(failure.code).toBe('code_locked');
    expect(failure.details).toBeNull();
    expect(failure.retryAfterSeconds).toBe(900);
  });

  it('survives a body that is not the envelope at all', () => {
    // A proxy returning an HTML error page, or a 413 rejected before the API
    // saw the request. A parser that throws while explaining a failure turns
    // one broken screen into a blank one.
    const failure = readApiError(errorResponse('<html>413 Request Entity Too Large</html>', 413));

    expect(failure.code).toBeNull();
    expect(failure.details).toBeNull();
    expect(failure.message).toContain('413');
  });

  it('says the server was unreachable on status 0, rather than inventing a code', () => {
    // Status 0 is what a refused cross-origin request looks like from inside
    // the application — which is precisely what withCredentials produced.
    const failure = readApiError(errorResponse(null, 0));

    expect(failure.code).toBeNull();
    expect(failure.message).toContain('could not be reached');
  });

  it('ignores a details object that is not field -> messages', () => {
    const failure = readApiError(
      errorResponse({ error: { code: 'INVALID_JSON', message: 'Malformed.', details: { email: 'not an array' } } }),
    );

    expect(failure.details).toBeNull();
  });
});

/**
 * One not-found test for every adapter (dry run 2026-11-09, defect 4): the interceptor rethrows an
 * `ApiFailure`, and the adapters looked for the raw response it replaces, so no 404 became `null`.
 */
describe('isNotFound', () => {
  it('recognises the failure the interceptor rethrows, and the raw response it replaces', () => {
    const failure = readApiError(
      new HttpErrorResponse({
        status: 404,
        error: { error: { code: 'NOT_FOUND', message: 'That report is not available.' } },
      }),
    );
    expect(isNotFound(failure)).toBe(true);
    expect(isNotFound(new HttpErrorResponse({ status: 404 }))).toBe(true);
  });

  it('is not a refusal, a failure or an error raised in the console', () => {
    expect(isNotFound(readApiError(new HttpErrorResponse({ status: 403 })))).toBe(false);
    expect(isNotFound(readApiError(new HttpErrorResponse({ status: 500 })))).toBe(false);
    expect(isNotFound(new HttpErrorResponse({ status: 0 }))).toBe(false);
    expect(isNotFound(new Error('not found'))).toBe(false);
    expect(isNotFound(null)).toBe(false);
  });
});
