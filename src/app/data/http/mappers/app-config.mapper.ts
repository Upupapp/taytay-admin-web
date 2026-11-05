import type { AppConfig, AppConfigChanges, FeatureFlag } from '@domain/index';

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
 * `AppConfig` → `AppConfig` (`DL-170`).
 *
 * Every setting is required by the spec, nullable, and read as it is: a setting the console could
 * not read would be shown as "not set" and saved as such by the next change, so an unreadable one
 * makes the whole configuration unreadable instead.
 *
 * **Not read**: `privacy_notice.body_markdown`, the notice's text — the API keeps it and no route
 * changes it, so this screen shows its version and date and nothing else.
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
  const notice = field(wire, 'privacy_notice');
  const noticeVersion = str(field(notice, 'version'));
  const noticeUpdatedAt = dateTime(field(notice, 'updated_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    contactLine === undefined ||
    supportEmail === undefined ||
    privacyVersion === undefined ||
    termsVersion === undefined ||
    minimumAppVersion === undefined ||
    featureFlags === null ||
    noticeVersion === null ||
    noticeUpdatedAt === null ||
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
    privacyNotice: { version: noticeVersion, updatedAt: noticeUpdatedAt },
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
  };
}
