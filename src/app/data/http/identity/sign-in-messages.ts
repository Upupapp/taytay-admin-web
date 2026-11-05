import { SignInError } from '@domain/index';

/**
 * What a sign-in refusal says, written once for both identity providers and the staff adapter.
 *
 * One message covers an unknown address, a wrong password, a disabled account **and** an account
 * the API says may not hold a console session (a resident's, or a closed one). Telling any of
 * them apart would let anybody holding the sign-in page find out which addresses have accounts —
 * including which residents use the app.
 */
export function invalidCredentials(): SignInError {
  return new SignInError(
    'invalid-credentials',
    'Those sign-in details were not recognised. Check the email address and password, then try again.',
  );
}

/**
 * Throttled by the identity provider. No wait is stated, because Google does not say how long it
 * lasts and a guessed number sends somebody back to a form that still refuses them.
 */
export function signInThrottled(): SignInError {
  return new SignInError(
    'throttled',
    'Too many sign-in attempts. Wait a while before trying again, or contact the MSWDO administrator.',
  );
}

export function signInUnavailable(): SignInError {
  return new SignInError('unavailable', 'Sign-in is unavailable right now. Please try again shortly.');
}

/** A wrong code and a lapsed attempt are one message: telling them apart says which half was right. */
export function secondFactorRefused(): SignInError {
  return new SignInError(
    'second-factor-refused',
    'That code was not accepted. Start again, and enter the code your authenticator app shows at that moment.',
  );
}

/**
 * This build has no Firebase web API key. Said plainly, and nothing is sent: a request with an
 * invented key fails at Google with a message that means nothing to an intake officer.
 */
export const SIGN_IN_NOT_CONFIGURED =
  'Sign-in is not configured for this installation of the console yet, so nobody can sign in here. ' +
  'Contact the MSWDO administrator.';

export function signInNotConfigured(): SignInError {
  return new SignInError('unavailable', SIGN_IN_NOT_CONFIGURED);
}
