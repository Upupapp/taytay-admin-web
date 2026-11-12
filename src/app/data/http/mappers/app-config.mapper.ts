import type {
  AppConfig,
  AppConfigChanges,
  FeatureFlag,
  FieldProblem,
  LegalText,
  LegalTextDraft,
  ReviewTimePart,
  WorkingDayRange,
} from '@domain/index';

import { dateTime, field, int, str } from './wire';

/** A nullable setting: a string, or `null` — and `undefined` when the wire is neither. */
function setting(value: unknown): string | null | undefined {
  return value === null ? null : (str(value) ?? undefined);
}

/** Every flag read, or `null`: a flag left out would read as one the app is not given. */
function flagsOf(value: unknown): readonly FeatureFlag[] | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const flags: FeatureFlag[] = [];
  for (const [key, flag] of Object.entries(value)) {
    if (typeof flag !== 'string') {
      return null;
    }
    flags.push({ key, value: flag });
  }
  return flags.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * A text residents accept, read whole or not at all: a text shown without its version could be
 * edited and republished under the wrong one (`DL-186`). The text is read exactly as sent.
 */
function legalTextOf(value: unknown): LegalText | null {
  const version = str(field(value, 'version'));
  const updatedAt = dateTime(field(value, 'updated_at'));
  const bodyMarkdown = str(field(value, 'body_markdown'));
  return version === null || updatedAt === null || bodyMarkdown === null
    ? null
    : { version, updatedAt, bodyMarkdown };
}

/**
 * The biometric consent, read whole like the other texts (`DL-216`) — and, when the key is not
 * there at all, `undefined`: an API older than the consent, which is unknown rather than "the
 * placeholder", and offers nothing to publish. Anything else unreadable makes the whole
 * configuration unreadable, by the rule below.
 */
function biometricConsentOf(
  value: unknown,
):
  { readonly readable: true; readonly text: LegalText | undefined } | { readonly readable: false } {
  if (value === undefined) {
    return { readable: true, text: undefined };
  }
  const text = legalTextOf(value);
  return text === null ? { readable: false } : { readable: true, text };
}

/**
 * The review time, as sent (`DL-205`): a range, `null` when the app states none — and, when the key
 * is not there at all, `undefined`: an API older than the setting, which is unknown rather than
 * "none". Read as `null`, the next save would offer to keep the app silent; no number stands in for
 * it either. Anything else is unreadable, and with it the whole configuration (the rule below).
 * Fewest ≤ most is read as the server keeps it; how many days at most is the server's policy.
 */
function reviewTimeOf(
  value: unknown,
):
  | { readonly readable: true; readonly days: WorkingDayRange | null | undefined }
  | { readonly readable: false } {
  if (value === undefined || value === null) {
    return { readable: true, days: value };
  }
  const min = int(field(value, 'min'));
  const max = int(field(value, 'max'));
  return min === null || max === null || min < 1 || min > max
    ? { readable: false }
    : { readable: true, days: { min, max } };
}

/**
 * `AppConfig` → `AppConfig` (`DL-170`).
 *
 * Every setting is required by the spec, nullable, and read as it is: a setting the console could
 * not read would be shown as "not set" and saved as such by the next change, so an unreadable one
 * makes the whole configuration unreadable instead.
 *
 * The privacy notice and the Terms of Use are read with their text (`DL-186`), because an
 * administrator now publishes both here, and the screen shows what residents are shown; the
 * biometric consent the same way (`DL-216`). `biometric_consent_version` is not read: it is the
 * text's version, or `null` while that is the placeholder, which `biometricVersionAskedNow` derives.
 *
 * @consumes GET app/config
 * @consumes PATCH admin/app/config
 */
