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
