import {
  ADMINISTERING_AGENCIES,
  centavos,
  GUIDANCE_CODES,
  GUIDANCE_PROVENANCES,
  GUIDANCE_WEIGHTS,
  LGU_ROLES,
  PROGRAM_CATEGORY_LABELS,
  PROGRAM_STATUS_CATALOG,
  REQUIREMENT_OBLIGATIONS,
  REQUIREMENT_TEMPLATE_STATUS_CATALOG,
  VULNERABILITY_SECTORS,
  WINDOW_PROVENANCES,
  type AssistanceProgram,
  type EligibilityGuideline,
  type IsoDate,
  type Money,
  type ProgramCategory,
  type ProgramDraft,
  type ProgramEligibility,
  type ProgramId,
  type ProgramRequirement,
  type ProgramResponsibility,
  type ProgramStatus,
  type RequirementTemplate,
  type RequirementTemplateDraft,
  type RequirementTemplateStatus,
  type ResponsibilitySource,
  type ReviewWindowPolicy,
  type StaffUserId,
  type VulnerabilitySector,
} from '@domain/index';

import { date, dateTime, field, id, int, oneOf, str } from './wire';

const CATEGORIES = Object.keys(PROGRAM_CATEGORY_LABELS) as readonly ProgramCategory[];
const STATUSES = Object.keys(PROGRAM_STATUS_CATALOG) as readonly ProgramStatus[];
const TEMPLATE_STATUSES = Object.keys(
  REQUIREMENT_TEMPLATE_STATUS_CATALOG,
) as readonly RequirementTemplateStatus[];

/**
 * Programmes on the wire (`OfficeProgram`, casework phase 1d, `DL-176`).
 *
 * | wire                        | domain                    | if absent or unknown              |
 * | --------------------------- | ------------------------- | --------------------------------- |
 * | `id`, `code`, `name`        | the same                  | the programme is not readable     |
 * | `category`, `status`        | the same                  | the programme is not readable     |
 * | `description`               | `description`             | empty                             |
 * | `legal_basis`               | `legalBasis`              | `null`                            |
 * | `funding_source`            | `fundingSource`           | the programme is not readable     |
 * | `maximum_grant_centavos`    | `maximumGrant` (`Money`)  | `null`; a fraction is not money   |
 * | `eligibility`               | `eligibility`             | the programme is not readable     |
 * | `responsibility`            | `responsibility`          | the programme is not readable     |
 * | `guidance`                  | `guidance`                | the programme is not readable     |
 * | `requirement_template_code` | `requirementTemplateCode` | `null`                            |
 * | `requirements`              | `requirements`            | the programme is not readable     |
 * | `review_window`             | `reviewWindow`            | `null` — the office default       |
 * | `effective_from`/`_to`      | `effectiveFrom`/`To`      | not readable / `null`             |
 * | `created_*`, `updated_*`    | `audit`                   | the programme is not readable     |
 *
 * **Whose programme it is decides what an applicant is told** (`DL-65`), so a responsibility record
 * that cannot be read refuses the programme rather than defaulting a field: defaulted, a DSWD
 * programme could be shown as the municipality's. The same holds for one unreadable guideline or
 * document — dropped, the list would show a programme asking for less than it does.
 *
 * This mapper discloses nothing and withholds nothing: the catalogue holds no personal data.
 *
 * @consumes GET office/programs
 * @consumes GET office/programs/{id}
 * @consumes POST office/programs
 * @consumes PATCH office/programs/{id}
 */
