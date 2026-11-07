import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '@core/auth/session.store';
import {
  asId,
  asIsoDateTime,
  ISSUANCE_BOUNDARIES,
  ISSUANCE_REPOSITORY,
  OFFICE_REPOSITORY,
  RETIRE_EFFECTS,
  type AppAccountId,
  type CursorPage,
  type CursorRequest,
  type IssuanceAttachmentId,
  type IssuanceEventId,
  type IssuanceFileGrant,
  type IssuanceListFilter,
  type IssuanceMove,
  type IssuanceQueueFilter,
  type IssuanceRepository,
  type IssuanceRequest,
  type IssuanceRequestId,
  type IssuanceRequestSummary,
  type IssuanceStatus,
  type IssuanceType,
  type IssuanceTypeChanges,
  type IssuanceTypeDraft,
  type IssuanceTypeId,
  type OfficeId,
} from '@domain/index';

import { IssuanceCataloguePage } from './issuance-catalogue-page';
import { IssuanceQueuePage } from './issuance-queue-page';
import { IssuanceRequestPage } from './issuance-request-page';
import { ISSUANCE_COPY } from './issuance.copy';

const OFFICE = { id: asId<OfficeId>('office-1'), name: 'MSWDO' };

function row(n: number, status: IssuanceStatus, since: string): IssuanceRequestSummary {
  return {
    id: asId<IssuanceRequestId>(`ir-${n}`),
    referenceNumber: `DR-2026-00000${n}`,
    status,
    type: { id: asId<IssuanceTypeId>('type-1'), name: 'Certificate of residency' },
    office: OFFICE,
    resident: {
      accountId: asId<AppAccountId>(`account-${n}`),
      name: n === 2 ? null : `Resident ${n}`,
    },
    filedAt: asIsoDateTime(since),
    statusSince: asIsoDateTime(since),
  };
}

function request(status: IssuanceStatus, allowedMoves: readonly IssuanceStatus[]): IssuanceRequest {
  return {
    ...row(7, status, '2026-11-01T00:00:00.000Z'),
    purpose: 'For my medical assistance application.',
    fee: { centavos: 5000, currency: 'PHP' },
    processingDays: 3,
    claimInstructions: null,
    requirements: [{ code: 'valid-id', label: 'A valid ID', required: true, hint: null }],
    attachments: [
      {
        id: asId<IssuanceAttachmentId>('file-1'),
        requirementCode: 'valid-id',
        version: 1,
        mimeType: 'image/jpeg',
        byteSize: 200_000,
        current: true,
        sentAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
      },
    ],
    claimDetails: null,
    history: [
      {
        id: asId<IssuanceEventId>('event-1'),
        from: null,
        to: 'submitted',
        side: 'resident',
        actorId: 'account-7',
        reason: null,
        claimDetails: null,
        at: asIsoDateTime('2026-11-01T00:00:00.000Z'),
      },
    ],
    allowedMoves,
  };
}

