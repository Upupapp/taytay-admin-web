import type { ResidentView } from '../residents/resident-disclosure';
import type { IsoDate, RequirementDocumentId, StaffUserId } from '../shared/ids';
import type { Referral } from './referral';

/**
 * What actually leaves the building.
 *
 * A referral summary is unlike every other screen in this application: it is
 * handed to **another organisation**. Once it is printed or sent, the MSWDO no
 * longer controls who reads it, and nothing can be taken back.
 *
 * So the summary is **computed, not laid out**. `composeReferralSummary` decides
 * which fields go, defaulting to the minimum the receiving office needs to
 * identify the person and act. Anything beyond that is opt-in, one field at a
 * time, each with a stated need — because "include everything, they can ignore
 * what they don't need" is how a survivor's address reaches a desk that had no
 * reason to hold it.
 *
 * This is the Data Privacy Act's minimisation and purpose-limitation duties
 * (RA 10173) expressed as a function rather than as a paragraph in a manual.
 */

/* ── The lawful basis ─────────────────────────────────────────────────────── */

/**
 * Why the office may share this person's information at all.
 *
 * Required before a referral can be sent (`DL-81`). Consent is the ordinary
 * case; the other two exist because insisting on written consent from somebody
 * unconscious in an emergency room, or from a child at risk, would be its own
 * kind of failure.
 */
export type DisclosureBasis = 'client-consent' | 'statutory-mandate' | 'vital-interest';

/** Every lawful basis, in the order a caseworker should consider them. */
export const DISCLOSURE_BASES: readonly DisclosureBasis[] = [
  'client-consent',
  'statutory-mandate',
  'vital-interest',
];

export const DISCLOSURE_BASIS_LABELS: Readonly<Record<DisclosureBasis, string>> = {
  'client-consent': 'The client agreed to the referral',
  'statutory-mandate': 'Required or authorised by law',
  'vital-interest': 'Urgent — life, health or safety at risk',
};

export const DISCLOSURE_BASIS_DESCRIPTIONS: Readonly<Record<DisclosureBasis, string>> = {
  'client-consent':
    'The client was told which office would receive their information, and what for, and agreed.',
  'statutory-mandate':
    'A statute or issuance requires this office to report or refer. Name it in the note.',
  'vital-interest':
    'Consent could not be obtained and delay would risk serious harm. Say what the risk was.',
};

export interface DisclosureAuthority {
  readonly basis: DisclosureBasis;
  /** What the client was told, or which law applies, or what the risk was. */
  readonly note: string;
  readonly recordedBy: StaffUserId;
  readonly recordedOn: IsoDate;
}

/* ── What may be shared ───────────────────────────────────────────────────── */

/**
 * Fields a referral summary can carry beyond the minimum.
 *
 * Named individually so each is a separate decision. A single "share full
 * profile" switch would be ticked once and forgotten.
 */
export type SharedField =
  | 'birth-date'
  | 'address'
  | 'contact-number'
  | 'household-composition'
  | 'income'
  | 'vulnerability-sectors'
  | 'assistance-history';

/** Every field that may be added beyond the minimum, each chosen individually (`DL-82`). */
export const SHARED_FIELDS: readonly SharedField[] = [
  'birth-date',
  'address',
  'contact-number',
  'household-composition',
  'income',
  'vulnerability-sectors',
  'assistance-history',
];

export const SHARED_FIELD_LABELS: Readonly<Record<SharedField, string>> = {
  'birth-date': 'Date of birth',
  address: 'Home address',
  'contact-number': 'Contact number',
  'household-composition': 'Who else is in the household',
  income: 'Household income',
  'vulnerability-sectors': 'Sector membership',
  'assistance-history': 'Previous assistance from this office',
};

/**
 * Sharing a sector membership can disclose that somebody is a VAWC survivor or
 * a child in conflict with the law. Flagged so the screen can ask twice and the
 * permission check can be tighter.
 */
export const SHARED_FIELDS_NEEDING_CARE: readonly SharedField[] = [
  'vulnerability-sectors',
  'address',
  'assistance-history',
];

export function needsExtraCare(field: SharedField): boolean {
  return SHARED_FIELDS_NEEDING_CARE.includes(field);
}

export interface SharedFieldChoice {
  readonly field: SharedField;
  /** Why the receiving office needs it. Required — an unexplained field is not shared. */
  readonly because: string;
}

/** One document the office chose to attach. Opt-in, one at a time (`DL-82`). */
export interface SharedAttachment {
  readonly documentId: RequirementDocumentId;
  readonly label: string;
  readonly because: string;
}

export interface DisclosurePlan {
  readonly authority: DisclosureAuthority;
  readonly extraFields: readonly SharedFieldChoice[];
  readonly attachments: readonly SharedAttachment[];
}

/* ── The composed sheet ───────────────────────────────────────────────────── */

export interface SummaryLine {
  readonly label: string;
  readonly value: string;
  /** True for anything beyond the minimum, so the sheet can mark it. */
  readonly isExtra: boolean;
}

/**
 * The printable summary. A flat list of lines, deliberately: a structure with
 * optional nested sections is a structure somebody eventually renders whole.
 */
