import { describe, expect, it } from 'vitest';

import {
  actorInSentence,
  ARCHIVE_REASON_LIMIT,
  archiveReasonProblem,
  ArchiveRefusedError,
  isArchiveRefusal,
} from './archive';

describe('archive, never delete (DL-225)', () => {
  it('asks for a reason, as the API does, and takes one of 1 to 500 characters once trimmed', () => {
    expect(archiveReasonProblem('')).toBe(
      'Give a reason. It is kept with the record, under your name.',
    );
    expect(archiveReasonProblem('   \n ')).toBe(archiveReasonProblem(''));
    expect(archiveReasonProblem('Merged into the MSWDO.')).toBeNull();
    expect(archiveReasonProblem('x'.repeat(ARCHIVE_REASON_LIMIT))).toBeNull();
    // The server trims before it counts, so the spaces around a full reason do not refuse it.
    expect(archiveReasonProblem(`  ${'x'.repeat(ARCHIVE_REASON_LIMIT)}  `)).toBeNull();
    expect(archiveReasonProblem('x'.repeat(ARCHIVE_REASON_LIMIT + 1))).toBe(
      'A reason is at most 500 characters.',
    );
  });

  it('raises one refusal for both adapter sets, carrying counts only when an office is in use', () => {
    const inUse = { staffAccounts: 2, services: 0, issuanceTypes: 1 };
    const refused = new ArchiveRefusedError('office-in-use', 'That office is still in use.', inUse);

    expect(refused).toBeInstanceOf(Error);
    expect(refused.name).toBe('ArchiveRefusedError');
    expect(refused.kind).toBe('office-in-use');
    expect(refused.message).toBe('That office is still in use.');
    expect(refused.inUse).toEqual(inUse);
    expect(new ArchiveRefusedError('read-only', 'Restore it first.').inUse).toBeNull();
  });

  it('tells an archive refusal from any other failure', () => {
    expect(isArchiveRefusal(new ArchiveRefusedError('already-archived', 'Archived already.'))).toBe(
      true,
    );
    expect(isArchiveRefusal(new Error('That office is archived already.'))).toBe(false);
    expect(isArchiveRefusal({ kind: 'already-archived', message: 'Archived already.' })).toBe(
      false,
    );
    expect(isArchiveRefusal(null)).toBe(false);
  });

  it('lowers only the API stand-in for an unnamed account after "by", never a name', () => {
    expect(actorInSentence('An account with no name recorded')).toBe(
      'an account with no name recorded',
    );
    expect(actorInSentence('An account since closed')).toBe('an account since closed');
    expect(actorInSentence('Ana Cruz')).toBe('Ana Cruz');
    expect(actorInSentence('Ancheta, M.')).toBe('Ancheta, M.');
    expect(actorInSentence('An Accountant')).toBe('An Accountant');
  });
});
