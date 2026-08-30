import {
  BENEFICIARY_ROLES,
  asId,
  asIsoDate,
  asIsoDateTime,
  buildAssistanceTimeline,
  deriveStanding,
  describeStanding,
  enrollmentProblems,
  gradeDuplicate,
  groupTimelineByYear,
  hasStanding,
  isBeneficiaryFilterActive,
  isCurrentEnrollment,
  isPeriodReversed,
  isReceivedReleaseStatus,
  pairKey,
  pesos,
  resolutionProblems,
  type AssistanceRequestStatus,
  type ReleaseStatus,
  type DuplicatePairId,
  type IdentityResolutionDraft,
  type MatchSignal,
  type ProgramEnrollment,
  type ProgramEnrollmentId,
  type ProgramId,
  type ResidentCaseSummary,
  type ResidentId,
  type ResidentPayoutSummary,
  type ResidentReferralSummary,
} from '@domain/index';

const ANA = asId<ResidentId>('res-ana');
const BEA = asId<ResidentId>('res-bea');
const PENSION = asId<ProgramId>('prog-pension');

function enrollment(overrides: Partial<ProgramEnrollment> = {}): ProgramEnrollment {
  return {
    id: asId<ProgramEnrollmentId>('enr-1'),
    residentId: ANA,
    programId: PENSION,
    programName: 'Social pension for indigent senior citizens',
    status: 'active',
    enrolledOn: asIsoDate('2024-01-15'),
    exit: null,
    continuesEnrollmentId: null,
    audit: {
      createdAt: asIsoDateTime('2024-01-15T01:00:00.000Z'),
      createdBy: null,
      updatedAt: asIsoDateTime('2024-01-15T01:00:00.000Z'),
      updatedBy: null,
    },
    ...overrides,
  };
}

function request(overrides: Partial<ResidentCaseSummary> = {}): ResidentCaseSummary {
  return {
    id: asId('req-1'),
    referenceNumber: 'AR-2026-0001',
    programId: PENSION,
    programName: 'Medical assistance',
    status: 'completed',
    requestedAmount: pesos(5000),
    approvedAmount: pesos(4000),
    submittedAt: asIsoDateTime('2026-03-01T01:00:00.000Z'),
    updatedAt: asIsoDateTime('2026-03-20T01:00:00.000Z'),
    ...overrides,
  };
}

function payout(overrides: Partial<ResidentPayoutSummary> = {}): ResidentPayoutSummary {
  return {
    id: asId('dsb-1'),
    requestId: asId('req-1'),
    referenceNumber: 'DV-2026-0001',
    status: 'claimed',
    method: 'cash',
    amount: pesos(4000),
    scheduledFor: asIsoDate('2026-03-18'),
    releasedAt: asIsoDateTime('2026-03-18T02:00:00.000Z'),
    ...overrides,
  };
}

function referral(overrides: Partial<ResidentReferralSummary> = {}): ResidentReferralSummary {
  return {
    id: asId('ref-1'),
    referenceNumber: 'RF-2026-0001',
    destination: 'hospital-msw',
    destinationName: 'Taytay Doctors Hospital medical social worker',
    status: 'served',
    referredAt: asIsoDateTime('2026-02-01T01:00:00.000Z'),
    respondedAt: null,
    ...overrides,
  };
}

function signal(attribute: MatchSignal['attribute'], outcome: MatchSignal['outcome']): MatchSignal {
  return { attribute, outcome, rule: `${attribute} compared` };
}

