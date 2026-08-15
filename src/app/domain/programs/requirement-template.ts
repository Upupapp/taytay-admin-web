import type { AuditStamp } from '../shared/audit';
import type { ProgramRequirement } from './program';

/**
 * A named, reusable set of documents.
 *
 * Before this, every programme carried its own list and the same four AICS
 * documents were retyped for each one — which is how "Barangay certificate of
 * indigency" ends up spelled three ways and waived under two different names in
 * reporting. A template is the single place the office says what a standard
 * document set is, and a programme points at one (`DL-67`).
 *
 * A programme may still add documents of its own: the template is a starting
 * point, not a cage. What it guarantees is that the shared documents have one
 * code and one wording everywhere they appear.
 */
export interface RequirementTemplate {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly requirements: readonly ProgramRequirement[];
  readonly audit: AuditStamp;
}

/**
 * The documents a programme actually asks for: its template, plus anything it
 * adds, with the programme's own entry winning on a shared code.
 *
 * Resolved here rather than stored flattened, so that correcting a template
 * corrects every programme using it. A flattened copy would drift the moment
 * one programme was edited.
 */
export function resolveRequirements(
  template: RequirementTemplate | null,
  additions: readonly ProgramRequirement[],
): readonly ProgramRequirement[] {
  const byCode = new Map<string, ProgramRequirement>();
  for (const requirement of template?.requirements ?? []) {
    byCode.set(requirement.code, requirement);
  }
  for (const requirement of additions) {
    byCode.set(requirement.code, requirement);
  }
  return [...byCode.values()];
}

/** Which of a programme's documents came from the template, for the screen to say so. */
export function isFromTemplate(template: RequirementTemplate | null, code: string): boolean {
  return (template?.requirements ?? []).some((requirement) => requirement.code === code);
}

export type TemplateProblemCode = 'duplicate-code' | 'empty-template' | 'label-too-short';

export interface TemplateProblem {
  readonly code: TemplateProblemCode;
}

export function templateProblems(template: RequirementTemplate): readonly TemplateProblem[] {
  const problems: TemplateProblem[] = [];
  if (template.requirements.length === 0) {
    problems.push({ code: 'empty-template' });
  }

  const seen = new Set<string>();
  for (const requirement of template.requirements) {
    if (seen.has(requirement.code)) {
      problems.push({ code: 'duplicate-code' });
      break;
    }
    seen.add(requirement.code);
  }

  if (template.requirements.some((requirement) => requirement.label.trim().length < 3)) {
    problems.push({ code: 'label-too-short' });
  }
  return problems;
}
