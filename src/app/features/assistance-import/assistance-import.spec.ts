import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LiveUpdates } from '@core/live/live-updates';
import {
  asId,
  asIsoDateTime,
  ASSISTANCE_IMPORT_REPOSITORY,
  type AssistanceImport,
  type AssistanceImportId,
  type AssistanceImportMapping,
  type AssistanceImportRepository,
  type AssistanceImportResolution,
  type AssistanceImportSummary,
  type CursorPage,
  type ImportTemplate,
  type ResidentId,
} from '@domain/index';
import { IMPORT_TEMPLATE_COPY } from '@shared/imports/imports.copy';

import { ASSISTANCE_IMPORT_COPY } from './assistance-import.copy';
import { ASSISTANCE_IMPORT_TOPICS, AssistanceImportPage } from './assistance-import-page';
import { AssistanceImportStartPage } from './assistance-import-start-page';

const COPY = ASSISTANCE_IMPORT_COPY;

const SUMMARY: AssistanceImportSummary = {
  id: asId<AssistanceImportId>('import-1'),
  fileName: 'tulong-2024.csv',
  kind: 'csv',
  status: 'open',
  rowCount: 3,
  createdAt: asIsoDateTime('2026-11-18T01:00:00.000Z'),
  createdBy: 'Test Officer',
  committedAt: null,
  committedBy: null,
  result: null,
  withdrawal: null,
};

const COMMITTED: AssistanceImportSummary = {
  ...SUMMARY,
  id: asId<AssistanceImportId>('import-2'),
  fileName: 'tulong-2023.csv',
  status: 'committed',
  committedAt: asIsoDateTime('2026-11-18T03:00:00.000Z'),
  committedBy: 'Test Officer',
  result: { imported: 4, skipped: 1, duplicates: 1, errors: 0, residentsCreated: 1 },
};

const RECORD: AssistanceImport = {
  ...SUMMARY,
  columns: [{ index: 0, header: 'Pangalan', samples: ['Cruz, Juan'] }],
  fields: [
    { field: 'fullName', label: 'Name', required: false },
    { field: 'barangay', label: 'Barangay', required: true },
  ],
  mapping: { fullName: 0 },
  missingFields: [],
  counts: { ready: 1, 'needs-review': 1, skipped: 0, duplicate: 1, error: 0 },
  rows: [
    {
      row: 1,
      sourceLine: 2,
      group: 'ready',
      values: { fullName: 'Reyes, Ana' },
      problems: [],
      match: { residentId: asId<ResidentId>('resident-1'), label: 'Reyes, A.', how: 'proposed' },
      willCreate: false,
      createProblems: [],
      candidates: [],
      duplicate: null,
      resolution: null,
    },
    {
      row: 2,
      sourceLine: 3,
      group: 'needs-review',
      values: { fullName: 'Cruz, Juan', barangay: 'Dolores' },
      problems: [],
      match: null,
      willCreate: false,
      createProblems: ['civil_status: Required'],
      candidates: [
        {
          residentId: asId<ResidentId>('resident-9'),
          label: 'Cruz, J.',
          strength: 'moderate',
          signals: [
            {
              attribute: 'barangay',
              outcome: 'differs',
              rule: 'The row and the record name different barangays.',
            },
          ],
        },
      ],
      duplicate: null,
      resolution: null,
    },
    {
      row: 3,
      sourceLine: 4,
      group: 'duplicate',
      values: { fullName: 'Reyes, Ana' },
      problems: [],
      match: null,
      willCreate: false,
      createProblems: [],
      candidates: [],
      duplicate: { reason: 'control-number', ofRow: null, ofRequestReference: 'TAY-2024-00012' },
      resolution: null,
    },
  ],
  outcomes: [],
};

const WITHDRAWN: AssistanceImport = {
  ...RECORD,
  ...COMMITTED,
  status: 'withdrawn',
  withdrawal: {
    at: asIsoDateTime('2026-11-19T03:00:00.000Z'),
    by: 'The Head',
    reason: 'The wrong year was imported.',
  },
  counts: { ready: 0, 'needs-review': 0, skipped: 0, duplicate: 0, error: 0 },
  rows: [],
  outcomes: [
    {
      row: 1,
      sourceLine: 2,
      outcome: 'duplicate',
      requestId: null,
      note: 'The same control number is already in row 4 of this file.',
    },
  ],
};

