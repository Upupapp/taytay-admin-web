import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  APP_CONFIG_REPOSITORY,
  AppConfigRefusedError,
  asIsoDateTime,
  type AppConfig,
  type AppConfigChanges,
  type AppConfigRepository,
} from '@domain/index';

import { AppSettingsPage } from './app-settings-page';

const CONFIG: AppConfig = {
  contactLine: '(02) 8000 0100',
  supportEmail: 'help@settings.example.test',
  privacyVersion: '2026-01',
  termsVersion: '2026-01',
  minimumAppVersion: '1.4.0',
  verificationReviewWorkingDays: { min: 1, max: 3 },
  featureFlags: [{ key: 'show_digital_id', value: 'true' }],
  privacyNotice: {
    version: '2026-01',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown: 'The privacy notice the LGU published, as **written**.',
  },
  // Still the API's placeholder: no text has been written for it yet.
  terms: {
    version: 'placeholder',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown: 'This is a placeholder for the Terms of Use.',
  },
  // Still the API's placeholder too: the server refuses every selfie (DL-216).
  biometricConsent: {
    version: 'placeholder',
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    bodyMarkdown: 'This is a placeholder for the consent to use your selfie.',
  },
  updatedAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
};

/** Records every change, so a test can say what was — and was not — sent. */
class RecordingConfig implements AppConfigRepository {
  readonly changes: AppConfigChanges[] = [];
  reads = 0;
  refuseWith: string | null = null;
  /** A refusal to answer with, as the adapter raises it. */
  refusal: Error | null = null;

  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  read(): Observable<AppConfig> {
    this.reads++;
    return of(this.config);
  }

  change(changes: AppConfigChanges): Observable<AppConfig> {
    if (this.refusal !== null) {
      const refusal = this.refusal;
      return throwError(() => refusal);
    }
    if (this.refuseWith !== null) {
      const message = this.refuseWith;
      return throwError(() => new Error(message));
    }
    this.changes.push(changes);
    return of(this.config);
  }
}

function configure(config: AppConfig = CONFIG): RecordingConfig {
  const repository = new RecordingConfig(config);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: APP_CONFIG_REPOSITORY, useValue: repository }],
  });
  return repository;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function type(selector: string, value: string): void {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (input === null) throw new Error(`No ${selector}.`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function buttonNamed(name: string): HTMLButtonElement | null {
  return (
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name,
    ) ?? null
  );
}

async function review(fixture: ComponentFixture<AppSettingsPage>): Promise<Element | null> {
  document.querySelector<HTMLFormElement>('form.settings')?.dispatchEvent(new Event('submit'));
  await settle(fixture);
  return document.querySelector('[role="dialog"]');
}

describe('AppSettingsPage (DL-170)', () => {
  it('says residents see it, and offers nothing to save until something changes', async () => {
    configure();
    const element = await settle(TestBed.createComponent(AppSettingsPage));

    expect(element.querySelector('app-page-header')?.textContent).toContain(
      'Residents see this in the Taytay app',
    );
    expect(element.textContent).toContain('Nothing has changed yet.');
    expect(element.textContent).toContain('Not secret');
    expect(element.textContent).toContain('The API serves privacy notice version 2026-01');
  });

  it('sends nothing until the change is reviewed and confirmed, and then only what changed', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-contact-line', '(02) 8000 0200');
    await settle(fixture);
    const dialog = await review(fixture);
    expect(repository.changes).toEqual([]);
    expect(dialog?.textContent).toContain('Residents see the new contact details in the app.');
    expect(dialog?.querySelector('input[type="checkbox"]')).toBeNull();

    buttonNamed('Save the settings')?.click();
    await settle(fixture);
    expect(repository.changes).toEqual([{ contactLine: '(02) 8000 0200' }]);
    expect(repository.reads).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('The settings were saved.');
  });

  it('will not save a newer oldest version until its consequence is acknowledged', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-minimum', '2.0');
    await settle(fixture);
    const dialog = await review(fixture);
    expect(dialog?.textContent).toContain(
      'This can force every resident whose app is older than 2.0 to update',
    );
    const save = buttonNamed('Save the settings');
    expect(save?.disabled).toBe(true);
    save?.click();
    await settle(fixture);
    expect(repository.changes).toEqual([]);

    const box = dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (box === null || box === undefined) throw new Error('No acknowledgement.');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settle(fixture);
    expect(buttonNamed('Save the settings')?.disabled).toBe(false);
    buttonNamed('Save the settings')?.click();
    await settle(fixture);
    expect(repository.changes).toEqual([{ minimumAppVersion: '2.0' }]);
  });

  it('asks every resident to accept again only after saying so, and says when the notice differs', async () => {
    configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-privacy', '2026-11');
    await settle(fixture);
    const dialog = await review(fixture);

    expect(dialog?.textContent).toContain(
      'can make every resident accept the privacy notice again',
    );
    expect(dialog?.textContent).toContain(
      'The API serves privacy notice version 2026-01, not 2026-11',
    );
    expect(dialog?.querySelector('input[type="checkbox"]')).not.toBeNull();
  });

  it('deletes a flag as null, and refuses a flag name the API would refuse', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Add a flag')?.click();
    await settle(fixture);
    type('#settings-new-flag-key-0', 'Bad Name');
    type('#settings-new-flag-value-0', 'on');
    await settle(fixture);
    expect(await review(fixture)).toBeNull();
    expect(document.querySelector('.settings__problems')?.textContent).toContain(
      'A flag name starts with a lower-case letter',
    );

    type('#settings-new-flag-key-0', 'new_flag');
    const remove = document.querySelector<HTMLInputElement>(
      'input[aria-label="Delete the flag show_digital_id"]',
    );
    if (remove === null) throw new Error('No delete box.');
    remove.checked = true;
    remove.dispatchEvent(new Event('change'));
    await settle(fixture);
    await review(fixture);
    buttonNamed('Save the settings')?.click();
    await settle(fixture);

    expect(repository.changes).toEqual([
      {
        featureFlags: [
          { key: 'show_digital_id', value: null },
          { key: 'new_flag', value: 'on' },
        ],
      },
    ]);
  });

  it('keeps the confirmation open and says why when the server refuses', async () => {
    const repository = configure();
    repository.refuseWith = 'The request could not be validated.';
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-contact-line', '');
    await settle(fixture);
    await review(fixture);
    buttonNamed('Save the settings')?.click();
    await settle(fixture);

    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent).toContain(
      'Not saved. The request could not be validated.',
    );
  });
});