const TYPE: IssuanceType = {
  id: asId<IssuanceTypeId>('type-1'),
  office: OFFICE,
  name: 'Certificate of residency',
  description: null,
  requirements: [],
  fee: null,
  processingDays: 3,
  claimInstructions: null,
  active: true,
  retiredAt: null,
  updatedAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
};

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingIssuance implements IssuanceRepository {
  readonly waited: IssuanceQueueFilter[] = [];
  readonly listed: { filter: IssuanceListFilter; page: CursorRequest }[] = [];
  readonly moves: IssuanceMove[] = [];
  readonly grants: IssuanceAttachmentId[] = [];
  readonly reads: IssuanceFileGrant[] = [];
  readonly created: IssuanceTypeDraft[] = [];
  readonly updated: IssuanceTypeChanges[] = [];
  readonly retired: string[] = [];
  current = request('approved', ['ready-for-pickup']);

  catalogue(): Observable<readonly IssuanceType[]> {
    return of([TYPE]);
  }
  officeTypes(): Observable<readonly IssuanceType[]> {
    return of([TYPE]);
  }
  createType(draft: IssuanceTypeDraft): Observable<IssuanceType> {
    this.created.push(draft);
    return of({ ...TYPE, name: draft.name });
  }
  updateType(_id: IssuanceTypeId, changes: IssuanceTypeChanges): Observable<IssuanceType> {
    this.updated.push(changes);
    return of(TYPE);
  }
  retireType(_id: IssuanceTypeId, reason: string): Observable<IssuanceType> {
    this.retired.push(reason);
    return of({ ...TYPE, active: false });
  }
  waiting(filter: IssuanceQueueFilter): Observable<readonly IssuanceRequestSummary[]> {
    this.waited.push(filter);
    return of([
      row(1, 'submitted', '2026-11-05T00:00:00.000Z'),
      row(2, 'approved', '2026-10-28T00:00:00.000Z'),
      row(3, 'needs-info', '2026-11-01T00:00:00.000Z'),
    ]);
  }
  list(
    filter: IssuanceListFilter,
    page: CursorRequest,
  ): Observable<CursorPage<IssuanceRequestSummary>> {
    this.listed.push({ filter, page });
    return of(
      page.cursor
        ? {
            items: [row(6, 'released', '2026-10-01T00:00:00.000Z')],
            hasMore: false,
            nextCursor: null,
          }
        : {
            items: [
              row(4, 'released', '2026-10-20T00:00:00.000Z'),
              row(5, 'released', '2026-10-10T00:00:00.000Z'),
            ],
            hasMore: true,
            nextCursor: 'cursor-2',
          },
    );
  }
  request(): Observable<IssuanceRequest> {
    return of(this.current);
  }
  move(_id: IssuanceRequestId, move: IssuanceMove): Observable<IssuanceRequest> {
    this.moves.push(move);
    return of({ ...this.current, status: move.to, allowedMoves: [] });
  }
  grantAttachment(
    _id: IssuanceRequestId,
    attachmentId: IssuanceAttachmentId,
  ): Observable<IssuanceFileGrant> {
    this.grants.push(attachmentId);
    return of({
      attachmentId,
      fileName: 'valid-id-v1.jpg',
      mimeType: 'image/jpeg',
      handle: 'handle-1234567890-abcdefghij',
      expiresAt: asIsoDateTime('2026-11-07T00:05:00.000Z'),
      warning: 'The server says: this holds personal information about a resident (RA 10173).',
    });
  }
  readAttachment(grant: IssuanceFileGrant): Observable<Blob> {
    this.reads.push(grant);
    return of(new Blob(['bytes'], { type: 'image/jpeg' }));
  }
}

const created: string[] = [];
const revoked: string[] = [];

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  // jsdom has no object URLs; these stand in and record what the page makes and gives back.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => {
      const url = `blob:test/${created.length + 1}`;
      created.push(url);
      return url;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn((url: string) => revoked.push(url)),
  });
});

afterEach(() => {
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

function configure(): RecordingIssuance {
  const repository = new RecordingIssuance();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ISSUANCE_REPOSITORY, useValue: repository },
      { provide: OFFICE_REPOSITORY, useValue: { list: () => of([]) } },
      {
        provide: SessionStore,
        useValue: { user: signal(null), permissions: signal(new Set()) },
      },
    ],
  });
  return repository;
}

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name,
    ) ?? null
  );
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function type(
  element: HTMLElement | null,
  value: string,
  kind: 'input' | 'change' = 'input',
): void {
  if (element === null) throw new Error('no such field');
  (element as HTMLInputElement).value = value;
  element.dispatchEvent(new Event(kind));
}

/* ── the queue ───────────────────────────────────────────────────────────── */

