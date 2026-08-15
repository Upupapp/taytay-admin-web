import type {
  AdministeringAgency,
  GuidanceCode,
  GuidanceProvenance,
  GuidanceWeight,
  LguRole,
  WindowProvenance,
} from '@domain/index';

/** Every user-facing string the programme catalog shares between screens (`DL-23`). */
export const PROGRAM_COPY = {
  agencyLabel: {
    dswd: 'DSWD',
    doh: 'Department of Health',
    deped: 'Department of Education',
    dole: 'Department of Labor and Employment',
    'other-national': 'Another national agency',
    'lgu-taytay': 'Municipality of Taytay',
  } satisfies Record<AdministeringAgency, string>,

  roleLabel: {
    owner: 'The municipality runs and funds this',
    augmenter: 'The municipality adds its own funds',
    referrer: 'The municipality refers into this',
    facilitator: 'The municipality helps residents apply',
  } satisfies Record<LguRole, string>,

  weightLabel: {
    expected: 'Expected',
    usual: 'Usual, with exceptions',
    context: 'Worth knowing',
  } satisfies Record<GuidanceWeight, string>,

  guidanceCodeLabel: {
    'age-range': 'Age',
    sector: 'Sector',
    'income-ceiling': 'Household income',
    residency: 'Residency',
    frequency: 'How often',
    documents: 'Evidence',
    other: 'Other',
  } satisfies Record<GuidanceCode, string>,

  provenanceLabel: {
    statute: 'Statute',
    issuance: 'Agency issuance',
    'office-convention': 'Office convention',
  } satisfies Record<GuidanceProvenance, string>,

  windowProvenanceLabel: {
    'convention-pending-confirmation': 'Convention — not yet confirmed',
    'office-confirmed': 'Confirmed by the office',
    'issuance-based': 'Set by an issuance',
  } satisfies Record<WindowProvenance, string>,

  responsibility: {
    heading: 'Whose programme this is',
    fundsHeldBy: 'Funds held by',
    /**
     * The sentence that stops the office claiming somebody else's decision.
     * `tools/check-programs.mjs` fails the build if the notice stops rendering
     * it (`DL-65`).
     */
    decidedElsewhere:
      'The MSWDO does not decide this one. Tell the applicant what happens next and who decides, and do not promise an outcome.',
    sourcesHeading: 'Where this comes from',
    notVerified: 'recorded, not yet checked against the source',
    verifiedOn: 'checked against the source',
    nationalWithoutSource:
      'This is described as another agency’s programme with nothing recorded to support it. Add a source before relying on the wording.',
  },

  guidance: {
    heading: 'What this programme looks for',
    /** The sentence that keeps the catalog out of the decision business. */
    advisory:
      'Guidance a worker reads, not a test the software applies. Nothing here approves or refuses anybody — the assessment does, and records why.',
    empty: 'No guidance has been recorded for this programme yet.',
    basisLabel: 'Basis:',
    unverifiedNote: 'recorded, not yet checked against the source',
    parametersHeading: 'Recorded figures',
    minAge: 'Youngest',
    maxAge: 'Oldest',
    income: 'Household income ceiling',
    residency: 'Residency (months)',
    sectors: 'Sectors',
    notes: 'Notes',
    none: 'Not set',
  },

  window: {
    heading: 'Review windows',
    description:
      'How much history the duplicate check shows an encoder. These change what a worker sees and nothing else — no request is approved, refused or ranked by them.',
    lookback: 'Assistance shown from the last',
    sameProgramme: 'Same-programme grant flagged within',
    months: 'months',
    days: 'days',
    usingDefault: 'Using the office default.',
    pending:
      'Not yet confirmed against Taytay’s own AICS guidelines. Until somebody records that check, treat it as a working convention rather than policy.',
    basisLabel: 'Settled by:',
  },

  utilization: {
    heading: 'How much this has been used',
    description:
      'A description of what has happened, not a budget position. This front end does not hold the appropriation and does not compute a remaining balance.',
    filed: 'Requests filed',
    open: 'Still open',
    completed: 'Completed',
    rejected: 'Rejected',
    approvedTotal: 'Approved',
    releasedTotal: 'Handed over',
    releases: 'Payouts',
    lastFiled: 'Last filed',
    lastReleased: 'Last handed over',
    unused: 'Nothing has been filed under this programme yet.',
    never: '—',
  },
} as const;
