import { describe, expect, it } from 'vitest';

import { asId, type ResidentId } from '@domain/index';

import DETAIL from '../fixtures/sector-application-detail.json';
import { toBarangayIndex } from './resident.mapper';
import {
  toSectorApplicationDetail,
  toWireSectorApproval,
  toWireSectorReturn,
} from './sector-application.mapper';

const BARANGAYS = toBarangayIndex([{ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04', name: 'San Juan' }]);

describe('sector application mapper (DL-215)', () => {
  it('reads the application, its proofs by id, and a candidate without a birth date', () => {
    const detail = toSectorApplicationDetail(DETAIL.data, BARANGAYS);

    expect(detail?.sector).toBe('senior-citizen');
    expect(detail?.applicant).toEqual({
      account: '0f1e2d3c-4b5a-4968-8776-655443322102',
      name: 'Fixture Resident',
      barangayName: 'San Juan',
    });
    expect(detail?.proofs).toEqual(['33333333-3333-4333-8333-333333333334']);
    expect(detail?.candidates).toEqual([
      {
        residentId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01',
        name: 'Resident, Fixture',
        barangayId: 'brgy-san-juan',
      },
    ]);
  });

  it('refuses an application for a sector the app may not apply for', () => {
    expect(toSectorApplicationDetail({ ...DETAIL.data, sector: 'vawc-survivor' }, BARANGAYS)).toBeNull();
  });

  it('sends the link and the card’s last four only when given, and the reason trimmed', () => {
    expect(toWireSectorApproval({ reason: ' Seen. ' })).toEqual({ reason: 'Seen.' });
    expect(
      toWireSectorApproval({
        reason: 'Seen.',
        link: { residentId: asId<ResidentId>('1a2b'), reason: 'Same person.' },
        details: { idLastFour: '1234', socialPension: true },
      }),
    ).toEqual({
      reason: 'Seen.',
      resident_id: '1a2b',
      link_reason: 'Same person.',
      id_number: '1234',
      social_pension: true,
    });
    expect(toWireSectorReturn(' Too dark. ')).toEqual({ reason: 'Too dark.' });
  });
});
