import type { StatusCatalog } from '../shared/status';

/**
 * What kind of data a record holds, in the terms the statute uses.
 *
 * RA 10173 does not treat all data alike. It distinguishes **personal
 * information** from **sensitive personal information**, and the second
 * carries stricter conditions for processing — which is why this application
 * has held `vawc-survivor` and `cicl` behind their own permission since TAB 07.
 *
 * Labelling is not decoration. An office that cannot say which of its screens
 * hold sensitive personal information cannot answer a data-protection officer,
 * cannot scope a breach, and cannot train anybody on what to be careful with.
 * So the classification is a **record**, attached to the record type, rendered
 * where the data is, and cited to the section it comes from.
 */

export type DataClassification =
  | 'public'
  | 'internal'
  | 'personal'
  | 'sensitive-personal';

export const CLASSIFICATION_CATALOG: StatusCatalog<DataClassification> = {
  public: {
    value: 'public',
    label: 'Public',
    tone: 'neutral',
    description: 'Published by the municipality. No restriction on sharing.',
  },
  internal: {
    value: 'internal',
    label: 'Internal',
    tone: 'info',
    description: 'Office working information about no identifiable person.',
  },
  personal: {
    value: 'personal',
    label: 'Personal information',
    tone: 'warning',
    description:
      'Identifies a living person. Processed only for a stated purpose, and shared only with a ' +
      'lawful basis.',
  },
  'sensitive-personal': {
    value: 'sensitive-personal',
    label: 'Sensitive personal information',
    tone: 'danger',
    description:
      'Health, offences, or the protection sectors. Processing is restricted, and disclosure ' +
      'outside the office needs a specific basis every time.',
  },
};

/**
 * The statutory basis for each label, cited so nobody has to take the office's
 * word for the distinction.
 *
 * **Written from established statute knowledge and not re-verified against an
 * online primary source in an offline run**, exactly as `CLAUDE.md` §6 requires
 * such citations to be marked.
 */
export const CLASSIFICATION_BASIS: Readonly<Record<DataClassification, string>> = {
  public: 'Not personal information under RA 10173 §3(g).',
  internal: 'Not personal information under RA 10173 §3(g); office working material.',
  personal: 'Personal information as defined by RA 10173 §3(g).',
  'sensitive-personal':
    'Sensitive personal information under RA 10173 §3(l) — includes health, and any proceeding ' +
    'for an offence. RA 9262 (VAWC) and RA 9344 (CICL) records fall here.',
};

/** What the office holds, by record type, so a label can be shown beside data. */
export interface ClassifiedRecordType {
  readonly key: string;
  readonly label: string;
  readonly classification: DataClassification;
  /** What the office actually keeps of this kind, in one sentence. */
  readonly holds: string;
}

export const CLASSIFIED_RECORD_TYPES: readonly ClassifiedRecordType[] = [
  {
    key: 'resident',
    label: 'Resident registry',
    classification: 'personal',
    holds: 'Name, birth date, address, contact, PhilSys last four, household membership.',
  },
  {
    key: 'resident-sector',
    label: 'Protection sectors',
    classification: 'sensitive-personal',
    holds: 'Whether a resident is recorded as a VAWC survivor or a child in conflict with the law.',
  },
  {
    key: 'household',
    label: 'Household record',
    classification: 'personal',
    holds: 'Address, members, and the vulnerability indicators read from them.',
  },
  {
    key: 'case-note',
    label: 'Case notes',
    classification: 'sensitive-personal',
    holds: 'What a worker recorded about a family, including protected notes.',
  },
  {
    key: 'assistance-request',
    label: 'Assistance requests',
    classification: 'personal',
    holds: 'Who asked for what, the assessment, and the decision.',
  },
  {
    key: 'document',
    label: 'Supporting documents',
    classification: 'sensitive-personal',
    holds: 'Scans an applicant presented, which routinely include medical abstracts.',
  },
  {
    key: 'release',
    label: 'Releases',
    classification: 'personal',
    holds: 'Who was paid what, when and where.',
  },
  {
    key: 'referral',
    label: 'Referrals',
    classification: 'sensitive-personal',
    holds: 'Why a client was sent to another office, and what was disclosed to them.',
  },
  {
    key: 'programme',
    label: 'Programme catalogue',
    classification: 'internal',
    holds: 'Eligibility guidance, requirements and responsibility. About no person.',
  },
  {
    key: 'audit',
    label: 'Audit trail',
    classification: 'personal',
    holds: 'Who accessed or changed which record, and when.',
  },
];

export function classificationOf(key: string): DataClassification | null {
  return CLASSIFIED_RECORD_TYPES.find((type) => type.key === key)?.classification ?? null;
}

export function isSensitive(classification: DataClassification): boolean {
  return classification === 'sensitive-personal';
}