describe('AppSettingsPage — the Terms of Use and the privacy notice (DL-186)', () => {
  it('shows each text with its version, and says when none has been written', async () => {
    configure();
    const element = await settle(TestBed.createComponent(AppSettingsPage));
    const notice = element.querySelector('#settings-privacyNotice-heading')?.closest('section');
    const terms = element.querySelector('#settings-terms-heading')?.closest('section');

    expect(notice?.textContent).toContain('Version 2026-01, published');
    // As text, never rendered: the marks stay as typed, and no element is made of them.
    expect(notice?.querySelector('.settings__legal-text')?.textContent).toBe(
      'The privacy notice the LGU published, as **written**.',
    );
    expect(notice?.querySelector('.settings__legal-text strong')).toBeNull();
    expect(terms?.textContent).toContain('No text has been written yet.');
    // The placeholder's own sentence is not shown as if it were the Terms of Use.
    expect(terms?.textContent).not.toContain('This is a placeholder for the Terms of Use.');
  });

  it('starts the editor empty for the placeholder, and from the published text otherwise', async () => {
    configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Write the Terms of Use')?.click();
    buttonNamed('Change the privacy notice')?.click();
    await settle(fixture);

    const value = (selector: string) =>
      document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)?.value;
    expect(value('#settings-terms-version')).toBe('');
    expect(value('#settings-terms-body')).toBe('');
    expect(value('#settings-privacyNotice-version')).toBe('2026-01');
    expect(value('#settings-privacyNotice-body')).toBe(
      'The privacy notice the LGU published, as **written**.',
    );
    // Opening an editor changes nothing by itself.
    expect(fixture.nativeElement.textContent).toContain('Nothing has changed yet.');
  });

  it('says before the button that a new version makes every resident accept again, and waits for the acknowledgement', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Write the Terms of Use')?.click();
    await settle(fixture);
    type('#settings-terms-version', ' 2026-11 ');
    type('#settings-terms-body', 'The Terms of Use the LGU approved.');
    await settle(fixture);
    const dialog = await review(fixture);

    const said = dialog?.textContent ?? '';
    expect(said).toContain(
      'This is a new version, 2026-11, so it makes every resident accept the Terms of Use again in the app',
    );
    const effect = [...(dialog?.querySelectorAll('li') ?? [])].find((item) =>
      item.textContent?.includes('makes every resident accept'),
    );
    const save = buttonNamed('Save the settings');
    expect(effect === undefined || save === null).toBe(false);
    if (effect !== undefined && save !== null) {
      // The sentence comes before the button in the document, not after it.
      expect(effect.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(save?.disabled).toBe(true);
    save?.click();
    await settle(fixture);
    expect(repository.changes).toEqual([]);

    const box = dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (box === null || box === undefined) throw new Error('No acknowledgement.');
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settle(fixture);
    buttonNamed('Save the settings')?.click();
    await settle(fixture);

    expect(repository.changes).toEqual([
      { terms: { version: '2026-11', bodyMarkdown: 'The Terms of Use the LGU approved.' } },
    ]);
  });

  it('says the same version changes the text without asking anyone to accept again', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Change the privacy notice')?.click();
    await settle(fixture);
    type('#settings-privacyNotice-body', 'The privacy notice, with a typing mistake corrected.');
    await settle(fixture);
    const dialog = await review(fixture);

    expect(dialog?.textContent).toContain(
      'The version stays 2026-01, so the text changes without asking anyone to accept again',
    );
    expect(dialog?.querySelector('input[type="checkbox"]')).toBeNull();
    buttonNamed('Save the settings')?.click();
    await settle(fixture);
    expect(repository.changes).toEqual([
      {
        privacyNotice: {
          version: '2026-01',
          bodyMarkdown: 'The privacy notice, with a typing mistake corrected.',
        },
      },
    ]);
  });

  it('refuses the placeholder’s version and an empty text before anything is sent', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Write the Terms of Use')?.click();
    await settle(fixture);
    type('#settings-terms-version', 'Placeholder');
    await settle(fixture);

    expect(await review(fixture)).toBeNull();
    const problems = document.querySelector('.settings__problems')?.textContent ?? '';
    expect(problems).toContain('marks the text that ships until the approved one is written');
    expect(problems).toContain('Nothing is written for the Terms of Use.');
    expect(repository.changes).toEqual([]);
  });
});

