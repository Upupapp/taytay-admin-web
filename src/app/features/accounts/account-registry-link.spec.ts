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
  type RegistryMatches,
  type ResidentId,
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
