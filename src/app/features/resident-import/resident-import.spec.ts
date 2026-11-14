import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { LiveUpdates } from '@core/live/live-updates';

import {
  asId,
  asIsoDateTime,
  RESIDENT_IMPORT_REPOSITORY,
  type CursorPage,
  type ImportMapping,
  type ImportResolution,
  type ResidentId,
  type ResidentImport,
  type ResidentImportId,
  type ResidentImportRepository,
  type ResidentImportSummary,
} from '@domain/index';

import { IMPORT_TOPICS, ImportPage } from './import-page';
import { ImportStartPage } from './import-start-page';
import { RESIDENT_IMPORT_COPY } from './resident-import.copy';

const SUMMARY: ResidentImportSummary = {
  id: asId<ResidentImportId>('import-1'),
  fileName: 'census.csv',
  kind: 'csv',
  status: 'open',
  rowCount: 3,
  createdAt: asIsoDateTime('2026-11-12T01:00:00.000Z'),
  createdBy: 'Test Officer',
  committedAt: null,
  committedBy: null,
  result: null,
};

const RECORD: ResidentImport = {
  ...SUMMARY,
  columns: [{ index: 0, header: 'Surname', samples: ['Cruz'] }],
  fields: [{ field: 'lastName', label: 'Surname', required: true }],
  mapping: { lastName: 0 },
  missingFields: [],
  counts: { new: 1, match: 1, duplicate: 0, error: 1, unresolved: 1 },
  groups: {
    new: [
      {
        row: 1,
        sourceLine: 2,
        values: { lastName: 'Cruz' },
        problems: [],
        candidates: [],
        duplicateOf: null,
        resolution: null,
      },
    ],
    match: [
      {
        row: 2,
        sourceLine: 3,
        values: { lastName: 'Reyes' },
        problems: [],
        candidates: [
          {
            residentId: asId<ResidentId>('resident-9'),
            name: 'Reyes, Ana',
            barangayId: null,
            isActive: true,
          },
        ],
        duplicateOf: null,
        resolution: null,
      },
    ],
    duplicate: [],
    error: [
      {
        row: 3,
        sourceLine: 4,
        values: {},
        problems: [{ field: 'lastName', message: 'Surname is empty.' }],
        candidates: [],
        duplicateOf: null,
        resolution: null,
      },
    ],
  },
  outcomes: [],
};

/** Records every act, and answers with the import as given. */
class Imports implements ResidentImportRepository {
  readonly calls: string[] = [];
  list(): Observable<CursorPage<ResidentImportSummary>> {
    this.calls.push('list');
    return of({ items: [SUMMARY], hasMore: false, nextCursor: null });
  }
  upload(file: File): Observable<ResidentImportSummary> {
    this.calls.push(`upload:${file.name}`);
    return of(SUMMARY);
  }
  get(): Observable<ResidentImport | null> {
    this.calls.push('get');
    return of(RECORD);
  }
  map(id: ResidentImportId, mapping: ImportMapping): Observable<ResidentImport> {
    this.calls.push(`map:${id}:${JSON.stringify(mapping)}`);
    return of(RECORD);
  }
  resolve(
    id: ResidentImportId,
    row: number,
    resolution: ImportResolution,
  ): Observable<ResidentImport> {
    this.calls.push(`resolve:${id}:${row}:${resolution.action}:${resolution.reason}`);
    return of(RECORD);
  }
  commit(): Observable<ResidentImportSummary> {
    this.calls.push('commit');
    return of(SUMMARY);
  }
}

function configure(extra: readonly Provider[] = []): Imports {
  const imports = new Imports();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: RESIDENT_IMPORT_REPOSITORY, useValue: imports },
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

const text = (root: HTMLElement): string => root.textContent?.replace(/\s+/g, ' ') ?? '';

