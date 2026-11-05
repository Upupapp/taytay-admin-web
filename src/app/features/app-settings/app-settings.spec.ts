import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  APP_CONFIG_REPOSITORY,
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
  featureFlags: [{ key: 'show_digital_id', value: 'true' }],
  privacyNotice: { version: '2026-01', updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z') },
  updatedAt: asIsoDateTime('2026-10-01T00:00:00.000Z'),
};

/** Records every change, so a test can say what was — and was not — sent. */
class RecordingConfig implements AppConfigRepository {
  readonly changes: AppConfigChanges[] = [];
  reads = 0;
  refuseWith: string | null = null;

  read(): Observable<AppConfig> {
    this.reads++;
    return of(CONFIG);
  }

  change(changes: AppConfigChanges): Observable<AppConfig> {
    if (this.refuseWith !== null) {
      const message = this.refuseWith;
      return throwError(() => new Error(message));
    }
    this.changes.push(changes);
    return of(CONFIG);
  }
}

function configure(): RecordingConfig {
  const repository = new RecordingConfig();
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
  const input = document.querySelector<HTMLInputElement>(selector);
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
