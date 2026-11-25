import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY, of, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  asId,
  asIsoDate,
  asIsoDateTime,
  RESIDENT_REPOSITORY,
  UNSERVED_PORTS,
  VERIFICATION_REPOSITORY,
  type AppAccountId,
  type BarangayId,
  type RegistryMatches,
  type Resident,
  type ResidentId,
  type ResidentView,
} from '@domain/index';

import { AccountLinkChoice, type AccountLinkState } from './account-link-choice';
import { ACCOUNT_LINK_COPY } from './account-link.copy';

const ANA = asId<AppAccountId>('account-ana');
const BEN = asId<AppAccountId>('account-ben');
const RECORD = asId<ResidentId>('resident-1');

const MATCHES = (accountId: AppAccountId): RegistryMatches => ({
  accountId,
  linkedResidentId: null,
  matches: [
    {
      residentId: RECORD,
      label: 'Mercado, L.',
      strength: 'strong',
      signals: [{ attribute: 'barangay', outcome: 'differs', rule: 'Both give a barangay.' }],
      linkedToOtherAccount: false,
    },
  ],
});

const RESIDENT = {
  id: RECORD,
  name: { first: 'Ligaya', middle: null, last: 'Mercado', suffix: null },
  sex: 'female',
  birthDate: asIsoDate('1980-04-02'),
  address: {
    barangayId: asId<BarangayId>('brgy-dolores'),
    purokOrSitio: null,
    streetAddress: '1 St',
  },
  audit: {
    createdAt: asIsoDateTime('2026-01-01T00:00:00Z'),
    updatedAt: asIsoDateTime('2026-01-01T00:00:00Z'),
  },
} as unknown as Resident;

const VIEW = {
  resident: RESIDENT,
  isProtected: false,
  withheld: [],
  listedName: 'Mercado, Ligaya',
  fullName: 'Ligaya Mercado',
} as ResidentView;

async function render(mode: 'verify' | 'later' = 'verify'): Promise<{
  fixture: ComponentFixture<AccountLinkChoice>;
  states: AccountLinkState[];
}> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: VERIFICATION_REPOSITORY,
        useValue: {
          registryMatches: (id: AppAccountId): Observable<RegistryMatches> => of(MATCHES(id)),
          linkLater: () => EMPTY,
        },
      },
      { provide: RESIDENT_REPOSITORY, useValue: { getById: () => of(VIEW) } },
      { provide: UNSERVED_PORTS, useValue: [] },
    ],
  });
  const fixture = TestBed.createComponent(AccountLinkChoice);
  const states: AccountLinkState[] = [];
  fixture.componentInstance.changed.subscribe((state) => states.push(state));
  fixture.componentRef.setInput('accountId', ANA);
  fixture.componentRef.setInput('verifiedName', 'Ligaya Bautista Mercado');
  fixture.componentRef.setInput('mode', mode);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, states };
}

function element(fixture: ComponentFixture<AccountLinkChoice>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

async function chooseRecordWithReason(fixture: ComponentFixture<AccountLinkChoice>): Promise<void> {
  const radio = element(fixture).querySelector<HTMLInputElement>('input[type="radio"]');
  radio?.click();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const reason = element(fixture).querySelector<HTMLTextAreaElement>('textarea');
  if (reason === null) throw new Error('no reason box');
  reason.value = 'PhilID seen at the counter';
  reason.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('the registry choice (DL-228, DL-260)', () => {
  it('starts another account from nothing chosen: no record or reason carried over', async () => {
    const { fixture, states } = await render();
    await chooseRecordWithReason(fixture);
    expect(states.at(-1)?.kind).toBe('ready');

    fixture.componentRef.setInput('accountId', BEN);
    fixture.componentRef.setInput('verifiedName', 'Ben Ramos Mercado');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const last = states.at(-1);
    expect(last?.kind).toBe('incomplete');
    expect(element(fixture).querySelector<HTMLTextAreaElement>('textarea')).toBeNull();
  });

  it('keeps the choice when only the verified name is corrected', async () => {
    const { fixture, states } = await render();
    await chooseRecordWithReason(fixture);
    fixture.componentRef.setInput('verifiedName', 'Ligaya B. Mercado');
    fixture.detectChanges();
    expect(states.at(-1)?.kind).toBe('ready');
  });

  it('shows the chosen record beside the account, and what to do when they differ', async () => {
    const { fixture } = await render('later');
    await chooseRecordWithReason(fixture);
    await fixture.whenStable();
    fixture.detectChanges();
    const text = element(fixture).textContent ?? '';
    expect(text).toContain('Ligaya Mercado');
    expect(text).toContain('Ligaya Bautista Mercado');
    expect(text).toContain(ACCOUNT_LINK_COPY.mismatch.heading);
    expect(text).toContain(ACCOUNT_LINK_COPY.compare.barangaySignal('different'));
    // A later link offers no "leave unlinked": that is what the account already is.
    expect(text).not.toContain(ACCOUNT_LINK_COPY.leave);
  });

  it('says what a correction does before the button, and sends only what was chosen', async () => {
    const { fixture, states } = await render('later');
    await chooseRecordWithReason(fixture);
    const sex = element(fixture).querySelector<HTMLSelectElement>('#account-link-correct-sex');
    if (sex === null) throw new Error('no sex correction');
    sex.value = 'female';
    sex.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const last = states.at(-1);
    expect(last?.kind).toBe('ready');
    if (last?.kind !== 'ready') return;
    expect(last.decision).toEqual({
      decision: 'link',
      residentId: RECORD,
      reason: 'PhilID seen at the counter',
      corrections: { sex: 'female' },
    });
    expect(last.effect).toContain('corrected to the ID');
  });
});