describe('Import citizens (DL-214)', () => {
  it('lists recent imports, says what uploading does, and sends nothing for a wrong file', async () => {
    const imports = configure();
    const fixture = TestBed.createComponent(ImportStartPage);
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root)).toContain('census.csv');
    expect(text(root)).toContain(RESIDENT_IMPORT_COPY.upload.effects[0]);

    const input = root.querySelector<HTMLInputElement>('input[type="file"]');
    const chosen = new File(['x'], 'list.pdf');
    if (input !== null) {
      Object.defineProperty(input, 'files', { value: { length: 1, item: () => chosen } });
      input.dispatchEvent(new Event('change'));
    }
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit'));
    await settle(fixture);

    expect(text(root)).toContain(RESIDENT_IMPORT_COPY.upload.wrongKind);
    expect(imports.calls.some((call) => call.startsWith('upload'))).toBe(false);
  });

  it('records a finding on a match only with a reason, and offers "the same person as" by name', async () => {
    const imports = configure();
    const fixture = TestBed.createComponent(ImportPage);
    fixture.componentRef.setInput('importId', 'import-1');
    fixture.componentRef.setInput('step', 'check');
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root)).toContain(
      `${RESIDENT_IMPORT_COPY.finding.actions['same-person']} Reyes, Ana`,
    );
    const radios = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    radios[1]?.click();
    root
      .querySelector<HTMLFormElement>('app-import-row-finding form')
      ?.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(text(root)).toContain(RESIDENT_IMPORT_COPY.finding.reasonMissing);
    expect(imports.calls.some((call) => call.startsWith('resolve'))).toBe(false);

    const reason = root.querySelector<HTMLTextAreaElement>('app-import-row-finding textarea');
    if (reason !== null) {
      reason.value = 'Same birth date and mother on file.';
      reason.dispatchEvent(new Event('input'));
    }
    root
      .querySelector<HTMLFormElement>('app-import-row-finding form')
      ?.dispatchEvent(new Event('submit'));
    await settle(fixture);
    expect(imports.calls).toContain(
      'resolve:import-1:2:same-person:Same birth date and mother on file.',
    );
  });

  it('holds the confirmation while a match is undecided, and says why', async () => {
    const imports = configure();
    const fixture = TestBed.createComponent(ImportPage);
    fixture.componentRef.setInput('importId', 'import-1');
    fixture.componentRef.setInput('step', 'confirm');
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root)).toContain(RESIDENT_IMPORT_COPY.confirm.blockers.unresolved);
    const submit = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === RESIDENT_IMPORT_COPY.confirm.submit,
    );
    expect(submit?.disabled).toBe(true);
    submit?.click();
    expect(imports.calls).not.toContain('commit');
  });
});

describe('an import keeps itself current (DL-222)', () => {
  /** A hint source, and an import read afresh each time so a re-read is a new record. */
  function live(): {
    readonly imports: Imports;
    readonly hint: () => void;
    readonly asked: unknown[];
  } {
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
    return { imports, hint: () => changes.next(), asked };
  }

  it('reads the import again on a hint, writes nothing, and keeps a finding being written', async () => {
    const { imports, hint, asked } = live();
    // The re-read brings a colleague's finding on the very row being decided.
    const decided: ResidentImport = {
      ...RECORD,
      groups: {
        ...RECORD.groups,
        match: RECORD.groups.match.map((row) => ({
          ...row,
          resolution: {
            action: 'create',
            residentId: null,
            reason: 'Checked with the barangay.',
            by: 'A colleague',
            at: asIsoDateTime('2026-11-12T02:00:00.000Z'),
          },
        })),
      },
    };
    imports.get = () => {
      imports.calls.push('get');
      return of(imports.calls.length === 1 ? structuredClone(RECORD) : decided);
    };
    const fixture = TestBed.createComponent(ImportPage);
    fixture.componentRef.setInput('importId', 'import-1');
    fixture.componentRef.setInput('step', 'check');
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;
    expect(asked).toEqual([IMPORT_TOPICS]);

    root.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]?.click();
    const reason = root.querySelector<HTMLTextAreaElement>('app-import-row-finding textarea');
    if (reason !== null) {
      reason.value = 'Same birth date.';
      reason.dispatchEvent(new Event('input'));
    }
    await settle(fixture);

    hint();
    await settle(fixture);

    expect(imports.calls).toEqual(['get', 'get']);
    expect(text(root)).toContain('Checked with the barangay.');
    expect(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1]?.checked).toBe(true);
    expect(root.querySelector<HTMLTextAreaElement>('app-import-row-finding textarea')?.value).toBe(
      'Same birth date.',
    );
  });

  it('keeps a column choice not yet saved when the import is read again', async () => {
    const { imports, hint } = live();
    const fixture = TestBed.createComponent(ImportPage);
    fixture.componentRef.setInput('importId', 'import-1');
    fixture.componentRef.setInput('step', 'map');
    await settle(fixture);
    const root = fixture.nativeElement as HTMLElement;

    const select = root.querySelector<HTMLSelectElement>('app-import-mapping-form select');
    if (select !== null) {
      select.value = '';
      select.dispatchEvent(new Event('change'));
    }
    await settle(fixture);

    hint();
    await settle(fixture);

    expect(imports.calls).toEqual(['get', 'get']);
    expect(root.querySelector<HTMLSelectElement>('app-import-mapping-form select')?.value).toBe('');
  });
});
