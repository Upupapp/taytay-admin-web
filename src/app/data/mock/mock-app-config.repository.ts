import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  AppConfigRefusedError,
  appConfigProblems,
  asIsoDateTime,
  workingDayRangeProblems,
  type AppConfig,
  type AppConfigChanges,
  type ArchivedFeatureFlag,
  type AppConfigRepository,
  type LegalText,
  type LegalTextDraft,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';

/**
 * The residents' app's settings, for the `local-mock` configuration (`DL-170`). Fictional: the
 * contact line dials nobody in particular, the address is at `settings.example.test`, a reserved
 * name and a `check:bundle` marker, and the privacy notice and the Terms of Use are the API's own
 * placeholders, and so is the biometric consent: no legal text is invented here either (`DL-186`,
 * `DL-216`). The review time is the range the API's migration `0046` stores, today's copy in the
 * app (`DL-205`).
 */
export const MOCK_APP_CONFIG: AppConfig = {
  contactLine: '(02) 8000 0100',
  supportEmail: 'help@settings.example.test',
  privacyVersion: 'placeholder',
  termsVersion: '2026-01',
  minimumAppVersion: '1.0.0',
  verificationReviewWorkingDays: { min: 1, max: 3 },
  featureFlags: [
    { key: 'show_digital_id', value: 'true' },
    { key: 'tulong_catalogue', value: 'on' },
  ],
  privacyNotice: {
    version: 'placeholder',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown:
      'This is a placeholder privacy notice. The approved notice will replace this text.',
  },
  terms: {
    version: 'placeholder',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown:
      'This is a placeholder for the Terms of Use. The approved Terms of Use will replace this text.',
  },
  // The API's placeholder, as migration 0048 stores it: the server refuses every selfie (`DL-216`).
  biometricConsent: {
    version: 'placeholder',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown:
      'This is a placeholder for the consent to use your selfie to check your identity. The ' +
      'approved text will replace it. Until then, no selfie can be sent.',
  },
  updatedAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
};

/**
 * In memory, as the API keeps them: the read is public, a change re-checks `app-config.manage`
 * (rule 4), `null` clears a setting, a flag set to `null` is archived with its value, and a value on
 * an archived flag's key restores it (`DL-225`).
 */
@Injectable()
export class MockAppConfigRepository implements AppConfigRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private config: AppConfig = MOCK_APP_CONFIG;
  private archived: readonly ArchivedFeatureFlag[] = [];

  read(): Observable<AppConfig> {
    return this.latency.respond(this.config);
  }

  archivedFlags(): Observable<readonly ArchivedFeatureFlag[]> {
    const denied = denyUnless<readonly ArchivedFeatureFlag[]>(
      this.access.currentUser(),
      'app-config.manage',
    );
    return denied ?? this.latency.respond(this.archived);
  }

  change(changes: AppConfigChanges): Observable<AppConfig> {
    const user = this.access.currentUser();
    const denied = denyUnless<AppConfig>(user, 'app-config.manage');
    if (denied) return denied;
    // The review time is refused as the API refuses it, each sentence by the end it is about.
    const range = changes.verificationReviewWorkingDays;
    const refusedTime = range === undefined || range === null ? [] : workingDayRangeProblems(range);
    if (refusedTime.length > 0) {
      return throwError(
        () => new AppConfigRefusedError('The request could not be validated.', refusedTime),
      );
    }
    // Refused as the API refuses it, with a 422: a placeholder version, an empty text, two versions.
    const refused = appConfigProblems(changes)[0];
    if (refused !== undefined) return throwError(() => new Error(refused.message));
    const now = asIsoDateTime(new Date());
    const published = (draft: LegalTextDraft | undefined, current: LegalText): LegalText =>
      draft === undefined
        ? current
        : {
            version: draft.version.trim(),
            bodyMarkdown: draft.bodyMarkdown.trim(),
            updatedAt: now,
          };

    const flags = new Map(this.config.featureFlags.map((flag) => [flag.key, flag.value]));
    const archived = new Map(this.archived.map((flag) => [flag.key, flag]));
    for (const flag of changes.featureFlags ?? []) {
      const value = flags.get(flag.key);
      if (flag.value === null) {
        // Archived with its value, never deleted; a key the app is not given is left as it is.
        if (value !== undefined) {
          flags.delete(flag.key);
          archived.set(flag.key, {
            key: flag.key,
            value,
            archived: { at: now, byName: user?.displayName ?? null, reason: null },
          });
        }
      } else {
        archived.delete(flag.key);
        flags.set(flag.key, flag.value);
      }
    }
    this.archived = [...archived.values()].sort((a, b) => a.key.localeCompare(b.key));
    const pick = (value: string | null | undefined, current: string | null) =>
      value === undefined ? current : value;

    this.config = {
      ...this.config,
      contactLine: pick(changes.contactLine, this.config.contactLine),
      supportEmail: pick(changes.supportEmail, this.config.supportEmail),
      // Publishing a text sets the version residents are asked to accept to its own (`DL-186`).
      privacyVersion:
        changes.privacyNotice?.version.trim() ??
        pick(changes.privacyVersion, this.config.privacyVersion),
      termsVersion:
        changes.terms?.version.trim() ?? pick(changes.termsVersion, this.config.termsVersion),
      privacyNotice: published(changes.privacyNotice, this.config.privacyNotice),
      terms: published(changes.terms, this.config.terms),
      biometricConsent:
        this.config.biometricConsent === undefined
          ? undefined
          : published(changes.biometricConsent, this.config.biometricConsent),
      minimumAppVersion: pick(changes.minimumAppVersion, this.config.minimumAppVersion),
      verificationReviewWorkingDays:
        range === undefined ? this.config.verificationReviewWorkingDays : range,
      featureFlags: [...flags]
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.key.localeCompare(b.key)),
      updatedAt: now,
    };
    return this.latency.respond(this.config);
  }
}
