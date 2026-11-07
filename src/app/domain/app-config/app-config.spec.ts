import { describe, expect, it } from 'vitest';

import { asIsoDateTime } from '../shared/ids';
import {
  APP_CONFIG_EFFECTS,
  appConfigEffects,
  appConfigProblems,
  asksEveryResident,
  compareAppVersions,
  isPlaceholderText,
  legalTextDraftFrom,
  type AppConfig,
} from './app-config';

const CONFIG: AppConfig = {
  contactLine: '(02) 8000 0100',
  supportEmail: null,
  privacyVersion: '2026-01',
  termsVersion: '2026-01',
  minimumAppVersion: '1.4.0',
  featureFlags: [{ key: 'show_digital_id', value: 'true' }],
  privacyNotice: {
    version: '2026-01',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown: 'The privacy notice as the LGU published it.',
  },
  terms: {
    version: '2026-01',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown: 'The Terms of Use as the LGU published them.',
  },
  updatedAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
};

describe('the app’s settings (DL-170)', () => {
  it('compares versions by number, segment by segment', () => {
    expect(compareAppVersions('1.10', '1.9')).toBe(1);
    expect(compareAppVersions('1.4', '1.4.0')).toBe(0);
    expect(compareAppVersions('1.3.9', '1.4')).toBe(-1);
  });

  it('refuses what the API refuses', () => {
    const problems = appConfigProblems({
      contactLine: 'call us',
      supportEmail: 'nobody',
      minimumAppVersion: 'v2',
      featureFlags: [
        { key: 'Show-ID', value: 'true' },
        { key: 'ok_flag', value: '' },
      ],
    });

    expect(problems.map((problem) => problem.field)).toEqual([
      'contactLine',
      'supportEmail',
      'minimumAppVersion',
      'featureFlags',
      'featureFlags',
    ]);
    expect(
      appConfigProblems({ minimumAppVersion: null, featureFlags: [{ key: 'old', value: null }] }),
    ).toEqual([]);
  });

  it('refuses a version longer than the column that holds it', () => {
    expect(appConfigProblems({ minimumAppVersion: '1234567890.1234567890' })).toHaveLength(1);
  });

  it('asks every resident only when the oldest version rises or a version to accept changes', () => {
    expect(asksEveryResident(CONFIG, { minimumAppVersion: '1.5' })).toBe(true);
    expect(asksEveryResident(CONFIG, { minimumAppVersion: '1.3' })).toBe(false);
    expect(asksEveryResident(CONFIG, { minimumAppVersion: null })).toBe(false);
    expect(asksEveryResident(CONFIG, { termsVersion: '2026-11' })).toBe(true);
    expect(asksEveryResident(CONFIG, { privacyVersion: '2026-11' })).toBe(true);
    expect(asksEveryResident(CONFIG, { contactLine: null })).toBe(false);
  });

  it('says what reaches every resident first, and that the server keeps no record of which setting', () => {
    const effects = appConfigEffects(CONFIG, { minimumAppVersion: '2.0', contactLine: '911' });

    expect(effects[0]).toContain('can force every resident whose app is older than 2.0 to update');
    expect(effects).toContain(APP_CONFIG_EFFECTS.contact[0]);
    expect(effects.at(-1)).toContain('not which setting');
  });

  it('warns when residents would be asked to accept a notice the API does not serve', () => {
    const effects = appConfigEffects(CONFIG, { privacyVersion: '2026-11' });

    expect(effects.join(' ')).toContain(
      'The API serves privacy notice version 2026-01, not 2026-11',
    );
    expect(effects.join(' ')).toContain('text does not change here');
  });
});

describe('the texts residents accept (DL-186)', () => {
  const PLACEHOLDER = {
    version: 'placeholder',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown: 'This is a placeholder for the Terms of Use.',
  };

  it('starts the editor from the published text, and from nothing while it is the placeholder', () => {
    expect(legalTextDraftFrom(CONFIG.terms)).toEqual({
      version: '2026-01',
      bodyMarkdown: 'The Terms of Use as the LGU published them.',
    });
    // The placeholder's sentence is not legal text, and nothing is invented in its place.
    expect(legalTextDraftFrom(PLACEHOLDER)).toEqual({ version: '', bodyMarkdown: '' });
    expect(isPlaceholderText({ version: ' Placeholder ' })).toBe(true);
  });

  it('refuses what the API refuses: no version, the placeholder’s, no text, or two versions', () => {
    const fields = (changes: Parameters<typeof appConfigProblems>[0]) =>
      appConfigProblems(changes).map((problem) => problem.field);

    expect(fields({ terms: { version: ' ', bodyMarkdown: 'Text.' } })).toEqual(['terms']);
    expect(fields({ terms: { version: 'PLACEHOLDER', bodyMarkdown: 'Text.' } })).toEqual(['terms']);
    expect(fields({ privacyNotice: { version: '2026-11', bodyMarkdown: '  ' } })).toEqual([
      'privacyNotice',
    ]);
    expect(fields({ terms: { version: '2026-11', bodyMarkdown: 'x'.repeat(20001) } })).toEqual([
      'terms',
    ]);
    expect(
      fields({ terms: { version: '2026-11', bodyMarkdown: 'Text.' }, termsVersion: '2026-12' }),
    ).toEqual(['terms']);
    expect(
      fields({ terms: { version: '2026-11', bodyMarkdown: 'Text.' }, termsVersion: '2026-11' }),
    ).toEqual([]);
  });

  it('asks every resident to accept again for a new version, and not for the same one', () => {
    expect(
      asksEveryResident(CONFIG, { terms: { version: '2026-11', bodyMarkdown: 'New text.' } }),
    ).toBe(true);
    expect(
      asksEveryResident(CONFIG, { privacyNotice: { version: '2026-11', bodyMarkdown: 'New.' } }),
    ).toBe(true);
    expect(
      asksEveryResident(CONFIG, { terms: { version: '2026-01', bodyMarkdown: 'Corrected.' } }),
    ).toBe(false);
  });

  it('says plainly what a new version does, and what keeping the version does', () => {
    const renewed = appConfigEffects(CONFIG, {
      terms: { version: '2026-11', bodyMarkdown: 'New text.' },
    }).join(' ');
    expect(renewed).toContain(
      'This is a new version, 2026-11, so it makes every resident accept the Terms of Use again in the app',
    );
    expect(renewed).toContain('Nothing in this console writes, suggests or fills in legal text.');

    const corrected = appConfigEffects(CONFIG, {
      privacyNotice: { version: '2026-01', bodyMarkdown: 'Corrected.' },
    }).join(' ');
    expect(corrected).toContain(
      'The version stays 2026-01, so the text changes without asking anyone to accept again',
    );
    expect(corrected).not.toContain('accept the privacy notice again in the app');
  });
});
