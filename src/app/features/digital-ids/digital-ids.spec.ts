import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import {
  APP_ACCOUNT_REPOSITORY,
  asId,
  notSentSentence,
  asIsoDateTime,
  DIGITAL_ID_EFFECTS,
  DIGITAL_ID_REPOSITORY,
  type AccountBarangay,
  type AccountRole,
  type AppAccount,
  type AppAccountId,
  type AppAccountRepository,
  type CursorPage,
  type CursorRequest,
  type DigitalIdCard,
  type DigitalIdHolder,
  type DigitalIdId,
  type DigitalIdRepository,
  type MediaId,
  type Permission,
} from '@domain/index';

import { CardPanel } from './card-panel';
import { DigitalIdsPage } from './digital-ids-page';
import { DIGITAL_IDS_COPY } from './digital-ids.copy';

function account(key: string, role: AccountRole): AppAccount {
  return {
    id: asId<AppAccountId>(key),
    name: `Person ${key}`,
    email: `${key}@ids.example.test`,
    role,
    officeId: null,
    officeRole: null,
    scopeBarangayId: null,
  };
}

function card(status: DigitalIdCard['status']): DigitalIdCard {
  return {
    id: asId<DigitalIdId>('card-1'),
    number: 'TAY-2026-000001',
    photo: asId<MediaId>('photo-1'),
    status,
    issuedAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
    expiresAt: asIsoDateTime('2099-11-01T00:00:00.000Z'),
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingCards implements DigitalIdRepository {
  readonly calls: string[] = [];
  current: DigitalIdCard | null = card('active');
  refuseWith: string | null = null;

  check(payload: string): Observable<DigitalIdHolder> {
    this.calls.push(`check:${payload}`);
    return of({
      name: 'Ana Reyes',
      photo: asId<MediaId>('photo-1'),
      status: 'suspended',
      expired: false,
      barangayName: 'San Juan',
    });
  }
  cardOf(id: AppAccountId): Observable<DigitalIdCard | null> {
    this.calls.push(`cardOf:${id}`);
    return of(this.current);
  }
  issue(id: AppAccountId): Observable<DigitalIdCard> {
    this.calls.push(`issue:${id}`);
    return of(card('active'));
  }
  suspend(id: DigitalIdId): Observable<DigitalIdCard> {
    this.calls.push(`suspend:${id}`);
    if (this.refuseWith !== null) {
      const reason = this.refuseWith;
      return throwError(() => new Error(reason));
    }
    this.current = card('suspended');
    return of(this.current);
  }
  revoke(id: DigitalIdId): Observable<DigitalIdCard> {
    this.calls.push(`revoke:${id}`);
    return of(card('revoked'));
  }
  reissue(id: DigitalIdId): Observable<DigitalIdCard> {
    this.calls.push(`reissue:${id}`);
    return of(card('active'));
  }
  openPhoto(photo: MediaId): Observable<Blob> {
    this.calls.push(`photo:${photo}`);
    return of(new Blob(['x'], { type: 'image/png' }));
  }
}

class Accounts implements AppAccountRepository {
  readonly listed: CursorRequest[] = [];
  list(page: CursorRequest): Observable<CursorPage<AppAccount>> {
    this.listed.push(page);
    return of({
      items: [account('a', 'verified'), account('b', 'registered'), account('c', 'staff')],
      hasMore: true,
      nextCursor: 'next',
    });
  }
  changeRole(): Observable<AppAccount> {
    throw new Error('not used');
  }
  assignOffice(): Observable<AppAccount> {
    throw new Error('not used');
  }
  assignOfficeRole(): Observable<AppAccount> {
    throw new Error('not used');
  }
  correctName(): Observable<AppAccount> {
    throw new Error('not used');
  }
  barangays(): Observable<readonly AccountBarangay[]> {
    throw new Error('not used');
  }
}

function configure(granted: readonly Permission[] = ['digital-id.verify', 'digital-id.manage']): {
  cards: RecordingCards;
  accounts: Accounts;
} {
  const cards = new RecordingCards();
  const accounts = new Accounts();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DIGITAL_ID_REPOSITORY, useValue: cards },
      { provide: APP_ACCOUNT_REPOSITORY, useValue: accounts },
      {
        provide: PermissionService,
        useValue: { can: (permission: Permission) => signal(granted.includes(permission)) },
      },
    ],
  });
  return { cards, accounts };
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function button(root: ParentNode, name: string): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === name,
    ) ?? null
  );
}

const COPY = DIGITAL_IDS_COPY;

/*
 * The photo test waits for a blob and an object URL. Inside the full suite on a low-memory machine
 * that wait plus the screen's first compile went past the default 5 s limit on a correct tree.
 * A timeout is not an assertion, so it is raised for this file only (as in events.spec.ts).
 */
vi.setConfig({ testTimeout: 20_000 });

