import { AuthTokenHolder } from './auth-token.holder';

describe('AuthTokenHolder', () => {
  it('attaches a bearer header once a token is held', () => {
    const holder = new AuthTokenHolder();
    holder.hold('secret-token', null);

    expect(holder.authorization()).toEqual({ Authorization: 'Bearer secret-token' });
  });

  it('sends no Authorization header at all when there is no token', () => {
    // Not an empty header: some proxies treat `Authorization:` with no value as
    // malformed, and an unauthenticated call should go out plainly.
    expect(new AuthTokenHolder().authorization()).toEqual({});
  });

  it('reports whether a session exists without revealing the token', () => {
    const holder = new AuthTokenHolder();
    expect(holder.hasToken()).toBe(false);

    holder.hold('secret-token', null);
    expect(holder.hasToken()).toBe(true);
  });

  it('exposes the expiry, which is not secret, for the session warning', () => {
    const expiry = new Date('2026-08-18T20:00:00Z');
    const holder = new AuthTokenHolder();
    holder.hold('secret-token', expiry);

    expect(holder.expiresAt()).toEqual(expiry);
  });

  it('forgets the token and its expiry when cleared', () => {
    const holder = new AuthTokenHolder();
    holder.hold('secret-token', new Date());
    holder.clear();

    expect(holder.hasToken()).toBe(false);
    expect(holder.authorization()).toEqual({});
    expect(holder.expiresAt()).toBeNull();
  });

  it('keeps the token off the instance, so nothing can enumerate it', () => {
    // The point of a private field rather than a convention: a token on an
    // enumerable property reaches a JSON.stringify, a log line or an error
    // report without anybody deciding it should.
    const holder = new AuthTokenHolder();
    holder.hold('secret-token', null);

    expect(JSON.stringify(holder)).not.toContain('secret-token');
    expect(Object.keys(holder)).toHaveLength(0);
  });

  it('says a token is about to lapse only when it knows the expiry (DL-166)', () => {
    const holder = new AuthTokenHolder();
    const now = Date.parse('2026-11-05T01:00:00.000Z');

    expect(holder.expiresWithin(60_000, now)).toBe(false);

    holder.hold('fixture-token', new Date(now + 30_000));
    expect(holder.expiresWithin(60_000, now)).toBe(true);
    expect(holder.expiresWithin(10_000, now)).toBe(false);

    holder.hold('fixture-token', new Date(now - 1_000));
    expect(holder.expiresWithin(60_000, now)).toBe(true);

    // An unknown expiry is never renewed on a guess.
    holder.hold('fixture-token', null);
    expect(holder.expiresWithin(60_000, now)).toBe(false);

    holder.clear();
    expect(holder.expiresWithin(60_000, now)).toBe(false);
  });
});
