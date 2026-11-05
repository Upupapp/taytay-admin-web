import { describe, expect, it } from 'vitest';

import APPROVED from '../fixtures/verification-approved.json';
import REJECTED from '../fixtures/verification-rejected.json';
import PAGE from '../fixtures/verification-requests-page.json';

import { toVerificationRequest } from './verification.mapper';

const WITH_BACK: Record<string, unknown> = { ...PAGE.data[0] };
const WITHOUT_BACK: Record<string, unknown> = { ...PAGE.data[1] };

describe('toVerificationRequest', () => {
  it('reads a waiting request, its three images and what the resident wrote', () => {
    const request = toVerificationRequest(WITH_BACK);

    expect(request).toEqual({
      id: '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e01',
      accountId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c01',
      idType: 'drivers-license',
      images: {
        idFront: 'aa11bb22-cc33-4d44-8e55-ff6600770801',
        idBack: 'aa11bb22-cc33-4d44-8e55-ff6600770802',
        selfie: 'aa11bb22-cc33-4d44-8e55-ff6600770803',
      },
      status: 'pending',
      submittedAt: '2026-11-04T08:15:00.000Z',
      reviewedAt: null,
      residentMessage: 'I took the photo again in daylight so the name can be read.',
      reviewNote: null,
    });
  });

  it('reads an ID with no back as having none, not as a missing record', () => {
    expect(toVerificationRequest(WITHOUT_BACK)?.images.idBack).toBeNull();
  });

  it('keeps the note of an approval and the reason of a rejection in the same field', () => {
    expect(toVerificationRequest(APPROVED.data)?.reviewNote).toBe(
      'Selfie matches the ID photo; card legible and unexpired.',
    );
    expect(toVerificationRequest(REJECTED.data)?.reviewNote).toBe(
      'The licence has expired. Please send a current government ID.',
    );
  });

  it('reads nothing it does not need: no reviewer id, no affordance, no second copy of the reason', () => {
    const request = toVerificationRequest(REJECTED.data);

    expect(Object.keys(request ?? {}).sort()).toEqual(
      [
        'accountId',
        'id',
        'idType',
        'images',
        'residentMessage',
        'reviewNote',
        'reviewedAt',
        'status',
        'submittedAt',
      ].sort(),
    );
  });

  it.each([
    'id',
    'user_id',
    'id_type',
    'id_front_media_id',
    'selfie_media_id',
    'status',
    'submitted_at',
  ])('refuses a record without %s rather than inventing it', (field) => {
    const rest = Object.fromEntries(Object.entries(WITH_BACK).filter(([key]) => key !== field));
    expect(toVerificationRequest(rest)).toBeNull();
  });

  it('never widens an ID type or a status it does not know', () => {
    expect(toVerificationRequest({ ...WITH_BACK, id_type: 'barangay_clearance' })).toBeNull();
    expect(toVerificationRequest({ ...WITH_BACK, status: 'verified' })).toBeNull();
  });
});
