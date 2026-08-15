import type { EligibilityGuideline, ProgramResponsibility } from '@domain/index';

/**
 * Who runs what, and on whose authority.
 *
 * The correction TAB 12 exists to make. AICS was described in this seed as
 * funded by the "Municipal social welfare fund"; it is a DSWD programme with
 * DSWD-disbursed funds, and what the municipality does is refer into it and
 * augment from its own appropriation (`DL-65`).
 *
 * Every URL below was **supplied by the supervisor and not retrieved in this
 * offline run** — which is why every `verifiedOn` is `null`. That is the honest
 * treatment required by `CLAUDE.md` §6, and the programme screen shows the
 * distinction rather than presenting an unread citation as checked.
 */
export const AICS_RESPONSIBILITY: ProgramResponsibility = {
  administeredBy: 'dswd',
  fundsHeldBy: 'dswd',
  lguRole: 'referrer',
  statement:
    'This is a DSWD programme. The MSWDO receives the request, assesses it and refers it to DSWD; DSWD assesses the referral in turn and releases the assistance. The municipality does not decide the outcome.',
  sources: [
    {
      title: 'DSWD — AICS is a DSWD service',
      url: 'https://aics.dswd.gov.ph/aics-program/',
      verifiedOn: null,
    },
    {
      title:
        'DSWD — AKAP and AICS are DSWD programmes with agency-disbursed funds; LGU and legislator referrals remain subject to DSWD assessment',
      url: 'https://aics.dswd.gov.ph/2024/11/akap-aics-are-dswd-programs-with-agency-disbursed-funds-dswd-chief/',
      verifiedOn: null,
    },
    {
      title:
        'DSWD Field Office Caraga — AICS serves cases especially where LGUs cannot accommodate them',
      url: 'https://caraga.dswd.gov.ph/programs-and-projects/assistance-to-individuals-in-crisis-situation-aics/',
      verifiedOn: null,
    },
  ],
};

export const MUNICIPAL_RESPONSIBILITY: ProgramResponsibility = {
  administeredBy: 'lgu-taytay',
  fundsHeldBy: 'lgu-taytay',
  lguRole: 'owner',
  statement:
    'This programme is run and funded by the Municipality of Taytay through the MSWDO. The office decides the outcome and releases the assistance itself.',
  sources: [],
};

/**
 * What each programme looks for, as records.
 *
 * Nothing here refuses anybody. Every entry is a `weight` a worker reads
 * alongside the applicant in front of them, and the assessment is what decides
 * (`DL-66`). DSWD describes the same shape for AICS: a screening and database
 * cross-match followed by a social worker's interview and assessment, not an
 * automatic disposition.
 */
const AICS_SOURCE =
  'https://dswd.gov.ph/request-for-assistance-under-aics-now-easier-for-clients-dswd/';

const residency = (months: number): EligibilityGuideline => ({
  code: 'residency',
  weight: 'expected',
  statement: `The applicant is normally a resident of Taytay for at least ${months} months.`,
  provenance: 'office-convention',
  basis: 'MSWDO counter practice',
  sourceUrl: null,
  verifiedOn: null,
});

const meansTest: EligibilityGuideline = {
  code: 'income-ceiling',
  weight: 'usual',
  statement:
    'Household income is usually at or below the recorded ceiling. A household above it may still be assisted where the crisis explains the gap.',
  provenance: 'office-convention',
  basis: 'MSWDO counter practice, read alongside the PSA poverty threshold',
  sourceUrl: null,
  verifiedOn: null,
};

const assessedNotScored: EligibilityGuideline = {
  code: 'other',
  weight: 'context',
  statement:
    'DSWD screening cross-matches the database and is then followed by a social worker interview and assessment. Nothing here decides the request on its own.',
  provenance: 'issuance',
  basis: 'DSWD — request for assistance under AICS',
  sourceUrl: AICS_SOURCE,
  verifiedOn: null,
};

export const guidance = {
  aicsMedical: [
    residency(6),
    meansTest,
    assessedNotScored,
    {
      code: 'documents',
      weight: 'expected',
      statement:
        'A hospital billing statement or a prescription dated within the last 90 days evidences the crisis.',
      provenance: 'office-convention',
      basis: 'MSWDO counter practice',
      sourceUrl: null,
      verifiedOn: null,
    },
  ] satisfies readonly EligibilityGuideline[],

  aicsBurial: [
    residency(6),
    meansTest,
    assessedNotScored,
    {
      code: 'documents',
      weight: 'expected',
      statement: 'A death certificate or a funeral contract in the claimant’s name.',
      provenance: 'office-convention',
      basis: 'MSWDO counter practice',
      sourceUrl: null,
      verifiedOn: null,
    },
  ] satisfies readonly EligibilityGuideline[],

  educational: [
    residency(6),
    meansTest,
    {
      code: 'age-range',
      weight: 'usual',
      statement: 'Normally for a learner between 7 and 24 enrolled in a public school or SUC.',
      provenance: 'office-convention',
      basis: 'Municipal education assistance guidelines',
      sourceUrl: null,
      verifiedOn: null,
    },
  ] satisfies readonly EligibilityGuideline[],

  soloParent: [
    residency(6),
    {
      code: 'sector',
      weight: 'expected',
      statement:
        'The applicant holds, or is eligible for, a Solo Parent Identification Card under RA 8972 as amended by RA 11861.',
      provenance: 'statute',
      basis: 'RA 8972 as amended by RA 11861',
      sourceUrl: 'https://www.officialgazette.gov.ph/2022/06/04/republic-act-no-11861/',
      verifiedOn: null,
    },
  ] satisfies readonly EligibilityGuideline[],

  livelihood: [
    residency(12),
    meansTest,
    {
      code: 'frequency',
      weight: 'usual',
      statement: 'A household normally receives livelihood capital once in a funding year.',
      provenance: 'office-convention',
      basis: 'Municipal livelihood programme guidelines',
      sourceUrl: null,
      verifiedOn: null,
    },
  ] satisfies readonly EligibilityGuideline[],

  foodRelief: [
    {
      code: 'other',
      weight: 'context',
      statement:
        'Released against a declared incident or a validated evacuation list rather than an individual means test.',
      provenance: 'office-convention',
      basis: 'LDRRMC operating practice',
      sourceUrl: null,
      verifiedOn: null,
    },
  ] satisfies readonly EligibilityGuideline[],

  seniorCash: [
    residency(6),
    {
      code: 'age-range',
      weight: 'expected',
      statement: 'For residents aged 60 and above, per RA 9994.',
      provenance: 'statute',
      basis: 'RA 9994 (Expanded Senior Citizens Act of 2010)',
      sourceUrl: 'https://www.officialgazette.gov.ph/2010/02/15/republic-act-no-9994/',
      verifiedOn: null,
    },
  ] satisfies readonly EligibilityGuideline[],
} as const;