describe('IssuanceQueuePage (DL-184)', () => {
  it('reads every open request whole and puts the one that has waited longest first', async () => {
    const repository = configure();
    const element = await settle(TestBed.createComponent(IssuanceQueuePage));

    expect(repository.waited[0]).toEqual({ status: null, typeId: null });
    expect(repository.listed).toHaveLength(0);
    const references = [...element.querySelectorAll('tbody tr a')].map((a) =>
      a.textContent?.trim(),
    );
    expect(references).toEqual(['DR-2026-000002', 'DR-2026-000003', 'DR-2026-000001']);
    expect(element.textContent).toContain('Showing all 3 requests.');
    expect(element.textContent).not.toMatch(/page \d+ of|overdue|late by/i);
  });

  it('says on whom each request waits, beside the office’s own standard, and names no deadline', async () => {
    configure();
    const element = await settle(TestBed.createComponent(IssuanceQueuePage));

    expect(element.textContent).toMatch(/With the office for \d+ days/);
    expect(element.textContent).toMatch(/With the resident for \d+ days/);
    expect(element.textContent).toContain('Office standard: 3 working days');
    expect(element.textContent).toContain(ISSUANCE_COPY.queue.noName);
  });

  it('states that nothing is paid online and that the office makes the document', async () => {
    configure();
    const element = await settle(TestBed.createComponent(IssuanceQueuePage));

    for (const sentence of ISSUANCE_BOUNDARIES) {
      expect(element.textContent).toContain(sentence);
    }
  });

  it('browses an ended status a page at a time, newest first, and says more exist', async () => {
    const repository = configure();
    await TestBed.inject(Router).navigateByUrl('/?status=released');
    const fixture = TestBed.createComponent(IssuanceQueuePage);
    const element = await settle(fixture);

    expect(repository.listed[0]).toEqual({
      filter: { status: 'released', typeId: null },
      page: { limit: 20, cursor: null },
    });
    expect(element.textContent).toContain('Showing 2 requests. More are available.');

    buttonNamed(element, ISSUANCE_COPY.queue.showMore)?.click();
    await settle(fixture);
    expect(repository.listed[1]?.page).toEqual({ limit: 20, cursor: 'cursor-2' });
    expect(element.textContent).toContain('Showing 3 requests. That is all of them.');
  });

  it('keeps its filters in the address', async () => {
    configure();
    const element = await settle(TestBed.createComponent(IssuanceQueuePage));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    type(element.querySelector('#issuance-status'), 'approved', 'change');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { status: 'approved' } }),
    );
    type(element.querySelector('#issuance-type'), 'type-1', 'change');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { type: 'type-1' } }),
    );
  });
});

describe('IssuanceQueuePage — by reference and by resident (DL-186)', () => {
  it('finds one request by its whole number, in every status, and nothing else narrows it', async () => {
    const repository = configure();
    await TestBed.inject(Router).navigateByUrl('/?reference=DR-2026-000004&status=approved');
    const element = await settle(TestBed.createComponent(IssuanceQueuePage));

    expect(repository.waited).toHaveLength(0);
    expect(repository.listed[0]).toEqual({
      filter: { status: null, typeId: null, reference: 'DR-2026-000004' },
      page: { limit: 20, cursor: null },
    });
    expect(element.textContent).toContain(ISSUANCE_COPY.queue.referenceShown('DR-2026-000004'));
    // The status and document filters stand aside while a number is looked up.
    expect(element.querySelector('#issuance-status')).toBeNull();
  });

  it('sends a whole number as the API reads it, and never part of one', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(IssuanceQueuePage);
    const element = await settle(fixture);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const box = element.querySelector<HTMLInputElement>('#issuance-reference');

    type(box, 'DR-2026-0001');
    buttonNamed(element, ISSUANCE_COPY.queue.find)?.click();
    await settle(fixture);
    expect(navigate).not.toHaveBeenCalled();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('whole reference');

    type(box, '  dr-2026-000123 ');
    buttonNamed(element, ISSUANCE_COPY.queue.find)?.click();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { reference: 'DR-2026-000123' } }),
    );
    expect(repository.listed.some((call) => call.filter.reference === 'DR-2026-0001')).toBe(false);
  });

  it('narrows the queue to one resident when the address names one', async () => {
    const repository = configure();
    await TestBed.inject(Router).navigateByUrl('/?resident=account-1');
    const element = await settle(TestBed.createComponent(IssuanceQueuePage));

    expect(repository.waited[0]).toEqual({
      status: null,
      typeId: null,
      residentAccountId: 'account-1',
    });
    expect(element.textContent).toContain(ISSUANCE_COPY.queue.residentShown);

    await TestBed.inject(Router).navigateByUrl('/?resident=account-1&status=released');
    const ended = TestBed.createComponent(IssuanceQueuePage);
    await settle(ended);
    expect(repository.listed.at(-1)?.filter).toEqual({
      status: 'released',
      typeId: null,
      residentAccountId: 'account-1',
    });
  });
});

