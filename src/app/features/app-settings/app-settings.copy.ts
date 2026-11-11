import { REVIEW_DAYS_BOUNDS } from '@domain/index';

/**
 * Every sentence the app settings page says (`DL-170`). What a change does is the domain's
 * (`APP_CONFIG_EFFECTS`), read from the backend.
 */
export const APP_SETTINGS_COPY = {
  title: 'App settings',
  subtitle:
    'Residents see this in the Taytay app: the contact details it shows, the terms and privacy ' +
    'notice it asks residents to accept, the oldest app version it allows, how long it says an ID ' +
    'review takes, and its feature flags. A change here reaches every resident.',
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
    `The API serves privacy notice version ${version}, last changed ${when}. Its text is published ` +
    'under “Privacy notice” below, with its own version.',
  minimumAppVersion: 'Oldest app version allowed',
  minimumAppVersionHint: 'Numbers joined by dots, such as 1.4 or 1.4.2. Empty for none.',

  reviewTimeHeading: 'Verification review time',
  reviewLead:
    'How long the app tells a resident an ID review usually takes, after they send their ID. No ' +
    'standard for it is published: it is the office’s own estimate, in working days.',
  reviewNotSent:
    'The API did not say what the app is told about review time: it is older than this setting. ' +
    'Nothing about it can be changed here until the API is updated, and the app keeps saying what ' +
    'it says now.',
  reviewChoiceLegend: 'In the app',
  reviewStateLabel: 'State a review time',
  reviewStateHint: 'The app says how many working days a review usually takes.',
  reviewNoneLabel: 'Don’t state a review time',
  reviewNoneHint: 'The app says nothing about how long a review takes.',
  reviewMin: 'Fewest working days',
  reviewMinHint: `A whole number from ${REVIEW_DAYS_BOUNDS.fewest} to ${REVIEW_DAYS_BOUNDS.most}.`,
  reviewMax: 'Most working days',
  reviewMaxHint: `From the fewest to ${REVIEW_DAYS_BOUNDS.most}. The same number for an exact time.`,
  reviewPreviewLead: 'What the app will say',
  reviewPreview: (phrase: string) => `“This ${phrase}.”`,
  reviewPreviewNone: 'Nothing about how long a review takes.',
  reviewPreviewIncomplete: 'Give both numbers above to see the sentence.',

  legalHeading: 'Terms of Use and privacy notice',
  legalLead:
    'The texts residents are asked to accept in the app. They are the LGU’s to write: this console ' +
    'never writes, suggests or fills in legal text. Each is published with a version you choose, and ' +
    'a new version makes every resident accept the text again in the app.',
  legalCurrent: (version: string, when: string) => `Version ${version}, published ${when}.`,
  legalAsWritten:
    'Shown exactly as written. Formatting marks such as # or ** appear here as typed; the app lays ' +
    'them out.',
  legalVersionHint:
    'Your choice, up to 32 characters, such as 2026-11 — never “placeholder”. A new version makes ' +
    'every resident accept the text again in the app; the same version changes the text without ' +
    'asking anyone to accept again.',
  legalBodyHint: 'The approved text, exactly as it should be shown, up to 20,000 characters.',
  legalPutAway: 'Put the editor away',
  legal: {
    terms: {
      heading: 'Terms of Use',
      noText:
        'No text has been written yet. Until the LGU’s approved Terms of Use are published here, ' +
        'the app shows a placeholder that says so, under the version “placeholder”.',
      read: 'Read the Terms of Use residents are shown',
      write: 'Write the Terms of Use',
      edit: 'Change the Terms of Use',
      version: 'Version of the Terms of Use',
      body: 'Text of the Terms of Use',
    },
    privacyNotice: {
      heading: 'Privacy notice',
      noText:
        'No text has been written yet. Until the LGU’s approved privacy notice is published here, ' +
        'the app shows a placeholder that says so, under the version “placeholder”.',
      read: 'Read the privacy notice residents are shown',
      write: 'Write the privacy notice',
      edit: 'Change the privacy notice',
      version: 'Version of the privacy notice',
      body: 'Text of the privacy notice',
    },
  },

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
  refusedLead: 'Not saved — the server refused it:',
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
