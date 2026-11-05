import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asIsoDateTime,
  type AppConfig,
  type AppConfigChanges,
  type AppConfigRepository,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';

/**
 * The residents' app's settings, for the `local-mock` configuration (`DL-170`). Fictional: the
 * contact line dials nobody in particular, the address is at `settings.example.test`, a reserved
 * name and a `check:bundle` marker, and the privacy notice is the API's own placeholder version.
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
  privacyNotice: { version: 'placeholder', updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z') },
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
      privacyVersion: pick(changes.privacyVersion, this.config.privacyVersion),
      termsVersion: pick(changes.termsVersion, this.config.termsVersion),
      minimumAppVersion: pick(changes.minimumAppVersion, this.config.minimumAppVersion),
      featureFlags: [...flags]
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => a.key.localeCompare(b.key)),
      updatedAt: asIsoDateTime(new Date()),
    };
    return this.latency.respond(this.config);
  }
}
