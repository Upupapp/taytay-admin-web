import {
  ASSISTANCE_LOOKBACK_MONTHS,
  EMPTY_ADVISORY,
  EMPTY_INTAKE_DRAFT,
  INTAKE_CHANNELS,
  INTAKE_SIGNAL_CODES,
  INTAKE_STEPS,
  OFFERED_INTAKE_CHANNELS,
  SAME_PROGRAMME_WINDOW_DAYS,
  asId,
  asIsoDate,
  asIsoDateTime,
  assessIntake,
  assessmentReadiness,
  canSubmitIntake,
  cautions,
  intakeProblems,
  isIntakeStep,
  isOfferedChannel,
  isSaveableDraft,
  isValidAcknowledgement,
  isValidFindings,
  needsAcknowledgement,
  nextStep,
  pesos,
  previousStep,
  problemsForStep,
  requirementEntriesFor,
  stepIndex,
  type AdvisoryAcknowledgement,
  type AdvisoryInput,
  type AssistanceRequest,
  type HouseholdId,
  type IntakeDraft,
  type IntakeSignalCode,
  type PriorRelease,
  type PriorRequest,
  type ProgramId,
  type ResidentId,
} from '@domain/index';

const AURORA = asId<ResidentId>('res-0001');
const HOUSEMATE = asId<ResidentId>('res-0006');
const HOUSEHOLD = asId<HouseholdId>('hh-0001');
const MEDICAL = asId<ProgramId>('prog-aics-medical');
const BURIAL = asId<ProgramId>('prog-aics-burial');

const NOW = asIsoDateTime('2026-08-15T02:00:00.000Z');
const TODAY = asIsoDate('2026-08-15');

const daysAgo = (days: number) =>
  asIsoDateTime(new Date(Date.parse(NOW) - days * 86_400_000).toISOString());

function request(overrides: Partial<PriorRequest> = {}): PriorRequest {
  return {
    id: asId('req-x'),
    referenceNumber: 'TAY-2026-000841',
    residentId: AURORA,
    programId: MEDICAL,
    programName: 'Medical assistance',
    status: 'endorsed',
    submittedAt: daysAgo(10),
    approvedAmount: null,
    ...overrides,
  };
}

function release(overrides: Partial<PriorRelease> = {}): PriorRelease {
  return {
    requestId: asId('req-y'),
    residentId: AURORA,
    amount: pesos(3000),
    releasedAt: daysAgo(30),
    ...overrides,
  };
}

function input(overrides: Partial<AdvisoryInput> = {}): AdvisoryInput {
  return {
    residentId: AURORA,
    householdId: HOUSEHOLD,
    programId: MEDICAL,
    requests: [],
    releases: [],
    cases: [],
    householdResidentIds: [AURORA, HOUSEMATE],
    today: TODAY,
    now: NOW,
    ...overrides,
  };
}

const codeOf = (advisory: ReturnType<typeof assessIntake>): readonly IntakeSignalCode[] =>
  advisory.signals.map((signal) => signal.code);

/* ── The criterion the whole TAB turns on ─────────────────────────────────── */

describe('the duplicate check reports evidence and decides nothing', () => {
  it('states a rule, a finding and the records read for every signal', () => {
    // A finding without its rule and its records is a verdict the reader has to
    // take on trust (DL-60).
    const advisory = assessIntake(
      input({
        requests: [request()],
        releases: [release()],
        cases: [{ referenceNumber: 'CASE-1', isOpen: true }],
      }),
    );
    expect(advisory.signals.length).toBeGreaterThan(0);
    for (const signal of advisory.signals) {
      expect(signal.rule.length).toBeGreaterThan(10);
      expect(signal.finding.length).toBeGreaterThan(0);
      expect(signal.references.length).toBeGreaterThan(0);
    }
  });

  it('offers only two tones, and neither of them blocks', () => {
    const advisory = assessIntake(input({ requests: [request()] }));
    for (const signal of advisory.signals) {
      expect(['note', 'caution']).toContain(signal.tone);
    }
  });

  it('says how many records it read, so silence is not mistaken for ignorance', () => {
    const advisory = assessIntake(
      input({ requests: [request(), request()], releases: [release()] }),
    );
    expect(advisory.recordsRead).toBe(3);

    const nothing = assessIntake(input());
    expect(nothing.signals).toEqual([]);
    expect(nothing.recordsRead).toBe(0);
  });

  it('distinguishes "not checked yet" from "checked and found nothing"', () => {
    expect(EMPTY_ADVISORY.recordsRead).toBe(0);
    expect(EMPTY_ADVISORY.signals).toEqual([]);
  });
});

