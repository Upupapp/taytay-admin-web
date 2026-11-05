import type { FieldProblem } from '../directory/directory-office';
import { isDialable } from '../directory/hotline';
import type { IsoDateTime } from '../shared/ids';

/**
 * The residents' app's settings, as the app reads them at `GET app/config` (`DL-170`): the LGU's
 * contact line and support address, the versions of the privacy notice and terms a resident must have
 * accepted, the oldest version of the app that may be used, and the app's feature flags.
 *
 * Public on the API — every resident's app reads it, signed in or not — so nothing here is a secret,
 * and the screen says so beside the flags.
 */
export interface AppConfig {
  readonly contactLine: string | null;
  readonly supportEmail: string | null;
  readonly privacyVersion: string | null;
  readonly termsVersion: string | null;
  readonly minimumAppVersion: string | null;
  readonly featureFlags: readonly FeatureFlag[];
  /**
   * The privacy notice the API serves, said by version and date only. Its text is kept by the API
   * and no route changes it, so this console neither reads nor offers it.
   */
  readonly privacyNotice: { readonly version: string; readonly updatedAt: IsoDateTime };
  readonly updatedAt: IsoDateTime;
}

export interface FeatureFlag {
  readonly key: string;
  readonly value: string;
}

/**
 * A change, as `AppConfigPatch` declares it. `undefined` leaves a setting; `null` clears it. A flag
 * set to `null` is deleted.
 */
export interface AppConfigChanges {
  readonly contactLine?: string | null;
  readonly supportEmail?: string | null;
  readonly privacyVersion?: string | null;
  readonly termsVersion?: string | null;
  readonly minimumAppVersion?: string | null;
  readonly featureFlags?: readonly { readonly key: string; readonly value: string | null }[];
}

/** Read from `src/modules/app-config/schemas.ts`, `repository.ts` and `0010_screen_coverage.sql` at `2736e28`. */
export const APP_CONFIG_LIMITS = {
  email: 200,
  version: 32,
  /** The pattern allows longer; the column's check allows twenty, and a longer one fails there. */
  minimumAppVersion: 20,
  flagValue: 200,
  flagsPerChange: 50,
} as const;

export const APP_VERSION_PATTERN = /^[0-9]+(\.[0-9]+){1,3}$/;
export const FLAG_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * `-1`, `0` or `1` as `a` is older than, the same as, or newer than `b` — by number, segment by
 * segment, so `1.10` is newer than `1.9`. A missing segment counts as zero.
 */
export function compareAppVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export type AppConfigField = Exclude<keyof AppConfigChanges, 'featureFlags'> | 'featureFlags';

export function appConfigProblems(
  changes: AppConfigChanges,
): readonly FieldProblem<AppConfigField>[] {
  const problems: FieldProblem<AppConfigField>[] = [];
  const { contactLine, supportEmail, privacyVersion, termsVersion, minimumAppVersion } = changes;

  if (contactLine !== undefined && contactLine !== null && !isDialable(contactLine)) {
    problems.push({
      field: 'contactLine',
      message:
        'A contact line is digits, with spaces and + ( ) . - if wanted, up to 32 characters.',
    });
  }
  if (
    supportEmail !== undefined &&
    supportEmail !== null &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ||
      supportEmail.length > APP_CONFIG_LIMITS.email)
  ) {
    problems.push({ field: 'supportEmail', message: 'That does not look like an email address.' });
  }
  for (const [field, value, label] of [
    ['privacyVersion', privacyVersion, 'privacy notice'],
    ['termsVersion', termsVersion, 'terms'],
  ] as const) {
    if (value !== undefined && value !== null && value.length > APP_CONFIG_LIMITS.version) {
      problems.push({
        field,
        message: `The ${label} version is at most ${APP_CONFIG_LIMITS.version} characters.`,
      });
    }
  }
  if (
    minimumAppVersion !== undefined &&
    minimumAppVersion !== null &&
    (!APP_VERSION_PATTERN.test(minimumAppVersion) ||
      minimumAppVersion.length > APP_CONFIG_LIMITS.minimumAppVersion)
  ) {
    problems.push({
      field: 'minimumAppVersion',
      message:
        'A version is numbers joined by dots — two to four of them, such as 1.4 or 1.4.2 — up to ' +
        `${APP_CONFIG_LIMITS.minimumAppVersion} characters.`,
    });
  }
  const flags = changes.featureFlags ?? [];
  if (flags.length > APP_CONFIG_LIMITS.flagsPerChange) {
    problems.push({
      field: 'featureFlags',
      message: `The API takes at most ${APP_CONFIG_LIMITS.flagsPerChange} flag changes at once.`,
    });
  }
  if (flags.some((flag) => !FLAG_KEY_PATTERN.test(flag.key))) {
    problems.push({
      field: 'featureFlags',
      message:
        'A flag name starts with a lower-case letter, then lower-case letters, digits or _, up to 40 ' +
        'characters — such as show_digital_id.',
    });
  }
  if (
    flags.some(
      (flag) =>
        flag.value !== null &&
        (flag.value === '' || flag.value.length > APP_CONFIG_LIMITS.flagValue),
    )
  ) {
    problems.push({
      field: 'featureFlags',
      message: `A flag's value is 1 to ${APP_CONFIG_LIMITS.flagValue} characters. To remove a flag, delete it.`,
    });
  }
  if (new Set(flags.map((flag) => flag.key)).size !== flags.length) {
    problems.push({ field: 'featureFlags', message: 'Each flag is named once.' });
  }
  return problems;
}

