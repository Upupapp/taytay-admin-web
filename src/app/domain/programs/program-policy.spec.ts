import {
  ADMINISTERING_AGENCIES,
  ASSISTANCE_LOOKBACK_MONTHS,
  DEFAULT_REVIEW_WINDOW,
  GUIDANCE_WEIGHTS,
  LGU_ROLES,
  SAME_PROGRAMME_WINDOW_DAYS,
  asId,
  asIsoDate,
  asIsoDateTime,
  awaitsConfirmation,
  decidesElsewhere,
  guidanceProblems,
  isFromTemplate,
  isNationalAgency,
  isResponsibilityValid,
  isUnused,
  pesos,
  resolveRequirements,
  responsibilityProblems,
  reviewWindowFor,
  reviewWindowProblems,
  summariseUtilization,
  templateProblems,
  type EligibilityGuideline,
  type ProgramId,
  type ProgramResponsibility,
  type RequirementTemplate,
  type ReviewWindowPolicy,
} from '@domain/index';

const MEDICAL = asId<ProgramId>('prog-aics-medical');
const NOW = asIsoDateTime('2026-08-15T02:00:00.000Z');

function responsibility(
  overrides: Partial<ProgramResponsibility> = {},
): ProgramResponsibility {
  return {
    administeredBy: 'dswd',
    fundsHeldBy: 'dswd',
    lguRole: 'referrer',
    statement:
      'This is a DSWD programme. The MSWDO refers the request and DSWD decides and releases it.',
    sources: [{ title: 'DSWD', url: 'https://aics.dswd.gov.ph/aics-program/', verifiedOn: null }],
    ...overrides,
  };
}

/* ── The criterion the TAB turns on ───────────────────────────────────────── */

describe('a programme cannot be misrepresented as the office’s own', () => {
  it('refuses a national programme recorded as one the municipality runs', () => {
    // The load-bearing rule. AICS is DSWD's; claiming it sets an expectation the
    // office cannot meet (DL-65).
    const problems = responsibilityProblems(responsibility({ lguRole: 'owner' }));
    expect(problems.map((problem) => problem.code)).toContain(
      'national-programme-claimed-as-owned',
    );
  });

  it('accepts the same programme recorded as a referral', () => {
    expect(isResponsibilityValid(responsibility())).toBe(true);
  });

  it('accepts a genuinely municipal programme as owned', () => {
    expect(
      isResponsibilityValid(
        responsibility({
          administeredBy: 'lgu-taytay',
          fundsHeldBy: 'lgu-taytay',
          lguRole: 'owner',
          statement: 'The municipality runs and funds this programme through the MSWDO.',
          sources: [],
        }),
      ),
    ).toBe(true);
  });

  it('refuses a claim to add funds the municipality does not hold', () => {
    const problems = responsibilityProblems(responsibility({ lguRole: 'augmenter' }));
    expect(problems.map((problem) => problem.code)).toContain('funds-claimed-without-holding');
  });

  it('demands a source for a claim about another agency’s programme', () => {
    const problems = responsibilityProblems(responsibility({ sources: [] }));
    expect(problems.map((problem) => problem.code)).toContain('claim-without-source');
  });

  it('demands a sentence staff can actually say', () => {
    const problems = responsibilityProblems(responsibility({ statement: 'DSWD' }));
    expect(problems.map((problem) => problem.code)).toContain('lgu-role-without-statement');
  });

  it('knows when the office should not imply it decides', () => {
    expect(decidesElsewhere(responsibility())).toBe(true);
    expect(decidesElsewhere(responsibility({ lguRole: 'augmenter' }))).toBe(false);
    expect(isNationalAgency('dswd')).toBe(true);
    expect(isNationalAgency('lgu-taytay')).toBe(false);
  });

  it('offers every agency and role the office actually uses', () => {
    expect(ADMINISTERING_AGENCIES).toContain('lgu-taytay');
    expect(LGU_ROLES).toEqual(['owner', 'augmenter', 'referrer', 'facilitator']);
  });
});

/* ── Guidance advises ─────────────────────────────────────────────────────── */

