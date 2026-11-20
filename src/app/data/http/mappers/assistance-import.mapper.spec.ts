import { describe, expect, it } from 'vitest';

import { asId, type ResidentId } from '@domain/index';

import ASSISTANCE_IMPORT from '../fixtures/assistance-import.json';
import ASSISTANCE_IMPORT_WITHDRAWN from '../fixtures/assistance-import-withdrawn.json';
import ASSISTANCE_IMPORTS_PAGE from '../fixtures/assistance-imports-page.json';
import IMPORT_TEMPLATE from '../fixtures/import-template.json';
import {
  toAssistanceImport,
  toAssistanceImportSummary,
  toWireAssistanceImportMapping,
  toWireAssistanceImportResolve,
  toWireAssistanceImportWithdraw,
} from './assistance-import.mapper';
import { toImportTemplate } from './import-template.mapper';

describe('the past-assistance import mapper (DL-228)', () => {
  it('reads an open import whole: groups, the proposed match, signals and duplicates', () => {
    const record = toAssistanceImport(ASSISTANCE_IMPORT.data);
    expect(record?.counts).toEqual({
      ready: 1,
      'needs-review': 1,
      skipped: 1,
      duplicate: 1,
      error: 1,
    });
    expect(record?.mapping).toEqual({
      fullName: 0,
      lastName: null,
      barangay: 1,
      program: 2,
      dateGiven: 3,
      controlNumber: 4,
    });
    const [ready, review, skipped, duplicate, error] = record?.rows ?? [];
    expect(ready?.match).toEqual({
      residentId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01',
      label: 'Reyes, A.',
      how: 'proposed',
    });
    expect(ready?.values?.fullName).toBe('Reyes, Ana');
    expect(review?.candidates[0]?.strength).toBe('moderate');
    expect(review?.candidates[0]?.signals[1]).toEqual({
      attribute: 'barangay',
      outcome: 'differs',
      rule: 'The row and the record name different barangays.',
    });
    expect(review?.createProblems).toHaveLength(2);
    expect(skipped?.resolution?.by).toBe('Fixture Officer');
    expect(duplicate?.duplicate).toEqual({
      reason: 'control-number',
      ofRow: 1,
      ofRequestReference: null,
    });
    expect(error?.problems[0]?.field).toBe('barangay');
  });

  it('reads a withdrawn import: who, when and why, and each row’s outcome', () => {
    const record = toAssistanceImport(ASSISTANCE_IMPORT_WITHDRAWN.data);
    expect(record?.status).toBe('withdrawn');
    expect(record?.withdrawal?.by).toBe('Fixture Officer');
    expect(record?.result?.duplicates).toBe(1);
    expect(record?.outcomes.map((outcome) => outcome.outcome)).toEqual([
      'imported',
      'duplicate',
      'error',
    ]);
    expect(record?.outcomes[0]?.requestId).toBe('2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d01');
  });

  it('reads a summary with an unnamed committer as null, not as unreadable', () => {
    const summary = toAssistanceImportSummary(ASSISTANCE_IMPORTS_PAGE.data[0]);
    expect(summary?.committedBy).toBeNull();
    expect(summary?.result?.residentsCreated).toBe(1);
  });

  it('refuses an answer it cannot read whole, rather than dropping a row', () => {
    const data = ASSISTANCE_IMPORT.data;
    expect(toAssistanceImportSummary({ ...data, status: 'deleted' })).toBeNull();
    expect(toAssistanceImportSummary({ ...data, withdrawal: { at: 'x' } })).toBeNull();
    expect(toAssistanceImport({ ...data, rows: [...data.rows, { row: 9 }] })).toBeNull();
    expect(
      toAssistanceImport({
        ...data,
        rows: data.rows.map((row) => ({ ...row, group: 'merged' })),
      }),
    ).toBeNull();
    expect(
      toAssistanceImport({
        ...data,
        rows: data.rows.map((row) => ({
          ...row,
          candidates: row.candidates.map((candidate) => ({ ...candidate, strength: 'certain' })),
        })),
      }),
    ).toBeNull();
    expect(toAssistanceImport({ ...data, counts: { ready: 1 } })).toBeNull();
  });

  it('writes the whole mapping, a resolution with only its own fields, and a trimmed reason', () => {
    const body = toWireAssistanceImportMapping({ program: 3 });
    expect(body.mapping.program).toBe(3);
    expect(body.mapping.full_name).toBeNull();

    expect(
      toWireAssistanceImportResolve({
        action: 'link',
        residentId: asId<ResidentId>('r-1'),
        reason: ' Seen. ',
      }),
    ).toEqual({ action: 'link', reason: 'Seen.', resident_id: 'r-1' });
    expect(
      toWireAssistanceImportResolve({
        action: 'create',
        record: { sex: 'female', birthDate: '1950-01-02', streetAddress: '' },
        reason: 'New.',
      }),
    ).toEqual({
      action: 'create',
      reason: 'New.',
      record: { sex: 'female', birth_date: '1950-01-02' },
    });
    expect(toWireAssistanceImportResolve({ action: 'skip', reason: 'No.' })).toEqual({
      action: 'skip',
      reason: 'No.',
    });
    expect(toWireAssistanceImportWithdraw('  Wrong year. ')).toEqual({ reason: 'Wrong year.' });
  });

  it('reads a template, and refuses one that is not a CSV with a name', () => {
    expect(toImportTemplate(IMPORT_TEMPLATE.data)?.contentType).toBe('text/csv');
    expect(toImportTemplate({ ...IMPORT_TEMPLATE.data, content_type: 'text/html' })).toBeNull();
    expect(toImportTemplate({ ...IMPORT_TEMPLATE.data, file_name: ' ' })).toBeNull();
    expect(toImportTemplate({ ...IMPORT_TEMPLATE.data, content: null })).toBeNull();
  });
});