/**
 * What a change to the app's settings does, shown **before** the confirmation (`DL-170`).
 *
 * Read from `taytay-backend` `2736e28`: `src/modules/app-config/routes.ts` (one audit entry,
 * `app.config_updated`, naming no setting and keeping no reason; the read is public),
 * `repository.ts` (a `null` flag deletes it; the privacy notice's text is the API's own and no route
 * changes it), and `src/modules/users/routes.ts` (a resident's acceptance is recorded by version
 * through `POST me/consents`; nothing on the server compares it with these versions, and nothing
 * refuses an old app). What the app does with each setting is the app's, which this console cannot
 * see — so the sentences say what the app is given and what that **can** make it do.
 */
export const APP_CONFIG_EFFECTS = {
  minimumRaised: (version: string) => [
    `This can force every resident whose app is older than ${version} to update before using it: ` +
      'the app is given this version to compare with its own. The API refuses nothing itself.',
    'A resident who cannot update — an old phone, no data — may be unable to use the app at all.',
  ],
  minimumLowered: [
    'Residents with an older app are no longer asked to update because of this setting.',
  ],
  termsChanged: (version: string | null) => [
    version === null
      ? 'The app is given no terms version, so it has none to ask residents to accept.'
      : `This can make every resident accept the terms again before using the app: the app is ` +
        `given ${version} to compare with the version each resident accepted. The API does not ` +
        'compare them itself.',
  ],
  privacyChanged: (version: string | null) => [
    version === null
      ? 'The app is given no privacy notice version, so it has none to ask residents to accept.'
      : `This can make every resident accept the privacy notice again: the app is given ${version} ` +
        'to compare with the version each resident accepted. The API does not compare them itself.',
    'The notice’s text does not change here. The API serves its own, and no route changes it — a ' +
      'new version number on an unchanged notice asks residents to accept what they already did.',
  ],
  privacyMismatch: (served: string, version: string) => [
    `The API serves privacy notice version ${served}, not ${version}. Residents may be asked to ` +
      'accept a version whose text the app cannot show them.',
  ],
  contact: ['Residents see the new contact details in the app.'],
  flags: [
    'The app reads each flag and decides what it does; this console cannot see what that is. A ' +
      'deleted flag is no longer given to the app at all.',
  ],
  always: [
    'Applies to every resident the next time the app reads its settings.',
    'The server records that you changed the settings, and when — not which setting, and no ' +
      'reason, so none is asked for.',
  ],
} as const;

/** True for a change that can stop residents using the app until they act. */
export function asksEveryResident(current: AppConfig, changes: AppConfigChanges): boolean {
  const minimum = changes.minimumAppVersion;
  const raised =
    minimum !== undefined &&
    minimum !== null &&
    (current.minimumAppVersion === null ||
      compareAppVersions(minimum, current.minimumAppVersion) > 0);
  return (
    raised ||
    (changes.termsVersion !== undefined && changes.termsVersion !== null) ||
    (changes.privacyVersion !== undefined && changes.privacyVersion !== null)
  );
}

/** Every consequence of saving this change, the ones that reach every resident first. */
export function appConfigEffects(current: AppConfig, changes: AppConfigChanges): readonly string[] {
  const effects: string[] = [];
  const minimum = changes.minimumAppVersion;
  if (minimum !== undefined) {
    const raised =
      minimum !== null &&
      (current.minimumAppVersion === null ||
        compareAppVersions(minimum, current.minimumAppVersion) > 0);
    effects.push(
      ...(raised && minimum !== null
        ? APP_CONFIG_EFFECTS.minimumRaised(minimum)
        : APP_CONFIG_EFFECTS.minimumLowered),
    );
  }
  if (changes.termsVersion !== undefined) {
    effects.push(...APP_CONFIG_EFFECTS.termsChanged(changes.termsVersion));
  }
  if (changes.privacyVersion !== undefined) {
    effects.push(...APP_CONFIG_EFFECTS.privacyChanged(changes.privacyVersion));
    if (
      changes.privacyVersion !== null &&
      changes.privacyVersion !== current.privacyNotice.version
    ) {
      effects.push(
        ...APP_CONFIG_EFFECTS.privacyMismatch(
          current.privacyNotice.version,
          changes.privacyVersion,
        ),
      );
    }
  }
  if (changes.contactLine !== undefined || changes.supportEmail !== undefined) {
    effects.push(...APP_CONFIG_EFFECTS.contact);
  }
  if (changes.featureFlags !== undefined && changes.featureFlags.length > 0) {
    effects.push(...APP_CONFIG_EFFECTS.flags);
  }
  return [...effects, ...APP_CONFIG_EFFECTS.always];
}
