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
/**
 * What the assessor recommends — **advisory, and the vocabulary says so**.
 *
 * Every value is a verb about what somebody *suggests*, never a state a case reaches. Completing an
 * assessment moves a case to `endorsed` at most; approval is a separate act by a different role,
 * which is what keeps `DL-08` true.
 *
 * The console had no field for this at all, and that was the gap rather than a principled absence:
 * a recommendation *is* the output of a case study, and the API requires one to complete an
 * assessment. Leaving it out meant a social worker could write findings that reached nobody.
 */
export type AssessmentRecommendation =
  | 'recommend-approve'
  | 'recommend-deny'
  | 'recommend-refer'
  | 'insufficient-information';

export const ASSESSMENT_RECOMMENDATIONS: readonly AssessmentRecommendation[] = [
  'recommend-approve',
  'recommend-deny',
  'recommend-refer',
  'insufficient-information',
];

/**
 * Worded as recommendations, never as outcomes.
 *
 * "Approve" on a button is what turns professional judgement into a commitment of public money
 * nobody with approval authority ever made. The labels say *recommend* every time.
 */
export const ASSESSMENT_RECOMMENDATION_LABELS: Readonly<
  Record<AssessmentRecommendation, string>
> = {
  'recommend-approve': 'Recommend approval',
  'recommend-deny': 'Recommend refusal',
  'recommend-refer': 'Recommend referral elsewhere',
  'insufficient-information': 'Not enough information to recommend',
};

export interface AssessmentDraft {
  readonly findings: string;
  readonly recommendedAmount: Money | null;
  readonly homeVisitConducted: boolean;
  /** What the assessor advises. The head decides; this never does. */
  readonly recommendation: AssessmentRecommendation;
  /**
   * Why this recommendation. **Required when recommending refusal**, and only then.
   *
   * The server enforces it and gives the reason: the applicant will be told a decision followed
   * from this, and "the assessor recommended refusal" with no stated basis is not something
   * anybody can appeal or a supervisor can review. It is deliberately *not* required for the
   * other three — a reason demanded on every recommendation becomes a sentence typed to get past
   * the form, and the one place it must mean something is the one place it would then not.
   */
  readonly reason: string | null;
}

export const EMPTY_ASSESSMENT: AssessmentDraft = {
  findings: '',
  recommendedAmount: null,
  homeVisitConducted: false,
  /*
   * The honest default: nothing has been assessed yet, so nothing is recommended. Defaulting to
   * `recommend-approve` would put a recommendation on a form nobody has filled in.
   */
  recommendation: 'insufficient-information',
  reason: null,
};

/**
 * What stops this assessment being completed, in words.
 *
 * `assessmentProblems` returns sentences, not a boolean and not a score. The screen disables the
 * button and shows them; the server checks the same things again inside its own transaction, which
 * is where the guarantee lives (`DL-140`'s lesson). This exists so an assessor learns what is
 * missing *before* writing findings that a failed save would strand.
 */
export function assessmentProblems(draft: AssessmentDraft): readonly string[] {
  const problems: string[] = [];

  if (draft.recommendation === 'recommend-deny' && (draft.reason ?? '').trim() === '') {
    problems.push(
      'A recommendation to refuse needs a stated reason. The applicant will be told a decision ' +
        'followed from this, and a refusal nobody can explain is one nobody can appeal.',
    );
  }

  return problems;
}

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
        // A recorded assessment that predates this field reads as "not enough information",
        // which is truthful: nobody was ever asked.
        recommendation: existing.recommendation ?? 'insufficient-information',
        reason: existing.recommendationReason,
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