describe('eligibility guidance is read, never applied', () => {
  const guideline: EligibilityGuideline = {
    code: 'residency',
    weight: 'expected',
    statement: 'The applicant is normally a resident of Taytay for at least six months.',
    provenance: 'office-convention',
    basis: 'MSWDO counter practice',
    sourceUrl: null,
    verifiedOn: null,
  };

  it('offers three weights and none of them refuses anybody', () => {
    expect([...GUIDANCE_WEIGHTS]).toEqual(['expected', 'usual', 'context']);
  });

  it('accepts a well-formed set', () => {
    expect(guidanceProblems([guideline])).toEqual([]);
  });

  it('notices a programme with nothing recorded', () => {
    expect(guidanceProblems([]).map((problem) => problem.code)).toContain('no-guidance-recorded');
  });

  it('refuses a statement too short to act on', () => {
    expect(
      guidanceProblems([{ ...guideline, statement: 'resident' }]).map((problem) => problem.code),
    ).toContain('statement-too-short');
  });

  it('refuses statutory force claimed without a source', () => {
    // How an office convention quietly becomes "the law says so".
    expect(
      guidanceProblems([{ ...guideline, provenance: 'statute' }]).map((problem) => problem.code),
    ).toContain('statute-without-source');
  });
});

/* ── Requirement templates ────────────────────────────────────────────────── */

describe('requirement templates', () => {
  const template: RequirementTemplate = {
    code: 'aics-standard',
    name: 'AICS standard set',
    description: 'The usual AICS documents.',
    requirements: [
      { code: 'valid-id', label: 'Valid government ID', obligation: 'required', appliesWhen: null, notes: null },
      { code: 'brgy-indigency', label: 'Indigency certificate', obligation: 'required', appliesWhen: null, notes: null },
    ],
    audit: {
      createdAt: NOW,
      createdBy: null,
      updatedAt: NOW,
      updatedBy: null,
    },
  };

  it('gives a programme the template’s documents plus its own', () => {
    const resolved = resolveRequirements(template, [
      { code: 'medical-abstract', label: 'Medical abstract', obligation: 'required', appliesWhen: null, notes: null },
    ]);
    expect(resolved.map((requirement) => requirement.code)).toEqual([
      'valid-id',
      'brgy-indigency',
      'medical-abstract',
    ]);
  });

  it('lets a programme override a shared document without forking the template', () => {
    const resolved = resolveRequirements(template, [
      { code: 'valid-id', label: 'Valid ID or PhilSys card', obligation: 'optional', appliesWhen: null, notes: null },
    ]);
    expect(resolved).toHaveLength(2);
    expect(resolved.find((r) => r.code === 'valid-id')?.obligation).toBe('optional');
  });

  it('works for a programme with no template at all', () => {
    expect(resolveRequirements(null, template.requirements)).toHaveLength(2);
  });

  it('says which documents came from the template, so a screen can label them', () => {
    expect(isFromTemplate(template, 'valid-id')).toBe(true);
    expect(isFromTemplate(template, 'medical-abstract')).toBe(false);
    expect(isFromTemplate(null, 'valid-id')).toBe(false);
  });

  it('refuses a template with a repeated code', () => {
    const broken = { ...template, requirements: [...template.requirements, template.requirements[0]!] };
    expect(templateProblems(broken).map((problem) => problem.code)).toContain('duplicate-code');
  });

  it('refuses an empty template', () => {
    expect(templateProblems({ ...template, requirements: [] }).map((p) => p.code)).toContain(
      'empty-template',
    );
  });
});

/* ── The review-window seam ───────────────────────────────────────────────── */