describe('beneficiary standing', () => {
  it('always includes constituent, because being on the registry is the floor', () => {
    const standing = deriveStanding({
      requestStatuses: [],
      releaseStatuses: [],
      enrollments: [],
    });

    expect(standing.roles).toEqual(['constituent']);
  });

  it('holds several standings at once — they are roles, not a ladder', () => {
    const standing = deriveStanding({
      requestStatuses: ['assessment', 'completed'],
      releaseStatuses: ['claimed'],
      enrollments: [enrollment()],
    });

    expect(standing.roles).toEqual(['constituent', 'applicant', 'beneficiary', 'enrollee']);
    expect(describeStanding(standing)).toBe('Resident · Applicant · Recipient · Programme member');
  });

  it('does not call somebody an applicant on the strength of a settled request', () => {
    const standing = deriveStanding({
      requestStatuses: ['rejected', 'completed', 'cancelled', 'expired'],
      releaseStatuses: [],
      enrollments: [],
    });

    expect(hasStanding(standing, 'applicant')).toBe(false);
    expect(standing.evidence.settledRequestCount).toBe(4);
  });

  it('a draft is not an application — nothing has been filed', () => {
    const standing = deriveStanding({
      requestStatuses: ['draft'],
      releaseStatuses: [],
      enrollments: [],
    });

    expect(hasStanding(standing, 'applicant')).toBe(false);
  });

  it('counts somebody a recipient only once something actually reached them', () => {
    const planned: readonly ReleaseStatus[] = [
      'for-release',
      'scheduled',
      'unclaimed',
      'deferred',
      'voided',
    ];
    const arrived: readonly ReleaseStatus[] = ['released', 'claimed', 'completed'];

    for (const status of planned) {
      expect(isReceivedReleaseStatus(status)).toBe(false);
    }
    for (const status of arrived) {
      expect(isReceivedReleaseStatus(status)).toBe(true);
    }

    const scheduledOnly = deriveStanding({
      requestStatuses: [],
      releaseStatuses: ['scheduled'],
      enrollments: [],
    });
    expect(hasStanding(scheduledOnly, 'beneficiary')).toBe(false);
  });

  it('stops calling somebody a programme member once they have exited', () => {
    const exited = enrollment({
      status: 'exited',
      exit: {
        reason: 'moved-out',
        exitedOn: asIsoDate('2026-01-10'),
        recordedBy: asId('stf-1'),
        note: 'Family transferred to Antipolo.',
      },
    });

    const standing = deriveStanding({
      requestStatuses: [],
      releaseStatuses: [],
      enrollments: [exited],
    });

    expect(hasStanding(standing, 'enrollee')).toBe(false);
    expect(standing.evidence.pastEnrollmentCount).toBe(1);
  });

  it('a suspended member is still a member — nothing was concluded', () => {
    const standing = deriveStanding({
      requestStatuses: [],
      releaseStatuses: [],
      enrollments: [enrollment({ status: 'suspended' })],
    });

    expect(hasStanding(standing, 'enrollee')).toBe(true);
  });

  it('every role in the vocabulary is reachable', () => {
    const standing = deriveStanding({
      requestStatuses: ['submitted'],
      releaseStatuses: ['released'],
      enrollments: [enrollment()],
    });

    expect([...standing.roles].sort()).toEqual([...BENEFICIARY_ROLES].sort());
  });
});

describe('program enrollment', () => {
  it('refuses an exit that does not agree with the status', () => {
    expect(enrollmentProblems(enrollment({ status: 'exited' }))).toContain(
      'exited-without-exit-record',
    );

    const standingWithExit = enrollment({
      exit: {
        reason: 'completed',
        exitedOn: asIsoDate('2026-01-01'),
        recordedBy: asId('stf-1'),
        note: 'Finished.',
      },
    });
    expect(enrollmentProblems(standingWithExit)).toContain(
      'exit-record-on-a-standing-enrollment',
    );
  });

  it('refuses an exit nobody explained', () => {
    const wordless = enrollment({
      status: 'exited',
      exit: {
        reason: 'removed-for-cause',
        exitedOn: asIsoDate('2026-01-01'),
        recordedBy: asId('stf-1'),
        note: '   ',
      },
    });

    expect(enrollmentProblems(wordless)).toContain('exit-without-a-note');
  });

  it('refuses an exit dated before the enrollment', () => {
    const backwards = enrollment({
      status: 'exited',
      enrolledOn: asIsoDate('2026-02-01'),
      exit: {
        reason: 'withdrew',
        exitedOn: asIsoDate('2026-01-01'),
        recordedBy: asId('stf-1'),
        note: 'Withdrew.',
      },
    });

    expect(enrollmentProblems(backwards)).toContain('exit-before-enrollment');
  });

  it('refuses an enrollment that continues itself', () => {
    const id = asId<ProgramEnrollmentId>('enr-loop');
    expect(enrollmentProblems(enrollment({ id, continuesEnrollmentId: id }))).toContain(
      'enrollment-continues-itself',
    );
  });

  it('accepts a well-formed standing enrollment and a well-formed exit', () => {
    expect(enrollmentProblems(enrollment())).toEqual([]);
    expect(isCurrentEnrollment(enrollment())).toBe(true);

    const proper = enrollment({
      status: 'exited',
      exit: {
        reason: 'completed',
        exitedOn: asIsoDate('2026-06-01'),
        recordedBy: asId('stf-1'),
        note: 'Completed the livelihood cycle.',
      },
    });
    expect(enrollmentProblems(proper)).toEqual([]);
    expect(isCurrentEnrollment(proper)).toBe(false);
  });
});

