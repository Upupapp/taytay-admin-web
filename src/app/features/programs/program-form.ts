import { describeFailure, isApiFailure } from '@core/http/api-failure';
import {
  asIsoDate,
  CATALOGUE_CODE_PATTERN,
  parsePesos,
  type EligibilityGuideline,
  type IsoDate,
  type Money,
  type ProgramCategory,
  type ProgramDraft,
  type ProgramRequirement,
  type ProgramResponsibility,
  type ProgramStatus,
  type ReviewWindowPolicy,
  type VulnerabilitySector,
  type WindowProvenance,
} from '@domain/index';

/**
 * What the new-programme form holds while somebody types (`DL-177`).
 *
 * Numbers and amounts are kept **as typed** and read only when the draft is composed: a field
 * that turned "1,5" into 15 while somebody was still typing would record a figure nobody wrote.
 * Everything else is the draft's own shape, so the domain's rules read it as they read a record.
 */
export interface ProgramFormValue {
  readonly name: string;
  readonly category: ProgramCategory;
  readonly status: ProgramStatus;
  readonly description: string;
  readonly legalBasis: string;
  readonly fundingSource: string;
  /** Pesos, as typed — read into centavos by `parsePesos`, never through a float. */
  readonly maximumGrant: string;
  readonly minAge: string;
  readonly maxAge: string;
  readonly requiredSectors: readonly VulnerabilitySector[];
  readonly incomeCeiling: string;
  readonly residencyMonths: string;
  readonly eligibilityNotes: string;
  readonly responsibility: ProgramResponsibility;
  readonly guidance: readonly EligibilityGuideline[];
  readonly requirementTemplateCode: string | null;
  readonly requirements: readonly ProgramRequirement[];
  /** `false`: the office default applies, and the record says so by holding none. */
  readonly ownWindow: boolean;
  readonly lookbackMonths: string;
  readonly sameProgrammeDays: string;
  readonly windowProvenance: WindowProvenance;
  readonly windowBasis: string;
  readonly windowConfirmedOn: string;
}

/** What the form itself refuses, before the domain's rules are asked anything. */
export type ProgramFieldProblem =
  | 'name-missing'
  | 'funding-missing'
  | 'grant-unreadable'
  | 'age-unreadable'
  | 'ages-reversed'
  | 'income-unreadable'
  | 'residency-unreadable'
  | 'window-unreadable'
  | 'source-incomplete'
  | 'document-code-unreadable';

export interface ProgramFormReading {
  readonly draft: ProgramDraft;
  readonly fieldProblems: readonly ProgramFieldProblem[];
}

/**
 * An empty form. The municipality's own programme is the starting point because it is the only
 * responsibility that needs no source; choosing a national agency takes "runs it" off the list.
 */
export function emptyProgramForm(): ProgramFormValue {
  return {
    name: '',
    category: 'crisis-intervention',
    status: 'draft',
    description: '',
    legalBasis: '',
    fundingSource: '',
    maximumGrant: '',
    minAge: '',
    maxAge: '',
    requiredSectors: [],
    incomeCeiling: '',
    residencyMonths: '',
    eligibilityNotes: '',
    responsibility: {
      administeredBy: 'lgu-taytay',
      fundsHeldBy: 'lgu-taytay',
      lguRole: 'owner',
      statement: '',
      sources: [],
    },
    guidance: [],
    requirementTemplateCode: null,
    requirements: [],
    ownWindow: false,
    lookbackMonths: '',
    sameProgrammeDays: '',
    windowProvenance: 'convention-pending-confirmation',
    windowBasis: '',
    windowConfirmedOn: '',
  };
}

export function blankGuideline(): EligibilityGuideline {
  return {
    code: 'other',
    weight: 'expected',
    statement: '',
    provenance: 'office-convention',
    basis: '',
    sourceUrl: null,
    verifiedOn: null,
  };
}

export function blankRequirement(): ProgramRequirement {
  return { code: '', label: '', obligation: 'required', appliesWhen: null, notes: null };
}

