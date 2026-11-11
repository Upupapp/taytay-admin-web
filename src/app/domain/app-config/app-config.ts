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
  /**
   * How long the app tells a resident an ID review usually takes (`DL-205`): a range of working
   * days, or `null` when the app states none. `undefined` when the API did not send it at all — one
   * older than the setting — which is unknown: never read as `null`, and never given a number.
   */
  readonly verificationReviewWorkingDays: WorkingDayRange | null | undefined;
  readonly featureFlags: readonly FeatureFlag[];
  /**
   * The privacy notice residents are asked to accept, with its text. An administrator publishes it
   * with its version (`DL-186`, superseding `DL-170`'s "no route changes it").
   */
  readonly privacyNotice: LegalText;
  /** The Terms of Use residents are asked to accept, the same shape and the same rules (`DL-186`). */
  readonly terms: LegalText;
  readonly updatedAt: IsoDateTime;
}

/* ── the texts residents accept (`DL-186`) ───────────────────────────────── */

/**
 * A text residents are asked to accept — the Terms of Use or the privacy notice — as the API serves
 * it. The text is the LGU's, written by an administrator; this console never writes, suggests or
 * fills in legal text, and shows the text as text, never as markup it renders.
 */
export interface LegalText {
  readonly version: string;
  readonly updatedAt: IsoDateTime;
  readonly bodyMarkdown: string;
}

/**
 * A text as an administrator publishes it: the text and the version residents accept it under,
 * always together, so the version a resident accepted names the text they were shown. The version
 * is the administrator's own choice — the API never derives or bumps it — because changing it is
 * what asks every resident to accept again.
 */
export interface LegalTextDraft {
  readonly version: string;
  readonly bodyMarkdown: string;
}

/** The version a text ships with until the approved one is written. Never a published version. */
export const LEGAL_TEXT_PLACEHOLDER_VERSION = 'placeholder';

/** Whether this is still the placeholder the API ships, whose text says only that it is one. */
export function isPlaceholderText(text: { readonly version: string }): boolean {
  return text.version.trim().toLowerCase() === LEGAL_TEXT_PLACEHOLDER_VERSION;
}

/**
 * What the editor starts from: the published text and its version — or nothing at all while it is
 * the placeholder. The placeholder's sentence is not legal text, and no text is ever invented to
 * stand in for the LGU's (`DL-186`).
 */
export function legalTextDraftFrom(text: LegalText): LegalTextDraft {
  return isPlaceholderText(text)
    ? { version: '', bodyMarkdown: '' }
    : { version: text.version, bodyMarkdown: text.bodyMarkdown };
}

/**
 * Whether publishing under `version` asks every resident to accept again: the app compares the
 * version each resident accepted with the version it is given, which publishing sets — so any
 * version other than the one residents are asked for now is a new one.
 */
export function isNewLegalVersion(version: string, askedNow: string | null): boolean {
  return version.trim() !== (askedNow ?? '').trim();
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
  /** Sent whole, both ends together; `null` makes the app state no review time (`DL-205`). */
  readonly verificationReviewWorkingDays?: WorkingDayRange | null;
  readonly featureFlags?: readonly { readonly key: string; readonly value: string | null }[];
  /** Publishes the Terms of Use: the text and its version together (`DL-186`). */
  readonly terms?: LegalTextDraft;
  /** Publishes the privacy notice, the same way. */
  readonly privacyNotice?: LegalTextDraft;
}

/**
 * Read from `src/modules/app-config/schemas.ts`, `repository.ts` and `0010_screen_coverage.sql` at
 * `2736e28`, and the texts from `schemas.ts` and `0037_terms_text.sql` at `0f1ffec`.
 */