export function toAssistanceProgram(wire: unknown): AssistanceProgram | null {
  const programId = id<ProgramId>(field(wire, 'id'));
  const code = str(field(wire, 'code'));
  const name = str(field(wire, 'name'));
  const category = oneOf<ProgramCategory>(field(wire, 'category'), CATEGORIES);
  const status = oneOf<ProgramStatus>(field(wire, 'status'), STATUSES);
  const fundingSource = str(field(wire, 'funding_source'));
  const eligibility = toEligibility(field(wire, 'eligibility'));
  const responsibility = toResponsibility(field(wire, 'responsibility'));
  const guidance = every(field(wire, 'guidance'), toGuideline);
  const requirements = every(field(wire, 'requirements'), toRequirement);
  const reviewWindowWire = field(wire, 'review_window');
  const reviewWindow = reviewWindowWire === null ? null : toReviewWindow(reviewWindowWire);
  const effectiveFrom = date(field(wire, 'effective_from'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const createdBy = id<StaffUserId>(field(wire, 'created_by'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  const updatedBy = id<StaffUserId>(field(wire, 'updated_by'));

  if (
    programId === null ||
    code === null ||
    name === null ||
    category === null ||
    status === null ||
    fundingSource === null ||
    eligibility === null ||
    responsibility === null ||
    guidance === null ||
    requirements === null ||
    reviewWindow === undefined ||
    effectiveFrom === null ||
    createdAt === null ||
    createdBy === null ||
    updatedAt === null ||
    updatedBy === null
  ) {
    return null;
  }

  return {
    id: programId,
    code,
    name,
    category,
    status,
    description: str(field(wire, 'description')) ?? '',
    legalBasis: str(field(wire, 'legal_basis')),
    fundingSource,
    maximumGrant: moneyOf(field(wire, 'maximum_grant_centavos')),
    eligibility,
    responsibility,
    guidance,
    requirementTemplateCode: str(field(wire, 'requirement_template_code')),
    requirements,
    reviewWindow,
    effectiveFrom,
    effectiveTo: date(field(wire, 'effective_to')),
    audit: { createdAt, createdBy, updatedAt, updatedBy },
  };
}

/**
 * A document set (`OfficeRequirementTemplate`, `DL-177`).
 *
 * | wire                       | domain         | if absent or unknown                          |
 * | -------------------------- | -------------- | --------------------------------------------- |
 * | `code`, `name`             | the same       | the template is not readable                  |
 * | `requirements`             | the same       | the template is not readable                  |
 * | `status`                   | `status`       | the template is not readable                  |
 * | `retired_at`               | `retiredAt`    | `null`                                        |
 * | `program_count`            | `programCount` | the template is not readable — never a zero   |
 * | `created_by`, `updated_by` | `audit`        | `null`: rows written before templates had one |
 *
 * A count that cannot be read refuses the template rather than default to zero: the editor states
 * it before a change as how many programmes the change reaches, and a zero would say none.
 * Likewise a status: defaulted to active, a retired template would be offered for adoption.
 *
 * @consumes GET office/programs/{id}/requirement-templates
 * @consumes GET office/requirement-templates
 * @consumes POST office/requirement-templates
 * @consumes PATCH office/requirement-templates/{code}
 * @consumes POST office/requirement-templates/{code}/retire
 */
export function toRequirementTemplate(wire: unknown): RequirementTemplate | null {
  const code = str(field(wire, 'code'));
  const name = str(field(wire, 'name'));
  const requirements = every(field(wire, 'requirements'), toRequirement);
  const status = oneOf<RequirementTemplateStatus>(field(wire, 'status'), TEMPLATE_STATUSES);
  const programCount = int(field(wire, 'program_count'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  if (
    code === null ||
    name === null ||
    requirements === null ||
    status === null ||
    programCount === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  return {
    code,
    name,
    description: str(field(wire, 'description')) ?? '',
    requirements,
    status,
    retiredAt: dateTime(field(wire, 'retired_at')),
    programCount,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };
}

/** Every item read, or `null` when the value is not a list or any item could not be. */
function every<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: T[] = [];
  for (const item of value) {
    const parsed = read(item);
    if (parsed === null) {
      return null;
    }
    items.push(parsed);
  }
  return items;
}

/** Integer centavos or nothing. A fraction is refused rather than rounded into somebody's grant. */
function moneyOf(value: unknown): Money | null {
  const amount = int(value);
  return amount === null ? null : centavos(amount);
}

/** A nullable integer: `undefined` when present but not an integer, so the record is refused. */
function nullableInt(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return int(value) ?? undefined;
}

function toEligibility(wire: unknown): ProgramEligibility | null {
  const minAge = nullableInt(field(wire, 'min_age'));
  const maxAge = nullableInt(field(wire, 'max_age'));
  const residency = nullableInt(field(wire, 'residency_months_required'));
  const income = field(wire, 'max_monthly_household_income_centavos');
  const sectors = every(field(wire, 'required_sectors'), (item) =>
    oneOf<VulnerabilitySector>(item, VULNERABILITY_SECTORS),
  );
  if (minAge === undefined || maxAge === undefined || residency === undefined || sectors === null) {
    return null;
  }
  if (income !== null && int(income) === null) {
    return null;
  }
  return {
    minAge,
    maxAge,
    requiredSectors: sectors,
    maxMonthlyHouseholdIncome: moneyOf(income),
    residencyMonthsRequired: residency,
    notes: str(field(wire, 'notes')),
  };
}

function toResponsibility(wire: unknown): ProgramResponsibility | null {
  const administeredBy = oneOf(field(wire, 'administered_by'), ADMINISTERING_AGENCIES);
  const fundsHeldBy = oneOf(field(wire, 'funds_held_by'), ADMINISTERING_AGENCIES);
  const lguRole = oneOf(field(wire, 'lgu_role'), LGU_ROLES);
  const statement = str(field(wire, 'statement'));
  const sources = every(field(wire, 'sources'), toSource);
  if (
    administeredBy === null ||
    fundsHeldBy === null ||
    lguRole === null ||
    statement === null ||
    sources === null
  ) {
    return null;
  }
  return { administeredBy, fundsHeldBy, lguRole, statement, sources };
}

function toSource(wire: unknown): ResponsibilitySource | null {
  const title = str(field(wire, 'title'));
  const url = str(field(wire, 'url'));
  return title === null || url === null
    ? null
    : { title, url, verifiedOn: date(field(wire, 'verified_on')) };
}

function toGuideline(wire: unknown): EligibilityGuideline | null {
  const code = oneOf(field(wire, 'code'), GUIDANCE_CODES);
  const weight = oneOf(field(wire, 'weight'), GUIDANCE_WEIGHTS);
  const statement = str(field(wire, 'statement'));
  const provenance = oneOf(field(wire, 'provenance'), GUIDANCE_PROVENANCES);
  const basis = str(field(wire, 'basis'));
  if (
    code === null ||
    weight === null ||
    statement === null ||
    provenance === null ||
    basis === null
  ) {
    return null;
  }
  return {
    code,
    weight,
    statement,
    provenance,
    basis,
    sourceUrl: str(field(wire, 'source_url')),
    verifiedOn: date(field(wire, 'verified_on')),
  };
}

function toRequirement(wire: unknown): ProgramRequirement | null {
  const code = str(field(wire, 'code'));
  const label = str(field(wire, 'label'));
  const obligation = oneOf(field(wire, 'obligation'), REQUIREMENT_OBLIGATIONS);
  const appliesWhen = str(field(wire, 'applies_when'));
  // A conditional document without its circumstances could only be shown as required or as
  // optional, and either would be the console deciding what the office left to a person (`DL-76`).
  if (
    code === null ||
    label === null ||
    obligation === null ||
    (obligation === 'conditional' && appliesWhen === null)
  ) {
    return null;
  }
  return { code, label, obligation, appliesWhen, notes: str(field(wire, 'notes')) };
}

/** `undefined` when present and unreadable, so the programme is refused rather than defaulted. */
function toReviewWindow(wire: unknown): ReviewWindowPolicy | undefined {
  const lookbackMonths = int(field(wire, 'lookback_months'));
  const sameProgrammeDays = int(field(wire, 'same_programme_days'));
  const provenance = oneOf(field(wire, 'provenance'), WINDOW_PROVENANCES);
  if (lookbackMonths === null || sameProgrammeDays === null || provenance === null) {
    return undefined;
  }
  return {
    lookbackMonths,
    sameProgrammeDays,
    provenance,
    basis: str(field(wire, 'basis')),
    confirmedOn: date(field(wire, 'confirmed_on')),
  };
}

/* ── writing ──────────────────────────────────────────────────────────────── */

/**
 * What `POST office/programs` and `PATCH office/programs/{id}` read (`OfficeProgramWrite`), and
 * nothing else: the body is strict. The whole draft every time — the console's `save` holds the
 * whole record — so the server checks its rules against exactly what the form showed.
 *
 * No `code`: the office's reference is issued by the server. A `reason`, always: the server keeps
 * it beside the version it explains, and refuses a write without one (`DL-177`).
 */
export interface ProgramDraftWire {
  readonly name: string;
  readonly category: ProgramCategory;
  readonly status: ProgramStatus;
  readonly description: string;
  readonly legal_basis: string | null;
  readonly funding_source: string;
  readonly maximum_grant_centavos: number | null;
  readonly eligibility: {
    readonly min_age: number | null;
    readonly max_age: number | null;
    readonly required_sectors: readonly VulnerabilitySector[];
    readonly max_monthly_household_income_centavos: number | null;
    readonly residency_months_required: number | null;
    readonly notes: string | null;
  };
  readonly responsibility: {
    readonly administered_by: ProgramResponsibility['administeredBy'];
    readonly funds_held_by: ProgramResponsibility['fundsHeldBy'];
    readonly lgu_role: ProgramResponsibility['lguRole'];
    readonly statement: string;
    readonly sources: readonly {
      readonly title: string;
      readonly url: string;
      readonly verified_on: IsoDate | null;
    }[];
  };
  readonly guidance: readonly {
    readonly code: EligibilityGuideline['code'];
    readonly weight: EligibilityGuideline['weight'];
    readonly statement: string;
    readonly provenance: EligibilityGuideline['provenance'];
    readonly basis: string;
    readonly source_url: string | null;
    readonly verified_on: IsoDate | null;
  }[];
  readonly requirement_template_code: string | null;
  readonly requirements: readonly {
    readonly code: string;
    readonly label: string;
    readonly obligation: ProgramRequirement['obligation'];
    readonly applies_when: string | null;
    readonly notes: string | null;
  }[];
  readonly review_window: {
    readonly lookback_months: number;
    readonly same_programme_days: number;
    readonly provenance: ReviewWindowPolicy['provenance'];
    readonly basis: string | null;
    readonly confirmed_on: IsoDate | null;
  } | null;
  readonly reason: string;
}

/** Empty optional text is sent as `null`: the API refuses an empty string where it allows none. */
function orNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export function toWireProgramDraft(draft: ProgramDraft, reason: string): ProgramDraftWire {
  const window = draft.reviewWindow;
  return {
    name: draft.name.trim(),
    category: draft.category,
    status: draft.status,
    description: draft.description.trim(),
    legal_basis: orNull(draft.legalBasis),
    funding_source: draft.fundingSource.trim(),
    maximum_grant_centavos: draft.maximumGrant === null ? null : draft.maximumGrant.centavos,
    eligibility: {
      min_age: draft.eligibility.minAge,
      max_age: draft.eligibility.maxAge,
      required_sectors: [...draft.eligibility.requiredSectors],
      max_monthly_household_income_centavos:
        draft.eligibility.maxMonthlyHouseholdIncome === null
          ? null
          : draft.eligibility.maxMonthlyHouseholdIncome.centavos,
      residency_months_required: draft.eligibility.residencyMonthsRequired,
      notes: orNull(draft.eligibility.notes),
    },
    responsibility: {
      administered_by: draft.responsibility.administeredBy,
      funds_held_by: draft.responsibility.fundsHeldBy,
      lgu_role: draft.responsibility.lguRole,
      statement: draft.responsibility.statement.trim(),
      sources: draft.responsibility.sources.map((source) => ({
        title: source.title,
        url: source.url,
        verified_on: source.verifiedOn,
      })),
    },
    guidance: draft.guidance.map((guideline) => ({
      code: guideline.code,
      weight: guideline.weight,
      statement: guideline.statement,
      provenance: guideline.provenance,
      basis: guideline.basis,
      source_url: guideline.sourceUrl,
      verified_on: guideline.verifiedOn,
    })),
    requirement_template_code: draft.requirementTemplateCode,
    requirements: draft.requirements.map(toWireRequirement),
    review_window:
      window === null
        ? null
        : {
            lookback_months: window.lookbackMonths,
            same_programme_days: window.sameProgrammeDays,
            provenance: window.provenance,
            basis: window.basis,
            confirmed_on: window.confirmedOn,
          },
    reason: reason.trim(),
  };
}

/** A document as `OfficeProgramRequirement` reads it, for a programme's own and a template's. */
interface RequirementWire {
  readonly code: string;
  readonly label: string;
  readonly obligation: ProgramRequirement['obligation'];
  readonly applies_when: string | null;
  readonly notes: string | null;
}

function toWireRequirement(requirement: ProgramRequirement): RequirementWire {
  return {
    code: requirement.code.trim(),
    label: requirement.label.trim(),
    obligation: requirement.obligation,
    applies_when: orNull(requirement.appliesWhen),
    notes: orNull(requirement.notes),
  };
}

/**
 * What `POST office/requirement-templates` reads (`OfficeRequirementTemplateWrite`): the code a
 * new template is known by from now on, its documents, and why it was recorded.
 */
export interface RequirementTemplateWriteWire {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly requirements: readonly RequirementWire[];
  readonly reason: string;
}

export function toWireRequirementTemplate(
  draft: RequirementTemplateDraft,
  reason: string,
): RequirementTemplateWriteWire {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    requirements: draft.requirements.map(toWireRequirement),
    reason: reason.trim(),
  };
}

/**
 * What `PATCH office/requirement-templates/{code}` reads (`OfficeRequirementTemplatePatch`). No
 * `code` — it never changes — and the documents whole, because the server replaces them whole:
 * the list the form showed is the list every programme naming the template asks for afterwards.
 */
export interface RequirementTemplatePatchWire {
  readonly name: string;
  readonly description: string;
  readonly requirements: readonly RequirementWire[];
  readonly reason: string;
}

export function toWireRequirementTemplatePatch(
  draft: RequirementTemplateDraft,
  reason: string,
): RequirementTemplatePatchWire {
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    requirements: draft.requirements.map(toWireRequirement),
    reason: reason.trim(),
  };
}