/* ── What it finds ────────────────────────────────────────────────────────── */

describe('duplicate signals', () => {
  it('raises a caution for an unfinished request under the same programme', () => {
    const advisory = assessIntake(input({ requests: [request({ status: 'assessment' })] }));
    expect(codeOf(advisory)).toContain('open-request-same-programme');
    expect(cautions(advisory).length).toBe(1);
    expect(needsAcknowledgement(advisory)).toBe(true);
  });

  it('treats an unfinished request elsewhere as a note, not a caution', () => {
    const advisory = assessIntake(
      input({ requests: [request({ programId: BURIAL, status: 'assessment' })] }),
    );
    expect(codeOf(advisory)).toContain('open-request-other-programme');
    expect(cautions(advisory)).toEqual([]);
    expect(needsAcknowledgement(advisory)).toBe(false);
  });

  it('ignores a finished request, however recent', () => {
    const advisory = assessIntake(
      input({ requests: [request({ status: 'rejected', submittedAt: daysAgo(1) })] }),
    );
    expect(codeOf(advisory)).not.toContain('open-request-same-programme');
  });

  it('counts an approved-but-unreleased grant as already granted', () => {
    // The money has not moved, but the office has committed. That is exactly
    // the duplicate an encoder needs to see.
    const advisory = assessIntake(
      input({ requests: [request({ status: 'approved', submittedAt: daysAgo(5) })] }),
    );
    expect(codeOf(advisory)).toContain('granted-same-programme-recently');
  });

  it('respects the same-programme window at its edges', () => {
    const inside = assessIntake(
      input({
        requests: [
          request({ status: 'completed', submittedAt: daysAgo(SAME_PROGRAMME_WINDOW_DAYS - 1) }),
        ],
      }),
    );
    expect(codeOf(inside)).toContain('granted-same-programme-recently');

    const outside = assessIntake(
      input({
        requests: [
          request({ status: 'completed', submittedAt: daysAgo(SAME_PROGRAMME_WINDOW_DAYS + 5) }),
        ],
      }),
    );
    expect(codeOf(outside)).not.toContain('granted-same-programme-recently');
  });

  it('reports what the person has actually received, with a total', () => {
    const advisory = assessIntake(
      input({ releases: [release({ amount: pesos(3000) }), release({ amount: pesos(2000) })] }),
    );
    const signal = advisory.signals.find((s) => s.code === 'assistance-within-lookback');
    expect(signal?.finding).toContain('2 payouts');
    expect(signal?.finding).toContain('5,000');
  });

  it('forgets a payout older than the lookback window', () => {
    const advisory = assessIntake(
      input({ releases: [release({ releasedAt: daysAgo(ASSISTANCE_LOOKBACK_MONTHS * 30 + 10) })] }),
    );
    expect(codeOf(advisory)).not.toContain('assistance-within-lookback');
  });

  it('catches the duplication an office actually gets caught by — the household', () => {
    // Two members of one household applying separately for the same event.
    const advisory = assessIntake(input({ releases: [release({ residentId: HOUSEMATE })] }));
    expect(codeOf(advisory)).toContain('household-assisted-recently');
    expect(cautions(advisory).map((s) => s.code)).toContain('household-assisted-recently');
  });

  it('does not raise a household signal for a person with no household', () => {
    const advisory = assessIntake(
      input({
        householdId: null,
        householdResidentIds: [],
        releases: [release({ residentId: HOUSEMATE })],
      }),
    );
    expect(codeOf(advisory)).not.toContain('household-assisted-recently');
  });

  it('never counts the applicant as their own household duplicate', () => {
    const advisory = assessIntake(input({ releases: [release({ residentId: AURORA })] }));
    expect(codeOf(advisory)).not.toContain('household-assisted-recently');
  });

  it('mentions an open case, because the request may belong inside it', () => {
    const advisory = assessIntake(
      input({ cases: [{ referenceNumber: 'CASE-2026-0117', isOpen: true }] }),
    );
    const signal = advisory.signals.find((s) => s.code === 'open-case');
    expect(signal?.tone).toBe('note');
    expect(signal?.references).toContain('CASE-2026-0117');
  });

  it('says nothing about somebody else’s history', () => {
    const advisory = assessIntake(
      input({ requests: [request({ residentId: HOUSEMATE, status: 'assessment' })] }),
    );
    expect(codeOf(advisory)).not.toContain('open-request-same-programme');
  });

  it('works before a programme is chosen', () => {
    const advisory = assessIntake(
      input({ programId: null, requests: [request({ status: 'assessment' })] }),
    );
    expect(codeOf(advisory)).toContain('open-request-other-programme');
  });

  it('words every code it can emit', () => {
    expect(INTAKE_SIGNAL_CODES.length).toBe(6);
  });
});

