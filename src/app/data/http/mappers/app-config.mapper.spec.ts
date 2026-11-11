import { describe, expect, it } from 'vitest';

import APP_CONFIG from '../fixtures/app-config.json';
import {
  fromWireReviewTimeRefusal,
  toAppConfig,
  toWireAppConfigChanges,
} from './app-config.mapper';

describe('the app settings mapper (DL-170)', () => {
  it('reads every setting, the flags by name, and both texts whole with their versions (DL-186)', () => {
    const config = toAppConfig(APP_CONFIG.data);

    expect(config).toMatchObject({
      contactLine: '(02) 8000 0100',
      supportEmail: null,
      minimumAppVersion: '1.4.0',
      featureFlags: [
        { key: 'show_digital_id', value: 'true' },
        { key: 'tulong_catalogue', value: 'on' },
      ],
      privacyNotice: {
        version: 'placeholder',
        bodyMarkdown:
          'This is a placeholder privacy notice. The approved notice will replace this text.',
      },
      terms: {
        version: 'placeholder',
        updatedAt: '2026-01-01T00:00:00.000Z',
        bodyMarkdown:
          'This is a placeholder for the Terms of Use. The approved Terms of Use will replace this text.',
      },
    });
  });

  it('refuses settings it cannot read, rather than showing one as not set', () => {
    expect(toAppConfig({ ...APP_CONFIG.data, terms_version: 7 })).toBeNull();
    expect(toAppConfig({ ...APP_CONFIG.data, feature_flags: { on: true } })).toBeNull();
    expect(toAppConfig({ ...APP_CONFIG.data, privacy_notice: null })).toBeNull();
    // A text without its version could be edited and republished under the wrong one.
    expect(toAppConfig({ ...APP_CONFIG.data, terms: undefined })).toBeNull();
    expect(
      toAppConfig({ ...APP_CONFIG.data, terms: { ...APP_CONFIG.data.terms, body_markdown: 4 } }),
    ).toBeNull();
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

  describe('the review time (DL-205)', () => {
    it('reads the range as sent, and null as the app stating none', () => {
      expect(toAppConfig(APP_CONFIG.data)?.verificationReviewWorkingDays).toEqual({
        min: 2,
        max: 5,
      });
      expect(
        toAppConfig({ ...APP_CONFIG.data, verification_review_working_days: null })
          ?.verificationReviewWorkingDays,
      ).toBeNull();
    });

    it('reads an API that does not send it as unknown: neither none nor a number of its own', () => {
      const older = Object.fromEntries(
        Object.entries(APP_CONFIG.data).filter(
          ([key]) => key !== 'verification_review_working_days',
        ),
      );
      const config = toAppConfig(older);

      expect(config).not.toBeNull();
      expect(config?.verificationReviewWorkingDays).toBeUndefined();
      expect(config !== null && 'verificationReviewWorkingDays' in config).toBe(true);
    });

    it('refuses a review time it cannot read, rather than showing it as none', () => {
      for (const unreadable of [
        '1-3',
        { min: 1 },
        { min: 1.5, max: 3 },
        { min: '1', max: '3' },
        { min: 4, max: 2 },
        { min: 0, max: 2 },
      ]) {
        expect(
          toAppConfig({ ...APP_CONFIG.data, verification_review_working_days: unreadable }),
        ).toBeNull();
      }
    });

    it('sends the range whole under its own key, null to state none, and nothing when unchanged', () => {
      const send = (changes: Parameters<typeof toWireAppConfigChanges>[0]): unknown =>
        JSON.parse(JSON.stringify(toWireAppConfigChanges(changes)));

      expect(send({ verificationReviewWorkingDays: { min: 2, max: 5 } })).toEqual({
        verification_review_working_days: { min: 2, max: 5 },
      });
      expect(send({ verificationReviewWorkingDays: null })).toEqual({
        verification_review_working_days: null,
      });
      expect(send({ contactLine: null })).toEqual({ contact_line: null });
    });

    it('puts each of the server’s sentences with the input it is about, and leaves the rest', () => {
      expect(
        fromWireReviewTimeRefusal({
          'verification_review_working_days.min': ['At least 1 working day.'],
          'verification_review_working_days.max': [
            'The fewest working days cannot be more than the most.',
          ],
          verification_review_working_days: ['Expected object, received string'],
          support_email: ['Invalid email'],
        }),
      ).toEqual([
        { field: 'min', message: 'At least 1 working day.' },
        { field: 'max', message: 'The fewest working days cannot be more than the most.' },
        { field: 'range', message: 'Expected object, received string' },
      ]);
      expect(fromWireReviewTimeRefusal({ support_email: ['Invalid email'] })).toEqual([]);
      expect(fromWireReviewTimeRefusal(null)).toEqual([]);
    });
  });

  it('publishes a text and its version together, as the API reads them (DL-186)', () => {
    const wire = toWireAppConfigChanges({
      terms: { version: ' 2026-11 ', bodyMarkdown: '  The text the LGU approved.  ' },
      privacyNotice: { version: '2026-11', bodyMarkdown: 'The notice the LGU approved.' },
    });

    expect(JSON.parse(JSON.stringify(wire))).toEqual({
      terms: { version: '2026-11', body_markdown: 'The text the LGU approved.' },
      privacy_notice: { version: '2026-11', body_markdown: 'The notice the LGU approved.' },
    });
  });
});
