import type { AuditStamp } from '../shared/audit';
import type { IsoDateTime } from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';
import type { ProgramRequirement } from './program';

/**
 * Whether a template may still be adopted. `retired` is one way (`DL-177`): no new programme
 * adopts it, and a programme that already names it keeps asking for its documents until that
 * programme is changed — a request filed under it last month must still read the same.
 */
export type RequirementTemplateStatus = 'active' | 'retired';

export const REQUIREMENT_TEMPLATE_STATUS_CATALOG: StatusCatalog<RequirementTemplateStatus> = {
  active: {
    value: 'active',
    label: 'In use',
    tone: 'success',
    description: 'A programme may adopt it. A change reaches every programme naming it.',
  },
  retired: {
    value: 'retired',
    label: 'Retired',
    tone: 'neutral',
    description:
      'No new programme may adopt it. Programmes that already name it keep asking for its documents.',
  },
};

/** Retiring is the only move, and nothing brings a template back. */
export const REQUIREMENT_TEMPLATE_TRANSITIONS: StatusTransitions<RequirementTemplateStatus> = {
  active: ['retired'],
  retired: [],
};

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
  readonly status: RequirementTemplateStatus;
  readonly retiredAt: IsoDateTime | null;
  /**
   * Programmes not closed that name this template, counted when it was read. What a change
   * reaches, said before the change is made — never a stored tally that drifts from the catalogue.
   */
  readonly programCount: number;
  readonly audit: AuditStamp;
}

/**
 * What a person writes. The code is read only when the template is first recorded: it is the
 * name every programme points at, so it never changes and is never reused, retired or not.
 */
export interface RequirementTemplateDraft {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly requirements: readonly ProgramRequirement[];
}

export function toTemplateDraft(template: RequirementTemplate): RequirementTemplateDraft {
  return {
    code: template.code,
    name: template.name,
    description: template.description,
    requirements: template.requirements,
  };
}

/** Lower-case words and hyphens, as the server reads a template's code and a document's. */
export const CATALOGUE_CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,59}$/;
export const TEMPLATE_NAME_MIN_LENGTH = 3;
export const TEMPLATE_NAME_MAX_LENGTH = 120;
export const TEMPLATE_DESCRIPTION_MAX_LENGTH = 1000;
export const TEMPLATE_DOCUMENTS_MAX = 40;
/** The office keeps at most this many templates, retired ones included. */
export const TEMPLATE_CAP = 200;

/** Whether a programme may take this template up. One that already names it keeps it. */
export function isAdoptable(template: RequirementTemplate): boolean {
  return template.status === 'active';
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

/**
 * What can be wrong with a list of documents — a template's or a programme's own, read the same
 * way, as the server reads them. A conditional document states its circumstances in words, and
 * only a conditional one does (`DL-76`): circumstances on a required document would read as a
 * condition nobody is asked to rule on.
 */
export type RequirementListProblemCode =
  | 'duplicate-code'
  | 'label-too-short'
  | 'condition-without-circumstances'
  | 'circumstances-without-condition';

export interface RequirementListProblem {
  readonly code: RequirementListProblemCode;
}

const REQUIREMENT_LIST_PROBLEM_ORDER: readonly RequirementListProblemCode[] = [
  'duplicate-code',
  'label-too-short',
  'condition-without-circumstances',
  'circumstances-without-condition',
];

export function requirementListProblems(
  requirements: readonly ProgramRequirement[],
): readonly RequirementListProblem[] {
  const found = new Set<RequirementListProblemCode>();
  const codes = new Set<string>();
  for (const requirement of requirements) {
    if (codes.has(requirement.code)) {
      found.add('duplicate-code');
    }
    codes.add(requirement.code);
    if (requirement.label.trim().length < 3) {
      found.add('label-too-short');
    }
    const circumstances = (requirement.appliesWhen ?? '').trim() !== '';
    if (requirement.obligation === 'conditional' && !circumstances) {
      found.add('condition-without-circumstances');
    }
    if (requirement.obligation !== 'conditional' && circumstances) {
      found.add('circumstances-without-condition');
    }
  }
  return REQUIREMENT_LIST_PROBLEM_ORDER.filter((code) => found.has(code)).map((code) => ({ code }));
}

export type TemplateProblemCode = 'empty-template' | RequirementListProblemCode;

export interface TemplateProblem {
  readonly code: TemplateProblemCode;
}

/**
 * A template's documents are what every programme naming it asks an applicant for, so they are
 * held to no looser a rule than a programme's own.
 */
export function templateProblems(
  template: Pick<RequirementTemplate, 'requirements'>,
): readonly TemplateProblem[] {
  const problems: TemplateProblem[] = [];
  if (template.requirements.length === 0) {
    problems.push({ code: 'empty-template' });
  }
  return [...problems, ...requirementListProblems(template.requirements)];
}
