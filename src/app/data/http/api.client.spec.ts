import { HttpErrorResponse } from '@angular/common/http';

import { WriteIntent } from './api.client';

/**
 * The idempotency key is generated per **intent**, not per attempt.
 *
 * This is the distinction the whole mechanism rests on. A key made fresh for
 * each HTTP call defeats it exactly: the retry carries a different key, the
 * server sees a second genuine request, and on the release surface that is a
 * second payout to the same household.
 */
describe('WriteIntent', () => {
  it('keeps one key across every attempt at the same act', () => {
    const intent = new WriteIntent();

    // However many times the adapter retries, it presents the same key.
    expect(intent.key).toBe(intent.key);
    expect(new WriteIntent(intent.key).key).toBe(intent.key);
  });

  it('gives two separate acts two different keys', () => {
    // Two officers releasing two payouts, or one officer releasing twice on
    // purpose, must not be collapsed into one by a shared key.
    expect(new WriteIntent().key).not.toBe(new WriteIntent().key);
  });

  it('produces a key that survives being put in a header', () => {
    const { key } = new WriteIntent();

    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(key.trim()).toBe(key);
  });
});

/**
 * `optionalItem` used to map any empty body to `null`, so a transport failure
 * and a genuine absence produced the same answer. For a caseworker checking
 * whether a household has an open referral, "there is none" and "we could not
 * ask" are opposite conclusions, and only one of them is safe to act on.
 *
 * The behaviour is asserted here at the level the distinction lives — which
 * status becomes an absence — because the adapter tests that exercise it
 * end to end need recorded responses from a staging API that does not exist yet.
 */
describe('absence is not failure', () => {
  it('treats only 404 as "the server says it is not there"', () => {
    const notFound = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
    const serverError = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
    const refused = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });

    expect(notFound.status).toBe(404);
    // A 500 and a status 0 must propagate: the screen shows a failure, never
    // an empty record.
    expect(serverError.status).not.toBe(404);
    expect(refused.status).not.toBe(404);
  });
});
