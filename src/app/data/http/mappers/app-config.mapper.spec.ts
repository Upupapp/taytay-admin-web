import { describe, expect, it } from 'vitest';

import APP_CONFIG from '../fixtures/app-config.json';
import { toAppConfig, toWireAppConfigChanges } from './app-config.mapper';

describe('the app settings mapper (DL-170)', () => {
  it('reads every setting, the flags by name, and the notice by version and date only', () => {
    const config = toAppConfig(APP_CONFIG.data);

    expect(config).toMatchObject({
      contactLine: '(02) 8000 0100',
      supportEmail: null,
      minimumAppVersion: '1.4.0',
      featureFlags: [
        { key: 'show_digital_id', value: 'true' },
        { key: 'tulong_catalogue', value: 'on' },
      ],
      privacyNotice: { version: 'placeholder' },
    });
    expect(JSON.stringify(config)).not.toContain('placeholder privacy notice');
  });

  it('refuses settings it cannot read, rather than showing one as not set', () => {
    expect(toAppConfig({ ...APP_CONFIG.data, terms_version: 7 })).toBeNull();
    expect(toAppConfig({ ...APP_CONFIG.data, feature_flags: { on: true } })).toBeNull();
    expect(toAppConfig({ ...APP_CONFIG.data, privacy_notice: null })).toBeNull();
  });

  it('sends only what changed: null clears, and a flag set to null is deleted', () => {
    const wire = toWireAppConfigChanges({
      minimumAppVersion: null,
      featureFlags: [
        { key: 'show_digital_id', value: null },
        { key: 'new_flag', value: 'on' },
      ],
    });

    expect(JSON.parse(JSON.stringify(wire))).toEqual({
      minimum_app_version: null,
      feature_flags: { show_digital_id: null, new_flag: 'on' },
    });
    expect(JSON.parse(JSON.stringify(toWireAppConfigChanges({})))).toEqual({});
  });
});
