import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { ArchiveDialog } from './archive-dialog';

const EFFECTS = ['It leaves the app.', 'It can be restored.'];

interface Opened {
  readonly fixture: ComponentFixture<ArchiveDialog>;
  readonly confirmed: string[];
  readonly dismissed: number[];
}

function open(inputs: Readonly<Record<string, unknown>> = {}): Opened {
  TestBed.resetTestingModule();
  const fixture = TestBed.createComponent(ArchiveDialog);
  fixture.componentRef.setInput('heading', 'Archive Office a?');
  fixture.componentRef.setInput('effects', EFFECTS);
  fixture.componentRef.setInput('confirmLabel', 'Archive the office');
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  const confirmed: string[] = [];
  const dismissed: number[] = [];
  fixture.componentInstance.confirmed.subscribe((reason) => confirmed.push(reason));
  fixture.componentInstance.dismissed.subscribe(() => dismissed.push(dismissed.length + 1));
  return { fixture, confirmed, dismissed };
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function confirmButton(element: HTMLElement): HTMLButtonElement | null {
  return element.querySelector<HTMLButtonElement>('.btn--primary');
}

function giveReason(element: HTMLElement, reason: string): void {
  const box = element.querySelector('textarea');
  if (box === null) throw new Error('No reason box.');
  box.value = reason;
  box.dispatchEvent(new Event('input'));
}

describe('ArchiveDialog (DL-225)', () => {
  it('says what the act does before its one primary button, which the effects describe', async () => {
    const { fixture } = open();
    const element = await settle(fixture);

    expect(element.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Archive Office a?',
    );
    const list = element.querySelector('ul');
    expect([...(list?.querySelectorAll('li') ?? [])].map((li) => li.textContent?.trim())).toEqual(
      EFFECTS,
    );
    const confirm = confirmButton(element);
    expect(confirm?.textContent?.trim()).toBe('Archive the office');
    expect(
      list !== null &&
        confirm !== null &&
        (list.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
    expect(confirm?.getAttribute('aria-describedby')).toBe(list?.id);
    // Reversible, so never the destructive style.
    expect(element.querySelector('.btn--danger')).toBeNull();
  });

  it('waits for a reason, explains the box by its hint, and scolds nothing before typing', async () => {
    const { fixture, confirmed } = open();
    const element = await settle(fixture);
    const box = element.querySelector('textarea');

    expect(confirmButton(element)?.disabled).toBe(true);
    expect(element.querySelector('.field__error')).toBeNull();
    expect(box?.getAttribute('aria-invalid')).toBeNull();
    const hint = element.querySelector('.field__hint');
    expect(hint?.textContent).toContain('Required, up to 500 characters.');
    expect(box?.getAttribute('aria-describedby')).toBe(hint?.id);
    expect(box?.getAttribute('maxlength')).toBe('500');
    expect(element.querySelector('label')?.getAttribute('for')).toBe(box?.id);

    confirmButton(element)?.click();
    expect(confirmed).toEqual([]);
  });

  it('says why a blank or over-long reason is refused, and sends neither', async () => {
    const { fixture, confirmed } = open();
    const element = await settle(fixture);

    giveReason(element, '   ');
    await settle(fixture);
    const error = element.querySelector('.field__error');
    expect(error?.textContent).toContain(
      'Give a reason. It is kept with the record, under your name.',
    );
    const box = element.querySelector('textarea');
    expect(box?.getAttribute('aria-invalid')).toBe('true');
    expect(box?.getAttribute('aria-describedby')).toContain(error?.id ?? 'missing');
    expect(confirmButton(element)?.disabled).toBe(true);

    giveReason(element, 'x'.repeat(501));
    await settle(fixture);
    expect(element.querySelector('.field__error')?.textContent).toContain(
      'A reason is at most 500 characters.',
    );
    expect(confirmButton(element)?.disabled).toBe(true);
    confirmButton(element)?.click();
    expect(confirmed).toEqual([]);

    // Five hundred, once trimmed, is taken.
    giveReason(element, ` ${'x'.repeat(500)} `);
    await settle(fixture);
    expect(element.querySelector('.field__error')).toBeNull();
    confirmButton(element)?.click();
    expect(confirmed).toEqual(['x'.repeat(500)]);
  });

  it('sends the reason trimmed, once', async () => {
    const { fixture, confirmed } = open();
    const element = await settle(fixture);

    giveReason(element, '  Merged into the MSWDO.\n');
    await settle(fixture);
    confirmButton(element)?.click();

    expect(confirmed).toEqual(['Merged into the MSWDO.']);
  });

  it('says Saving and takes no second press while the act is in flight', async () => {
    const { fixture, confirmed } = open({ busy: true });
    const element = await settle(fixture);
    giveReason(element, 'Merged.');
    await settle(fixture);

    expect(confirmButton(element)?.textContent?.trim()).toBe('Saving…');
    expect(confirmButton(element)?.disabled).toBe(true);
    confirmButton(element)?.click();
    expect(confirmed).toEqual([]);
  });

  it('shows a refusal as an alert in words, with its lines, and keeps the reason typed', async () => {
    const { fixture } = open();
    const element = await settle(fixture);
    giveReason(element, 'Merged.');
    await settle(fixture);

    fixture.componentRef.setInput('problem', 'The office is still in use, so it was not archived.');
    fixture.componentRef.setInput('problemLines', ['2 staff accounts are linked to it.']);
    await settle(fixture);

    const alert = element.querySelector('.callout--danger[role="alert"]');
    expect(alert?.querySelector('p')?.textContent).toBe(
      'The office is still in use, so it was not archived.',
    );
    expect([...(alert?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual([
      '2 staff accounts are linked to it.',
    ]);
    expect(element.querySelector('textarea')?.value).toBe('Merged.');
    expect(confirmButton(element)?.disabled).toBe(false);
  });

  it('shows no alert list for a refusal without lines', async () => {
    const { fixture } = open({ problem: 'Not done. The server did not answer.' });
    const element = await settle(fixture);

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Not done. The server did not answer.',
    );
    expect(element.querySelector('[role="alert"] ul')).toBeNull();
  });

  it('asks to be closed from Cancel, sending nothing', async () => {
    const { fixture, confirmed, dismissed } = open();
    const element = await settle(fixture);

    [...element.querySelectorAll<HTMLButtonElement>('.btn--secondary')]
      .find((button) => button.textContent?.trim() === 'Cancel')
      ?.click();

    expect(dismissed).toEqual([1]);
    expect(confirmed).toEqual([]);
  });
});