describe('the review windows move into policy without moving', () => {
  it('builds the default from the TAB 11 constants, so the two cannot drift', () => {
    expect(DEFAULT_REVIEW_WINDOW.lookbackMonths).toBe(ASSISTANCE_LOOKBACK_MONTHS);
    expect(DEFAULT_REVIEW_WINDOW.sameProgrammeDays).toBe(SAME_PROGRAMME_WINDOW_DAYS);
  });

  it('still says the default is an unconfirmed convention', () => {
    // The measurable retirement condition (DL-68).
    expect(DEFAULT_REVIEW_WINDOW.provenance).toBe('convention-pending-confirmation');
    expect(awaitsConfirmation(DEFAULT_REVIEW_WINDOW)).toBe(true);
  });

  it('falls back to the default where a programme sets none', () => {
    expect(reviewWindowFor(null)).toEqual(DEFAULT_REVIEW_WINDOW);
  });

  it('lets a programme carry its own', () => {
    const own: ReviewWindowPolicy = {
      lookbackMonths: 6,
      sameProgrammeDays: 30,
      provenance: 'office-confirmed',
      basis: 'MSWDO memorandum 2026-04',
      confirmedOn: asIsoDate('2026-04-01'),
    };
    expect(reviewWindowFor(own).lookbackMonths).toBe(6);
    expect(awaitsConfirmation(own)).toBe(false);
    expect(reviewWindowProblems(own)).toEqual([]);
  });

  it('refuses a window that claims to be settled without saying by what', () => {
    const problems = reviewWindowProblems({
      ...DEFAULT_REVIEW_WINDOW,
      provenance: 'office-confirmed',
    });
    expect(problems.map((problem) => problem.code)).toEqual([
      'confirmed-without-basis',
      'confirmed-without-date',
    ]);
  });

  it('refuses a window of zero or less', () => {
    expect(
      reviewWindowProblems({ ...DEFAULT_REVIEW_WINDOW, lookbackMonths: 0 }).map((p) => p.code),
    ).toContain('non-positive-window');
  });
});

/* ── Utilization describes, never budgets ─────────────────────────────────── */

describe('programme utilization', () => {
  const request = (overrides: Partial<Parameters<typeof summariseUtilization>[0]['requests'][number]> = {}) => ({
    id: asId('req-1' as string) as never,
    programId: MEDICAL,
    status: 'completed' as const,
    requestedAmount: pesos(5000),
    approvedAmount: pesos(4000),
    submittedAt: NOW,
    ...overrides,
  });

  /**
   * Requests are not counted here any more, and that is the office record's shape rather than a
   * simplification: it reports what a programme **delivered** and carries no count of what was
   * asked of it (`DL-159`). What was filed, open, completed or rejected is a gap, not a field.
   */
  it('totals what actually reached somebody', () => {
    const summary = summariseUtilization({
      programId: MEDICAL,
      requests: [request(), request({ approvedAmount: pesos(1000) })],
      releases: [{ requestId: asId('req-1'), programId: MEDICAL, amount: pesos(4000), releasedAt: NOW }],
      now: NOW,
    });
    expect(summary.releasedTotal?.centavos).toBe(400_000);
    expect(summary.releaseCount).toBe(1);
  });

  /**
   * Nothing computed here is ever withheld.
   *
   * Suppression is the office record's decision — it holds the population and knows when a cell is
   * too small to report. A client suppressing figures it was already handed would be hiding data it
   * has in its hands, which protects nobody (`DL-105`).
   */
  it('never withholds a figure it computed itself', () => {
    const summary = summariseUtilization({ programId: MEDICAL, requests: [], releases: [], now: NOW });

    expect(summary.isWithheld).toBe(false);
  });

  it('ignores another programme’s activity', () => {
    const summary = summariseUtilization({
      programId: MEDICAL,
      requests: [request({ programId: asId<ProgramId>('prog-other') })],
      releases: [],
      now: NOW,
    });
    expect(summary.releaseCount).toBe(0);
    expect(isUnused(summary)).toBe(true);
  });

  /**
   * A withheld programme is not an unused one.
   *
   * "We are not telling you how many" and "nobody has used this" are different statements, and the
   * second is the one that gets a programme closed (`DL-105`).
   */
  it('does not call a withheld programme unused', () => {
    expect(
      isUnused({ programId: MEDICAL, releaseCount: null, releasedTotal: null, isWithheld: true }),
    ).toBe(false);
  });

  it('returns zeros for an unused programme rather than being absent', () => {
    const summary = summariseUtilization({ programId: MEDICAL, requests: [], releases: [], now: NOW });
    expect(summary.releaseCount).toBe(0);
    expect(summary.releasedTotal?.centavos).toBe(0);
  });

  it('never reports a remaining balance, because this front end does not hold one', () => {
    const summary = summariseUtilization({ programId: MEDICAL, requests: [], releases: [], now: NOW });
    expect(Object.keys(summary)).not.toContain('remaining');
    expect(Object.keys(summary)).not.toContain('balance');
  });
});
