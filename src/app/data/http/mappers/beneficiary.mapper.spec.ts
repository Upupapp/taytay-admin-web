import { describe, expect, it } from 'vitest';

import OFFICE_IDENTITY_FINDING from '../fixtures/office-identity-finding.json';
import OFFICE_IDENTITY_PREVIEW from '../fixtures/office-identity-preview.json';
import { toIdentityResolution, toMergePreview } from './beneficiary.mapper';

/**
 * What a same-person finding does to a resident's app account linked to the record it supersedes
 * (`DL-226`, backend ADR 0003 B), on the finding and on the preview said before the button.
 */
describe('the beneficiary mapper, a resident’s app account (DL-226)', () => {
  const FINDING = OFFICE_IDENTITY_FINDING.data;
  const PREVIEW = OFFICE_IDENTITY_PREVIEW.data;
  const KEPT = FINDING.canonical_resident_id;
  const SUPERSEDED = FINDING.superseded_resident_id;

  it('reads an account moved to the record kept, on the finding and on its preview', () => {
    const moved = { outcome: 'relinked', reason: null, linkedResidentId: KEPT };
    expect(toIdentityResolution(FINDING)?.appAccount).toEqual(moved);
    expect(toMergePreview(PREVIEW)?.appAccount).toEqual(moved);
  });

  it('reads an account left where it was, and why', () => {
    const stayed = {
      outcome: 'not-relinked',
      reason: 'kept-record-has-account',
      linked_resident_id: SUPERSEDED,
    };
    const read = {
      outcome: 'not-relinked',
      reason: 'kept-record-has-account',
      linkedResidentId: SUPERSEDED,
    };
    expect(toIdentityResolution({ ...FINDING, app_account: stayed })?.appAccount).toEqual(read);
    expect(toMergePreview({ ...PREVIEW, app_account: stayed })?.appAccount).toEqual(read);
  });

  it('reads no account linked to the record superseded as none', () => {
    expect(toIdentityResolution({ ...FINDING, app_account: null })?.appAccount).toBeNull();
    expect(toMergePreview({ ...PREVIEW, app_account: null })?.appAccount).toBeNull();
    const distinct = {
      ...FINDING,
      verdict: 'distinct-people',
      canonical_resident_id: null,
      superseded_resident_id: null,
      app_account: null,
    };
    expect(toIdentityResolution(distinct)?.appAccount).toBeNull();
  });

  it('refuses an outcome it cannot word, rather than read it as "no account moved"', () => {
    const unreadable: readonly unknown[] = [
      undefined,
      'relinked',
      { outcome: 'moved', reason: null, linked_resident_id: KEPT },
      { outcome: 'relinked', reason: null },
      { outcome: 'relinked', reason: 'kept-record-has-account', linked_resident_id: KEPT },
      { outcome: 'not-relinked', reason: null, linked_resident_id: SUPERSEDED },
      { outcome: 'not-relinked', reason: 'two-accounts', linked_resident_id: SUPERSEDED },
    ];
    for (const account of unreadable) {
      expect(toIdentityResolution({ ...FINDING, app_account: account })).toBeNull();
      expect(toMergePreview({ ...PREVIEW, app_account: account })).toBeNull();
    }
    const { app_account: _absent, ...withoutAccount } = FINDING;
    expect(_absent).not.toBeNull();
    expect(toIdentityResolution(withoutAccount)).toBeNull();
  });
});
