import { describe, expect, it } from 'vitest';

import { asId, type OfficeId } from '@domain/index';

import ISSUANCE_FILE_GRANT from '../fixtures/issuance-file-grant.json';
import ISSUANCE_TYPES from '../fixtures/issuance-types.json';
import OFFICE_ISSUANCE_REQUEST from '../fixtures/office-issuance-request.json';
import OFFICE_ISSUANCE_REQUESTS_PAGE from '../fixtures/office-issuance-requests-page.json';
import {
  toIssuanceFileGrant,
  toIssuanceRequest,
  toIssuanceRequestSummary,
  toIssuanceType,
  toWireIssuanceStatusChange,
  toWireIssuanceTypeCreate,
  toWireIssuanceTypeUpdate,
} from './issuance.mapper';

/** Residents' document requests, read and written by name (`DL-184`). */
describe('issuance mappers (DL-184)', () => {
  it('reads a type with its fee in integer centavos, and no fee as none stated', () => {
    const [first, second] = ISSUANCE_TYPES.data.map(toIssuanceType);
    expect(first?.fee).toEqual({ centavos: 5000, currency: 'PHP' });
    expect(first?.processingDays).toBe(3);
    expect(first?.requirements.map((requirement) => requirement.code)).toEqual([
      'valid-id',
      'barangay-certificate',
    ]);
    expect(second?.fee).toBeNull();
    expect(second?.processingDays).toBeNull();
    expect(toIssuanceType({ ...ISSUANCE_TYPES.data[0], fee_centavos: 50.5 })?.fee).toBeNull();
  });

  it('reads a list row without the purpose, and a missing name as none', () => {
    const [first, second] = OFFICE_ISSUANCE_REQUESTS_PAGE.data.map(toIssuanceRequestSummary);
    expect(first?.referenceNumber).toBe('DR-2026-000012');
    expect(first && 'purpose' in first).toBe(false);
    expect(second?.resident.name).toBeNull();
    expect(second?.statusSince).toBe('2026-11-02T02:00:00.000Z');
  });

  it('reads a request whole: snapshot, every file version, history and the server’s moves', () => {
    const request = toIssuanceRequest(OFFICE_ISSUANCE_REQUEST.data);
    expect(request?.purpose).toMatch(/medical assistance/);
    expect(request?.attachments.map((file) => [file.version, file.current])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(request?.history.map((line) => `${line.side}:${line.to}`)).toEqual([
      'resident:submitted',
      'office:under-review',
      'office:needs-info',
      'resident:under-review',
      'office:approved',
    ]);
    expect(request?.history[0]?.from).toBeNull();
    expect(request?.allowedMoves).toEqual(['ready-for-pickup']);
  });

  it('refuses a request whose history it cannot read in full', () => {
    const broken = {
      ...OFFICE_ISSUANCE_REQUEST.data,
      history: [...OFFICE_ISSUANCE_REQUEST.data.history, { to_status: 'archived' }],
    };
    expect(toIssuanceRequest(broken)).toBeNull();
  });

  it('reads a grant with the warning the server composed', () => {
    const grant = toIssuanceFileGrant(ISSUANCE_FILE_GRANT.data);
    expect(grant?.mimeType).toBe('application/pdf');
    expect(grant?.warning).toMatch(/recorded against your account/);
    expect(toIssuanceFileGrant({ ...ISSUANCE_FILE_GRANT.data, handle: null })).toBeNull();
  });

  it('writes a new type as the API validates it: centavos, the office only when chosen', () => {
    const draft = {
      officeId: null,
      name: '  Certificate of residency ',
      description: null,
      requirements: [{ code: 'valid-id', label: ' A valid ID ', required: true, hint: '   ' }],
      fee: { centavos: 125050, currency: 'PHP' as const },
      processingDays: 3,
      claimInstructions: null,
      reason: ' Offered from this month. ',
    };
    expect(toWireIssuanceTypeCreate(draft)).toEqual({
      office_id: undefined,
      name: 'Certificate of residency',
      description: null,
      requirements: [{ code: 'valid-id', label: 'A valid ID', required: true, hint: null }],
      fee_centavos: 125050,
      processing_days: 3,
      claim_instructions: null,
      reason: 'Offered from this month.',
    });
    expect(
      toWireIssuanceTypeCreate({ ...draft, officeId: asId<OfficeId>('office-1') }).office_id,
    ).toBe('office-1');
  });

  it('writes only what moved on a change, and a cleared fee as null', () => {
    const body = JSON.parse(
      JSON.stringify(toWireIssuanceTypeUpdate({ fee: null, reason: 'No fee any more.' })),
    ) as Record<string, unknown>;
    expect(body).toEqual({ fee_centavos: null, reason: 'No fee any more.' });
    expect(
      JSON.parse(JSON.stringify(toWireIssuanceTypeUpdate({ name: 'New', reason: 'Renamed it.' }))),
    ).toEqual({ name: 'New', reason: 'Renamed it.' });
  });

  it('sends claim details only with marking a request ready', () => {
    expect(
      toWireIssuanceStatusChange({
        to: 'ready-for-pickup',
        reason: ' Ready. ',
        claimDetails: ' MSWDO counter. ',
      }),
    ).toEqual({ to: 'ready-for-pickup', reason: 'Ready.', claim_details: 'MSWDO counter.' });
    expect(
      JSON.parse(
        JSON.stringify(
          toWireIssuanceStatusChange({ to: 'approved', reason: 'Approved.', claimDetails: null }),
        ),
      ),
    ).toEqual({ to: 'approved', reason: 'Approved.' });
  });
});
