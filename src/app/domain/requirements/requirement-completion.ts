import type { RequirementStatus, SubmittedRequirement } from '../assistance/assistance-request';
import { awaitsApplicabilityDecision, isOutstandingObligation } from './requirement-obligation';

/**
 * How far along a request's paperwork is.
 *
 * The master command is explicit: show requirements completion at case level,
 * but **never equate 100% document completeness with automatic eligibility**.
 * That is the same doctrine as vulnerability factors (`DL-42`), the intake
 * advisory (`DL-60`) and eligibility guidance (`DL-66`), reaching its fourth
 * surface — and it is the surface where the temptation is strongest, because a
 * complete checklist *looks* like a green light.
 *
 * So this type carries counts and nothing else. There is deliberately no
 * `isComplete`, no `isEligible`, no `canApprove` and no percentage promoted to a
 * verdict. `check:documents` fails the build if a decision-shaped field appears
 * here or on any type in this module.
 */

export interface RequirementCompletion {
  /** Documents that apply to this applicant and are not yet settled. */
  readonly outstandingCount: number;
  /** Settled: verified or waived. */
  readonly settledCount: number;
  /** Conditional documents nobody has ruled on yet. Staff work, not applicant work. */
  readonly awaitingDecisionCount: number;
  /** Presented but not yet checked. */
  readonly awaitingVerificationCount: number;
  /** Expired, or rejected and needing another copy. */
  readonly needsReplacementCount: number;
  /** Applicable documents in total — the denominator a screen may show. */
  readonly applicableCount: number;
}

const SETTLED: readonly RequirementStatus[] = ['verified', 'waived'];
const NEEDS_REPLACEMENT: readonly RequirementStatus[] = ['rejected', 'expired', 'needs-replacement'];

export function summariseRequirements(
  requirements: readonly SubmittedRequirement[],
): RequirementCompletion {
  let outstandingCount = 0;
  let settledCount = 0;
  let awaitingDecisionCount = 0;
  let awaitingVerificationCount = 0;
  let needsReplacementCount = 0;
  let applicableCount = 0;

  for (const requirement of requirements) {
    if (awaitsApplicabilityDecision(requirement.obligation, requirement.applicability)) {
      awaitingDecisionCount += 1;
      continue;
    }
    if (!isOutstandingObligation(requirement.obligation, requirement.applicability)) {
      continue;
    }

    applicableCount += 1;

    if (SETTLED.includes(requirement.status)) {
      settledCount += 1;
      continue;
    }

    outstandingCount += 1;
    if (requirement.status === 'submitted') {
      awaitingVerificationCount += 1;
    }
    if (NEEDS_REPLACEMENT.includes(requirement.status)) {
      needsReplacementCount += 1;
    }
  }

  return {
    outstandingCount,
    settledCount,
    awaitingDecisionCount,
    awaitingVerificationCount,
    needsReplacementCount,
    applicableCount,
  };
}

/**
 * The sentence a screen puts beside the counts.
 *
 * Returned from the domain rather than written in a template because it is the
 * one place the boundary is stated, and a template is where such a sentence
 * quietly gets shortened to "Complete".
 */
export function describeCompletion(completion: RequirementCompletion): string {
  if (completion.applicableCount === 0 && completion.awaitingDecisionCount === 0) {
    return 'No documents are required for this request.';
  }
  if (completion.outstandingCount === 0 && completion.awaitingDecisionCount === 0) {
    return 'Every required document is settled. Eligibility is still a caseworker’s decision.';
  }
  return `${completion.settledCount} of ${completion.applicableCount} required documents settled.`;
}
