import type { AuditStamp } from '../shared/audit';
import type { IsoDate, ProgramId } from '../shared/ids';
import type { Money } from '../shared/money';
import type { StatusCatalog } from '../shared/status';
import type { VulnerabilitySector } from '../residents/resident';
import type { EligibilityGuideline } from './eligibility-guidance';
import type { ProgramResponsibility } from './program-responsibility';
import type { ReviewWindowPolicy } from './review-window';

/**
 * Programme families administered by the Municipal Social Welfare and
 * Development Office. `crisis-intervention` covers AICS (Assistance to
 * Individuals in Crisis Situation) intake.
 */
export type ProgramCategory =
  | 'crisis-intervention'
  | 'medical-assistance'
  | 'burial-assistance'
  | 'educational-assistance'
  | 'food-and-relief'
  | 'livelihood'
  | 'senior-citizen'
  | 'pwd'
  | 'solo-parent'
  | 'child-welfare'
  | 'women-welfare'
  | 'disaster-response';

export type ProgramStatus = 'draft' | 'active' | 'suspended' | 'closed';

export const PROGRAM_STATUS_CATALOG: StatusCatalog<ProgramStatus> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    tone: 'neutral',
    description: 'Being set up. Not accepting applications.',
  },
  active: {
    value: 'active',
    label: 'Active',
    tone: 'success',
    description: 'Open and accepting applications.',
  },
  suspended: {
    value: 'suspended',
    label: 'Suspended',
    tone: 'warning',
    description: 'Temporarily paused, usually pending funds.',
  },
  closed: {
    value: 'closed',
    label: 'Closed',
    tone: 'neutral',
    description: 'Ended. Retained for reporting only.',
  },
};

/** A document the applicant must produce, e.g. barangay indigency certificate. */
export interface ProgramRequirement {
  readonly code: string;
  readonly label: string;
  readonly isMandatory: boolean;
  readonly notes: string | null;
}

export interface ProgramEligibility {
  readonly minAge: number | null;
  readonly maxAge: number | null;
  readonly requiredSectors: readonly VulnerabilitySector[];
  readonly maxMonthlyHouseholdIncome: Money | null;
  readonly residencyMonthsRequired: number | null;
  readonly notes: string | null;
}

export interface AssistanceProgram {
  readonly id: ProgramId;
  readonly code: string;
  readonly name: string;
  readonly category: ProgramCategory;
  readonly status: ProgramStatus;
  readonly description: string;
  /** Statutory or issuance basis, e.g. `RA 11861` or a DSWD memorandum circular. */
  readonly legalBasis: string | null;
  readonly fundingSource: string;
  readonly maximumGrant: Money | null;
  readonly eligibility: ProgramEligibility;
  /**
   * Whose programme this is and what this office's part in it is (`DL-65`).
   *
   * Not optional. A programme in the catalog without a stated responsibility is
   * a programme the office is implicitly claiming, and `tools/check-programs.mjs`
   * fails the build if one appears.
   */
  readonly responsibility: ProgramResponsibility;
  /**
   * What the office looks for, as records rather than as code (`DL-66`).
   * Guidance a worker reads; never a gate the software closes.
   */
  readonly guidance: readonly EligibilityGuideline[];
  /** The shared document set this programme starts from, by code (`DL-67`). */
  readonly requirementTemplateCode: string | null;
  /** Documents this programme adds on top of its template. */
  readonly requirements: readonly ProgramRequirement[];
  /** Overrides the office default where this programme needs its own (`DL-68`). */
  readonly reviewWindow: ReviewWindowPolicy | null;
  readonly effectiveFrom: IsoDate;
  readonly effectiveTo: IsoDate | null;
  readonly audit: AuditStamp;
}

/** The editable half of a programme. Identity and audit are the store's. */
export interface ProgramDraft {
  readonly name: string;
  readonly category: ProgramCategory;
  readonly status: ProgramStatus;
  readonly description: string;
  readonly legalBasis: string | null;
  readonly fundingSource: string;
  readonly maximumGrant: Money | null;
  readonly eligibility: ProgramEligibility;
  readonly responsibility: ProgramResponsibility;
  readonly guidance: readonly EligibilityGuideline[];
  readonly requirementTemplateCode: string | null;
  readonly requirements: readonly ProgramRequirement[];
  readonly reviewWindow: ReviewWindowPolicy | null;
}

export function toProgramDraft(program: AssistanceProgram): ProgramDraft {
  return {
    name: program.name,
    category: program.category,
    status: program.status,
    description: program.description,
    legalBasis: program.legalBasis,
    fundingSource: program.fundingSource,
    maximumGrant: program.maximumGrant,
    eligibility: program.eligibility,
    responsibility: program.responsibility,
    guidance: program.guidance,
    requirementTemplateCode: program.requirementTemplateCode,
    requirements: program.requirements,
    reviewWindow: program.reviewWindow,
  };
}

export interface ProgramFilter {
  readonly search?: string;
  readonly category?: ProgramCategory;
  readonly status?: ProgramStatus;
}

export const PROGRAM_CATEGORY_LABELS: Readonly<Record<ProgramCategory, string>> = {
  'crisis-intervention': 'Crisis intervention (AICS)',
  'medical-assistance': 'Medical assistance',
  'burial-assistance': 'Burial assistance',
  'educational-assistance': 'Educational assistance',
  'food-and-relief': 'Food and relief',
  livelihood: 'Livelihood',
  'senior-citizen': 'Senior citizen',
  pwd: 'Persons with disability',
  'solo-parent': 'Solo parent',
  'child-welfare': 'Child welfare',
  'women-welfare': 'Women welfare',
  'disaster-response': 'Disaster response',
};
