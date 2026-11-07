import type { IsoDateTime, IssuanceTypeId, OfficeId } from '../shared/ids';
import { parsePesos, type Money } from '../shared/money';

/**
 * A kind of document an office issues to residents — a certificate, a clearance — as the office
 * keeps it in its catalogue (`DL-184`). Code and wire say **issuance**: "document request" already
 * means the office asking an applicant for a document inside casework (`DL-178`).
 *
 * ## What it deliberately does not carry
 *
 * - **No payment.** `fee` is what the resident is told they will pay **at the office**; nothing here
 *   collects it, and no field could (`DL-09`).
 * - **No template, no signature.** The office prepares and signs the paper itself; the system tracks
 *   the request and says when and where to claim it.
 * - **No deadline.** `processingDays` is the office's own standard in **working** days, from its
 *   Citizen's Charter. This console holds no holiday calendar, so it never turns that standard into
 *   a date or a lateness (`DL-101`).
 */
export interface IssuanceType {
  readonly id: IssuanceTypeId;
  readonly office: IssuanceOfficeRef;
  readonly name: string;
  readonly description: string | null;
  /** In the order the resident is asked for them. */
  readonly requirements: readonly IssuanceRequirement[];
  /** Integer centavos, paid at the office. `null`: the office stated no fee. Zero: no fee. */
  readonly fee: Money | null;
  /** Working days. `null`: not stated. Zero: the same day. */
  readonly processingDays: number | null;
  readonly claimInstructions: string | null;
  /** False once retired — one-way: nothing brings a retired type back. */
  readonly active: boolean;
  readonly retiredAt: IsoDateTime | null;
  readonly updatedAt: IsoDateTime;
}

export interface IssuanceOfficeRef {
  readonly id: OfficeId;
  readonly name: string;
}

/**
 * One thing the resident sends with a request. `code` names the file's field in the residents'
 * app, so it is a key rather than a label: a request keeps the requirements it was filed with.
 */
export interface IssuanceRequirement {
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly hint: string | null;
}

/* ── the API's limits, read from the vendored spec (`IssuanceTypeCreate`) ── */

export const ISSUANCE_TYPE_LIMITS = {
  name: { minimum: 3, maximum: 120 },
  description: 2000,
  claimInstructions: 1000,
  requirements: 10,
  code: { minimum: 2, maximum: 40 },
  label: { minimum: 2, maximum: 120 },
  hint: 300,
  /** ₱1,000,000.00, in centavos. */
  fee: 100_000_000,
  processingDays: 365,
  reason: { minimum: 8, maximum: 500 },
} as const;

/** Lowercase letters and digits, joined by single `-` or `_` — as the API validates a code. */
export const REQUIREMENT_CODE_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/**
 * Field names the residents' app sends beside the files, so no requirement may take one — the API's
 * `RESERVED_FIELD_NAMES` (`src/modules/issuance/schemas.ts`), which refuses each of them. A
 * requirement coded `idempotency_key` would have its file read as the retry key and lost.
 */
export const RESERVED_REQUIREMENT_CODES: readonly string[] = [
  'type_id',
  'purpose',
  'note',
  'idempotency_key',
];

/**
 * A code suggested from a label — `Barangay clearance` → `barangay-clearance` — offered while the
 * code field has not been typed in. A suggestion: the office may write its own.
 */
export function suggestRequirementCode(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ISSUANCE_TYPE_LIMITS.code.maximum)
    .replace(/-+$/g, '');
}

/* ── the fee, typed in pesos and kept in centavos ─────────────────────────── */

/** What the fee field says: no fee stated, an amount, or something that is not an amount. */
export type FeeEntry =
  | { readonly kind: 'none' }
  | { readonly kind: 'amount'; readonly fee: Money }
  | { readonly kind: 'invalid' };

