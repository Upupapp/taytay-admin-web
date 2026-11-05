import { asId, type AppAccountId, type MediaId, type VerificationRequestId } from '../shared/ids';
import { nextStatuses } from '../shared/status';
import {
  awaitsReview,
  imagesOf,
  mediaFor,
  REVIEW_NOTE_LIMITS,
  reviewNoteProblem,
  VERIFICATION_DECISION_EFFECTS,
  VERIFICATION_REVIEW_MOVES,
  VERIFICATION_STATUS_CATALOG,
  VERIFICATION_STATUS_TRANSITIONS,
  VERIFICATION_STATUSES,
  type VerificationRequest,
  type VerificationStatus,
} from './verification-request';

function request(
  status: VerificationStatus,
  idBack: string | null = 'media-back',
): VerificationRequest {
  return {
    id: asId<VerificationRequestId>('vr-1'),
    accountId: asId<AppAccountId>('account-1'),
    idType: 'philid',
    images: {
      idFront: asId<MediaId>('media-front'),
      idBack: idBack === null ? null : asId<MediaId>(idBack),
      selfie: asId<MediaId>('media-selfie'),
    },
    status,
    submittedAt: '2026-11-05T00:00:00.000Z' as VerificationRequest['submittedAt'],
    reviewedAt: null,
    residentMessage: null,
    reviewNote: null,
  };
}

describe('the verification lifecycle, defined once', () => {
  it('describes every status in one catalog', () => {
    for (const status of VERIFICATION_STATUSES) {
      expect(VERIFICATION_STATUS_CATALOG[status].value).toBe(status);
      expect(VERIFICATION_STATUS_CATALOG[status].description.length).toBeGreaterThan(20);
    }
  });

  it('lets the office decide only what is pending, and only approve or reject', () => {
    expect(VERIFICATION_REVIEW_MOVES).toEqual(['approved', 'rejected']);
    expect(nextStatuses(VERIFICATION_STATUS_TRANSITIONS, 'pending')).toEqual([
      'approved',
      'rejected',
    ]);
    expect(awaitsReview(request('pending'))).toBe(true);
    expect(awaitsReview(request('approved'))).toBe(false);
    expect(awaitsReview(request('rejected'))).toBe(false);
  });

  it('keeps an approval final, and a resubmission the resident’s move rather than the office’s', () => {
    expect(nextStatuses(VERIFICATION_STATUS_TRANSITIONS, 'approved')).toEqual([]);
    expect(nextStatuses(VERIFICATION_STATUS_TRANSITIONS, 'rejected')).toEqual(['pending']);
    expect(VERIFICATION_REVIEW_MOVES).not.toContain('pending');
  });
});

describe('what a decision does, said before it is made', () => {
  it('says an approval verifies the account and may issue a digital ID', () => {
    const said = VERIFICATION_DECISION_EFFECTS.approved.join(' ');
    expect(said).toMatch(/marked verified/);
    expect(said).toMatch(/digital ID is issued/);
    expect(said).toMatch(/does not see it/);
  });

  it('says the resident reads a rejection, and may send it again', () => {
    const said = VERIFICATION_DECISION_EFFECTS.rejected.join(' ');
    expect(said).toMatch(/resident reads your reason/);
    expect(said).toMatch(/send it again/);
  });
});

describe('a decision carries words, within the API’s limit', () => {
  it('refuses too few and too many, after trimming as the API does', () => {
    expect(reviewNoteProblem('   ok   ')).toBe('too-short');
    expect(reviewNoteProblem('x'.repeat(REVIEW_NOTE_LIMITS.maximum + 1))).toBe('too-long');
    expect(reviewNoteProblem(` ${'x'.repeat(REVIEW_NOTE_LIMITS.maximum)} `)).toBeNull();
    expect(reviewNoteProblem('Selfie matches the ID.')).toBeNull();
  });
});

describe('the images a request carries', () => {
  it('lists the back only when the resident sent one', () => {
    expect(imagesOf(request('pending'))).toEqual(['id-front', 'id-back', 'selfie']);
    expect(imagesOf(request('pending', null))).toEqual(['id-front', 'selfie']);
    expect(mediaFor(request('pending', null), 'id-back')).toBeNull();
  });

  it('holds no verdict, number or address of its own', () => {
    const keys = [
      ...Object.keys(request('pending')),
      ...Object.keys(request('pending').images),
    ].join(' ');

    expect(keys).not.toMatch(/score|confidence|match|valid|recommend|number|url|src/i);
  });
});