describe('DigitalIdsPage — checking a card (DL-171)', () => {
  // The photo becomes an object URL. jsdom has none, and Node's own refuses a jsdom Blob — which of
  // the two a worker holds depended on which spec files ran before this one, so the photo test passed
  // alone and failed inside the full suite. A stand-in, as the other screens' specs use, restored
  // exactly as it was found rather than deleted.
  const found = {
    create: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
    revoke: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
  };
  const restore = (
    name: 'createObjectURL' | 'revokeObjectURL',
    was: PropertyDescriptor | undefined,
  ) => {
    if (was === undefined) {
      Reflect.deleteProperty(URL, name);
    } else {
      Object.defineProperty(URL, name, was);
    }
  };
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:test/card-photo'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });
  afterEach(() => {
    restore('createObjectURL', found.create);
    restore('revokeObjectURL', found.revoke);
  });

  it('says no camera is needed, and what a check does, before its button', async () => {
    configure();
    const element = await settle(TestBed.createComponent(DigitalIdsPage));
    const text = element.textContent ?? '';
    expect(text).toContain(COPY.check.noCamera);
    expect(text).toContain('Residents carry this card in the Taytay app');

    const form = element.querySelector('form');
    const effects = form?.querySelector('.digital-ids__effects');
    const submit = form?.querySelector('button[type="submit"]');
    expect(effects?.textContent).toContain('records that you checked this card');
    expect(
      effects !== null &&
        effects !== undefined &&
        submit !== null &&
        submit !== undefined &&
        effects.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('sends the code, empties the field, and shows only what the API answered', async () => {
    const { cards } = configure();
    const fixture = TestBed.createComponent(DigitalIdsPage);
    const element = await settle(fixture);
    const field = element.querySelector<HTMLTextAreaElement>('#card-check-payload');
    if (field === null) throw new Error('no field');
    field.value = 'signed.code';
    field.dispatchEvent(new Event('input'));
    await settle(fixture);
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle(fixture);

    expect(cards.calls).toEqual(['check:signed.code']);
    expect(field.value).toBe('');
    const result = element.querySelector('.digital-ids__result')?.textContent ?? '';
    expect(result).toContain('Ana Reyes');
    expect(result).toContain('Suspended');
    expect(result).toContain('Not expired');
    expect(result).toContain('San Juan');
    expect(result).toContain(COPY.check.notInForce);
  });

  it('opens the photo only from the warning’s own button', async () => {
    const { cards } = configure();
    const fixture = TestBed.createComponent(DigitalIdsPage);
    const element = await settle(fixture);
    const field = element.querySelector<HTMLTextAreaElement>('#card-check-payload');
    if (field === null) throw new Error('no field');
    field.value = 'signed.code';
    field.dispatchEvent(new Event('input'));
    await settle(fixture);
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await settle(fixture);

    button(element, COPY.photo.show)?.click();
    await settle(fixture);
    expect(cards.calls.filter((call) => call.startsWith('photo:'))).toEqual([]);
    expect(document.body.textContent).toContain(COPY.photo.warningHeading);

    button(document.body, COPY.photo.confirm)?.click();
    // The photo arrives as a blob turned into an object URL — more than one turn of the event loop.
    // One settle was enough alone and not inside the full suite on a loaded machine.
    await vi.waitFor(
      async () => {
        await settle(fixture);
        expect(cards.calls).toContain('photo:photo-1');
        expect(element.querySelector('img')?.getAttribute('alt')).toBe(COPY.photo.alt('Ana Reyes'));
      },
      { timeout: 5_000, interval: 50 },
    );
  });

  it('offers neither section to a grant that does not hold it, and reads no account', async () => {
    const { accounts } = configure(['digital-id.verify']);
    const element = await settle(TestBed.createComponent(DigitalIdsPage));
    expect(element.textContent).toContain(COPY.manage.noManage);
    expect(accounts.listed).toEqual([]);

    configure(['digital-id.manage']);
    const other = await settle(TestBed.createComponent(DigitalIdsPage));
    expect(other.querySelector('#card-check-payload')).toBeNull();
  });
});

describe('DigitalIdsPage — keeping cards (DL-171)', () => {
  it('shows the verified residents among the accounts read, and says more are available', async () => {
    const { accounts } = configure();
    const element = await settle(TestBed.createComponent(DigitalIdsPage));
    expect(accounts.listed[0]).toEqual({ limit: 50, cursor: null });
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(element.textContent).toContain(COPY.manage.read(3, 1));
    expect(element.textContent).toContain(COPY.manage.moreAvailable);
    expect(element.textContent).not.toMatch(/page \d+ of/i);
  });

  it('opens a resident’s card beside the list', async () => {
    const { cards } = configure();
    const fixture = TestBed.createComponent(DigitalIdsPage);
    const element = await settle(fixture);
    element.querySelector<HTMLButtonElement>('tbody tr button')?.click();
    await settle(fixture);

    expect(cards.calls).toContain('cardOf:a');
    expect(document.body.textContent).toContain(COPY.panel.heading('Person a'));
    expect(document.body.textContent).toContain('TAY-2026-000001');
  });
});

describe('CardPanel (DL-171)', () => {
  async function panel(cards?: (repository: RecordingCards) => void): Promise<{
    fixture: ComponentFixture<CardPanel>;
    element: HTMLElement;
    repository: RecordingCards;
  }> {
    const { cards: repository } = configure();
    cards?.(repository);
    const fixture = TestBed.createComponent(CardPanel);
    fixture.componentRef.setInput('account', account('a', 'verified'));
    const element = await settle(fixture);
    return { fixture, element, repository };
  }

  it('says what suspending does before the button that does it, and sends nothing until then', async () => {
    const { fixture, element, repository } = await panel();
    button(element, COPY.panel.act.suspend)?.click();
    await settle(fixture);

    expect(repository.calls).toEqual(['cardOf:a']);
    const modal = document.body.querySelector('.digital-ids__effects');
    for (const effect of DIGITAL_ID_EFFECTS.suspend) {
      expect(modal?.textContent).toContain(effect);
    }

    button(document.body, COPY.panel.confirm.suspend)?.click();
    await settle(fixture);
    expect(repository.calls).toEqual(['cardOf:a', 'suspend:card-1', 'cardOf:a']);
    expect(element.textContent).toContain(COPY.panel.outcome.suspend);
    expect(element.textContent).toContain('Suspended');
    // No route lifts a suspension, so nothing offers to.
    expect(button(element, COPY.panel.act.suspend)).toBeNull();
  });

  it('keeps a refusal in the confirmation, in the API’s words', async () => {
    const { fixture, element } = await panel((repository) => {
      repository.refuseWith = 'That digital ID cannot be suspended.';
    });
    button(element, COPY.panel.act.suspend)?.click();
    await settle(fixture);
    button(document.body, COPY.panel.confirm.suspend)?.click();
    await settle(fixture);
    expect(document.body.textContent).toContain(
      COPY.panel.notDone('That digital ID cannot be suspended.'),
    );
  });

  it('offers to issue a card when the account holds none, and says a revoked one is not shown', async () => {
    const { element } = await panel((repository) => {
      repository.current = null;
    });
    expect(element.textContent).toContain(COPY.panel.none);
    expect(element.textContent).toContain(COPY.panel.noneWhy);
    expect(button(element, COPY.panel.act.issue)).not.toBeNull();
  });
});

describe('CardPanel as the CitizenIDRecord board (DL-211)', () => {
  async function panel(): Promise<{
    fixture: ComponentFixture<CardPanel>;
    element: HTMLElement;
    repository: RecordingCards;
  }> {
    const { cards: repository } = configure();
    const fixture = TestBed.createComponent(CardPanel);
    fixture.componentRef.setInput('account', account('a', 'verified'));
    const element = await settle(fixture);
    return { fixture, element, repository };
  }

  it('draws the card as the app does — the number, the validity, the status — and no QR code', async () => {
    const { element } = await panel();
    const face = element.querySelector('.id-card');
    expect(face?.getAttribute('aria-label')).toBe(COPY.face.label('TAY-2026-000001'));
    expect(face?.textContent).toContain('Person a');
    expect(face?.textContent).toContain('TAY-2026-000001');
    expect(face?.querySelector('app-status-badge')).not.toBeNull();
    expect(face?.querySelector('.id-card__photo')?.textContent).toContain(COPY.face.photoHidden);
    expect(face?.querySelector('.id-card__photo img')).toBeNull();
    expect(face?.textContent).not.toMatch(/\bqr\b/i);
    expect(face?.querySelector('canvas')).toBeNull();
  });

  it('puts the photo button beside the Card heading, and the photo only after the warning', async () => {
    const { fixture, element, repository } = await panel();
    const head = element.querySelector('.card-record__head');
    expect(head?.querySelector('h3')?.textContent?.trim()).toBe(COPY.panel.cardHeading);
    const show = button(head ?? element, COPY.photo.show);
    expect(show).not.toBeNull();

    show?.click();
    await settle(fixture);
    expect(repository.calls.filter((call) => call.startsWith('photo:'))).toEqual([]);

    button(document.body, COPY.photo.confirm)?.click();
    await vi.waitFor(
      async () => {
        await settle(fixture);
        const image = element.querySelector<HTMLImageElement>('.id-card__photo img');
        expect(image?.getAttribute('alt')).toBe(COPY.photo.alt('Person a'));
      },
      { timeout: 5_000, interval: 50 },
    );
    expect(element.querySelector('.digital-ids__photo')).toBeNull();

    button(head ?? element, COPY.photo.hide)?.click();
    await settle(fixture);
    expect(element.querySelector('.id-card__photo img')).toBeNull();
  });

  it('says in its place that the card’s history is not sent, rather than drawing an empty one', async () => {
    const { element } = await panel();
    const history = element.querySelector('.card-record__history');
    expect(history?.querySelector('h4')?.textContent?.trim()).toBe(COPY.panel.historyHeading);
    expect(history?.querySelector('[role="note"]')?.textContent?.trim()).toBe(
      notSentSentence('card-history'),
    );
  });
});