export function toAppConfig(wire: unknown): AppConfig | null {
  const contactLine = setting(field(wire, 'contact_line'));
  const supportEmail = setting(field(wire, 'support_email'));
  const privacyVersion = setting(field(wire, 'privacy_version'));
  const termsVersion = setting(field(wire, 'terms_version'));
  const minimumAppVersion = setting(field(wire, 'minimum_app_version'));
  const reviewTime = reviewTimeOf(field(wire, 'verification_review_working_days'));
  const featureFlags = flagsOf(field(wire, 'feature_flags'));
  const privacyNotice = legalTextOf(field(wire, 'privacy_notice'));
  const terms = legalTextOf(field(wire, 'terms'));
  const biometricConsent = biometricConsentOf(field(wire, 'biometric_consent'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    contactLine === undefined ||
    supportEmail === undefined ||
    privacyVersion === undefined ||
    termsVersion === undefined ||
    minimumAppVersion === undefined ||
    !reviewTime.readable ||
    featureFlags === null ||
    privacyNotice === null ||
    terms === null ||
    !biometricConsent.readable ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    contactLine,
    supportEmail,
    privacyVersion,
    termsVersion,
    minimumAppVersion,
    verificationReviewWorkingDays: reviewTime.days,
    featureFlags,
    privacyNotice,
    terms,
    biometricConsent: biometricConsent.text,
    updatedAt,
  };
}

/** `AppConfigPatch`. `undefined` is left out; `null` clears a setting or deletes a flag. */
export interface AppConfigPatchWire {
  readonly contact_line: string | null | undefined;
  readonly support_email: string | null | undefined;
  readonly privacy_version: string | null | undefined;
  readonly terms_version: string | null | undefined;
  readonly minimum_app_version: string | null | undefined;
  readonly verification_review_working_days: WorkingDaysWire | null | undefined;
  readonly feature_flags: Readonly<Record<string, string | null>> | undefined;
  readonly terms: LegalTextWire | undefined;
  readonly privacy_notice: LegalTextWire | undefined;
  readonly biometric_consent: LegalTextWire | undefined;
}

/** `TermsOfUseWrite`, `PrivacyNoticeWrite` and `BiometricConsentWrite`: the text and its version, always together. */
export interface LegalTextWire {
  readonly version: string;
  readonly body_markdown: string;
}

/** `VerificationReviewWorkingDays`: both ends together, whole numbers (`DL-205`). */
export interface WorkingDaysWire {
  readonly min: number;
  readonly max: number;
}

/** The range whole, or `null` to make the app state none; `undefined` leaves it as stored. */
function toWireWorkingDays(
  range: WorkingDayRange | null | undefined,
): WorkingDaysWire | null | undefined {
  return range === undefined || range === null ? range : { min: range.min, max: range.max };
}

function toWireLegalText(draft: LegalTextDraft | undefined): LegalTextWire | undefined {
  return draft === undefined
    ? undefined
    : { version: draft.version.trim(), body_markdown: draft.bodyMarkdown.trim() };
}

export function toWireAppConfigChanges(changes: AppConfigChanges): AppConfigPatchWire {
  return {
    contact_line: changes.contactLine,
    support_email: changes.supportEmail,
    privacy_version: changes.privacyVersion,
    terms_version: changes.termsVersion,
    minimum_app_version: changes.minimumAppVersion,
    verification_review_working_days: toWireWorkingDays(changes.verificationReviewWorkingDays),
    feature_flags:
      changes.featureFlags === undefined || changes.featureFlags.length === 0
        ? undefined
        : Object.fromEntries(changes.featureFlags.map((flag) => [flag.key, flag.value])),
    terms: toWireLegalText(changes.terms),
    privacy_notice: toWireLegalText(changes.privacyNotice),
    biometric_consent: toWireLegalText(changes.biometricConsent),
  };
}

/**
 * Where each of the server's sentences about the review time belongs (`DL-205`): its 422 names the
 * end it refused (`….min`, `….max`), or the whole value when it is not a range at all.
 */
const REVIEW_TIME_DETAIL_KEYS: Readonly<Record<string, ReviewTimePart>> = {
  'verification_review_working_days.min': 'min',
  'verification_review_working_days.max': 'max',
  verification_review_working_days: 'range',
};

/** The server's sentences about the review time, each by the input it belongs to, in its words. */
export function fromWireReviewTimeRefusal(
  details: Readonly<Record<string, readonly string[]>> | null,
): readonly FieldProblem<ReviewTimePart>[] {
  const problems: FieldProblem<ReviewTimePart>[] = [];
  for (const [key, messages] of Object.entries(details ?? {})) {
    const part = REVIEW_TIME_DETAIL_KEYS[key];
    if (part === undefined) continue;
    for (const message of messages) problems.push({ field: part, message });
  }
  return problems;
}