/** Records every act, and answers with the import as given. */
class Imports implements AssistanceImportRepository {
  readonly calls: string[] = [];
  page: Observable<CursorPage<AssistanceImportSummary>> = of({
    items: [SUMMARY, COMMITTED],
    hasMore: true,
    nextCursor: 'c2',
  });
  record: AssistanceImport | null = RECORD;
  resolveAnswer: () => Observable<AssistanceImport> = () => of(RECORD);

  list(): Observable<CursorPage<AssistanceImportSummary>> {
    this.calls.push('list');
    return this.page;
  }
  upload(file: File): Observable<AssistanceImportSummary> {
    this.calls.push(`upload:${file.name}`);
    return of(SUMMARY);
  }
  get(): Observable<AssistanceImport | null> {
    this.calls.push('get');
    return of(this.record);
  }
  map(id: AssistanceImportId, mapping: AssistanceImportMapping): Observable<AssistanceImport> {
    this.calls.push(`map:${id}:${JSON.stringify(mapping)}`);
    return of(RECORD);
  }
  resolve(
    id: AssistanceImportId,
    row: number,
    resolution: AssistanceImportResolution,
  ): Observable<AssistanceImport> {
    this.calls.push(`resolve:${id}:${row}:${JSON.stringify(resolution)}`);
    return this.resolveAnswer();
  }
  commit(): Observable<AssistanceImportSummary> {
    this.calls.push('commit');
    return of(COMMITTED);
  }
  withdraw(id: AssistanceImportId, reason: string): Observable<AssistanceImportSummary> {
    this.calls.push(`withdraw:${id}:${reason}`);
    return of({ ...COMMITTED, status: 'withdrawn' });
  }
  template(): Observable<ImportTemplate> {
    this.calls.push('template');
    return of({
      fileName: 'past-assistance-template.csv',
      contentType: 'text/csv',
      content: '\uFEFFSurname\r\n',
    });
  }
}

function configure(extra: readonly Provider[] = []): Imports {
  const imports = new Imports();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ASSISTANCE_IMPORT_REPOSITORY, useValue: imports },
      ...extra,
    ],
  });
  return imports;
}

async function settle(fixture: {
  detectChanges(): void;
  whenStable(): Promise<unknown>;
}): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const text = (root: ParentNode): string => root.textContent?.replace(/\s+/g, ' ') ?? '';

function button(root: ParentNode, label: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
}

function type(element: HTMLTextAreaElement | HTMLInputElement | null, value: string): void {
  if (element === null) return;
  element.value = value;
  element.dispatchEvent(new Event('input'));
}

interface OpenPage extends HTMLElement {
  readonly settle: () => Promise<void>;
}

async function openPage(step: string): Promise<OpenPage> {
  const fixture = TestBed.createComponent(AssistanceImportPage);
  fixture.componentRef.setInput('importId', 'import-1');
  fixture.componentRef.setInput('step', step);
  await settle(fixture);
  return Object.assign(fixture.nativeElement as HTMLElement, { settle: () => settle(fixture) });
}

const URLS = {
  create: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revoke: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
};

afterEach(() => {
  for (const [name, descriptor] of [
    ['createObjectURL', URLS.create],
    ['revokeObjectURL', URLS.revoke],
  ] as const) {
    if (descriptor === undefined) Reflect.deleteProperty(URL, name);
    else Object.defineProperty(URL, name, descriptor);
  }
  vi.restoreAllMocks();
});

