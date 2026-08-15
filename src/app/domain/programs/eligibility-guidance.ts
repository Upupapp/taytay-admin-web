import type { IsoDate } from '../shared/ids';
import type { Money } from '../shared/money';
import type { VulnerabilitySector } from '../residents/resident';

/**
 * What a programme expects, expressed as data.
 *
 * TAB 12's first two acceptance criteria are that programme rules are
 * data-driven rather than hardcoded into components, and that a policy change
 * can be represented without rewriting the UI. Both are properties of this
 * file: a guideline is a **record**, the screen renders whatever records it is
 * given, and adding, retiring or reworded a rule is an edit to data (`DL-66`).
 *
 * The doctrine of `DL-42` and `DL-60` carries straight through: a guideline is
 * **guidance a worker reads, never a gate the software closes**. There is no
 * `blocks`, no `score`, no `eligible`. Nothing in the application refuses an
 * applicant because a guideline was not met — that is the assessor's judgement,
 * recorded with a reason, and DSWD's own description of AICS is the same shape:
 * a screening and database cross-match followed by a social worker's interview
 * and assessment, not an automatic disposition.
 */
export type GuidanceCode =
  'age-range' | 'sector' | 'income-ceiling' | 'residency' | 'frequency' | 'documents' | 'other';

export const GUIDANCE_CODES: readonly GuidanceCode[] = [
  'age-range',
  'sector',
  'income-ceiling',
  'residency',
  'frequency',
  'documents',
  'other',
];

/**
 * How firmly the office holds a guideline.
 *
 * Three levels, and **none of them blocks**. `expected` is the ordinary case.
 * `usual` is a norm with routine exceptions. `context` is background a worker
 * should know. A fourth level meaning "refuse" would make the catalog into a
 * decision engine, which is what the criterion forbids.
 */
export type GuidanceWeight = 'expected' | 'usual' | 'context';

export const GUIDANCE_WEIGHTS: readonly GuidanceWeight[] = ['expected', 'usual', 'context'];

/**
 * Where a guideline comes from, so a worker challenged on it can answer.
 *
 * `basis` names the issuance or ordinance in words. `sourceUrl` is optional
 * because many office conventions have no published URL — and a convention is
 * allowed, as long as it says so through `provenance` rather than borrowing the
 * authority of a statute it does not have.
 */
export type GuidanceProvenance = 'statute' | 'issuance' | 'office-convention';

export const GUIDANCE_PROVENANCES: readonly GuidanceProvenance[] = [
  'statute',
  'issuance',
  'office-convention',
];

export interface EligibilityGuideline {
  readonly code: GuidanceCode;
  readonly weight: GuidanceWeight;
  /** What the office looks for, in words an applicant could be shown. */
  readonly statement: string;
  readonly provenance: GuidanceProvenance;
  /** The named issuance, ordinance or convention. */
  readonly basis: string;
  readonly sourceUrl: string | null;
  /** `null` when recorded but not retrieved and read (`CLAUDE.md` §6). */
  readonly verifiedOn: IsoDate | null;
}

/**
 * The structured half, kept beside the worded half.
 *
 * These are the values a future report or a server-side pre-filter might use.
 * Nothing in this application reads them to decide anything; they exist so that
 * a policy change is a number in a record rather than a constant in a
 * component.
 */
export interface EligibilityParameters {
  readonly minAge: number | null;
  readonly maxAge: number | null;
  readonly requiredSectors: readonly VulnerabilitySector[];
  readonly maxMonthlyHouseholdIncome: Money | null;
  readonly residencyMonthsRequired: number | null;
  readonly notes: string | null;
}

export type GuidanceProblemCode =
  'statement-too-short' | 'statute-without-source' | 'no-guidance-recorded';

export interface GuidanceProblem {
  readonly code: GuidanceProblemCode;
}

export const GUIDANCE_STATEMENT_MIN_LENGTH = 12;

/**
 * What is wrong with a set of guidelines. Never what is wrong with an
 * applicant — this function takes a programme, not a person, and there is
 * deliberately no counterpart that takes both.
 */
export function guidanceProblems(
  guidelines: readonly EligibilityGuideline[],
): readonly GuidanceProblem[] {
  const problems: GuidanceProblem[] = [];

  if (guidelines.length === 0) {
    problems.push({ code: 'no-guidance-recorded' });
  }
  for (const guideline of guidelines) {
    if (guideline.statement.trim().length < GUIDANCE_STATEMENT_MIN_LENGTH) {
      problems.push({ code: 'statement-too-short' });
      break;
    }
  }
  // Claiming statutory force without saying where is how an office convention
  // quietly becomes "the law says so".
  for (const guideline of guidelines) {
    if (guideline.provenance === 'statute' && guideline.sourceUrl === null) {
      problems.push({ code: 'statute-without-source' });
      break;
    }
  }
  return problems;
}

export function guidelinesOfWeight(
  guidelines: readonly EligibilityGuideline[],
  weight: GuidanceWeight,
): readonly EligibilityGuideline[] {
  return guidelines.filter((guideline) => guideline.weight === weight);
}

/** Guidelines a worker should be able to see the grounds for. */
export function unverifiedGuidelines(
  guidelines: readonly EligibilityGuideline[],
): readonly EligibilityGuideline[] {
  return guidelines.filter((guideline) => guideline.verifiedOn === null);
}
