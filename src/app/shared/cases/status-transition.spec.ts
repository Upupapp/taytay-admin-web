import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import {
  RELEASE_STATUS_CATALOG,
  RELEASE_STATUS_TRANSITIONS,
  type ReleaseStatus,
} from '@domain/index';

import { CASE_COPY } from './case.copy';
import { StatusTransition } from './status-transition';

const EXAMPLES: Partial<Record<ReleaseStatus, string>> = {
  voided: 'e.g. Prepared twice by mistake',
};

@Component({
  selector: 'app-transition-host',
  imports: [StatusTransition],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-status-transition
      [catalog]="catalog"
      [transitions]="transitions"
      current="scheduled"
      [reasonExamples]="examples"
    />
  `,
})
class TransitionHost {
  protected readonly catalog = RELEASE_STATUS_CATALOG;
  protected readonly transitions = RELEASE_STATUS_TRANSITIONS;
  protected readonly examples = EXAMPLES;
}

async function open(): Promise<ComponentFixture<TransitionHost>> {
  TestBed.configureTestingModule({ imports: [TransitionHost] });
  const fixture = TestBed.createComponent(TransitionHost);
  await fixture.whenStable();
  return fixture;
}

const element = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const reasonOf = (fixture: ComponentFixture<unknown>) =>
  element(fixture).querySelector<HTMLTextAreaElement>('.transition__reason');
const problemOf = (fixture: ComponentFixture<unknown>) =>
  element(fixture).querySelector('.transition__problem');

async function write(fixture: ComponentFixture<unknown>, value: string): Promise<void> {
  const reason = reasonOf(fixture);
  if (reason) {
    reason.value = value;
    reason.dispatchEvent(new Event('input'));
  }
  await fixture.whenStable();
}

async function leave(fixture: ComponentFixture<unknown>): Promise<void> {
  reasonOf(fixture)?.dispatchEvent(new Event('blur'));
  await fixture.whenStable();
}

describe('the reason for a move is judged when the writer stops, not while they type', () => {
  it('says nothing about a short reason mid-sentence', async () => {
    const fixture = await open();
    for (const partial of ['C', 'Cl', 'Cla', 'Claim']) {
      await write(fixture, partial);
      expect(problemOf(fixture)).toBeNull();
      expect(reasonOf(fixture)?.getAttribute('aria-invalid')).toBeNull();
    }
  });

  it('says it is too short once the writer leaves the field', async () => {
    const fixture = await open();
    await write(fixture, 'Claim');
    await leave(fixture);
    expect(problemOf(fixture)?.getAttribute('role')).toBe('alert');
    expect(problemOf(fixture)?.textContent).toContain(CASE_COPY.transition.reasonTooShort);
    expect(reasonOf(fixture)?.getAttribute('aria-invalid')).toBe('true');
  });

  it('takes the problem away the moment the reason is long enough', async () => {
    const fixture = await open();
    await write(fixture, 'Claim');
    await leave(fixture);
    await write(fixture, 'Claimant came');
    expect(problemOf(fixture)).toBeNull();
    await write(fixture, 'Claim');
    expect(problemOf(fixture)).toBeNull();
  });

  it('says nothing about a field nobody wrote in', async () => {
    const fixture = await open();
    await leave(fixture);
    expect(problemOf(fixture)).toBeNull();
  });
});

describe('the example in the reason field fits the move', () => {
  it('names no lifecycle before a move is chosen', async () => {
    const fixture = await open();
    expect(reasonOf(fixture)?.placeholder).toBe(CASE_COPY.transition.reasonPlaceholder);
    expect(CASE_COPY.transition.reasonPlaceholder).not.toMatch(/visit|household|case/i);
  });

  it('gives the chosen move its own example, and the default for one without', async () => {
    const fixture = await open();
    const select = element(fixture).querySelector<HTMLSelectElement>('.transition__select');
    if (select) {
      select.value = 'voided';
      select.dispatchEvent(new Event('change'));
    }
    await fixture.whenStable();
    expect(reasonOf(fixture)?.placeholder).toBe('e.g. Prepared twice by mistake');

    if (select) {
      select.value = 'deferred';
      select.dispatchEvent(new Event('change'));
    }
    await fixture.whenStable();
    expect(reasonOf(fixture)?.placeholder).toBe(CASE_COPY.transition.reasonPlaceholder);
  });
});
