import { Injectable } from '@angular/core';

/**
 * Where the access token lives: a private field, and nowhere else.
 *
 * ADR 0006 decided this. The token is **not** in `localStorage`, **not** in
 * `sessionStorage`, **not** in a cookie, never in a URL, a query parameter, an
 * analytics event or a log line. It does not survive a page reload, which is
 * the point: a memory-only token narrows the XSS window from "everything ever
 * stored" to "this tab, while open".
 *
 * DELIBERATELY NOT A SIGNAL. A signal is readable by any component that injects
 * this service, and a template that can read a token is a template that can
 * render one into the DOM. The only two operations are `attach` and `clear`, so
 * there is no getter to misuse and nothing to bind to.
 *
 * The expiry is exposed, because it is not secret and the session warning needs
 * it. Knowing *when* a token lapses tells an attacker nothing they could use.
 */
@Injectable({ providedIn: 'root' })
export class AuthTokenHolder {
  #token: string | null = null;
  #expiresAt: Date | null = null;

  /** Called only by the staff adapter, on a successful sign-in. */
  hold(token: string, expiresAt: Date | null): void {
    this.#token = token;
    this.#expiresAt = expiresAt;
  }

  /**
   * Adds the bearer header, or returns the headers unchanged when there is no
   * token — an unauthenticated call must go out plainly rather than with an
   * empty `Authorization`, which some proxies treat as malformed.
   */
  authorization(): Readonly<Record<string, string>> {
    return this.#token === null ? {} : { Authorization: `Bearer ${this.#token}` };
  }

  hasToken(): boolean {
    return this.#token !== null;
  }

  /** When the token lapses, for the expiry warning. Not secret. */
  expiresAt(): Date | null {
    return this.#expiresAt;
  }

  /**
   * Whether the token lapses within `ms` — or already has. Asked before an API request, so a token
   * about to expire is renewed rather than sent to be refused (`DL-166`).
   *
   * `false` without a token, and `false` for an unknown expiry: nothing is renewed on a guess.
   */
  expiresWithin(ms: number, now: number = Date.now()): boolean {
    return this.#token !== null && this.#expiresAt !== null && this.#expiresAt.getTime() - now <= ms;
  }

  /**
   * Drops the token.
   *
   * **This is not sign-out.** Sign-out is `POST auth/sign-out`, and the server
   * revoking the account's refresh tokens is what ends the session; this only
   * forgets the token locally. The adapter calls this once the API has answered,
   * never instead of asking (`DL-165`).
   */
  clear(): void {
    this.#token = null;
    this.#expiresAt = null;
  }
}
