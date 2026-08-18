/**
 * Sign-in copy. Typed module per `DL-23`.
 *
 * Every failure message here is deliberately identical in meaning. The screen
 * must not reveal whether an address belongs to a staff account, or whether an
 * account has been deactivated.
 */
export const AUTH_COPY = {
  title: 'Sign in',
  subtitle: 'Municipal Social Welfare and Development Office — staff console.',

  emailLabel: 'Work email address',
  emailHint: 'The address issued to you by the municipality.',
  passwordLabel: 'Password',

  showPassword: 'Show password',
  hidePassword: 'Hide password',

  submit: 'Sign in',
  submitting: 'Signing in…',

  // One message for unknown address, wrong password and deactivated account.
  invalidCredentials:
    'Those sign-in details were not recognised. Check the email address and password, then try again.',
  emailRequired: 'Enter your work email address.',
  passwordRequired: 'Enter your password.',
  errorSummaryHeading: 'There is a problem',

  /**
   * States the provisioning model on the screen itself. There is no
   * registration link because there is no registration (`DL-32`).
   */
  noSelfRegistration:
    'Staff accounts are issued by the MSWDO administrator. There is no self-registration — contact your administrator if you need access.',

  forgotPassword: 'Forgotten your password?',
  forgotPasswordHelp:
    'Password resets are handled by the MSWDO administrator. Contact the office to have yours reset.',

  signedOutNotice: 'You have been signed out.',

  /*
   * The second factor.
   *
   * One labelled field, nothing that auto-advances. Split boxes that jump focus
   * per digit are announced by a screen reader as six unlabelled inputs, break
   * paste on several browsers, and strand anybody who mistypes — WCAG 2.2
   * §3.3.8 treats blocking paste as removing the Mechanism a user relies on.
   */
  codeTitle: 'Enter your authentication code',
  codeSubtitle:
    'Your password was accepted. Enter the six-digit code from your authenticator app to finish signing in.',
  codeLabel: 'Authentication code',
  codeHint: 'Six digits, or one of your recovery codes if you cannot use your authenticator.',
  codeRequired: 'Enter the code from your authenticator app.',
  codeSubmit: 'Verify and sign in',
  codeSubmitting: 'Verifying…',
  codeExpiry: (minutes: number): string =>
    `This code request expires in ${minutes} minute${minutes === 1 ? '' : 's'}. After that you will need to sign in again.`,
  codeStartOver: 'Start again',

  // A wrong code and an expired challenge are one message: telling them apart
  // says which half of the attempt was right.
  codeRefused: 'That code was not accepted. Start again and request a new one.',

  recoveryHelp:
    'Lost your authenticator? Use a recovery code, or contact the MSWDO administrator to have your second factor reset.',

  /**
   * Throttling. Says nothing about the account — only about this caller's rate
   * — and gives the one fact the user can act on.
   */
  throttled: (seconds: number): string =>
    `Too many sign-in attempts. Try again in ${seconds} second${seconds === 1 ? '' : 's'}.`,
} as const;
