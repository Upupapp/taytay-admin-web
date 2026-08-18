import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { readApiError } from './api-failure';

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
        { error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred.' } },
        500,
        new HttpHeaders({ 'X-Request-Id': '01JBHEADER' }),
      ),
    );

    expect(failure.requestId).toBe('01JBHEADER');
  });

  it('reads Retry-After on a throttled response', () => {
    const failure = readApiError(
      errorResponse(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } },
        429,
        new HttpHeaders({ 'Retry-After': '30' }),
      ),
    );

    expect(failure.code).toBe('RATE_LIMITED');
    expect(failure.retryAfterSeconds).toBe(30);
  });

  it('survives a body that is not the envelope at all', () => {
    // A proxy returning an HTML error page, or a 413 rejected before Laravel
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
      errorResponse({ error: { code: 'BAD_REQUEST', message: 'Malformed.', details: { email: 'not an array' } } }),
    );

    expect(failure.details).toBeNull();
  });
});