/* ── one request ─────────────────────────────────────────────────────────── */

describe('IssuanceRequestPage (DL-184)', () => {
  async function open(subject?: IssuanceRequest) {
    const repository = configure();
    if (subject !== undefined) repository.current = subject;
    const fixture = TestBed.createComponent(IssuanceRequestPage);
    fixture.componentRef.setInput('requestId', 'ir-7');
    const element = await settle(fixture);
    return { repository, fixture, element };
  }

  it('shows the resident’s purpose and the fee from integer centavos', async () => {
    const { element } = await open();
    expect(element.textContent).toContain('For my medical assistance application.');
    expect(element.textContent).toContain('₱50.00');
    expect(element.textContent).toContain('Office standard: 3 working days');
  });

  it('opens nothing until asked, shows the server’s warning first, and gives the file back on close', async () => {
    const { repository, fixture, element } = await open();
    expect(repository.grants).toHaveLength(0);
    expect(created).toHaveLength(0);

    buttonNamed(element, ISSUANCE_COPY.request.show)?.click();
    await settle(fixture);
    expect(repository.grants).toEqual(['file-1']);
    expect(repository.reads).toHaveLength(0);
    expect(document.body.textContent).toContain('this holds personal information about a resident');

    buttonNamed(document.body, ISSUANCE_COPY.request.warningProceed)?.click();
    await settle(fixture);
    expect(repository.reads).toHaveLength(1);
    expect(created).toEqual(['blob:test/1']);
    expect(document.body.querySelector('img[src="blob:test/1"]')).not.toBeNull();

    buttonNamed(document.body, ISSUANCE_COPY.request.close)?.click();
    await settle(fixture);
    expect(revoked).toContain('blob:test/1');
  });

  it('gives every file back when the page is left', async () => {
    const { fixture, element } = await open();
    buttonNamed(element, ISSUANCE_COPY.request.show)?.click();
    await settle(fixture);
    buttonNamed(document.body, ISSUANCE_COPY.request.warningProceed)?.click();
    await settle(fixture);

    fixture.destroy();
    expect(revoked).toEqual(created);
  });

  it('asks when and where to claim it before marking it ready, and says the resident reads it', async () => {
    const { repository, fixture, element } = await open();
    expect(element.textContent).toContain(ISSUANCE_COPY.request.reasonHint);

    type(element.querySelector('#issuance-move-destination'), 'ready-for-pickup', 'change');
    await settle(fixture);
    const confirm = buttonNamed(element, ISSUANCE_COPY.request.confirm);
    type(element.querySelector('#issuance-move-reason'), 'Your certificate is ready.');
    await settle(fixture);
    expect(confirm?.disabled).toBe(true);

    type(element.querySelector('#issuance-move-detail'), 'MSWDO counter, weekdays 8 to 5.');
    await settle(fixture);
    expect(confirm?.disabled).toBe(false);
    confirm?.click();
    await settle(fixture);

    expect(repository.moves).toEqual([
      {
        to: 'ready-for-pickup',
        reason: 'Your certificate is ready.',
        claimDetails: 'MSWDO counter, weekdays 8 to 5.',
      },
    ]);
    expect(element.textContent).toContain('Recorded: the request is now ready for pickup.');
  });

  it('offers only the server’s moves, and none while the resident owes the next act', async () => {
    const { element } = await open(request('needs-info', []));
    expect(element.querySelector('#issuance-move-destination')).toBeNull();
    expect(element.textContent).toContain(ISSUANCE_COPY.request.waitingOnResident);
  });
});

