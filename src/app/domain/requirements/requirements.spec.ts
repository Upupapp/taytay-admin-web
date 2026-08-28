import {
  EXPIRY_WARNING_DAYS,
  REQUIREMENT_OBLIGATIONS,
  asId,
  asIsoDate,
  asIsoDateTime,
  awaitsApplicabilityDecision,
  currentVersion,
  describeCompletion,
  documentRequestProblems,
  documentValidity,
  documentVersionProblems,
  isDocumentRequestOverdue,
  isOutstandingObligation,
  maskDocumentNumber,
  sourceHoldsAFile,
  summariseRequirements,
  supersededVersions,
  type ConditionalApplicability,
  type DocumentRequest,
  type DocumentRequestId,
  type DocumentVersion,
  type DocumentVersionDraft,
  type DocumentVersionId,
  type RequirementDocument,
  type RequirementDocumentId,
  type RequirementId,
  type RequirementObligation,
  type StaffUserId,
  type SubmittedRequirement,
} from '@domain/index';

const NOW = new Date('2026-08-01T00:00:00.000Z');

function version(overrides: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id: asId<DocumentVersionId>('dv-1'),
    version: 1,
    // A STORED version: metadata about bytes the office already holds.
    file: { fileName: 'indigency.pdf', mimeType: 'application/pdf', byteSize: 1024, pageCount: 1 },
    source: 'scanned',
    documentNumber: 'BC-2026-00817',
    issuedOn: asIsoDate('2026-01-01'),
    expiresOn: asIsoDate('2026-12-31'),
    receivedBy: asId<StaffUserId>('staff-1'),
    receivedAt: asIsoDateTime('2026-01-02T00:00:00.000Z'),
    supersededAt: null,
    supersededReason: null,
    ...overrides,
  };
}

function requirement(overrides: Partial<SubmittedRequirement> = {}): SubmittedRequirement {
  return {
    id: asId<RequirementId>('rq-1'),
    code: 'brgy-indigency',
    label: 'Barangay certificate of indigency',
    status: 'pending',
    obligation: 'required',
    applicability: 'undecided',
    appliesWhen: null,
    applicabilityDecidedBy: null,
    applicabilityReason: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    remarks: null,
    document: null,
    ...overrides,
  };
}

function draft(overrides: Partial<DocumentVersionDraft> = {}): DocumentVersionDraft {
  return {
    // A DRAFT: the bytes being sent, not a description of them.
    file: new File(['%PDF-1.4'], 'indigency.pdf', { type: 'application/pdf' }),
    source: 'scanned',
    documentNumber: null,
    issuedOn: null,
    expiresOn: null,
    replacesBecause: null,
    ...overrides,
  };
}

describe('how firmly a document is asked for', () => {
  const cases: readonly [RequirementObligation, ConditionalApplicability, boolean][] = [
    ['required', 'undecided', true],
    ['optional', 'undecided', false],
    ['conditional', 'undecided', false],
    ['conditional', 'applies', true],
    ['conditional', 'does-not-apply', false],
  ];

  for (const [obligation, applicability, expected] of cases) {
    it(`${obligation} + ${applicability} is ${expected ? '' : 'not '}outstanding`, () => {
      expect(isOutstandingObligation(obligation, applicability)).toBe(expected);
    });
  }

  it('surfaces an undecided conditional as staff work, not applicant work', () => {
    expect(awaitsApplicabilityDecision('conditional', 'undecided')).toBe(true);
    expect(awaitsApplicabilityDecision('conditional', 'applies')).toBe(false);
    expect(awaitsApplicabilityDecision('required', 'undecided')).toBe(false);
  });

  it('covers every obligation in the vocabulary', () => {
    for (const obligation of REQUIREMENT_OBLIGATIONS) {
      expect(() => isOutstandingObligation(obligation, 'undecided')).not.toThrow();
    }
  });
});

describe('a document keeps every version it ever had', () => {
  const replaced: RequirementDocument = {
    id: asId<RequirementDocumentId>('doc-1'),
    requirementId: asId<RequirementId>('rq-1'),
    versions: [
      version({
        id: asId<DocumentVersionId>('dv-1'),
        version: 1,
        supersededAt: asIsoDateTime('2026-03-01T00:00:00.000Z'),
        supersededReason: 'Household size corrected.',
      }),
      version({ id: asId<DocumentVersionId>('dv-2'), version: 2 }),
    ],
  };

  it('treats the last entry as the one in force', () => {
    expect(currentVersion(replaced)?.id).toBe('dv-2');
  });

  it('keeps the superseded copy, with the reason it was replaced', () => {
    const history = supersededVersions(replaced);
    expect(history).toHaveLength(1);
    expect(history[0]?.supersededReason).toBe('Household size corrected.');
  });

  it('never renumbers: version 1 stays version 1', () => {
    expect(replaced.versions.map((entry) => entry.version)).toEqual([1, 2]);
  });
});

