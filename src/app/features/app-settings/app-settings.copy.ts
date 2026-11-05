/**
 * Every sentence the app settings page says (`DL-170`). What a change does is the domain's
 * (`APP_CONFIG_EFFECTS`), read from the backend.
 */
export const APP_SETTINGS_COPY = {
  title: 'App settings',
  subtitle:
    'Residents see this in the Taytay app: the contact details it shows, the terms and privacy ' +
    'notice it asks residents to accept, the oldest app version it allows, and its feature flags. ' +
    'A change here reaches every resident.',
  caption: 'The Taytay app’s settings',
  lastChanged: (when: string) => `Last changed ${when}.`,

  contactHeading: 'Contact',
  contactLine: 'Contact line',
  contactLineHint: 'The LGU number residents are shown, such as (02) 8123 4567. Empty for none.',
  supportEmail: 'Support email',
  supportEmailHint: 'Empty for none.',

  versionsHeading: 'What residents must accept, and which app they must have',
  termsVersion: 'Terms version',
  termsVersionHint: 'Empty for none.',
  privacyVersion: 'Privacy notice version',
  privacyVersionHint: 'Empty for none.',
  noticeServed: (version: string, when: string) =>
    `The API serves privacy notice version ${version}, last changed ${when}. Its text is kept by the ` +
    'API and is not changed here.',
  minimumAppVersion: 'Oldest app version allowed',
  minimumAppVersionHint: 'Numbers joined by dots, such as 1.4 or 1.4.2. Empty for none.',

  flagsHeading: 'Feature flags',
  flagsLead:
    'Read by the app, which decides what each one does. Not secret: any resident’s app reads them, ' +
    'signed in or not, so never put a password or a key here.',
  flagsCaption: 'Feature flags the app is given',
  flagName: 'Name',
  flagValue: 'Value',
  flagDelete: 'Delete',
  flagDeleteLabel: (key: string) => `Delete the flag ${key}`,
  flagValueLabel: (key: string) => `Value of the flag ${key}`,
  noFlags: 'The app is given no feature flags.',
  newFlagName: 'New flag name',
  newFlagValue: 'New flag value',
  addFlag: 'Add a flag',
  removeNewFlag: (index: number) => `Remove new flag ${index}`,

  problemsLead: 'Not sent — the API would refuse it:',
  unchanged: 'Nothing has changed yet.',
  review: 'Review the change',
  reviewHeading: 'Change the app’s settings?',
  effectsLead: 'What this does:',
  acknowledge:
    'I understand this can stop residents using the app until they update it or accept again.',
  acknowledgeNeeded: 'Tick the box above to confirm.',
  cancel: 'Go back',
  confirm: 'Save the settings',
  saving: 'Saving…',
  saved: 'The settings were saved. Residents’ apps read them the next time they load.',
  notDone: (reason: string) => `Not saved. ${reason}`,
  failed: 'The server did not answer.',
} as const;
