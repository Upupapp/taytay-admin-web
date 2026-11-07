import type {
  AppConfig,
  AppConfigChanges,
  FeatureFlag,
  LegalText,
  LegalTextDraft,
} from '@domain/index';

import { dateTime, field, str } from './wire';

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
 * `AppConfig` → `AppConfig` (`DL-170`).
 *
 * Every setting is required by the spec, nullable, and read as it is: a setting the console could
 * not read would be shown as "not set" and saved as such by the next change, so an unreadable one
 * makes the whole configuration unreadable instead.
 *
 * The privacy notice and the Terms of Use are read with their text (`DL-186`), because an
 * administrator now publishes both here, and the screen shows what residents are shown.
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
  const featureFlags = flagsOf(field(wire, 'feature_flags'));
  const privacyNotice = legalTextOf(field(wire, 'privacy_notice'));
  const terms = legalTextOf(field(wire, 'terms'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    contactLine === undefined ||
    supportEmail === undefined ||
    privacyVersion === undefined ||
    termsVersion === undefined ||
    minimumAppVersion === undefined ||
    featureFlags === null ||
    privacyNotice === null ||
    terms === null ||
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
    featureFlags,
    privacyNotice,
    terms,
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
  readonly feature_flags: Readonly<Record<string, string | null>> | undefined;
  readonly terms: LegalTextWire | undefined;
  readonly privacy_notice: LegalTextWire | undefined;
}

/** `TermsOfUseWrite` and `PrivacyNoticeWrite`: the text and its version, always together. */
export interface LegalTextWire {
  readonly version: string;
  readonly body_markdown: string;
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
    feature_flags:
      changes.featureFlags === undefined || changes.featureFlags.length === 0
        ? undefined
        : Object.fromEntries(changes.featureFlags.map((flag) => [flag.key, flag.value])),
    terms: toWireLegalText(changes.terms),
    privacy_notice: toWireLegalText(changes.privacyNotice),
  };
}
