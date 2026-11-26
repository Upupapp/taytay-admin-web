import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import {
  asId,
  RESIDENT_REPOSITORY,
  UNSERVED_PORTS,
  VERIFICATION_REPOSITORY,
  type AccountLinkDecision,
  type AppAccount,
  type AppAccountId,
  type LaterLinkOutcome,
  type Permission,
  type RegistryLinkHistoryEntry,
  type RegistryMatches,
  type RegistryUnlinkOutcome,
  type ResidentId,
  REGISTRY_UNLINK_EFFECTS,
  asIsoDateTime,
} from '@domain/index';

import { AccountRegistryLink } from './account-registry-link';
import { ACCOUNTS_COPY } from './accounts.copy';

const COPY = ACCOUNTS_COPY.registryLink;
const RECORD = asId<ResidentId>('resident-1');

const LIGAYA: AppAccount = {
  id: asId<AppAccountId>('account-ligaya'),
  name: 'Ligaya Mercado',
  email: 'ligaya@accounts.example.test',
  role: 'verified',
  officeId: null,
  officeRole: null,
  scopeBarangayId: null,
};

class Links {
  linked: ResidentId | null = null;
  readonly sent: AccountLinkDecision[] = [];
  readonly unlinkReasons: string[] = [];
  history: RegistryLinkHistoryEntry[] = [];
  unlinkAccount(_accountId: AppAccountId, reason: string): Observable<RegistryUnlinkOutcome> {
    this.unlinkReasons.push(reason);
    const residentId = this.linked ?? RECORD;
    this.linked = null;
    const at = asIsoDateTime('2026-11-26T08:00:00.000Z');
    this.history = [
      ...this.history,
      {
        act: 'unlinked',
        residentId,
        residentName: 'Ligaya Mercado',
        reason,
        actorName: 'Ana Admin',
        at,
      },
    ];
    return of({ residentId, unlinkedAt: at });
  }
  registryLinkHistory(): Observable<readonly RegistryLinkHistoryEntry[]> {
    return of(this.history);
  }
  registryMatches(accountId: AppAccountId): Observable<RegistryMatches> {
    return of({
      accountId,
      linkedResidentId: this.linked,
      matches: [
        {
          residentId: RECORD,
          label: 'Mercado, L.',
          strength: 'strong',
          signals: [],
          linkedToOtherAccount: false,
        },
      ],
    });
  }
  linkLater(_accountId: AppAccountId, decision: AccountLinkDecision): Observable<LaterLinkOutcome> {
    this.sent.push(decision);
    this.linked = RECORD;
    return of({ link: { decision: 'link', residentId: RECORD }, corrected: [] });
  }
}

async function render(
  account: AppAccount,
  granted: readonly Permission[] = ['verification.review'],
): Promise<{ fixture: ComponentFixture<AccountRegistryLink>; links: Links; said: string[] }> {
  const links = new Links();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: VERIFICATION_REPOSITORY, useValue: links },
      { provide: RESIDENT_REPOSITORY, useValue: { getById: () => of(null) } },
      { provide: UNSERVED_PORTS, useValue: [] },
      {
        provide: PermissionService,
        useValue: { can: (permission: Permission) => signal(granted.includes(permission)) },
      },
    ],
  });
  const fixture = TestBed.createComponent(AccountRegistryLink);
  const said: string[] = [];
  fixture.componentInstance.announced.subscribe((text) => said.push(text));
  fixture.componentRef.setInput('account', account);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, links, said };
}

function text(fixture: ComponentFixture<AccountRegistryLink>): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

function button(root: ParentNode, name: string): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === name,
    ) ?? null
  );
}

