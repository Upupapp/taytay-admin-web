import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import {
  asId,
  asIsoDateTime,
  DIGITAL_ID_REPOSITORY,
  type AppAccountId,
  type CursorRequest,
  type DigitalIdCard,
  type DigitalIdHolder,
  type DigitalIdId,
  type DigitalIdListFilter,
  type DigitalIdListing,
  type DigitalIdListPage,
  type DigitalIdRepository,
  type Permission,
  type TakenCardPhoto,
} from '@domain/index';

import { CitizenIdsPage } from './citizen-ids-page';
import { CITIZEN_IDS_COPY } from './citizen-ids.copy';

function listing(key: string, name: string | null, expired = false): DigitalIdListing {
  return {
    id: asId<DigitalIdId>(`card-${key}`),
    number: `TAY-TEST-${key}`,
    status: 'active',
    expired,
    issuedAt: asIsoDateTime('2026-01-05T00:00:00.000Z'),
    expiresAt: asIsoDateTime('2027-01-05T00:00:00.000Z'),
    holder: { account: asId<AppAccountId>(`account-${key}`), name, barangayName: 'Muzon' },
  };
}

const COUNTS = { active: 7, expiring: 2, expired: 1, suspended: 3, revoked: 4 };

/** Answers what it is told to, and records every list it was asked for. */
class Cards implements DigitalIdRepository {
  readonly asked: { page: CursorRequest; filter: DigitalIdListFilter }[] = [];
  answer: Observable<DigitalIdListPage> = of({
    items: [listing('1', 'Ana Reyes'), listing('2', null, true)],
    hasMore: true,
    nextCursor: 'next',
    counts: COUNTS,
  });

  list(page: CursorRequest, filter: DigitalIdListFilter): Observable<DigitalIdListPage> {
    this.asked.push({ page, filter });
    return this.answer;
  }
  check(): Observable<DigitalIdHolder> {
    return throwError(() => new Error('not in this test'));
  }
  cardOf(): Observable<DigitalIdCard | null> {
    return of(null);
  }
  issue(): Observable<DigitalIdCard> {
    return throwError(() => new Error('not in this test'));
  }
  takeCardPhoto(): Observable<TakenCardPhoto> {
    return throwError(() => new Error('not in this test'));
  }
  suspend(): Observable<DigitalIdCard> {
    return throwError(() => new Error('not in this test'));
  }
  revoke(): Observable<DigitalIdCard> {
    return throwError(() => new Error('not in this test'));
  }
  reissue(): Observable<DigitalIdCard> {
    return throwError(() => new Error('not in this test'));
  }
  openPhoto(): Observable<Blob> {
    return throwError(() => new Error('not in this test'));
  }
}

function configure(granted: readonly Permission[]): Cards {
  const cards = new Cards();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: DIGITAL_ID_REPOSITORY, useValue: cards },
      {
        provide: PermissionService,
        useValue: { can: (permission: Permission) => signal(granted.includes(permission)) },
      },
    ],
  });
  return cards;
}

async function render(): Promise<{ root: HTMLElement; fixture: ComponentFixture<CitizenIdsPage> }> {
  const fixture = TestBed.createComponent(CitizenIdsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { root: fixture.nativeElement as HTMLElement, fixture };
}

const text = (root: HTMLElement): string => root.textContent?.replace(/\s+/g, ' ') ?? '';

describe('CitizenIdsPage (DL-212)', () => {
  it('lists the cards with the strip of counts from the same answer', async () => {
    const cards = configure(['digital-id.verify', 'digital-id.manage']);
    const { root } = await render();

    expect(cards.asked).toEqual([{ page: { limit: 20, cursor: null }, filter: {} }]);
    expect(text(root)).toContain('Ana Reyes');
    expect(text(root)).toContain('TAY-TEST-1');
    const figures = [...root.querySelectorAll('.tally__value')].map((node) =>
      node.textContent?.trim(),
    );
    expect(figures).toEqual(['7', '2', '1', '3', '4']);
    expect(text(root)).toContain(CITIZEN_IDS_COPY.moreAvailable);
  });

  it('says a closed account’s name is not shown, and that a card is past its date', async () => {
    configure(['digital-id.manage']);
    const { root } = await render();

    expect(text(root)).toContain(CITIZEN_IDS_COPY.noName);
    expect(text(root)).toContain(CITIZEN_IDS_COPY.pastDate);
  });

  it('shows the empty state when no card has been issued', async () => {
    const cards = configure(['digital-id.manage']);
    cards.answer = of({
      items: [],
      hasMore: false,
      nextCursor: null,
      counts: { ...COUNTS, active: 0 },
    });
    const { root } = await render();

    expect(text(root)).toContain(CITIZEN_IDS_COPY.emptyHeading);
  });

  it('says what went wrong, offers Try again, and shows no counts', async () => {
    const cards = configure(['digital-id.manage']);
    cards.answer = throwError(() => new Error('The cards could not be read.'));
    const { root } = await render();

    expect(text(root)).toContain('The cards could not be read.');
    expect(text(root)).toContain(CITIZEN_IDS_COPY.lifecycle.failed);
    expect(root.querySelectorAll('.tally__value')).toHaveLength(0);
    expect(
      [...root.querySelectorAll('button')].some(
        (button) => button.textContent?.trim() === CITIZEN_IDS_COPY.tryAgain,
      ),
    ).toBe(true);
  });

  it('asks nothing of the list without digital-id.manage, and still offers the check', async () => {
    const cards = configure(['digital-id.verify']);
    const { root } = await render();

    expect(cards.asked).toEqual([]);
    expect(text(root)).toContain(CITIZEN_IDS_COPY.noManage);
    expect(text(root)).toContain(CITIZEN_IDS_COPY.check);
    expect(text(root)).not.toContain(CITIZEN_IDS_COPY.issue);
  });

  it('opens the card record for a row, by the holder’s account', async () => {
    configure(['digital-id.manage']);
    const { root, fixture } = await render();

    const open = root.querySelector<HTMLButtonElement>(
      `button[aria-label="${CITIZEN_IDS_COPY.openLabel('Ana Reyes')}"]`,
    );
    open?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.textContent).toContain(CITIZEN_IDS_COPY.recordHeading('Ana Reyes'));
  });
});
