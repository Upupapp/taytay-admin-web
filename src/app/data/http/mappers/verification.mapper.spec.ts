import { describe, expect, it } from 'vitest';

import { asId, WriteIntent, type ResidentId } from '@domain/index';

import IN_PERSON from '../fixtures/in-person-verification.json';
import APPROVED from '../fixtures/verification-approved.json';
import REJECTED from '../fixtures/verification-rejected.json';
import SUPERSEDED from '../fixtures/verification-superseded.json';
import PAGE from '../fixtures/verification-requests-page.json';

import MATCHES from '../fixtures/registry-matches.json';

import {
  toAccountLinkOutcome,
  toInPersonFieldErrors,
  toInPersonVerification,
  toRegistryProposals,
  toVerificationRequest,
  toWireAccountLink,
  toWireInPersonCheck,
  toWireVerificationApproval,
} from './verification.mapper';

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
      registryOutcome: null,
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
        'registryOutcome',
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

describe('the in-person check on the wire (DL-219)', () => {
  const intent = new WriteIntent('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
  const check = {
    idType: 'drivers-license',
    idLastFour: '4C7K',
    confirmedName: 'Ana Cruz',
    correctedName: null,
    accountLink: null,
  } as const;

  it('sends the type in the API’s words, the four characters, the name shown and the tick', () => {
    expect(toWireInPersonCheck(check, intent)).toEqual({
      idempotency_key: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      id_type: 'drivers_license',
      id_last_four: '4C7K',
      confirmed_name: 'Ana Cruz',
      id_shows_name: true,
    });
  });

  it('adds a corrected name only when there is one, never an empty one', () => {
    expect(toWireInPersonCheck({ ...check, correctedName: 'Ana Cruz Reyes' }, intent)).toEqual(
      expect.objectContaining({ corrected_name: 'Ana Cruz Reyes' }),
    );
    expect(Object.keys(toWireInPersonCheck(check, intent))).not.toContain('corrected_name');
  });

  it('reads what the server recorded, and not the four characters or who recorded it', () => {
    const record = toInPersonVerification(IN_PERSON.data);

    expect(record).toEqual({
      id: '3e2d1c0b-9a8f-4e7d-8c6b-5a4f3e2d1c01',
      accountId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c03',
      idType: 'philid',
      nameCorrected: false,
      supersededRequestId: '7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e03',
      verifiedAt: '2026-11-12T03:15:00.000Z',
      registryOutcome: { decision: 'link', residentId: '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01' },
    });
    expect(JSON.stringify(record)).not.toContain('4C7K');
  });

  it('reads no superseded request when there was none', () => {
    expect(
      toInPersonVerification({ ...IN_PERSON.data, superseded_request_id: null })
        ?.supersededRequestId,
    ).toBeNull();
  });

  it.each(['id', 'user_id', 'id_type', 'name_corrected', 'verified_at'])(
    'refuses a record without %s',
    (missing) => {
      const rest = Object.fromEntries(
        Object.entries(IN_PERSON.data).filter(([key]) => key !== missing),
      );
      expect(toInPersonVerification(rest)).toBeNull();
    },
  );

  it('refuses a record that is not an in-person check', () => {
    expect(toInPersonVerification({ ...IN_PERSON.data, method: 'selfie' })).toBeNull();
  });

  it('reads a 422 as the form’s fields, the first sentence each, and drops a key it has no field for', () => {
    expect(
      toInPersonFieldErrors({
        id_last_four: ['Only the last four characters of the ID number.', 'Second.'],
        id_shows_name: ['Invalid literal value, expected true'],
        confirmed_name: ['Required'],
      }),
    ).toEqual({
      idLastFour: 'Only the last four characters of the ID number.',
      idShowsName: 'Invalid literal value, expected true',
    });
    expect(toInPersonFieldErrors(null)).toEqual({});
  });
});

describe('the registry decision at verification (DL-228)', () => {
  it('reads the proposals whole: a label, a band, signals in words, and nothing else', () => {
    const read = toRegistryProposals(MATCHES.data);
    expect(read?.linkedResidentId).toBeNull();
    expect(read?.matches).toHaveLength(2);
    expect(read?.matches[0]).toEqual(
      expect.objectContaining({
        label: 'Mercado, L.',
        strength: 'strong',
        linkedToOtherAccount: false,
      }),
    );
    expect(read?.matches[1]?.linkedToOtherAccount).toBe(true);
    expect(read?.matches[0]?.signals[0]).toEqual({
      attribute: 'surname',
      outcome: 'same',
      rule: "Every word of the record's surname is in the account's name.",
    });
  });

  it('refuses the answer when one proposal or one signal cannot be read', () => {
    const [first, second] = MATCHES.data.matches;
    expect(
      toRegistryProposals({ ...MATCHES.data, matches: [first, { ...second, strength: 'certain' }] }),
    ).toBeNull();
    expect(
      toRegistryProposals({
        ...MATCHES.data,
        matches: [{ ...first, signals: [{ attribute: 'income', outcome: 'same', rule: 'x' }] }],
      }),
    ).toBeNull();
    expect(toRegistryProposals({ ...MATCHES.data, linked_resident_id: 42 })).toBeNull();
  });

  it('reads what an approval decided, and no decision as none', () => {
    expect(toAccountLinkOutcome({ decision: 'leave-unlinked', resident_id: null })).toEqual({
      decision: 'leave-unlinked',
      residentId: null,
    });
    expect(toAccountLinkOutcome(null)).toBeNull();
    expect(toVerificationRequest(APPROVED.data)?.registryOutcome).toEqual({
      decision: 'leave-unlinked',
      residentId: null,
    });
  });

  it('sends each decision in the shape the API takes, leaving out what the account supplies', () => {
    expect(
      toWireAccountLink({ decision: 'link', residentId: asId<ResidentId>('r-1'), reason: 'Seen' }),
    ).toEqual({ decision: 'link', resident_id: 'r-1', reason: 'Seen' });
    expect(toWireAccountLink({ decision: 'leave-unlinked', reason: 'Two records' })).toEqual({
      decision: 'leave-unlinked',
      reason: 'Two records',
    });
    expect(
      toWireAccountLink({
        decision: 'create',
        record: {
          firstName: 'Ana',
          middleName: null,
          lastName: 'Cruz',
          suffix: null,
          sex: null,
          birthDate: null,
          civilStatus: 'single',
          streetAddress: null,
        },
        reason: null,
      }),
    ).toEqual({
      decision: 'create',
      record: {
        first_name: 'Ana',
        middle_name: null,
        last_name: 'Cruz',
        suffix: null,
        civil_status: 'single',
      },
    });
  });

  it('adds the decision to an approval and a counter check only when there is one', () => {
    const confirmed = { name: 'Ana Cruz', birthDate: null };
    expect(toWireVerificationApproval('Checked', confirmed, null)).toEqual({
      notes: 'Checked',
      confirmed_name: 'Ana Cruz',
      confirmed_birthdate: null,
    });
    expect(
      toWireVerificationApproval('Checked', confirmed, {
        decision: 'leave-unlinked',
        reason: 'Why',
      }).account_link,
    ).toEqual({ decision: 'leave-unlinked', reason: 'Why' });
    const intent = new WriteIntent('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
    expect(
      toWireInPersonCheck(
        {
          idType: 'philid',
          idLastFour: '4C7K',
          confirmedName: 'Ana Cruz',
          correctedName: null,
          accountLink: { decision: 'leave-unlinked', reason: 'Why' },
        },
        intent,
      ).account_link,
    ).toEqual({ decision: 'leave-unlinked', reason: 'Why' });
  });
});
