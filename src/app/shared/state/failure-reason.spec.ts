import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { readApiError } from '@core/http/api-failure';
import { failureReason } from './failure-reason';

const refused = (status: number, code: string, details?: Record<string, string[]>) =>
  readApiError(
    new HttpErrorResponse({
      status,
      error: { error: { code, message: 'The request could not be validated.', details } },
    }),
  );

describe('failureReason', () => {
  // Flow audit 5: a street address too long came back as "The request could not be validated",
  // which named no field (DL-290).
  it('names the field and says the API’s own sentence for a validation refusal', () => {
    const reason = failureReason(
      refused(422, 'VALIDATION_FAILED', { street_address: ['Use 200 characters or less.'] }),
    );
    expect(reason).toBe('Street address: Use 200 characters or less.');
  });

  it('keeps the envelope’s sentence when a refusal names no field, and any other refusal’s', () => {
    expect(failureReason(refused(422, 'VALIDATION_FAILED'))).toBe(
      'The request could not be validated.',
    );
    expect(failureReason(refused(409, 'CONFLICT', { reason: ['Taken.'] }))).toBe(
      'The request could not be validated.',
    );
    expect(failureReason(new Error('Not saved.'))).toBe('Not saved.');
    expect(failureReason(null)).toBeNull();
  });
});