/* ── Acknowledgement ──────────────────────────────────────────────────────── */

describe('an acknowledgement is a sentence, not a checkbox', () => {
  it('refuses a token acknowledgement', () => {
    expect(isValidAcknowledgement('ok')).toBe(false);
    expect(isValidAcknowledgement('   ')).toBe(false);
  });

  it('accepts a sentence an auditor could read', () => {
    expect(isValidAcknowledgement('Second admission for the same condition')).toBe(true);
  });
});

/* ── Steps ────────────────────────────────────────────────────────────────── */

describe('four steps, one page', () => {
  it('walks forward and back without falling off either end', () => {
    expect(INTAKE_STEPS.length).toBe(4);
    expect(previousStep('person')).toBeNull();
    expect(nextStep('review')).toBeNull();
    expect(nextStep('person')).toBe('request');
    expect(previousStep('review')).toBe('checks');
    expect(stepIndex('checks')).toBe(2);
  });

  it('degrades an unknown step rather than throwing', () => {
    expect(isIntakeStep('checks')).toBe(true);
    expect(isIntakeStep('elsewhere')).toBe(false);
  });
});

/* ── Channels ─────────────────────────────────────────────────────────────── */

describe('intake channels', () => {
  it('models the online channel and does not offer it', () => {
    // A channel a member of staff can pick by hand is not an online submission
    // — it is an encoded one mislabelled (DL-61).
    expect(INTAKE_CHANNELS).toContain('online');
    expect(OFFERED_INTAKE_CHANNELS).not.toContain('online');
    expect(isOfferedChannel('online')).toBe(false);
    expect(isOfferedChannel('walk-in')).toBe(true);
  });

  it('offers the three a counter actually uses', () => {
    expect([...OFFERED_INTAKE_CHANNELS]).toEqual(['walk-in', 'barangay-referral', 'encoded']);
  });
});

/* ── What is missing ──────────────────────────────────────────────────────── */

