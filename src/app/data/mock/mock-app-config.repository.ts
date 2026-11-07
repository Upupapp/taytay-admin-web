import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  appConfigProblems,
  asIsoDateTime,
  type AppConfig,
  type AppConfigChanges,
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
 * placeholders: no legal text is invented here either (`DL-186`).
 */
export const MOCK_APP_CONFIG: AppConfig = {
  contactLine: '(02) 8000 0100',
  supportEmail: 'help@settings.example.test',
  privacyVersion: 'placeholder',
  termsVersion: '2026-01',
  minimumAppVersion: '1.0.0',
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
  updatedAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
};

/**
 * In memory, as the API keeps them: the read is public, a change re-checks `app-config.manage`
 * (rule 4), `null` clears a setting, and a flag set to `null` is deleted.
 */
@Injectable()
export class MockAppConfigRepository implements AppConfigRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private config: AppConfig = MOCK_APP_CONFIG;

  read(): Observable<AppConfig> {
    return this.latency.respond(this.config);
  }

  change(changes: AppConfigChanges): Observable<AppConfig> {
    const denied = denyUnless<AppConfig>(this.access.currentUser(), 'app-config.manage');
    if (denied) return denied;
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
    for (const flag of changes.featureFlags ?? []) {
      if (flag.value === null) flags.delete(flag.key);
      else flags.set(flag.key, flag.value);
    }
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
      minimumAppVersion: pick(changes.minimumAppVersion, this.config.minimumAppVersion),
      featureFlags: [...flags]
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.key.localeCompare(b.key)),
      updatedAt: now,
    };
    return this.latency.respond(this.config);
  }
}
