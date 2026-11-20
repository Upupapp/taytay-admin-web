import { asId, type ResidentId } from '../shared/ids';

import {
  accountLinkProblems,
  startAccountLinkDraft,
  toAccountLinkDecision,
  type AccountLinkDraft,
  type RegistryMatch,
} from './account-link';

const RECORD = asId<ResidentId>('resident-1');
const HELD = asId<ResidentId>('resident-2');

const MATCHES: readonly RegistryMatch[] = [
  {
    residentId: RECORD,
    label: 'Mercado, L.',
    strength: 'strong',
    signals: [],
    linkedToOtherAccount: false,
  },
  {
    residentId: HELD,
    label: 'Mercado, L.',
    strength: 'weak',
    signals: [],
    linkedToOtherAccount: true,
  },
];

const draft = (change: Partial<AccountLinkDraft>): AccountLinkDraft => ({
  ...startAccountLinkDraft('Lorna Dela Cruz Mercado'),
  ...change,
});

describe('the registry decision at verification (DL-228)', () => {
  it('starts with nothing chosen, the name split with the last word as the surname', () => {
    const start = startAccountLinkDraft('  Lorna  Dela Cruz Mercado ');
    expect(start.decision).toBeNull();
    expect(start.firstName).toBe('Lorna Dela Cruz');
    expect(start.lastName).toBe('Mercado');
    expect(startAccountLinkDraft('Lorna').firstName).toBe('Lorna');
    expect(startAccountLinkDraft('Lorna').lastName).toBe('');
  });

  it('asks for a choice before anything else', () => {
    expect(accountLinkProblems(draft({}), MATCHES)).toEqual(['choose']);
    expect(toAccountLinkDecision(draft({}), MATCHES)).toBeNull();
  });

  it('links only to a proposed record nobody else holds, and only with a reason', () => {
    expect(accountLinkProblems(draft({ decision: 'link' }), MATCHES)).toEqual([
      'choose-record',
      'reason',
    ]);
    expect(
      accountLinkProblems(draft({ decision: 'link', residentId: HELD, reason: 'Seen' }), MATCHES),
    ).toEqual(['record-held']);
    expect(
      toAccountLinkDecision(
        draft({ decision: 'link', residentId: RECORD, reason: '  ID and record agree ' }),
        MATCHES,
      ),
    ).toEqual({ decision: 'link', residentId: RECORD, reason: 'ID and record agree' });
  });

  it('leaves an account unlinked only with a reason, kept within 500 characters', () => {
    expect(accountLinkProblems(draft({ decision: 'leave-unlinked' }), MATCHES)).toEqual(['reason']);
    expect(
      accountLinkProblems(draft({ decision: 'leave-unlinked', reason: 'x'.repeat(501) }), MATCHES),
    ).toEqual(['reason-too-long']);
    expect(
      toAccountLinkDecision(draft({ decision: 'leave-unlinked', reason: 'Two records' }), []),
    ).toEqual({ decision: 'leave-unlinked', reason: 'Two records' });
  });

  it('makes a record only with both names and a civil status, the rest left to the account', () => {
    expect(accountLinkProblems(draft({ decision: 'create', firstName: '' }), [])).toEqual([
      'first-name',
      'civil-status',
    ]);
    expect(
      accountLinkProblems(
        draft({ decision: 'create', civilStatus: 'single', birthDate: '5/1/90' }),
        [],
      ),
    ).toEqual(['birth-date']);
    expect(
      toAccountLinkDecision(draft({ decision: 'create', civilStatus: 'married' }), []),
    ).toEqual({
      decision: 'create',
      record: {
        firstName: 'Lorna Dela Cruz',
        middleName: null,
        lastName: 'Mercado',
        suffix: null,
        sex: null,
        birthDate: null,
        civilStatus: 'married',
        streetAddress: null,
      },
      reason: null,
    });
  });
});
