import { describe, expect, it } from 'vitest';

import APPROVED from '../fixtures/verification-approved.json';
import REJECTED from '../fixtures/verification-rejected.json';
import SUPERSEDED from '../fixtures/verification-superseded.json';
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
      selfieErasedAt: null,
      status: 'pending',
      submittedAt: '2026-11-04T08:15:00.000Z',
      reviewedAt: null,
      residentMessage: 'I took the photo again in daylight so the name can be read.',
      reviewNote: null,
      account: { name: 'Ana Cruz', birthDate: '1990-05-01' },
    });
  });

  it('reads what the account gives only while the request waits (DL-197)', () => {
    expect(toVerificationRequest(WITHOUT_BACK)?.account).toEqual({ name: null, birthDate: null });
    expect(toVerificationRequest(APPROVED.data)?.account).toBeNull();
    expect(
      toVerificationRequest({ ...APPROVED.data, account_name: 'Ana Cruz' })?.account,
    ).toBeNull();
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
        'account',
        'accountId',
        'id',
        'idType',
        'images',
        'residentMessage',
        'reviewNote',
        'reviewedAt',
        'selfieErasedAt',
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

  it('reads a superseded request as closed, with its erased selfie and the server’s note (DL-218)', () => {
    const request = toVerificationRequest(SUPERSEDED.data);

    expect(request?.status).toBe('superseded');
    expect(request?.selfieErasedAt).toBe('2026-11-12T03:15:00.000Z');
    expect(request?.account).toBeNull();
    expect(request?.reviewNote).toMatch(/verified this account in person/);
  });

  it('reads when a waiting request’s selfie was erased, as the API says it', () => {
    expect(
      toVerificationRequest({ ...WITH_BACK, selfie_erased_at: '2026-11-11T09:00:00.000Z' })
        ?.selfieErasedAt,
    ).toBe('2026-11-11T09:00:00.000Z');
  });

  it('reads an API older than selfie_erased_at as not erased, and keeps the record (DL-218)', () => {
    const older = Object.fromEntries(
      Object.entries(WITH_BACK).filter(([key]) => key !== 'selfie_erased_at'),
    );

    expect(toVerificationRequest(older)?.selfieErasedAt).toBeNull();
    expect(toVerificationRequest({ ...WITH_BACK, selfie_erased_at: 'not a date' })).not.toBeNull();
  });

  it('never widens an ID type or a status it does not know', () => {
    expect(toVerificationRequest({ ...WITH_BACK, id_type: 'barangay_clearance' })).toBeNull();
    expect(toVerificationRequest({ ...WITH_BACK, status: 'verified' })).toBeNull();
  });
});
