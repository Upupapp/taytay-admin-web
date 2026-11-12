import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { EMPTY, of, throwError, type Observable } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';

import {
  asId,
  asIsoDateTime,
  IN_PERSON_CORRECTION_EFFECT,
  IN_PERSON_EFFECTS,
  InPersonRefusedError,
  VERIFICATION_REPOSITORY,
  type AppAccountId,
  type CursorPage,
  type InPersonCheck,
  type InPersonOutcome,
  type InPersonVerification,
  type InPersonVerificationId,
  type VerificationRepository,
  type VerificationRequest,
  type WriteIntent,
} from '@domain/index';

import { VerifyInPersonDialog } from './verify-in-person-dialog';
import { VERIFY_IN_PERSON_COPY as COPY } from './verify-in-person.copy';

const ACCOUNT = asId<AppAccountId>('account-ana');

function recorded(check: InPersonCheck): InPersonVerification {
  return {
    id: asId<InPersonVerificationId>('in-person-1'),
    accountId: ACCOUNT,
    idType: check.idType,
    nameCorrected: check.correctedName !== null,
    supersededRequestId: null,
    verifiedAt: asIsoDateTime('2026-11-12T03:15:00.000Z'),
  };
}

/** Records every counter check, so a test can say what was — and was not — sent. */
class RecordingChecks implements VerificationRepository {
  readonly sent: { accountId: AppAccountId; check: InPersonCheck; intent: WriteIntent }[] = [];
  /** What the next check fails with, once, or `null` to record it. */
  failWith: unknown = null;

  list(): Observable<CursorPage<VerificationRequest>> {
    return EMPTY;
  }
  approve(): Observable<VerificationRequest> {
    return EMPTY;
  }
  reject(): Observable<VerificationRequest> {
    return EMPTY;
  }
  openImage(): Observable<Blob> {
    return EMPTY;
  }

  verifyInPerson(
    accountId: AppAccountId,
    check: InPersonCheck,
    intent: WriteIntent,
  ): Observable<InPersonVerification> {
    this.sent.push({ accountId, check, intent });
    if (this.failWith !== null) {
      const failure = this.failWith;
      this.failWith = null;
      return throwError(() => failure);
    }
    return of(recorded(check));
  }
}

function open(name = 'Ana Cruz') {
  const repository = new RecordingChecks();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: VERIFICATION_REPOSITORY, useValue: repository }],
  });
  const fixture = TestBed.createComponent(VerifyInPersonDialog);
  fixture.componentRef.setInput('subject', { accountId: ACCOUNT, name });
  const verified: InPersonOutcome[] = [];
  let dismissed = 0;
  fixture.componentInstance.verified.subscribe((outcome) => verified.push(outcome));
  fixture.componentInstance.dismissed.subscribe(() => (dismissed += 1));
  return { repository, fixture, verified, dismissedCount: () => dismissed };
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  // The modal draws its panel where the page's overlays go, so read the whole document.
  return document.body;
}

function field<T extends HTMLElement>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector);
  if (found === null) throw new Error(`no ${selector}`);
  return found;
}

function choose(root: ParentNode, type: string): void {
  const select = field<HTMLSelectElement>(root, '#in-person-id-type');
  select.value = type;
  select.dispatchEvent(new Event('change'));
}

function type(root: ParentNode, selector: string, value: string): void {
  const input = field<HTMLInputElement>(root, selector);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function statement(root: ParentNode): HTMLInputElement {
  return field<HTMLInputElement>(root, '.in-person__statement input[type="checkbox"]');
}

function tick(root: ParentNode): void {
  const box = statement(root);
  box.checked = true;
  box.dispatchEvent(new Event('change'));
}

function button(root: ParentNode, name: string): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  );
  if (found === undefined) throw new Error(`no button ${name}`);
  return found;
}

async function fillIn<T>(fixture: ComponentFixture<T>, lastFour = '4c7k'): Promise<HTMLElement> {
  const root = await settle(fixture);
  choose(root, 'philid');
  type(root, '#in-person-last-four', lastFour);
  await settle(fixture);
  tick(root);
  return settle(fixture);
}

afterEach(() => TestBed.resetTestingModule());