describe('AppSettingsPage — how long an ID review usually takes (DL-205)', () => {
  const input = (id: string): HTMLInputElement | null =>
    document.querySelector<HTMLInputElement>(`#${id}`);
  const preview = (): string =>
    document.querySelector('#settings-review-preview')?.textContent?.replace(/\s+/g, ' ').trim() ??
    '';
  const choose = (value: 'stated' | 'none'): void => {
    const radio = document.querySelector<HTMLInputElement>(
      `input[name="settings-review-time"][value="${value}"]`,
    );
    if (radio === null) throw new Error(`No ${value} choice.`);
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  };

  it('starts from the range the server holds, and shows the sentence the app says', async () => {
    configure();
    const element = await settle(TestBed.createComponent(AppSettingsPage));

    expect(element.textContent).toContain('Verification review time');
    expect(input('settings-review-min')?.value).toBe('1');
    expect(input('settings-review-max')?.value).toBe('3');
    expect(preview()).toContain('“This usually takes 1–3 working days.”');
    expect(element.textContent).toContain('Nothing has changed yet.');
  });

  it('previews as the numbers are typed, one number when both ends are the same', async () => {
    configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-review-min', '2');
    type('#settings-review-max', '5');
    await settle(fixture);
    expect(preview()).toContain('“This usually takes 2–5 working days.”');

    type('#settings-review-min', '1');
    type('#settings-review-max', '1');
    await settle(fixture);
    expect(preview()).toContain('“This usually takes 1 working day.”');

    type('#settings-review-min', '4');
    type('#settings-review-max', '4');
    await settle(fixture);
    expect(preview()).toContain('“This usually takes 4 working days.”');
  });

  it('says what the app will say before saving, asks no acknowledgement, and sends the range', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-review-min', '2');
    type('#settings-review-max', '5');
    await settle(fixture);
    const dialog = await review(fixture);

    expect(dialog?.textContent).toContain(
      'The app will tell residents an ID review usually takes 2–5 working days.',
    );
    expect(dialog?.querySelector('input[type="checkbox"]')).toBeNull();
    expect(repository.changes).toEqual([]);
    buttonNamed('Save the settings')?.click();
    await settle(fixture);
    expect(repository.changes).toEqual([{ verificationReviewWorkingDays: { min: 2, max: 5 } }]);
  });

  it('sends null when the app is to state no review time, and says it will stop', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    choose('none');
    await settle(fixture);
    expect(input('settings-review-min')).toBeNull();
    expect(preview()).toContain('Nothing about how long a review takes.');
    const dialog = await review(fixture);
    expect(dialog?.textContent).toContain('The app will stop saying how long an ID review takes.');
    buttonNamed('Save the settings')?.click();
    await settle(fixture);

    expect(repository.changes).toEqual([{ verificationReviewWorkingDays: null }]);
  });

  it('says beside each input what the server would refuse, and sends nothing', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-review-min', '');
    type('#settings-review-max', '0');
    await settle(fixture);
    expect(await review(fixture)).toBeNull();

    const min = input('settings-review-min');
    const max = input('settings-review-max');
    expect(min?.getAttribute('aria-invalid')).toBe('true');
    expect(min?.getAttribute('aria-describedby')).toBe(
      'settings-review-min-hint settings-review-min-error',
    );
    expect(document.querySelector('#settings-review-min-error')?.textContent).toContain(
      'Give the fewest working days.',
    );
    expect(document.querySelector('#settings-review-max-error')?.textContent).toContain(
      'At least 1 working day.',
    );
    expect(preview()).toContain('Give both numbers above to see the sentence.');

    type('#settings-review-min', '5');
    type('#settings-review-max', '2');
    await settle(fixture);
    expect(min?.getAttribute('aria-invalid')).toBeNull();
    expect(max?.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('#settings-review-max-error')?.textContent).toContain(
      'The fewest working days cannot be more than the most.',
    );

    type('#settings-review-min', '2.5');
    type('#settings-review-max', '31');
    await settle(fixture);
    expect(document.querySelector('#settings-review-min-error')?.textContent).toContain(
      'Working days are a whole number.',
    );
    expect(document.querySelector('#settings-review-max-error')?.textContent).toContain(
      'At most 30 working days.',
    );
    expect(await review(fixture)).toBeNull();
    expect(repository.changes).toEqual([]);
  });

  it('puts the server’s refusal beside the input it is about, until that is edited', async () => {
    const repository = configure();
    repository.refusal = new AppConfigRefusedError('The request could not be validated.', [
      { field: 'max', message: 'At most 30 working days.' },
    ]);
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    type('#settings-review-max', '7');
    await settle(fixture);
    await review(fixture);
    buttonNamed('Save the settings')?.click();
    await settle(fixture);

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(input('settings-review-max')?.getAttribute('aria-invalid')).toBe('true');
    expect(input('settings-review-max')?.getAttribute('aria-describedby')).toContain(
      'settings-review-max-error',
    );
    expect(document.querySelector('#settings-review-max-error')?.textContent).toContain(
      'At most 30 working days.',
    );
    expect(document.querySelector('.settings__problems')?.textContent).toContain(
      'Not saved — the server refused it:',
    );

    type('#settings-review-max', '6');
    await settle(fixture);
    expect(input('settings-review-max')?.getAttribute('aria-invalid')).toBeNull();
    expect(document.querySelector('#settings-review-max-error')).toBeNull();
  });

  it('starts empty when the app states none, and never fills in a number of its own', async () => {
    configure({ ...CONFIG, verificationReviewWorkingDays: null });
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    expect(
      document.querySelector<HTMLInputElement>('input[name="settings-review-time"][value="none"]')
        ?.checked,
    ).toBe(true);
    expect(input('settings-review-min')).toBeNull();

    choose('stated');
    await settle(fixture);
    expect(input('settings-review-min')?.value).toBe('');
    expect(input('settings-review-max')?.value).toBe('');
  });

  it('says so when the API does not send the setting, and offers nothing to change', async () => {
    configure({ ...CONFIG, verificationReviewWorkingDays: undefined });
    const element = await settle(TestBed.createComponent(AppSettingsPage));

    expect(element.textContent).toContain('The API did not say what the app is told about review');
    expect(element.querySelector('input[name="settings-review-time"]')).toBeNull();
    expect(element.querySelector('#settings-review-min')).toBeNull();
    expect(element.textContent).toContain('Nothing has changed yet.');
  });
});