describe('assistance timeline', () => {
  it('merges four record types into one sequence, newest first', () => {
    const timeline = buildAssistanceTimeline({
      requests: [request()],
      payouts: [payout()],
      referrals: [referral()],
      enrollments: [enrollment()],
    });

    expect(timeline.map((entry) => entry.kind)).toEqual([
      'request-settled',
      'assistance-released',
      'request-filed',
      'referral-made',
      'enrollment-started',
    ]);
  });

  it('cites the record behind every entry', () => {
    const timeline = buildAssistanceTimeline({
      requests: [request()],
      payouts: [payout()],
      referrals: [referral()],
      enrollments: [enrollment()],
    });

    for (const entry of timeline) {
      expect(entry.sourceId.length).toBeGreaterThan(0);
      expect(entry.reference.length).toBeGreaterThan(0);
    }
  });

  it('drops an unfiled draft rather than dating it to now', () => {
    const timeline = buildAssistanceTimeline({
      requests: [request({ status: 'draft', submittedAt: null })],
      payouts: [],
      referrals: [],
      enrollments: [],
    });

    expect(timeline).toEqual([]);
  });

  it('leaves a scheduled payout out of history — a plan is not a receipt', () => {
    const timeline = buildAssistanceTimeline({
      requests: [],
      payouts: [payout({ status: 'scheduled', releasedAt: null })],
      referrals: [],
      enrollments: [],
    });

    expect(timeline).toEqual([]);
  });

  it('records a referral answer as its own event', () => {
    const timeline = buildAssistanceTimeline({
      requests: [],
      payouts: [],
      referrals: [referral({ respondedAt: asIsoDateTime('2026-02-09T01:00:00.000Z') })],
      enrollments: [],
    });

    expect(timeline.map((entry) => entry.kind)).toEqual(['referral-answered', 'referral-made']);
  });

  it('records an exit without erasing the enrollment that preceded it', () => {
    const timeline = buildAssistanceTimeline({
      requests: [],
      payouts: [],
      referrals: [],
      enrollments: [
        enrollment({
          status: 'exited',
          exit: {
            reason: 'no-longer-qualified',
            exitedOn: asIsoDate('2026-05-01'),
            recordedBy: asId('stf-1'),
            note: 'Income rose above the threshold.',
          },
          audit: {
            createdAt: asIsoDateTime('2024-01-15T01:00:00.000Z'),
            createdBy: null,
            updatedAt: asIsoDateTime('2026-05-01T01:00:00.000Z'),
            updatedBy: null,
          },
        }),
      ],
    });

    expect(timeline.map((entry) => entry.kind)).toEqual([
      'enrollment-ended',
      'enrollment-started',
    ]);
  });

  it('keeps a stable order when two records share a timestamp', () => {
    const sameMoment = asIsoDateTime('2026-04-01T00:00:00.000Z');
    const input = {
      requests: [
        request({ id: asId('req-b'), referenceNumber: 'AR-B', submittedAt: sameMoment }),
        request({ id: asId('req-a'), referenceNumber: 'AR-A', submittedAt: sameMoment }),
      ],
      payouts: [],
      referrals: [],
      enrollments: [],
    };

    const first = buildAssistanceTimeline(input).map((entry) => entry.key);
    const second = buildAssistanceTimeline(input).map((entry) => entry.key);

    expect(first).toEqual(second);
  });

  it('groups into calendar years, newest first', () => {
    const years = groupTimelineByYear(
      buildAssistanceTimeline({
        requests: [
          request({ id: asId('req-old'), submittedAt: asIsoDateTime('2024-05-01T01:00:00.000Z') }),
          request({ id: asId('req-new'), submittedAt: asIsoDateTime('2026-05-01T01:00:00.000Z') }),
        ],
        payouts: [],
        referrals: [],
        enrollments: [],
      }),
    );

    expect(years.map((year) => year.year)).toEqual(['2026', '2024']);
  });
});

