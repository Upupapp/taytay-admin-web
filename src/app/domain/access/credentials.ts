import type { AuthenticatedUser } from './staff-user';

/**
 * Sign-in credentials and their outcome.
 *
 * **No password is stored anywhere in this repository.** The mock adapter
 * verifies that the email belongs to an active staff account and that the
 * password meets a minimum length; it cannot verify a password, because a
 * front end has nothing to verify it against. Committing a fixture password
 * would be storing a credential for no benefit (`CLAUDE.md` §2 rule 5).
 */
export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
  /**
   * Read by the development verifier and by nothing else (`DL-166`).
   *
   * Against a backend running `AUTH_VERIFIER=mock`, the console presents a credential naming the
   * role the API should record **the first time** that subject reaches it; afterwards the API's
   * own record wins. The Firebase provider ignores this field: a real role is never asked for by
   * the person signing in, it is whatever the API already holds.
   */
  readonly developmentRoleClaim?: DevelopmentRoleClaim;
}

/** The two roles a development credential may ask the API to record for a new subject. */
export type DevelopmentRoleClaim = 'staff' | 'admin';

/**
 * How this build signs somebody in, so the sign-in screen can say so rather than offer a form
 * that cannot work.
 *
 * - `password` — email and password, checked by the identity provider.
 * - `not-configured` — this build has no identity provider configured (no Firebase web API key
 *   was supplied). The screen says so and sends nothing: a request with an invented key would
 *   fail at Google with a message that means nothing to an intake officer.
 * - `development-verifier` — `local-api` only, against a backend that accepts development
 *   credentials. The password is not checked by anything, and the screen says that too.
 *
 * The explanations are written by the adapter that knows them, as a refusal's message is, so a
 * production bundle carries no development wording at all (`check:bundle`).
 */
export type SignInMethod =
  | { readonly kind: 'password' }
  | { readonly kind: 'not-configured'; readonly explanation: string }
  | {
      readonly kind: 'development-verifier';
      readonly explanation: readonly string[];
      readonly roleClaims: readonly DevelopmentRoleClaim[];
    };

/**
 * Why a sign-in failed.
 *
 * `invalid-credentials` is returned for an unknown email, a wrong password
 * **and** a deactivated account. Distinguishing them would let anyone with the
 * sign-in page enumerate which municipal staff addresses exist — a disclosure
 * that costs us nothing to prevent.
 */
export type SignInFailureReason =
  | 'invalid-credentials'
  | 'malformed'
  | 'unavailable'
  /**
   * Throttled. Kept distinct from `invalid-credentials` because it discloses
   * nothing about the account — it is a fact about this caller's rate, not
   * about whether the address exists — and because the user can act on it once
   * they are told how long to wait.
   */
  | 'throttled'
  /**
   * The second factor was wrong, or its challenge has expired. One reason for
   * both: a challenge that has lapsed and a code that is wrong both mean "start
   * again", and separating them tells an attacker which half they got right.
   */
  | 'second-factor-refused'
  /**
   * The account requires a second factor and has never enrolled one. The API
   * issues a token that can reach enrolment and nothing else, so this is not a
   * session — and the console does not pretend it is.
   */
  | 'second-factor-enrolment-required';

export class SignInError extends Error {
  readonly reason: SignInFailureReason;
  /** Seconds to wait, from `Retry-After`. Only ever set for `throttled`. */
  readonly retryAfterSeconds: number | null;

  constructor(reason: SignInFailureReason, message: string, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'SignInError';
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Minimum length the form and the adapter both apply before any lookup. */
export const MINIMUM_PASSWORD_LENGTH = 8;

export function isPlausibleEmail(value: string): boolean {
  // Deliberately permissive: the API is the authority on what it accepts, and
  // an over-strict client-side pattern rejects valid government addresses.
  const trimmed = value.trim();
  return trimmed.length >= 3 && trimmed.includes('@') && !/\s/.test(trimmed);
}

export function isPlausiblePassword(value: string): boolean {
  return value.length >= MINIMUM_PASSWORD_LENGTH;
}

/**
 * A second factor is required before a token is issued.
 *
 * The password was correct — the API answers `200`, not `401`, precisely so a
 * client can tell "wrong password" from "now prove it is you". The challenge is
 * single-use and short-lived, and the console shows the expiry rather than
 * letting somebody discover it by typing a code into a dead form.
 */
export interface MfaChallenge {
  readonly challenge: string;
  readonly expiresInMinutes: number;
}

/**
 * The second step. `code` is the six-digit code from an authenticator app. There are no recovery
 * codes: the identity provider issues none, and a hint promising one sends somebody looking for
 * a sheet of paper that does not exist.
 */
export interface MfaCredentials {
  readonly challenge: string;
  readonly code: string;
}

/**
 * What a sign-in attempt produced.
 *
 * Modelled as a discriminated union rather than a nullable user plus a flag,
 * because "authenticated" and "needs a second factor" are different states with
 * different next steps, and a boolean beside a user invites a screen to read
 * one without the other.
 */
export type SignInOutcome =
  | { readonly kind: 'authenticated'; readonly user: AuthenticatedUser }
  | { readonly kind: 'mfa-required'; readonly challenge: MfaChallenge };

export function isMfaRequired(
  outcome: SignInOutcome,
): outcome is { kind: 'mfa-required'; challenge: MfaChallenge } {
  return outcome.kind === 'mfa-required';
}