describe('Import past assistance, the upload and the list (DL-228)', () => {
  it('lists imports, says more exist without a total, and says what uploading does', async () => {
    configure();
    const fixture = TestBed.createComponent(AssistanceImportStartPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root)).toContain('tulong-2024.csv');
    expect(text(root)).toContain(COPY.recent.moreAvailable);
    expect(text(root)).not.toMatch(/page 1 of/i);
    expect(text(root)).toContain(COPY.upload.effects[0]);
    expect(text(root)).toContain(COPY.recent.result(4, 1, 1, 0));
  });

  it('sends nothing for a wrong file', async () => {
    const imports = configure();
    const fixture = TestBed.createComponent(AssistanceImportStartPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    const input = root.querySelector<HTMLInputElement>('input[type="file"]');
    const chosen = new File(['x'], 'report.pdf');
    if (input !== null) {
      Object.defineProperty(input, 'files', { value: { length: 1, item: () => chosen } });
      input.dispatchEvent(new Event('change'));
    }
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit'));
    await settle(fixture);

    expect(text(root)).toContain(COPY.upload.wrongKind);
    expect(imports.calls.some((call) => call.startsWith('upload'))).toBe(false);
  });

  it('downloads the template as a file made in the browser', async () => {
    const imports = configure();
    const made: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => {
        made.push(blob);
        return 'blob:template';
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      // jsdom does not navigate; the click is what hands the file to the browser.
    });
    const fixture = TestBed.createComponent(AssistanceImportStartPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    button(root, IMPORT_TEMPLATE_COPY.button)?.click();
    await settle(fixture);

    expect(imports.calls).toContain('template');
    expect(made[0]?.type).toContain('text/csv');
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(text(root)).toContain(IMPORT_TEMPLATE_COPY.saved('past-assistance-template.csv'));
    // Leaving the page revokes the file's address, while the stub still stands.
    fixture.destroy();
  });

  it('shows an empty list as empty, and a failed list with Try again', async () => {
    const imports = configure();
    imports.page = of({ items: [], hasMore: false, nextCursor: null });
    const empty = TestBed.createComponent(AssistanceImportStartPage);
    await settle(empty);
    expect(text(empty.nativeElement as HTMLElement)).toContain(COPY.recent.emptyHeading);

    imports.page = throwError(() => new Error('The list could not be read.'));
    const failed = TestBed.createComponent(AssistanceImportStartPage);
    await settle(failed);
    const root = failed.nativeElement as HTMLElement;
    expect(text(root)).toContain('The list could not be read.');
    imports.page = of({ items: [SUMMARY], hasMore: false, nextCursor: null });
    const listed = imports.calls.length;
    button(root, COPY.retry)?.click();
    await settle(failed);
    expect(imports.calls.length).toBe(listed + 1);
    expect(text(root)).toContain('tulong-2024.csv');
  });

  it('withdraws a committed import only with a reason, saying first that nothing is deleted', async () => {
    const imports = configure();
    const fixture = TestBed.createComponent(AssistanceImportStartPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    const withdraw = [...root.querySelectorAll<HTMLButtonElement>('button')].filter(
      (candidate) => candidate.textContent?.trim() === COPY.withdraw.button,
    );
    // Only the committed import offers it; the open one does not.
    expect(withdraw).toHaveLength(1);
    withdraw[0]?.click();
    await settle(fixture);

    const dialog = document.body.querySelector('app-assistance-import-withdraw') ?? root;
    const effects = COPY.withdraw.effects(4);
    expect(text(dialog)).toContain(effects[1]);
    expect(text(dialog)).toContain(effects[2]);
    const confirm = button(dialog, COPY.withdraw.confirm);
    expect(confirm?.disabled).toBe(true);
    // The effects stand before the button that acts on them.
    const order =
      text(dialog).indexOf(effects[1] ?? '') < text(dialog).lastIndexOf(COPY.withdraw.confirm);
    expect(order).toBe(true);

    type(dialog.querySelector('textarea'), 'The wrong year was imported.');
    await settle(fixture);
    button(dialog, COPY.withdraw.confirm)?.click();
    await settle(fixture);

    expect(imports.calls).toContain('withdraw:import-2:The wrong year was imported.');
    expect(imports.calls.filter((call) => call === 'list')).toHaveLength(2);
  });
});

describe('Import past assistance, the rows (DL-228)', () => {
  it('shows a candidate by its masked label and signals in words, and records a link only with a reason', async () => {
    const imports = configure();
    const root = await openPage('review');

    expect(text(root)).toContain('Cruz, J.');
    expect(text(root)).toContain(
      'Barangay: Different — The row and the record name different barangays.',
    );
    expect(text(root)).not.toContain('resident-9');

    const form = (): HTMLFormElement | null =>
      root.querySelector<HTMLFormElement>('app-assistance-import-row form');
    form()?.dispatchEvent(new Event('submit'));
    await root.settle();
    expect(text(root)).toContain(COPY.finding.chooseAction);

    root
      .querySelectorAll<HTMLInputElement>('app-assistance-import-row input[type="radio"]')[0]
      ?.click();
    form()?.dispatchEvent(new Event('submit'));
    await root.settle();
    expect(text(root)).toContain(COPY.finding.reasonMissing);
    expect(imports.calls.some((call) => call.startsWith('resolve'))).toBe(false);

    type(root.querySelector('app-assistance-import-row textarea'), 'Same mother on file.');
    form()?.dispatchEvent(new Event('submit'));
    await root.settle();
    expect(imports.calls).toContain(
      `resolve:import-1:2:${JSON.stringify({ action: 'link', residentId: 'resident-9', reason: 'Same mother on file.' })}`,
    );
  });

  it('asks a create for what the registry lacks, shows the server’s problems, and sends only what was given', async () => {
    const imports = configure();
    const root = await openPage('review');

    const radios = root.querySelectorAll<HTMLInputElement>(
      'app-assistance-import-row input[type="radio"]',
    );
    radios[1]?.click();
    await root.settle();
    expect(text(root)).toContain('civil_status: Required');

    const civil = root.querySelector<HTMLSelectElement>('app-assistance-import-row select');
    if (civil !== null) {
      civil.value = 'widowed';
      civil.dispatchEvent(new Event('change'));
    }
    type(root.querySelector('app-assistance-import-row textarea'), 'Not on the registry.');
    root
      .querySelector<HTMLFormElement>('app-assistance-import-row form')
      ?.dispatchEvent(new Event('submit'));
    await root.settle();

    expect(imports.calls).toContain(
      `resolve:import-1:2:${JSON.stringify({ action: 'create', record: { civilStatus: 'widowed' }, reason: 'Not on the registry.' })}`,
    );
  });

  it('says a refusal in the server’s plain words, never a code', async () => {
    const imports = configure();
    imports.resolveAnswer = () =>
      throwError(() => new Error('The registry needs more than the row gives to make a record.'));
    const root = await openPage('review');

    root
      .querySelectorAll<HTMLInputElement>('app-assistance-import-row input[type="radio"]')[2]
      ?.click();
    type(root.querySelector('app-assistance-import-row textarea'), 'Not ours.');
    root
      .querySelector<HTMLFormElement>('app-assistance-import-row form')
      ?.dispatchEvent(new Event('submit'));
    await root.settle();

    expect(text(root)).toContain(
      COPY.finding.refused('The registry needs more than the row gives to make a record.'),
    );
    expect(text(root)).not.toMatch(/\b(409|422)\b/);
  });

  it('names the request a duplicate repeats', async () => {
    configure();
    const fixture = TestBed.createComponent(AssistanceImportPage);
    fixture.componentRef.setInput('importId', 'import-1');
    fixture.componentRef.setInput('step', 'review');
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    [...root.querySelectorAll<HTMLButtonElement>('.tab')]
      .find((tab) => tab.textContent?.includes(COPY.review.groups.duplicate))
      ?.click();
    await settle(fixture);
    expect(text(root)).toContain(
      COPY.review.duplicateRequest(COPY.review.duplicateOf['control-number'], 'TAY-2024-00012'),
    );
  });

  it('holds the commit while a row waits, and says why', async () => {
    const imports = configure();
    const root = await openPage('commit');

    expect(text(root)).toContain(COPY.commit.blockers['needs-review']);
    const submit = button(root, COPY.commit.submit);
    expect(submit?.disabled).toBe(true);
    submit?.click();
    expect(imports.calls).not.toContain('commit');
  });

  it('shows a withdrawn import’s result: who withdrew it, when and why, and each row’s note', async () => {
    const imports = configure();
    imports.record = WITHDRAWN;
    const root = await openPage('map');

    expect(text(root)).toContain(COPY.done.heading);
    expect(text(root)).toContain('The Head');
    expect(text(root)).toContain(COPY.withdrawn.reason('The wrong year was imported.'));
    expect(text(root)).toContain('The same control number is already in row 4 of this file.');
    expect(button(root, COPY.withdraw.button)).toBeUndefined();
  });

  it('says an import was not found, and where to choose one', async () => {
    const imports = configure();
    imports.record = null;
    const root = await openPage('map');
    expect(text(root)).toContain(COPY.record.notFound);
    expect(text(root)).toContain(COPY.record.notFoundLink);
  });
});

describe('an import of past assistance keeps itself current (DL-222)', () => {
  it('reads the import again on a hint, writes nothing, and keeps a finding being written', async () => {
    const changes = new Subject<void>();
    const asked: unknown[] = [];
    const imports = configure([
      {
        provide: LiveUpdates,
        useValue: {
          changes: (topics: readonly string[]) => {
            asked.push(topics);
            return changes.asObservable();
          },
          noteRefreshed: vi.fn(),
          noteRefreshFailed: vi.fn(),
        },
      },
    ]);
    imports.get = () => {
      imports.calls.push('get');
      return of(structuredClone(RECORD));
    };
    const root = await openPage('review');
    expect(asked).toEqual([ASSISTANCE_IMPORT_TOPICS]);

    type(root.querySelector('app-assistance-import-row textarea'), 'Checking.');
    await root.settle();
    changes.next();
    await root.settle();

    expect(imports.calls).toEqual(['get', 'get']);
    expect(
      root.querySelector<HTMLTextAreaElement>('app-assistance-import-row textarea')?.value,
    ).toBe('Checking.');
  });
});