describe('what still has to happen before filing', () => {
  const complete: IntakeDraft = {
    ...EMPTY_INTAKE_DRAFT,
    residentId: AURORA,
    programId: MEDICAL,
    reasonForRequest: 'Maintenance medicines after a hypertension confinement',
  };

  it('names the step each problem belongs to, so the stepper can mark it', () => {
    const problems = intakeProblems(EMPTY_INTAKE_DRAFT, EMPTY_ADVISORY, null);
    expect(problems.map((p) => p.code)).toContain('no-resident');
    expect(problemsForStep(problems, 'person').map((p) => p.code)).toEqual(['no-resident']);
    expect(problemsForStep(problems, 'request').map((p) => p.code)).toContain('no-programme');
  });

  it('accepts a complete draft', () => {
    expect(canSubmitIntake(complete, EMPTY_ADVISORY, null)).toBe(true);
  });

  it('asks for more than a couple of words about the need', () => {
    const terse = { ...complete, reasonForRequest: 'medicine' };
    expect(intakeProblems(terse, EMPTY_ADVISORY, null).map((p) => p.code)).toContain(
      'reason-too-short',
    );
  });

  it('treats a waiver as a valid answer to a missing document', () => {
    const requirements = requirementEntriesFor([
      { code: 'valid-id', label: 'Valid ID', obligation: 'required', appliesWhen: null, notes: null },
    ]);
    const missing = { ...complete, requirements };
    expect(intakeProblems(missing, EMPTY_ADVISORY, null).map((p) => p.code)).toContain(
      'missing-mandatory-requirement',
    );

    const waived = {
      ...complete,
      requirements: requirements.map((entry) => ({ ...entry, waivedReason: 'Lost in the fire' })),
    };
    expect(canSubmitIntake(waived, EMPTY_ADVISORY, null)).toBe(true);
  });

  it('refuses a waiver nobody signed', () => {
    const requirements = requirementEntriesFor([
      { code: 'valid-id', label: 'Valid ID', obligation: 'required', appliesWhen: null, notes: null },
    ]).map((entry) => ({ ...entry, waivedReason: '  ' }));
    expect(
      intakeProblems({ ...complete, requirements }, EMPTY_ADVISORY, null).map((p) => p.code),
    ).toContain('waiver-without-reason');
  });

  it('ignores an optional document that was never presented', () => {
    const requirements = requirementEntriesFor([
      { code: 'photo', label: 'Photograph', obligation: 'optional', appliesWhen: null, notes: null },
    ]);
    expect(canSubmitIntake({ ...complete, requirements }, EMPTY_ADVISORY, null)).toBe(true);
  });

  it('asks for a sentence when the check raised a caution — and nothing more', () => {
    const advisory = assessIntake(input({ requests: [request({ status: 'assessment' })] }));
    expect(canSubmitIntake(complete, advisory, null)).toBe(false);
    expect(intakeProblems(complete, advisory, null).map((p) => p.code)).toContain(
      'unacknowledged-caution',
    );

    const acknowledgement: AdvisoryAcknowledgement = {
      codes: ['open-request-same-programme'],
      reason: 'Second admission for the same condition',
      actorId: null,
      actorName: 'Test User',
      acknowledgedAt: NOW,
    };
    // Acknowledged, and the request files. Nothing was ever refused.
    expect(canSubmitIntake(complete, advisory, acknowledgement)).toBe(true);
  });

  it('does not ask for one when only notes were raised', () => {
    const advisory = assessIntake(input({ cases: [{ referenceNumber: 'CASE-1', isOpen: true }] }));
    expect(canSubmitIntake(complete, advisory, null)).toBe(true);
  });

  it('will not save a draft that names nobody', () => {
    expect(isSaveableDraft(EMPTY_INTAKE_DRAFT)).toBe(false);
    expect(isSaveableDraft(complete)).toBe(true);
  });
});

/* ── Assessment ───────────────────────────────────────────────────────────── */

describe('the case study', () => {
  const base: AssistanceRequest = {
    id: asId('req-0001'),
    referenceNumber: 'TAY-2026-000841',
    residentId: AURORA,
    programId: MEDICAL,
    barangayId: asId('brgy-san-juan'),
    status: 'assessment',
    requestedAmount: pesos(9000),
    approvedAmount: null,
    reasonForRequest: 'Maintenance medicines',
    assignedTo: null,
    requirements: [],
    assessment: null,
    statusHistory: [],
    decisionRemarks: null,
    submittedAt: NOW,
    audit: { createdAt: NOW, createdBy: null, updatedAt: NOW, updatedBy: null },
  };

  it('asks for findings somebody else could act on', () => {
    expect(isValidFindings('OK')).toBe(false);
    expect(isValidFindings('Home visit on 12 August; household of five in one rented room.')).toBe(
      true,
    );
  });

  it('lists what is outstanding without preventing anything', () => {
    // The readiness list is a statement, never a gate (DL-60).
    expect(assessmentReadiness(base)).toContain('no-assessment');

    const assessed: AssistanceRequest = {
      ...base,
      assessment: {
        assessedBy: asId('staff-sw-1'),
        assessedAt: NOW,
        findings: 'Home visit on 12 August; household of five in one rented room.',
        recommendedAmount: pesos(5000),
        homeVisitConducted: true,
        recommendation: 'recommend-approve',
      },
    };
    expect(assessmentReadiness(assessed)).toEqual([]);
  });

  it('notices an outstanding mandatory document', () => {
    const withDocument: AssistanceRequest = {
      ...base,
      requirements: [
        {
          id: asId('rq-1'),
          code: 'valid-id',
          label: 'Valid ID',
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
        },
      ],
    };
    expect(assessmentReadiness(withDocument)).toContain('outstanding-requirements');
  });
});