describe('recording a version', () => {
  it('accepts a first version with no reason', () => {
    expect(documentVersionProblems(draft(), false)).toEqual([]);
  });

  it('refuses an unexplained replacement', () => {
    expect(documentVersionProblems(draft(), true)).toContain('replacement-needs-a-reason');
    expect(
      documentVersionProblems(draft({ replacesBecause: 'Reissued by the barangay.' }), true),
    ).toEqual([]);
  });

  it('requires a file for a source that should have one', () => {
    expect(documentVersionProblems(draft({ file: null }), false)).toContain(
      'file-required-for-this-source',
    );
  });

  it('refuses a file on a record that holds none', () => {
    // The office confirmed the document with the issuing office and kept no
    // copy. A file here would misrepresent what the office actually holds.
    expect(
      documentVersionProblems(draft({ source: 'external-verification' }), false),
    ).toContain('file-on-a-sourceless-record');
    expect(sourceHoldsAFile('external-verification')).toBe(false);
    expect(sourceHoldsAFile('encoded')).toBe(false);
    expect(sourceHoldsAFile('scanned')).toBe(true);
  });

  it('refuses an expiry that precedes the issue date', () => {
    expect(
      documentVersionProblems(
        draft({ issuedOn: asIsoDate('2026-06-01'), expiresOn: asIsoDate('2026-01-01') }),
        false,
      ),
    ).toContain('expiry-before-issue');
  });
});

describe('validity over time', () => {
  it('reports an expired document as expired', () => {
    expect(documentValidity(version({ expiresOn: asIsoDate('2026-07-01') }), NOW)).toBe('expired');
  });

  it('warns before a document lapses, not after', () => {
    const soon = new Date(NOW.getTime() + (EXPIRY_WARNING_DAYS - 5) * 86_400_000);
    expect(
      documentValidity(
        version({ expiresOn: asIsoDate(soon.toISOString().slice(0, 10)) }),
        NOW,
      ),
    ).toBe('expiring-soon');
  });

  it('keeps "never expires" and "nobody wrote it down" apart', () => {
    // Only one of them is somebody's unfinished work.
    expect(documentValidity(version({ expiresOn: null }), NOW)).toBe('no-expiry');
    expect(documentValidity(version({ expiresOn: null, issuedOn: null }), NOW)).toBe('unknown');
  });
});

describe('masking a document number', () => {
  it('shows only the last four characters', () => {
    expect(maskDocumentNumber('BC-2026-00817')).toBe('••••0817');
  });

  it('masks a short number entirely rather than revealing most of it', () => {
    expect(maskDocumentNumber('1234')).toBe('••••');
    expect(maskDocumentNumber('12')).toBe('••');
  });

  it('reports an absent number as absent', () => {
    expect(maskDocumentNumber(null)).toBeNull();
    expect(maskDocumentNumber('   ')).toBeNull();
  });
});

describe('completion counts, and refuses to be a verdict', () => {
  it('ignores optional documents in the denominator', () => {
    const completion = summariseRequirements([
      requirement({ status: 'verified' }),
      requirement({ obligation: 'optional' }),
    ]);

    expect(completion.applicableCount).toBe(1);
    expect(completion.settledCount).toBe(1);
    expect(completion.outstandingCount).toBe(0);
  });

  it('counts an undecided conditional as a decision owed, not a missing paper', () => {
    const completion = summariseRequirements([
      requirement({ obligation: 'conditional', applicability: 'undecided' }),
    ]);

    expect(completion.awaitingDecisionCount).toBe(1);
    expect(completion.outstandingCount).toBe(0);
    expect(completion.applicableCount).toBe(0);
  });

  it('separates "not checked yet" from "needs another copy"', () => {
    const completion = summariseRequirements([
      requirement({ status: 'submitted' }),
      requirement({ id: asId<RequirementId>('rq-2'), status: 'expired' }),
      requirement({ id: asId<RequirementId>('rq-3'), status: 'rejected' }),
    ]);

    expect(completion.awaitingVerificationCount).toBe(1);
    expect(completion.needsReplacementCount).toBe(2);
  });

  it('says eligibility is still a decision even when everything is settled', () => {
    const completion = summariseRequirements([requirement({ status: 'verified' })]);

    expect(describeCompletion(completion)).toContain('still a caseworker’s decision');
  });

  it('carries no field a screen could read as approval', () => {
    const completion = summariseRequirements([requirement({ status: 'verified' })]);
    const forbidden = ['isComplete', 'isEligible', 'canApprove', 'approved', 'passed', 'score'];

    for (const key of forbidden) {
      expect(Object.keys(completion)).not.toContain(key);
    }
  });
});

describe('asking an applicant for a document', () => {
  const today = asIsoDate('2026-08-01');

  it('refuses a request that does not say what was asked for', () => {
    expect(
      documentRequestProblems(
        { requirementId: asId<RequirementId>('rq-1'), channel: 'sms', message: '  ', neededBy: null },
        today,
      ),
    ).toContain('message-required');
  });

  it('refuses a deadline already in the past', () => {
    expect(
      documentRequestProblems(
        {
          requirementId: asId<RequirementId>('rq-1'),
          channel: 'sms',
          message: 'Please bring the certificate.',
          neededBy: asIsoDate('2026-07-01'),
        },
        today,
      ),
    ).toContain('needed-by-in-the-past');
  });

  it('reports an open request past its date as overdue, and a closed one never', () => {
    const base: DocumentRequest = {
      id: asId<DocumentRequestId>('dr-1'),
      assistanceRequestId: asId('ar-1'),
      requirementId: asId<RequirementId>('rq-1'),
      state: 'open',
      channel: 'sms',
      message: 'Please bring the certificate.',
      neededBy: asIsoDate('2026-07-01'),
      requestedBy: asId<StaffUserId>('staff-1'),
      requestedAt: asIsoDateTime('2026-06-01T00:00:00.000Z'),
      closedAt: null,
      withdrawnReason: null,
    };

    expect(isDocumentRequestOverdue(base, today)).toBe(true);
    expect(isDocumentRequestOverdue({ ...base, state: 'answered' }, today)).toBe(false);
    expect(isDocumentRequestOverdue({ ...base, neededBy: null }, today)).toBe(false);
  });
});
