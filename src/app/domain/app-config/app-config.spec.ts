import { describe, expect, it } from 'vitest';

import { asIsoDateTime } from '../shared/ids';
import {
  APP_CONFIG_EFFECTS,
  appConfigEffects,
  appConfigProblems,
  asksEveryResident,
  biometricVersionAskedNow,
  compareAppVersions,
  isPlaceholderText,
  legalTextDraftFrom,
  readWorkingDayRange,
  refusesEverySelfie,
  reviewTimePhrase,
  workingDayRangeProblems,
  type AppConfig,
} from './app-config';

const CONFIG: AppConfig = {
  contactLine: '(02) 8000 0100',
  supportEmail: null,
  privacyVersion: '2026-01',
  termsVersion: '2026-01',
  minimumAppVersion: '1.4.0',
  verificationReviewWorkingDays: { min: 1, max: 3 },
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
  biometricConsent: {
    version: 'placeholder',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown: 'This is a placeholder for the consent to use your selfie.',
  },
  updatedAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
};

const PUBLISHED: AppConfig = {
  ...CONFIG,
  biometricConsent: {
    version: '2026-11',
    updatedAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
    bodyMarkdown: 'The biometric consent as the LGU published it.',
  },
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

describe('how long an ID review usually takes (DL-205)', () => {
  it('words the range by the app’s rule, one number when both ends are the same', () => {
    expect(reviewTimePhrase({ min: 2, max: 5 })).toBe('usually takes 2–5 working days');
    expect(reviewTimePhrase({ min: 1, max: 1 })).toBe('usually takes 1 working day');
    expect(reviewTimePhrase({ min: 4, max: 4 })).toBe('usually takes 4 working days');
  });

  it('reads what is typed as the server reads it, each problem by the end it is about', () => {
    expect(readWorkingDayRange(' 2 ', '5')).toEqual({ range: { min: 2, max: 5 }, problems: [] });
    expect(readWorkingDayRange('', '').problems).toEqual([
      { field: 'min', message: 'Give the fewest working days.' },
      { field: 'max', message: 'Give the most working days.' },
    ]);
    expect(readWorkingDayRange('1.5', 'three').problems).toEqual([
      { field: 'min', message: 'Working days are a whole number.' },
      { field: 'max', message: 'Working days are a whole number.' },
    ]);
    expect(readWorkingDayRange('0', '31').problems).toEqual([
      { field: 'min', message: 'At least 1 working day.' },
      { field: 'max', message: 'At most 30 working days.' },
    ]);
    expect(readWorkingDayRange('0', '').problems).toEqual([
      { field: 'min', message: 'At least 1 working day.' },
      { field: 'max', message: 'Give the most working days.' },
    ]);
    const reversed = readWorkingDayRange('5', '2');
    expect(reversed.range).toBeNull();
    expect(reversed.problems).toEqual([
      { field: 'max', message: 'The fewest working days cannot be more than the most.' },
    ]);
    expect(workingDayRangeProblems({ min: 1, max: 30 })).toEqual([]);
  });

  it('refuses a range the API refuses, and nothing for null', () => {
    expect(appConfigProblems({ verificationReviewWorkingDays: { min: 3, max: 2 } })).toEqual([
      {
        field: 'verificationReviewWorkingDays',
        message: 'The fewest working days cannot be more than the most.',
      },
    ]);
    expect(appConfigProblems({ verificationReviewWorkingDays: null })).toEqual([]);
  });

  it('says what the app will say, or that it will stop, and asks nobody to acknowledge it', () => {
    const stated = appConfigEffects(CONFIG, { verificationReviewWorkingDays: { min: 2, max: 5 } });
    expect(stated[0]).toBe(
      'The app will tell residents an ID review usually takes 2–5 working days.',
    );
    expect(stated.join(' ')).toContain('An app too old to read this setting keeps saying');
    expect(appConfigEffects(CONFIG, { verificationReviewWorkingDays: { min: 1, max: 1 } })[0]).toBe(
      'The app will tell residents an ID review usually takes 1 working day.',
    );
    expect(appConfigEffects(CONFIG, { verificationReviewWorkingDays: null })[0]).toBe(
      'The app will stop saying how long an ID review takes.',
    );
    expect(asksEveryResident(CONFIG, { verificationReviewWorkingDays: null })).toBe(false);
    expect(asksEveryResident(CONFIG, { verificationReviewWorkingDays: { min: 9, max: 30 } })).toBe(
      false,
    );
  });
});

describe('the biometric (selfie) consent (DL-216)', () => {
  it('refuses every selfie exactly while the text is the placeholder, and knows nothing when not sent', () => {
    expect(refusesEverySelfie(CONFIG)).toBe(true);
    expect(refusesEverySelfie(PUBLISHED)).toBe(false);
    expect(refusesEverySelfie({ ...CONFIG, biometricConsent: undefined })).toBe(false);
    expect(biometricVersionAskedNow(CONFIG.biometricConsent ?? PUBLISHED.terms)).toBeNull();
    expect(biometricVersionAskedNow(PUBLISHED.terms)).toBe('2026-01');
  });

  it('refuses what the API refuses: no version, the placeholder’s, or no text', () => {
    const fields = (draft: { version: string; bodyMarkdown: string }) =>
      appConfigProblems({ biometricConsent: draft }).map((problem) => problem.field);

    expect(fields({ version: '', bodyMarkdown: 'Text.' })).toEqual(['biometricConsent']);
    expect(fields({ version: 'Placeholder', bodyMarkdown: 'Text.' })).toEqual(['biometricConsent']);
    expect(fields({ version: '2026-11', bodyMarkdown: '  ' })).toEqual(['biometricConsent']);
    expect(fields({ version: '2026-11', bodyMarkdown: 'The approved consent.' })).toEqual([]);
  });

  it('says a first publication lets residents send a selfie, and cannot be undone here', () => {
    const effects = appConfigEffects(CONFIG, {
      biometricConsent: { version: '2026-11', bodyMarkdown: 'The approved consent.' },
    }).join(' ');

    expect(effects).toContain('Residents can send a selfie from now on.');
    expect(effects).toContain('no resident could verify their ID by selfie');
    expect(effects).toContain('must agree to version 2026-11 in the app');
    expect(effects).toContain('This cannot be undone here');
    expect(effects).toContain('Nothing in this console writes, suggests or fills in legal text.');
  });

  it('says a new version is agreed to again before the next selfie, and the same one is not', () => {
    const renewed = appConfigEffects(PUBLISHED, {
      biometricConsent: { version: '2026-12', bodyMarkdown: 'Changed.' },
    }).join(' ');
    expect(renewed).toContain(
      'must agree to 2026-12 in the app before sending another selfie. Selfies already sent are kept.',
    );
    expect(renewed).not.toContain('from now on');

    const corrected = appConfigEffects(PUBLISHED, {
      biometricConsent: { version: '2026-11', bodyMarkdown: 'Corrected.' },
    }).join(' ');
    expect(corrected).toContain(
      'The version stays 2026-11, so the text changes without asking anyone to agree again',
    );
  });

  it('asks nobody to acknowledge it: it stops nobody using the app', () => {
    for (const config of [CONFIG, PUBLISHED]) {
      expect(
        asksEveryResident(config, {
          biometricConsent: { version: '2026-12', bodyMarkdown: 'New.' },
        }),
      ).toBe(false);
    }
  });
});
