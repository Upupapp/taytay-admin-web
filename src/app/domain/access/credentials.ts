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
}

/**
 * Why a sign-in failed.
 *
 * `invalid-credentials` is returned for an unknown email, a wrong password
 * **and** a deactivated account. Distinguishing them would let anyone with the
 * sign-in page enumerate which municipal staff addresses exist — a disclosure
 * that costs us nothing to prevent.
 */
export type SignInFailureReason = 'invalid-credentials' | 'malformed' | 'unavailable';

export class SignInError extends Error {
  readonly reason: SignInFailureReason;

  constructor(reason: SignInFailureReason, message: string) {
    super(message);
    this.name = 'SignInError';
    this.reason = reason;
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