export const APP_CONFIG_LIMITS = {
  email: 200,
  version: 32,
  legalText: 20000,
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

/* ── how long an ID review usually takes (`DL-205`) ──────────────────────── */

/**
 * The working days the app tells a resident an ID review usually takes, both ends counted. No
 * service standard for it is published: it is the office's own estimate, set by an administrator,
 * and the console never supplies one of its own.
 */
export interface WorkingDayRange {
  readonly min: number;
  readonly max: number;
}

/** Read from `src/modules/app-config/schemas.ts` at `39d650b`: whole numbers, fewest ≤ most. */
export const REVIEW_DAYS_BOUNDS = { fewest: 1, most: 30 } as const;

/** The server's own sentences for what it refuses in a range (`39d650b`). */
export const REVIEW_DAYS_MESSAGES = {
  missingMin: 'Give the fewest working days.',
  missingMax: 'Give the most working days.',
  whole: 'Working days are a whole number.',
  tooFew: `At least ${REVIEW_DAYS_BOUNDS.fewest} working day.`,
  tooMany: `At most ${REVIEW_DAYS_BOUNDS.most} working days.`,
  order: 'The fewest working days cannot be more than the most.',
} as const;

/** The input a sentence about the range belongs to; `range` when it is about the whole value. */
export type ReviewTimePart = 'min' | 'max' | 'range';

/**
 * The words the app uses, by the app's own rule (the F3 contract the three repositories share):
 * "usually takes 2–5 working days", or one number when both ends are the same — "1 working day",
 * "4 working days". Shown on the page as typed, and in the confirmation, from this one place.
 */
export function reviewTimePhrase(range: WorkingDayRange): string {
  if (range.min === range.max) {
    return `usually takes ${range.min} working ${range.min === 1 ? 'day' : 'days'}`;
  }
  return `usually takes ${range.min}–${range.max} working days`;
}

function boundProblem(field: 'min' | 'max', value: number): FieldProblem<'min' | 'max'> | null {
  if (!Number.isInteger(value)) return { field, message: REVIEW_DAYS_MESSAGES.whole };
  if (value < REVIEW_DAYS_BOUNDS.fewest) return { field, message: REVIEW_DAYS_MESSAGES.tooFew };
  if (value > REVIEW_DAYS_BOUNDS.most) return { field, message: REVIEW_DAYS_MESSAGES.tooMany };
  return null;
}

/** What the server would refuse in a range, by the end it belongs to, in the server's words. */
export function workingDayRangeProblems(
  range: WorkingDayRange,
): readonly FieldProblem<'min' | 'max'>[] {
  const problems = [boundProblem('min', range.min), boundProblem('max', range.max)].filter(
    (problem): problem is FieldProblem<'min' | 'max'> => problem !== null,
  );
  if (problems.length === 0 && range.min > range.max) {
    problems.push({ field: 'max', message: REVIEW_DAYS_MESSAGES.order });
  }
  return problems;
}

/** `null` for nothing typed, `undefined` for something that is not a whole number. */
function typedDays(typed: string): number | null | undefined {
  const trimmed = typed.trim();
  if (trimmed === '') return null;
  return /^[+-]?\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

/**
 * The two ends as typed, read the way the server reads them: the range when it would accept it,
 * and otherwise each end's problem — so a screen can say it beside the input it belongs to. A
 * usability courtesy only; the server decides.
 */
export function readWorkingDayRange(
  minTyped: string,
  maxTyped: string,
): {
  readonly range: WorkingDayRange | null;
  readonly problems: readonly FieldProblem<'min' | 'max'>[];
} {
  const min = typedDays(minTyped);
  const max = typedDays(maxTyped);
  if (typeof min === 'number' && typeof max === 'number') {
    const problems = workingDayRangeProblems({ min, max });
    return { range: problems.length === 0 ? { min, max } : null, problems };
  }
  const problems: FieldProblem<'min' | 'max'>[] = [];
  for (const [field, value, missing] of [
    ['min', min, REVIEW_DAYS_MESSAGES.missingMin],
    ['max', max, REVIEW_DAYS_MESSAGES.missingMax],
  ] as const) {
    if (value === null) problems.push({ field, message: missing });
    else if (value === undefined) problems.push({ field, message: REVIEW_DAYS_MESSAGES.whole });
    else {
      const problem = boundProblem(field, value);
      if (problem !== null) problems.push(problem);
    }
  }
  return { range: null, problems };
}

/**
 * A change the server refused, with what it said about the review time by the input each sentence
 * belongs to (`DL-205`), so the screen can put it there. `message` is the server's own.
 */
export class AppConfigRefusedError extends Error {
  readonly reviewTime: readonly FieldProblem<ReviewTimePart>[];

  constructor(message: string, reviewTime: readonly FieldProblem<ReviewTimePart>[]) {
    super(message);
    this.name = 'AppConfigRefusedError';
    this.reviewTime = reviewTime;
  }
}

export function isAppConfigRefusal(error: unknown): error is AppConfigRefusedError {
  return error instanceof AppConfigRefusedError;
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
  const reviewTime = changes.verificationReviewWorkingDays;
  if (reviewTime !== undefined && reviewTime !== null) {
    for (const problem of workingDayRangeProblems(reviewTime)) {
      problems.push({ field: 'verificationReviewWorkingDays', message: problem.message });
    }
  }
  for (const [field, draft, name, alongside, alongsideName] of [
    ['terms', changes.terms, 'Terms of Use', termsVersion, 'terms version'],
    [
      'privacyNotice',
      changes.privacyNotice,
      'privacy notice',
      privacyVersion,
      'privacy notice version',
    ],
  ] as const) {
    if (draft === undefined) continue;
    problems.push(...legalTextProblems(field, draft, name));
    // The API sets the version residents accept to the text's own; a different one beside it is 422.
    if (alongside !== undefined && alongside !== draft.version.trim()) {
      problems.push({
        field,
        message:
          `Publishing the ${name} sets the ${alongsideName} to its own version, ${draft.version.trim() || '(none given)'}. ` +
          `Change the version in one place: leave the ${alongsideName} above as it was.`,
      });
    }
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

/** What the API would refuse in a published text, said before anything is sent (`DL-186`). */
function legalTextProblems(
  field: 'terms' | 'privacyNotice',
  draft: LegalTextDraft,
  name: string,
): readonly FieldProblem<AppConfigField>[] {
  const problems: FieldProblem<AppConfigField>[] = [];
  const version = draft.version.trim();
  if (version === '') {
    problems.push({
      field,
      message: `Give the ${name} a version — the one residents accept it under.`,
    });
  } else if (version.length > APP_CONFIG_LIMITS.version) {
    problems.push({
      field,
      message: `The ${name} version is at most ${APP_CONFIG_LIMITS.version} characters.`,
    });
  } else if (isPlaceholderText({ version })) {
    problems.push({
      field,
      message:
        `“${LEGAL_TEXT_PLACEHOLDER_VERSION}” marks the text that ships until the approved one is ` +
        `written. Give the approved ${name} a version of its own.`,
    });
  }
  const body = draft.bodyMarkdown.trim();
  if (body === '') {
    problems.push({
      field,
      message: `Nothing is written for the ${name}. Write the approved text, or put the editor away.`,
    });
  } else if (body.length > APP_CONFIG_LIMITS.legalText) {
    problems.push({
      field,
      message: `The text of the ${name} is at most ${APP_CONFIG_LIMITS.legalText} characters.`,
    });
  }
  return problems;
}

/**
 * What a change to the app's settings does, shown **before** the confirmation (`DL-170`).
 *
 * Read from `taytay-backend` `2736e28`: `src/modules/app-config/routes.ts` (one audit entry,
 * `app.config_updated`, naming no setting and keeping no reason; the read is public),
 * `repository.ts` (a `null` flag deletes it), and `src/modules/users/routes.ts` (a resident's
 * acceptance is recorded by version through `POST me/consents`; nothing on the server compares it
 * with these versions, and nothing refuses an old app). What the app does with each setting is the
 * app's, which this console cannot see — so the sentences say what the app is given and what that
 * **can** make it do.
 *
 * The texts (`DL-186`), from `0f1ffec`: `privacy_notice` and `terms` publish a text and its version
 * together and set the version residents are asked to accept to it; the API never bumps a version.
 * The residents' app asks a resident to accept again when the version it is given differs from the
 * one they accepted (`taytay-mobile-app`, `auth_api_repository.dart`), so a new version **makes**
 * every resident accept again — said plainly, before the button.
 */
const APP_TOO_OLD_FOR_REVIEW_TIME =
  'An app too old to read this setting keeps saying what it was built to say.';

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
    'The notice’s text does not change here, only the version number residents are asked to ' +
      'accept — a new number on an unchanged notice asks residents to accept what they already ' +
      'did. To change the text, publish it under “Privacy notice” below.',
  ],
  privacyMismatch: (served: string, version: string) => [
    `The API serves privacy notice version ${served}, not ${version}. Residents may be asked to ` +
      'accept a version whose text the app cannot show them.',
  ],
  termsMismatch: (served: string, version: string) => [
    `The API serves the Terms of Use as version ${served}, not ${version}. Residents may be asked ` +
      'to accept a version whose text the app cannot show them.',
  ],
  termsPublished: (version: string, isNew: boolean) =>
    isNew
      ? [
          `This is a new version, ${version}, so it makes every resident accept the Terms of Use ` +
            'again in the app before going on using it.',
        ]
      : [
          `The version stays ${version}, so the text changes without asking anyone to accept ` +
            `again: a resident who accepted version ${version} is not shown the new Terms of Use ` +
            'to accept. Keep the version only to correct a mistake that does not change what ' +
            'residents agree to.',
        ],
  noticePublished: (version: string, isNew: boolean) =>
    isNew
      ? [
          `This is a new version, ${version}, so it makes every resident accept the privacy ` +
            'notice again in the app before going on using it.',
        ]
      : [
          `The version stays ${version}, so the text changes without asking anyone to accept ` +
            `again: a resident who accepted version ${version} is not shown the new privacy ` +
            'notice to accept. Keep the version only to correct a mistake that does not change ' +
            'what residents agree to.',
        ],
  asWritten: [
    'The text is published exactly as written here, and the app shows it as written. Nothing in ' +
      'this console writes, suggests or fills in legal text.',
  ],
  contact: ['Residents see the new contact details in the app.'],
  /**
   * The review time (`DL-205`, from `39d650b`): the app is given the range or `null`, and says the
   * one or says nothing. It asks nothing of a resident, so it needs no acknowledgement.
   */
  reviewTimeStated: (range: WorkingDayRange) => [
    `The app will tell residents an ID review ${reviewTimePhrase(range)}.`,
    APP_TOO_OLD_FOR_REVIEW_TIME,
  ],
  reviewTimeCleared: [
    'The app will stop saying how long an ID review takes.',
    APP_TOO_OLD_FOR_REVIEW_TIME,
  ],
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

/**
 * True for a change that can stop residents using the app until they act. The review time is not
 * one: it changes a sentence, and asks nobody to update or accept (`DL-205`).
 */
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
    (changes.privacyVersion !== undefined && changes.privacyVersion !== null) ||
    // A text published under a new version asks every resident to accept it (`DL-186`).
    (changes.terms !== undefined &&
      isNewLegalVersion(changes.terms.version, current.termsVersion)) ||
    (changes.privacyNotice !== undefined &&
      isNewLegalVersion(changes.privacyNotice.version, current.privacyVersion))
  );
}

/** Every consequence of saving this change, the ones that reach every resident first. */
export function appConfigEffects(current: AppConfig, changes: AppConfigChanges): readonly string[] {
  const effects: string[] = [];
  // The texts first: a new version reaches every resident before they can go on (`DL-186`).
  if (changes.terms !== undefined) {
    const version = changes.terms.version.trim();
    effects.push(
      ...APP_CONFIG_EFFECTS.termsPublished(
        version,
        isNewLegalVersion(version, current.termsVersion),
      ),
    );
  }
  if (changes.privacyNotice !== undefined) {
    const version = changes.privacyNotice.version.trim();
    effects.push(
      ...APP_CONFIG_EFFECTS.noticePublished(
        version,
        isNewLegalVersion(version, current.privacyVersion),
      ),
    );
  }
  if (changes.terms !== undefined || changes.privacyNotice !== undefined) {
    effects.push(...APP_CONFIG_EFFECTS.asWritten);
  }
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
    if (
      changes.terms === undefined &&
      changes.termsVersion !== null &&
      changes.termsVersion !== current.terms.version
    ) {
      effects.push(
        ...APP_CONFIG_EFFECTS.termsMismatch(current.terms.version, changes.termsVersion),
      );
    }
  }
  if (changes.privacyVersion !== undefined) {
    effects.push(...APP_CONFIG_EFFECTS.privacyChanged(changes.privacyVersion));
    if (
      changes.privacyNotice === undefined &&
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
  const reviewTime = changes.verificationReviewWorkingDays;
  if (reviewTime !== undefined) {
    effects.push(
      ...(reviewTime === null
        ? APP_CONFIG_EFFECTS.reviewTimeCleared
        : APP_CONFIG_EFFECTS.reviewTimeStated(reviewTime)),
    );
  }
  if (changes.contactLine !== undefined || changes.supportEmail !== undefined) {
    effects.push(...APP_CONFIG_EFFECTS.contact);
  }
  if (changes.featureFlags !== undefined && changes.featureFlags.length > 0) {
    effects.push(...APP_CONFIG_EFFECTS.flags);
  }
  return [...effects, ...APP_CONFIG_EFFECTS.always];
}