describe('VerifyInPersonDialog (DL-219)', () => {
  it('is a centred dialog that takes no photo: no camera, no file, no image', async () => {
    const { fixture } = open();
    const root = await settle(fixture);

    expect(root.querySelector('[role="dialog"]')).not.toBeNull();
    expect(root.querySelector('input[type="file"], video, canvas, img')).toBeNull();
    expect(root.textContent).toContain('No photo or biometric data is taken here.');
    expect(root.textContent).toContain(
      'A card photo, if the resident wants a digital ID, is a separate step with its own consent',
    );
  });

  it('asks for the last four characters only, and says only those are recorded (DL-183)', async () => {
    const { fixture } = open();
    const root = await settle(fixture);

    const lastFour = field<HTMLInputElement>(root, '#in-person-last-four');
    expect(field(root, `#${lastFour.getAttribute('aria-describedby') ?? ''}`).textContent).toBe(
      COPY.lastFourHint,
    );
    expect(COPY.lastFourHint).toContain('Only these four are recorded, never the whole number');

    type(root, '#in-person-last-four', '1234-5678-9012');
    await settle(fixture);
    expect(lastFour.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#in-person-last-four-error')?.textContent).toContain(
      'Only the last four characters are recorded',
    );
  });

  it('says what the server does before the statement, and the statement before the button', async () => {
    const { fixture } = open();
    const root = await settle(fixture);

    const effects = field(root, '#in-person-effects');
    for (const effect of IN_PERSON_EFFECTS) expect(effects.textContent).toContain(effect);
    const box = statement(root);
    const confirm = button(root, COPY.confirm);
    expect(effects.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field(root, '.in-person__statement').textContent).toContain(
      'The ID shows the name “Ana Cruz”.',
    );
  });

  it('waits for the kind of ID, four characters and the statement, and says what is missing', async () => {
    const { repository, fixture } = open();
    const root = await settle(fixture);

    expect(button(root, COPY.confirm).disabled).toBe(true);
    expect(root.textContent).toContain(COPY.waiting);
    choose(root, 'philid');
    type(root, '#in-person-last-four', '4c7k');
    await settle(fixture);
    expect(button(root, COPY.confirm).disabled).toBe(true);

    tick(root);
    await settle(fixture);
    expect(button(root, COPY.confirm).disabled).toBe(false);
    expect(root.textContent).not.toContain(COPY.waiting);
    expect(repository.sent).toEqual([]);
  });

  it('sends the check as shown, upper-cased, and hands back what the server recorded', async () => {
    const { repository, fixture, verified } = open();
    const root = await fillIn(fixture);

    button(root, COPY.confirm).click();
    await settle(fixture);

    expect(repository.sent.map(({ accountId, check }) => ({ accountId, check }))).toEqual([
      {
        accountId: ACCOUNT,
        check: {
          idType: 'philid',
          idLastFour: '4C7K',
          confirmedName: 'Ana Cruz',
          correctedName: null,
        },
      },
    ]);
    expect(verified.map((outcome) => outcome.record.accountId)).toEqual([ACCOUNT]);
  });

  it('names a corrected name in the statement, unticks it when it changes, and says so first', async () => {
    const { repository, fixture } = open();
    const root = await fillIn(fixture);

    type(root, '#in-person-corrected', 'Ana Cruz Reyes');
    await settle(fixture);
    expect(statement(root).checked).toBe(false);
    expect(field(root, '.in-person__statement').textContent).toContain(
      'The ID shows the name “Ana Cruz Reyes”.',
    );
    expect(field(root, '#in-person-effects').textContent).toContain(IN_PERSON_CORRECTION_EFFECT);

    tick(root);
    await settle(fixture);
    button(root, COPY.confirm).click();
    await settle(fixture);
    expect(repository.sent[0]?.check.correctedName).toBe('Ana Cruz Reyes');

    type(root, '#in-person-corrected', 'Ana Cruz');
    await settle(fixture);
    expect(root.querySelector('#in-person-corrected-error')?.textContent).toContain(
      'already the account’s name',
    );
  });

  it('keeps one key across retries of the same check, and a new one for a different check', async () => {
    const { repository, fixture } = open();
    const root = await fillIn(fixture);

    repository.failWith = new Error('The server could not be reached.');
    button(root, COPY.confirm).click();
    await settle(fixture);
    expect(root.querySelector('.callout--danger')?.textContent).toContain(
      'The account was not verified. The server could not be reached.',
    );
    button(root, COPY.confirm).click();
    await settle(fixture);
    expect(repository.sent[1]?.intent).toBe(repository.sent[0]?.intent);

    repository.failWith = new Error('Again.');
    button(root, COPY.confirm).click();
    await settle(fixture);
    expect(repository.sent).toHaveLength(3);
    type(root, '#in-person-last-four', '9C7K');
    await settle(fixture);
    button(root, COPY.confirm).click();
    await settle(fixture);
    expect(repository.sent[3]?.intent).not.toBe(repository.sent[2]?.intent);
  });

  it('puts a refusal of a field under that field, until the field changes', async () => {
    const { repository, fixture } = open();
    const root = await fillIn(fixture);

    repository.failWith = new InPersonRefusedError(
      'The request could not be validated.',
      'invalid',
      {
        idLastFour: 'Only the last four characters of the ID number.',
      },
    );
    button(root, COPY.confirm).click();
    await settle(fixture);

    const input = field<HTMLInputElement>(root, '#in-person-last-four');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain('in-person-last-four-error');
    expect(field(root, '#in-person-last-four-error').textContent).toContain(
      'Only the last four characters of the ID number.',
    );
    expect(root.querySelector('.callout--danger')).toBeNull();

    type(root, '#in-person-last-four', '4C7L');
    await settle(fixture);
    expect(root.querySelector('#in-person-last-four-error')).toBeNull();
  });

  it('says an account already verified, or changed, was not touched', async () => {
    const { repository, fixture, verified } = open();
    const root = await fillIn(fixture);

    repository.failWith = new InPersonRefusedError('This account is already verified.', 'conflict');
    button(root, COPY.confirm).click();
    await settle(fixture);

    const callout = field(root, '.callout--danger');
    expect(callout.getAttribute('role')).toBe('alert');
    expect(callout.textContent).toContain(
      'The account was not verified. This account is already verified.',
    );
    expect(callout.textContent).toContain(COPY.nothingChanged);
    expect(verified).toEqual([]);
  });

  it('says it is not the reader’s to make when the server refuses with a 403', async () => {
    const { repository, fixture } = open();
    const root = await fillIn(fixture);

    repository.failWith = new InPersonRefusedError(
      'You cannot verify your own account.',
      'forbidden',
    );
    button(root, COPY.confirm).click();
    await settle(fixture);

    expect(field(root, '.callout--danger').textContent).toContain(
      'The account was not verified. You cannot verify your own account.',
    );
  });

  it('closes on Cancel without sending anything', async () => {
    const { repository, fixture, dismissedCount } = open();
    const root = await settle(fixture);

    button(root, COPY.cancel).click();
    await settle(fixture);

    expect(dismissedCount()).toBe(1);
    expect(repository.sent).toEqual([]);
  });
});
