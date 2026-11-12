import { asId, type AppAccountId, type MediaId, type VerificationRequestId } from '../shared/ids';
import { nextStatuses } from '../shared/status';
import {
  approvalBar,
  awaitsReview,
  identityToConfirm,
  imagesOf,
  mediaFor,
  REVIEW_NOTE_LIMITS,
  reviewMovesFor,
  reviewNoteProblem,
  selfieErased,
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
    selfieErasedAt: null,
    status,
    submittedAt: '2026-11-05T00:00:00.000Z' as VerificationRequest['submittedAt'],
    reviewedAt: null,
    residentMessage: null,
    reviewNote: null,
    account: status === 'pending' ? { name: 'Ana Cruz', birthDate: null } : null,
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
      'superseded',
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

  it('keeps superseded final and out of the review: an in-person check makes it (DL-218)', () => {
    expect(nextStatuses(VERIFICATION_STATUS_TRANSITIONS, 'superseded')).toEqual([]);
    expect(nextStatuses(VERIFICATION_STATUS_TRANSITIONS, 'rejected')).not.toContain('superseded');
    expect(VERIFICATION_REVIEW_MOVES).not.toContain('superseded');
    expect(awaitsReview(request('superseded'))).toBe(false);
    expect(VERIFICATION_STATUS_CATALOG.superseded.label).toBe('Replaced by an in-person check');
    expect(VERIFICATION_STATUS_CATALOG.superseded.description).toMatch(/selfie was erased/);
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

  it('confirms the name the account gives, and leaves only a rejection without one (DL-197)', () => {
    expect(identityToConfirm(request('pending'))).toEqual({ name: 'Ana Cruz', birthDate: null });
    expect(reviewMovesFor(request('pending'))).toEqual(['approved', 'rejected']);

    const nameless: VerificationRequest = {
      ...request('pending'),
      account: { name: null, birthDate: null },
    };
    expect(identityToConfirm(nameless)).toBeNull();
    expect(reviewMovesFor(nameless)).toEqual(['rejected']);
    expect(identityToConfirm(request('approved'))).toBeNull();
  });

  it('never lists an erased selfie, and offers no approval without one (DL-218)', () => {
    const erased: VerificationRequest = {
      ...request('pending'),
      selfieErasedAt: '2026-11-11T09:00:00.000Z' as VerificationRequest['submittedAt'],
    };

    expect(selfieErased(erased)).toBe(true);
    expect(selfieErased(request('pending'))).toBe(false);
    expect(imagesOf(erased)).toEqual(['id-front', 'id-back']);
    expect(imagesOf({ ...erased, images: { ...erased.images, idBack: null } })).toEqual([
      'id-front',
    ]);
    expect(reviewMovesFor(erased)).toEqual(['rejected']);
    expect(approvalBar(erased)).toBe('selfie-erased');
    expect(approvalBar(request('pending'))).toBeNull();
    expect(approvalBar({ ...request('pending'), account: { name: null, birthDate: null } })).toBe(
      'no-name',
    );
  });

  it('says before an approval that the confirmed name is kept and can no longer be changed', () => {
    expect(VERIFICATION_DECISION_EFFECTS.approved.join(' ')).toMatch(/name you confirmed is kept/);
    expect(VERIFICATION_DECISION_EFFECTS.approved.join(' ')).toMatch(/cannot change their name/);
  });

  it('holds no verdict, number or address of its own', () => {
    const keys = [
      ...Object.keys(request('pending')),
      ...Object.keys(request('pending').images),
    ].join(' ');

    expect(keys).not.toMatch(/score|confidence|match|valid|recommend|number|url|src/i);
  });
});