describe('duplicate review', () => {
  it('grades an agreeing identifier plus a surname as strong', () => {
    const strength = gradeDuplicate([
      signal('surname', 'same'),
      signal('birth-date', 'same'),
      signal('barangay', 'same'),
    ]);

    expect(strength).toBe('strong');
  });

  it('will not call a shared surname and barangay strong — that is a neighbourhood', () => {
    const strength = gradeDuplicate([
      signal('surname', 'same'),
      signal('barangay', 'same'),
      signal('sex', 'same'),
    ]);

    expect(strength).toBe('moderate');
  });

  it('demotes a pair whose identifiers contradict, however much else agrees', () => {
    const strength = gradeDuplicate([
      signal('surname', 'same'),
      signal('given-name', 'same'),
      signal('barangay', 'same'),
      signal('street-address', 'same'),
      signal('birth-date', 'differs'),
    ]);

    expect(strength).toBe('weak');
  });

  it('treats a missing field as no evidence, not as disagreement', () => {
    const withGap = gradeDuplicate([
      signal('surname', 'same'),
      signal('birth-date', 'same'),
      signal('mobile', 'not-comparable'),
    ]);

    expect(withGap).toBe('strong');
  });

  it('keys a pair the same way whichever side was opened first', () => {
    expect(pairKey(ANA, BEA)).toBe(pairKey(BEA, ANA));
  });
});

describe('recording an identity finding', () => {
  function draft(overrides: Partial<IdentityResolutionDraft> = {}): IdentityResolutionDraft {
    return {
      pairId: asId<DuplicatePairId>('pair-ana-bea'),
      verdict: 'same-person',
      pair: [ANA, BEA],
      canonicalResidentId: ANA,
      reason: 'Same PhilSys digits and birth date; confirmed with the applicant at the counter.',
      ...overrides,
    };
  }

  it('accepts a well-formed finding either way', () => {
    expect(resolutionProblems(draft())).toEqual([]);
    expect(
      resolutionProblems(
        draft({ verdict: 'distinct-people', canonicalResidentId: null, reason: 'Twin sisters.' }),
      ),
    ).toEqual([]);
  });

  it('refuses a finding nobody explained', () => {
    expect(resolutionProblems(draft({ reason: '  ' }))).toContain('reason-required');
  });

  it('refuses to resolve a record against itself', () => {
    expect(resolutionProblems(draft({ pair: [ANA, ANA] }))).toContain('same-record-twice');
  });

  it('requires a surviving record when two records are found to be one person', () => {
    expect(resolutionProblems(draft({ canonicalResidentId: null }))).toContain(
      'canonical-required',
    );
  });

  it('refuses a survivor that is not one of the two records', () => {
    expect(
      resolutionProblems(draft({ canonicalResidentId: asId<ResidentId>('res-carlo') })),
    ).toContain('canonical-not-in-pair');
  });

  it('refuses to supersede a record it just found unrelated', () => {
    expect(
      resolutionProblems(draft({ verdict: 'distinct-people', canonicalResidentId: ANA })),
    ).toContain('canonical-on-distinct-verdict');
  });
});

describe('beneficiary filtering', () => {
  it('reports an empty filter as inactive', () => {
    expect(isBeneficiaryFilterActive({})).toBe(false);
  });

  it('notices every filter dimension', () => {
    expect(isBeneficiaryFilterActive({ search: 'mercado' })).toBe(true);
    expect(isBeneficiaryFilterActive({ role: 'beneficiary' })).toBe(true);
    expect(isBeneficiaryFilterActive({ programId: PENSION })).toBe(true);
    expect(isBeneficiaryFilterActive({ withOpenDuplicateReview: true })).toBe(true);
  });

  it('catches a reversed period, which otherwise reads as "never helped"', () => {
    expect(
      isPeriodReversed({ receivedFrom: asIsoDate('2026-06-01'), receivedTo: asIsoDate('2026-01-01') }),
    ).toBe(true);
    expect(
      isPeriodReversed({ receivedFrom: asIsoDate('2026-01-01'), receivedTo: asIsoDate('2026-06-01') }),
    ).toBe(false);
    expect(isPeriodReversed({ receivedFrom: asIsoDate('2026-01-01') })).toBe(false);
  });
});

describe('the registry introduces no second identity', () => {
  it('every exported request status is classified as open or settled, never both', () => {
    const statuses: readonly AssistanceRequestStatus[] = [
      'draft',
      'submitted',
      'intake-review',
      'returned',
      'assessment',
      'endorsed',
      'approved',
      'rejected',
      'scheduled',
      'released',
      'completed',
      'cancelled',
      'expired',
    ];

    const standing = deriveStanding({
      requestStatuses: statuses,
      releaseStatuses: [],
      enrollments: [],
    });

    expect(standing.evidence.openRequestCount + standing.evidence.settledRequestCount).toBe(
      statuses.length,
    );
  });
});