/** Composes the draft the form describes, and says what in it could not be read. */
export function readProgramForm(form: ProgramFormValue): ProgramFormReading {
  const problems = new Set<ProgramFieldProblem>();

  if (form.name.trim() === '') {
    problems.add('name-missing');
  }
  if (form.fundingSource.trim() === '') {
    problems.add('funding-missing');
  }

  const maximumGrant = amountOf(form.maximumGrant);
  if (maximumGrant === undefined) {
    problems.add('grant-unreadable');
  }
  const minAge = wholeNumberOf(form.minAge, 130);
  const maxAge = wholeNumberOf(form.maxAge, 130);
  if (minAge === undefined || maxAge === undefined) {
    problems.add('age-unreadable');
  } else if (minAge !== null && maxAge !== null && minAge > maxAge) {
    problems.add('ages-reversed');
  }
  const income = amountOf(form.incomeCeiling);
  if (income === undefined) {
    problems.add('income-unreadable');
  }
  const residency = wholeNumberOf(form.residencyMonths, 1200);
  if (residency === undefined) {
    problems.add('residency-unreadable');
  }

  let reviewWindow: ReviewWindowPolicy | null = null;
  if (form.ownWindow) {
    const lookbackMonths = wholeNumberOf(form.lookbackMonths, 1200);
    const sameProgrammeDays = wholeNumberOf(form.sameProgrammeDays, 36500);
    if (
      lookbackMonths === undefined ||
      lookbackMonths === null ||
      sameProgrammeDays === undefined ||
      sameProgrammeDays === null
    ) {
      problems.add('window-unreadable');
    }
    reviewWindow = {
      lookbackMonths: lookbackMonths ?? 0,
      sameProgrammeDays: sameProgrammeDays ?? 0,
      provenance: form.windowProvenance,
      basis: textOrNull(form.windowBasis),
      confirmedOn: readDateInput(form.windowConfirmedOn),
    };
  }

  if (
    form.responsibility.sources.some(
      (source) => source.title.trim() === '' || source.url.trim() === '',
    )
  ) {
    problems.add('source-incomplete');
  }
  if (form.requirements.some((requirement) => !CATALOGUE_CODE_PATTERN.test(requirement.code))) {
    problems.add('document-code-unreadable');
  }

  const draft: ProgramDraft = {
    name: form.name.trim(),
    category: form.category,
    status: form.status,
    description: form.description.trim(),
    legalBasis: textOrNull(form.legalBasis),
    fundingSource: form.fundingSource.trim(),
    maximumGrant: maximumGrant ?? null,
    eligibility: {
      minAge: minAge ?? null,
      maxAge: maxAge ?? null,
      requiredSectors: form.requiredSectors,
      maxMonthlyHouseholdIncome: income ?? null,
      residencyMonthsRequired: residency ?? null,
      notes: textOrNull(form.eligibilityNotes),
    },
    responsibility: {
      ...form.responsibility,
      statement: form.responsibility.statement.trim(),
      sources: form.responsibility.sources.map((source) => ({
        title: source.title.trim(),
        url: source.url.trim(),
        verifiedOn: source.verifiedOn,
      })),
    },
    guidance: form.guidance.map((guideline) => ({
      ...guideline,
      statement: guideline.statement.trim(),
      basis: guideline.basis.trim(),
      sourceUrl: textOrNull(guideline.sourceUrl ?? ''),
    })),
    requirementTemplateCode: form.requirementTemplateCode,
    requirements: form.requirements.map((requirement) => ({
      code: requirement.code.trim(),
      label: requirement.label.trim(),
      obligation: requirement.obligation,
      // Circumstances belong to a conditional document only (`DL-76`); a stale sentence left in
      // the box after the obligation changed is not sent.
      appliesWhen:
        requirement.obligation === 'conditional' ? textOrNull(requirement.appliesWhen ?? '') : null,
      notes: textOrNull(requirement.notes ?? ''),
    })),
    reviewWindow,
  };

  return { draft, fieldProblems: [...problems] };
}

/**
 * The server's refusal in its own words (`DL-176`, `DL-177`): each sentence it sent, or its
 * message when it sent none. A sentence written about a rule is not re-worded here.
 */
export function refusalSentences(failure: unknown, fallback: string): readonly string[] {
  if (isApiFailure(failure)) {
    const sentences = Object.values(failure.details ?? {}).flat();
    return sentences.length > 0 ? sentences : [describeFailure(failure)];
  }
  return [failure instanceof Error ? failure.message : fallback];
}

/** `null` for nothing typed, `undefined` for something that is not an amount. */
function amountOf(text: string): Money | null | undefined {
  return text.trim() === '' ? null : (parsePesos(text) ?? undefined);
}

/** `null` for nothing typed, `undefined` for something that is not a whole number in range. */
function wholeNumberOf(text: string, maximum: number): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+$/.test(trimmed)) {
    return undefined;
  }
  const value = Number.parseInt(trimmed, 10);
  return value <= maximum ? value : undefined;
}

function textOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

export function readDateInput(text: string): IsoDate | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? asIsoDate(text) : null;
}