describe('AppSettingsPage — the biometric (selfie) consent (DL-216)', () => {
  const published: AppConfig = {
    ...CONFIG,
    biometricConsent: {
      version: '2026-11',
      updatedAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
      bodyMarkdown: 'The biometric consent the LGU published.',
    },
  };

  it('says at the top, and where the text would be, that the app cannot take selfies', async () => {
    configure();
    const element = await settle(TestBed.createComponent(AppSettingsPage));
    const warning = element.querySelector('.callout--warning');
    const section = element.querySelector('#settings-biometricConsent-heading')?.closest('section');

    expect(warning?.textContent).toContain('The app cannot take selfies.');
    expect(warning?.textContent).toContain('no resident can verify their ID by selfie');
    // Before every setting, because the editor that ends it is far down the page.
    const firstGroup = element.querySelector('fieldset');
    expect(
      warning !== null &&
        firstGroup !== null &&
        (warning.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
    expect(section?.textContent).toContain('No text has been written yet.');
    expect(section?.textContent).toContain('the app cannot take a selfie');
    expect(section?.textContent).not.toContain('This is a placeholder for the consent');
    // In a group of its own, apart from the Terms and the privacy notice.
    expect(section?.closest('fieldset')?.querySelector('legend')?.textContent).toContain(
      'Biometric (selfie) consent',
    );
    expect(section?.closest('fieldset')?.querySelector('#settings-terms-heading')).toBeNull();
  });

  it('says nothing of the kind once a text is published, and shows it with its version', async () => {
    configure(published);
    const element = await settle(TestBed.createComponent(AppSettingsPage));
    const section = element.querySelector('#settings-biometricConsent-heading')?.closest('section');

    expect(element.textContent).not.toContain('The app cannot take selfies.');
    expect(section?.textContent).toContain('Version 2026-11, published');
    expect(section?.querySelector('.settings__legal-text')?.textContent).toBe(
      'The biometric consent the LGU published.',
    );
  });

  it('shows what the text has to cover beside an empty editor, and puts none of it in the field', async () => {
    configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);
    expect(document.querySelector('.settings__requirements')).toBeNull();

    buttonNamed('Write the biometric consent')?.click();
    await settle(fixture);

    const body = document.querySelector<HTMLTextAreaElement>('#settings-biometricConsent-body');
    const version = document.querySelector<HTMLInputElement>('#settings-biometricConsent-version');
    const checklist = document.querySelector('.settings__requirements');
    expect(body?.value).toBe('');
    expect(version?.value).toBe('');
    expect(checklist?.textContent).toContain('What withdrawing does');
    expect(checklist?.textContent).toContain('The server erases the resident’s selfies');
    expect(checklist?.textContent).toContain('RA 10173 s. 13(a)');
    expect(checklist?.textContent).toContain('NPC Circular 2023-04');
    // Only the biometric consent's editor has it.
    buttonNamed('Write the Terms of Use')?.click();
    await settle(fixture);
    expect(document.querySelectorAll('.settings__requirements')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Nothing has changed yet.');
  });

  it('says what a first publication does, asks no acknowledgement, and sends the text', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Write the biometric consent')?.click();
    await settle(fixture);
    type('#settings-biometricConsent-version', '2026-11');
    type('#settings-biometricConsent-body', 'The consent the LGU approved.');
    await settle(fixture);
    const dialog = await review(fixture);

    const said = dialog?.textContent ?? '';
    expect(said).toContain('Residents can send a selfie from now on.');
    expect(said).toContain('This cannot be undone here');
    expect(dialog?.querySelector('input[type="checkbox"]')).toBeNull();
    const save = buttonNamed('Save the settings');
    expect(save?.disabled).toBe(false);
    save?.click();
    await settle(fixture);

    expect(repository.changes).toEqual([
      { biometricConsent: { version: '2026-11', bodyMarkdown: 'The consent the LGU approved.' } },
    ]);
  });

  it('says a new version is agreed to again before the next selfie', async () => {
    configure(published);
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Change the biometric consent')?.click();
    await settle(fixture);
    expect(
      document.querySelector<HTMLTextAreaElement>('#settings-biometricConsent-body')?.value,
    ).toBe('The biometric consent the LGU published.');
    type('#settings-biometricConsent-version', '2026-12');
    await settle(fixture);
    const said = (await review(fixture))?.textContent ?? '';

    expect(said).toContain('must agree to 2026-12 in the app before sending another selfie');
    expect(said).not.toContain('from now on');
  });

  it('refuses the placeholder’s version before anything is sent', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(AppSettingsPage);
    await settle(fixture);

    buttonNamed('Write the biometric consent')?.click();
    await settle(fixture);
    type('#settings-biometricConsent-version', 'placeholder');
    type('#settings-biometricConsent-body', 'Text.');
    await settle(fixture);

    expect(await review(fixture)).toBeNull();
    expect(document.querySelector('.settings__problems')?.textContent).toContain(
      'Give the approved biometric consent a version of its own.',
    );
    expect(repository.changes).toEqual([]);
  });

  it('says so when the API does not send it, and offers nothing to publish', async () => {
    configure({ ...CONFIG, biometricConsent: undefined });
    const element = await settle(TestBed.createComponent(AppSettingsPage));
    const section = element.querySelector('#settings-biometricConsent-heading')?.closest('section');

    expect(section?.textContent).toContain('The API did not send this text');
    expect(buttonNamed('Write the biometric consent')).toBeNull();
    // Unknown is not "refused": nothing is claimed about selfies either way.
    expect(element.textContent).not.toContain('The app cannot take selfies.');
  });
});