/**
 * The fee as typed — `50`, `1,250.50`, `₱ 75` — read into whole centavos by `parsePesos`, which
 * reads the pesos and the centavos as two integers and never multiplies a decimal (rule 6). An
 * empty field is "no fee stated", which the resident is told; a third decimal place is refused
 * rather than rounded, because a centavo cannot be split.
 */
export function readFeeEntry(text: string): FeeEntry {
  if (text.trim() === '') {
    return { kind: 'none' };
  }
  const fee = parsePesos(text);
  return fee === null ? { kind: 'invalid' } : { kind: 'amount', fee };
}

/**
 * A fee as the form shows it for editing — `1250.50` — written digit by digit from the integer
 * centavos, never divided. Empty for no fee stated.
 */
export function feeEntryText(fee: Money | null): string {
  if (fee === null) {
    return '';
  }
  const digits = String(Math.abs(Math.trunc(fee.centavos))).padStart(3, '0');
  return `${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/* ── writing the catalogue ──────────────────────────────────────────────── */

/** The catalogue form's fields, already read: the fee in centavos, the days as a whole number. */
export interface IssuanceTypeFields {
  readonly name: string;
  readonly description: string | null;
  readonly requirements: readonly IssuanceRequirement[];
  readonly fee: Money | null;
  readonly processingDays: number | null;
  readonly claimInstructions: string | null;
}

/** A new type. `officeId` is the administrator's choice; staff leave it `null` for their own. */
export interface IssuanceTypeDraft extends IssuanceTypeFields {
  readonly officeId: OfficeId | null;
  readonly reason: string;
}

/** Only the fields that moved, and why. The server records which fields moved, never their values. */
export interface IssuanceTypeChanges extends Partial<IssuanceTypeFields> {
  readonly reason: string;
}

/** The form as it stands, for comparing with the type it edits. */
export function fieldsOf(type: IssuanceType): IssuanceTypeFields {
  return {
    name: type.name,
    description: type.description,
    requirements: type.requirements,
    fee: type.fee,
    processingDays: type.processingDays,
    claimInstructions: type.claimInstructions,
  };
}

/**
 * The fields of `next` that differ from `current`, with the reason — or `null` when nothing moved,
 * so the screen can say so rather than send a change that changes nothing.
 */
export function issuanceTypeChanges(
  current: IssuanceTypeFields,
  next: IssuanceTypeFields,
  reason: string,
): IssuanceTypeChanges | null {
  const moved: { -readonly [K in keyof IssuanceTypeFields]?: IssuanceTypeFields[K] } = {};
  if (next.name !== current.name) moved.name = next.name;
  if (next.description !== current.description) moved.description = next.description;
  if (!sameRequirements(next.requirements, current.requirements)) {
    moved.requirements = next.requirements;
  }
  if ((next.fee?.centavos ?? null) !== (current.fee?.centavos ?? null)) moved.fee = next.fee;
  if (next.processingDays !== current.processingDays) moved.processingDays = next.processingDays;
  if (next.claimInstructions !== current.claimInstructions) {
    moved.claimInstructions = next.claimInstructions;
  }
  return Object.keys(moved).length === 0 ? null : { ...moved, reason };
}

function sameRequirements(
  a: readonly IssuanceRequirement[],
  b: readonly IssuanceRequirement[],
): boolean {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        item.code === other.code &&
        item.label === other.label &&
        item.required === other.required &&
        item.hint === other.hint
      );
    })
  );
}

/**
 * Why the API would refuse these fields, in words, before anything is sent. Empty when it would
 * not. The server checks all of it again (rule 4); this is so the office reads the sentence here
 * rather than a 422.
 */
export function issuanceTypeProblems(fields: IssuanceTypeFields): readonly string[] {
  const limits = ISSUANCE_TYPE_LIMITS;
  const problems: string[] = [];
  const name = fields.name.trim();
  if (name.length < limits.name.minimum || name.length > limits.name.maximum) {
    problems.push(`The name needs ${limits.name.minimum} to ${limits.name.maximum} characters.`);
  }
  if ((fields.description?.length ?? 0) > limits.description) {
    problems.push(`The description may be up to ${limits.description} characters.`);
  }
  if ((fields.claimInstructions?.length ?? 0) > limits.claimInstructions) {
    problems.push(`The claim instructions may be up to ${limits.claimInstructions} characters.`);
  }
  if (fields.fee !== null && (fields.fee.centavos < 0 || fields.fee.centavos > limits.fee)) {
    problems.push('The fee may be at most ₱1,000,000.00.');
  }
  if (
    fields.processingDays !== null &&
    (!Number.isInteger(fields.processingDays) ||
      fields.processingDays < 0 ||
      fields.processingDays > limits.processingDays)
  ) {
    problems.push(`The working days are a whole number from 0 to ${limits.processingDays}.`);
  }
  if (fields.requirements.length > limits.requirements) {
    problems.push(`A document asks for at most ${limits.requirements} things.`);
  }
  const seen = new Set<string>();
  fields.requirements.forEach((requirement, index) => {
    const which = `Requirement ${index + 1}`;
    const code = requirement.code;
    if (
      code.length < limits.code.minimum ||
      code.length > limits.code.maximum ||
      !REQUIREMENT_CODE_PATTERN.test(code)
    ) {
      problems.push(
        `${which}: the code is ${limits.code.minimum} to ${limits.code.maximum} lowercase letters ` +
          'or digits, joined by - or _.',
      );
    } else if (RESERVED_REQUIREMENT_CODES.includes(code)) {
      problems.push(`${which}: the code “${code}” is used by the app for something else.`);
    } else if (seen.has(code)) {
      problems.push(`${which}: the code “${code}” is used twice.`);
    }
    seen.add(code);
    const label = requirement.label.trim();
    if (label.length < limits.label.minimum || label.length > limits.label.maximum) {
      problems.push(
        `${which}: the label needs ${limits.label.minimum} to ${limits.label.maximum} characters.`,
      );
    }
    if ((requirement.hint?.length ?? 0) > limits.hint) {
      problems.push(`${which}: the hint may be up to ${limits.hint} characters.`);
    }
  });
  return problems;
}

/** Why a reason for a catalogue change would be refused, or `null`. */
export function catalogueReasonProblem(reason: string): string | null {
  const length = reason.trim().length;
  const { minimum, maximum } = ISSUANCE_TYPE_LIMITS.reason;
  return length < minimum || length > maximum
    ? `Say why in ${minimum} to ${maximum} characters. The reason is kept with the change.`
    : null;
}

/**
 * The office's own standard, in words — never a due date. Working days need a holiday calendar
 * this console does not hold, so the standard is shown beside the waiting time, not subtracted
 * from it (`DL-101`).
 */
export function describeProcessingStandard(days: number | null): string {
  if (days === null) {
    return 'Office standard: not stated';
  }
  if (days === 0) {
    return 'Office standard: the same day';
  }
  return days === 1 ? 'Office standard: 1 working day' : `Office standard: ${days} working days`;
}

/**
 * What retiring a type does, shown **before** the button (`DL-184`). Read from the backend at
 * `2fd0566` (`retireIssuanceType`): one-way, never deleted, filed requests continue.
 */
export const RETIRE_EFFECTS: readonly string[] = [
  'Residents can no longer choose this document in the app.',
  'Requests already filed continue, and keep the name, requirements, fee and working days they were filed with.',
  'The type is kept, never deleted. Your reason is kept with it.',
  'Retiring is one-way: nothing in this console or the API brings a retired type back. To offer it again, add it as a new type.',
];

/** What saving a change does, shown before the button. */
export const UPDATE_EFFECTS: readonly string[] = [
  'Residents see the change in the app’s catalogue from now on.',
  'Requests already filed keep the name, requirements, fee and working days they were filed with.',
  'The server records which fields moved and your reason, never the old or new values.',
];