/* ── the catalogue ───────────────────────────────────────────────────────── */

describe('IssuanceCataloguePage (DL-184)', () => {
  it('reads a fee typed in pesos into centavos and says back what residents will see', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(IssuanceCataloguePage);
    const element = await settle(fixture);

    buttonNamed(element, ISSUANCE_COPY.catalogue.add)?.click();
    await settle(fixture);
    const body = document.body;
    type(body.querySelector('#issuance-type-name'), 'Certificate of residency');
    type(body.querySelector('#issuance-type-fee'), '1,250.50');
    type(body.querySelector('#issuance-type-days'), '3');
    type(body.querySelector('#issuance-type-reason'), 'Offered from this month.');
    await settle(fixture);
    expect(body.textContent).toContain('₱1,250.50');

    buttonNamed(body, ISSUANCE_COPY.catalogue.save)?.click();
    await settle(fixture);
    expect(repository.created[0]).toMatchObject({
      name: 'Certificate of residency',
      fee: { centavos: 125050, currency: 'PHP' },
      processingDays: 3,
      officeId: null,
    });
  });

  it('refuses a fee with a third decimal place rather than rounding it', async () => {
    configure();
    const fixture = TestBed.createComponent(IssuanceCataloguePage);
    const element = await settle(fixture);
    buttonNamed(element, ISSUANCE_COPY.catalogue.add)?.click();
    await settle(fixture);
    type(document.body.querySelector('#issuance-type-name'), 'Certificate of residency');
    type(document.body.querySelector('#issuance-type-fee'), '10.005');
    type(document.body.querySelector('#issuance-type-reason'), 'Offered from this month.');
    await settle(fixture);

    expect(document.body.textContent).toContain(ISSUANCE_COPY.catalogue.feeInvalid);
    expect(buttonNamed(document.body, ISSUANCE_COPY.catalogue.save)?.disabled).toBe(true);
  });

  it('says what retiring does before the button, and retires only with a reason', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(IssuanceCataloguePage);
    const element = await settle(fixture);

    buttonNamed(element, ISSUANCE_COPY.catalogue.retire)?.click();
    await settle(fixture);
    for (const line of RETIRE_EFFECTS) {
      expect(document.body.textContent).toContain(line);
    }
    const confirm = buttonNamed(document.body, ISSUANCE_COPY.catalogue.retireConfirm);
    expect(confirm?.disabled).toBe(true);

    type(document.body.querySelector('#issuance-retire-reason'), 'Replaced by a new form.');
    await settle(fixture);
    expect(confirm?.disabled).toBe(false);
    confirm?.click();
    await settle(fixture);
    expect(repository.retired).toEqual(['Replaced by a new form.']);
  });

  it('sends nothing when an edit changes nothing', async () => {
    const repository = configure();
    const fixture = TestBed.createComponent(IssuanceCataloguePage);
    const element = await settle(fixture);

    buttonNamed(element, ISSUANCE_COPY.catalogue.edit)?.click();
    await settle(fixture);
    type(document.body.querySelector('#issuance-type-reason'), 'Nothing really changed.');
    await settle(fixture);

    expect(document.body.textContent).toContain(ISSUANCE_COPY.catalogue.unchanged);
    expect(buttonNamed(document.body, ISSUANCE_COPY.catalogue.save)?.disabled).toBe(true);
    expect(repository.updated).toHaveLength(0);
  });
});
