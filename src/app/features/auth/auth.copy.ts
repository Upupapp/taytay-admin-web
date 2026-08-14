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
} as const;