async function settle(fixture: ComponentFixture<AccountRegistryLink>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('linking a verified account to its registry record later (DL-260)', () => {
  it('offers the link for a verified, unlinked account only, and never for one’s own', async () => {
    const { fixture } = await render(LIGAYA);
    expect(text(fixture)).toContain(COPY.unlinked);
    expect(button(fixture.nativeElement as HTMLElement, COPY.open)).not.toBeNull();

    const own = await render(LIGAYA);
    own.fixture.componentRef.setInput('own', true);
    await settle(own.fixture);
    expect(button(own.fixture.nativeElement as HTMLElement, COPY.open)).toBeNull();

    const registered = await render({ ...LIGAYA, role: 'registered' });
    expect(text(registered.fixture)).not.toContain(COPY.heading);

    const withoutKey = await render(LIGAYA, []);
    expect(text(withoutKey.fixture)).not.toContain(COPY.heading);
  });

  it('waits for a choice and the ID statement, then links and reads the link again', async () => {
    const { fixture, links, said } = await render(LIGAYA);
    const root = fixture.nativeElement as HTMLElement;
    button(root, COPY.open)?.click();
    await settle(fixture);

    const confirm = button(document.body, COPY.confirm);
    expect(confirm?.disabled).toBe(true);

    document.body.querySelector<HTMLInputElement>('input[type="radio"]')?.click();
    await settle(fixture);
    const reason = document.body.querySelector<HTMLTextAreaElement>('textarea');
    if (reason === null) throw new Error('no reason box');
    reason.value = 'PhilID seen at the counter';
    reason.dispatchEvent(new Event('input'));
    await settle(fixture);
    expect(button(document.body, COPY.confirm)?.disabled).toBe(true);

    const statement = [
      ...document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ].at(-1);
    statement?.click();
    await settle(fixture);
    button(document.body, COPY.confirm)?.click();
    await settle(fixture);

    expect(links.sent).toEqual([
      { decision: 'link', residentId: RECORD, reason: 'PhilID seen at the counter' },
    ]);
    expect(said.at(-1)).toBe(COPY.done(0));
    expect(text(fixture)).toContain(COPY.linked);
  });
});

describe('unlinking a wrong link (DL-262)', () => {
  it('says what unlinking does before its primary button, takes a reason, and keeps the history', async () => {
    const { fixture, links, said } = await render(LIGAYA);
    links.linked = RECORD;
    links.history = [
      {
        act: 'linked',
        residentId: RECORD,
        residentName: 'Ligaya Mercado',
        reason: 'PhilID seen.',
        actorName: 'Ana Admin',
        at: asIsoDateTime('2026-11-20T08:00:00.000Z'),
      },
    ];
    fixture.componentRef.setInput('account', { ...LIGAYA });
    await settle(fixture);
    expect(text(fixture)).toContain(COPY.linked);
    expect(text(fixture)).toContain(COPY.historyHeading);
    expect(text(fixture)).toContain('PhilID seen.');

    button(fixture.nativeElement as HTMLElement, COPY.unlinkOpen)?.click();
    await settle(fixture);
    const dialog = document.body.textContent ?? '';
    for (const effect of REGISTRY_UNLINK_EFFECTS) {
      expect(dialog).toContain(effect);
    }
    const confirm = button(document.body, COPY.unlinkConfirm);
    expect(confirm?.classList.contains('btn--primary')).toBe(true);
    expect(confirm?.classList.contains('btn--danger')).toBe(false);
    expect(confirm?.disabled).toBe(true);

    const reason = document.body.querySelector<HTMLTextAreaElement>('textarea');
    if (reason === null) throw new Error('no reason box');
    reason.value = '  Wrong Ligaya: the birth date on her ID differs.  ';
    reason.dispatchEvent(new Event('input'));
    await settle(fixture);
    button(document.body, COPY.unlinkConfirm)?.click();
    await settle(fixture);

    expect(links.unlinkReasons).toEqual(['Wrong Ligaya: the birth date on her ID differs.']);
    expect(said.at(-1)).toBe(COPY.unlinkDone);
    expect(text(fixture)).toContain(COPY.unlinked);
    expect(text(fixture)).toContain('Wrong Ligaya: the birth date on her ID differs.');
  });
});
