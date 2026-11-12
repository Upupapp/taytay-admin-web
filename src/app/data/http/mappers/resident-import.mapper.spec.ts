import { describe, expect, it } from 'vitest';

import IMPORT from '../fixtures/resident-import.json';
import { toBarangayIndex } from './resident.mapper';
import {
  toResidentImport,
  toWireImportMapping,
  toWireImportResolve,
} from './resident-import.mapper';

const BARANGAYS = toBarangayIndex([{ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04', name: 'San Juan' }]);

describe('resident import mapper (DL-214)', () => {
  it('reads the fields by the domain’s names and a candidate without its birth date', () => {
    const record = toResidentImport(IMPORT.data, BARANGAYS);

    expect(record?.mapping).toEqual({ lastName: 0, birthDate: 1, email: null });
    expect(record?.missingFields).toEqual(['firstName']);
    expect(record?.groups.match[0]?.candidates).toEqual([
      {
        residentId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01',
        name: 'Reyes, Ana',
        barangayId: 'brgy-san-juan',
        isActive: true,
      },
    ]);
    expect(record?.groups.match[0]?.resolution?.by).toBe('Fixture Officer');
    expect(record?.groups.error[0]?.problems[0]?.field).toBe('birthDate');
  });

  it('refuses an import with a row it cannot read, rather than dropping the row', () => {
    const broken = {
      ...IMPORT.data,
      groups: { ...IMPORT.data.groups, match: [{ ...IMPORT.data.groups.match[0], row: 'one' }] },
    };
    expect(toResidentImport(broken, BARANGAYS)).toBeNull();
  });

  it('sends the whole mapping, every field named, and a finding with its reason', () => {
    expect(toWireImportMapping({ lastName: 0 }).mapping).toEqual({
      last_name: 0,
      first_name: null,
      middle_name: null,
      suffix: null,
      sex: null,
      birth_date: null,
      civil_status: null,
      barangay: null,
      purok_or_sitio: null,
      street_address: null,
      mobile: null,
      email: null,
    });
    expect(toWireImportResolve({ action: 'skip', reason: ' Not ours. ' })).toEqual({
      action: 'skip',
      reason: 'Not ours.',
    });
  });
});