export interface ReferralSummarySheet {
  readonly referenceNumber: string;
  readonly destinationName: string;
  readonly serviceRequested: string;
  readonly reason: string;
  readonly lines: readonly SummaryLine[];
  readonly attachmentLabels: readonly string[];
  /** Printed on the sheet so the receiving office knows the basis it holds it on. */
  readonly authorityStatement: string;
  /** Printed on the sheet. Not decoration — it states the purpose limitation. */
  readonly handlingNotice: string;
}

export const HANDLING_NOTICE =
  'Shared by the Municipal Social Welfare and Development Office of Taytay, Rizal for the ' +
  'purpose stated above only. It contains personal information protected under RA 10173. ' +
  'Do not forward it or use it for another purpose.';

export interface SummaryInput {
  readonly referral: Referral;
  /** Already redacted for the composing user (`DL-38`). */
  readonly client: ResidentView;
  readonly plan: DisclosurePlan;
  readonly serviceRequested: string;
}

/**
 * Builds the sheet.
 *
 * The minimum is the client's name, the reference number and the reason — enough
 * for the receiving office to know who is coming and why. Everything else is
 * present only because somebody chose it and said why.
 *
 * A withheld field is **omitted, not blanked**: a line reading "Address:
 * withheld" tells the reader there is an address worth hiding, which for a
 * protection case is itself the disclosure.
 */
export function composeReferralSummary(input: SummaryInput): ReferralSummarySheet {
  const { referral, client, plan } = input;

  const lines: SummaryLine[] = [
    { label: 'Client', value: client.fullName, isExtra: false },
    { label: 'Referred by', value: 'MSWDO Taytay, Rizal', isExtra: false },
  ];

  for (const choice of plan.extraFields) {
    const value = valueFor(choice.field, client);
    // A field chosen but not held is skipped rather than printed empty: an
    // empty line invites the receiving office to ask for it.
    if (value === null) {
      continue;
    }
    lines.push({ label: SHARED_FIELD_LABELS[choice.field], value, isExtra: true });
  }

  return {
    referenceNumber: referral.referenceNumber,
    destinationName: referral.destinationName,
    serviceRequested: input.serviceRequested,
    reason: referral.reason,
    lines,
    attachmentLabels: plan.attachments.map((attachment) => attachment.label),
    authorityStatement: DISCLOSURE_BASIS_LABELS[plan.authority.basis],
    handlingNotice: HANDLING_NOTICE,
  };
}

/**
 * Reads one field off the disclosed client record.
 *
 * Anything the composing user was not cleared to see is already absent from
 * `ResidentView`, so a summary cannot carry a field its author could not read
 * (`DL-38`). The redaction is not re-implemented here; it is inherited.
 */
function valueFor(field: SharedField, client: ResidentView): string | null {
  const resident = client.resident;
  switch (field) {
    case 'birth-date':
      return resident.birthDate;
    case 'address':
      return resident.address.streetAddress;
    case 'contact-number':
      return resident.contact.mobile;
    case 'vulnerability-sectors':
      return resident.sectors.length === 0 ? null : resident.sectors.join(', ');
    case 'income':
      return resident.monthlyIncome === null
        ? null
        : `PHP ${(resident.monthlyIncome.centavos / 100).toFixed(2)} per month`;
    // Both are assembled from other records and are supplied by the adapter,
    // which is why they are not read off the resident here. Returning null
    // keeps this function honest rather than inventing a value.
    case 'household-composition':
    case 'assistance-history':
      return null;
  }
}

/* ── Validation ───────────────────────────────────────────────────────────── */

export type DisclosureProblem =
  /**
   * No lawful basis has been recorded at all.
   *
   * Distinct from a basis whose note is missing: one is a referral nobody has authorised, the
   * other is one authorised without saying why. The first cannot be sent by anyone; the second is
   * a sentence away.
   */
  | 'authority-required'
  | 'authority-note-required'
  | 'field-needs-a-reason'
  | 'attachment-needs-a-reason'
  | 'duplicate-field';

export function disclosurePlanProblems(plan: DisclosurePlan): readonly DisclosureProblem[] {
  const problems: DisclosureProblem[] = [];

  if (plan.authority.note.trim().length === 0) {
    problems.push('authority-note-required');
  }
  if (plan.extraFields.some((choice) => choice.because.trim().length === 0)) {
    problems.push('field-needs-a-reason');
  }
  if (plan.attachments.some((attachment) => attachment.because.trim().length === 0)) {
    problems.push('attachment-needs-a-reason');
  }

  const fields = plan.extraFields.map((choice) => choice.field);
  if (new Set(fields).size !== fields.length) {
    problems.push('duplicate-field');
  }

  return problems;
}

export class DisclosurePlanInvalidError extends Error {
  readonly problems: readonly DisclosureProblem[];

  constructor(problems: readonly DisclosureProblem[]) {
    super('That referral needs correcting before it can be sent.');
    this.name = 'DisclosurePlanInvalidError';
    this.problems = problems;
  }
}

export function isDisclosurePlanInvalid(error: unknown): error is DisclosurePlanInvalidError {
  return error instanceof DisclosurePlanInvalidError;
}
