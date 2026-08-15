import type { AssistanceRequest, SubmittedRequirement } from '../assistance/assistance-request';
import { outstandingRequirements } from '../assistance/assistance-request';
import type { Money } from '../shared/money';

/**
 * What a social worker writes after a case study.
 *
 * `recommendedAmount` is a **recommendation**, and the type says so: it is not
 * `approvedAmount`, it is not computed from anything, and nothing downstream
 * reads it as a decision. Approval is a separate act by a different role, which
 * is what keeps `DL-08` true — the worker who assessed does not also approve.
 */
export interface AssessmentDraft {
  readonly findings: string;
  readonly recommendedAmount: Money | null;
  readonly homeVisitConducted: boolean;
}

export const EMPTY_ASSESSMENT: AssessmentDraft = {
  findings: '',
  recommendedAmount: null,
  homeVisitConducted: false,
};

/**
 * Long enough to be a finding rather than a tick.
 *
 * A case study is the document an audit reads when it asks why public money
 * moved. "OK" recorded against a household is indistinguishable from nobody
 * having looked.
 */
export const FINDINGS_MIN_LENGTH = 20;

export function isValidFindings(findings: string): boolean {
  return findings.trim().length >= FINDINGS_MIN_LENGTH;
}

export function toAssessmentDraft(request: AssistanceRequest): AssessmentDraft {
  const existing = request.assessment;
  return existing === null
    ? EMPTY_ASSESSMENT
    : {
        findings: existing.findings,
        recommendedAmount: existing.recommendedAmount,
        homeVisitConducted: existing.homeVisitConducted,
      };
}

/* ── Readiness ─────────────────────────────────────────────────────────────── */

export type AssessmentReadinessCode =
  'no-assessment' | 'findings-too-short' | 'outstanding-requirements' | 'no-home-visit';

/**
 * What is not yet done, stated so the screen can show it — **and nothing more**.
 *
 * Deliberately not a gate. Every one of these is a legitimate state to endorse
 * from: a home visit is impossible for a household that has been relocated, and
 * a requirement can be waived. The screen shows the list; the permission and
 * the recorded reason decide whether the move happens. Software that refused
 * the endorsement here would be denying an applicant on a checklist, which is
 * exactly what TAB 11's third criterion forbids (`DL-60`).
 */
export function assessmentReadiness(
  request: AssistanceRequest,
): readonly AssessmentReadinessCode[] {
  const codes: AssessmentReadinessCode[] = [];
  const assessment = request.assessment;

  if (assessment === null) {
    codes.push('no-assessment');
  } else {
    if (!isValidFindings(assessment.findings)) {
      codes.push('findings-too-short');
    }
    if (!assessment.homeVisitConducted) {
      codes.push('no-home-visit');
    }
  }
  if (outstandingRequirements(request).length > 0) {
    codes.push('outstanding-requirements');
  }
  return codes;
}

export function verifiedCount(requirements: readonly SubmittedRequirement[]): number {
  return requirements.filter(
    (requirement) => requirement.status === 'verified' || requirement.status === 'waived',
  ).length;
}
