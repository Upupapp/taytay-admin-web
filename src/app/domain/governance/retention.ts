import type { DataClassification } from './data-classification';

/**
 * Retention and disposal — **placeholders, and honest about it**.
 *
 * The master command asks for "retention/purge policy placeholders for future
 * backend integration". The word placeholder is doing real work there, and this
 * file refuses to quietly upgrade it.
 *
 * No retention schedule was supplied by the municipality. The National Archives
 * of the Philippines Act (RA 9470) requires a government agency to have a
 * records disposition schedule approved by the NAP, and the MSWDO will have one
 * — but this application was not given it, and the periods differ by record
 * series in ways nobody can guess.
 *
 * So every entry here carries `provenance: 'awaiting-office-policy'` and a
 * `period` of `null`. The screen shows the record type, its classification, and
 * the words "no schedule recorded" — not a number.
 *
 * This is the same refusal as `DL-89` (no invented accounting), `DL-101` (no
 * invented service standard) and `DL-105` (a threshold marked unconfirmed). An
 * invented retention period is worse than all three: an office that believes it
 * may delete after five years, and does, cannot undo it (`DL-113`).
 */

export type RetentionProvenance =
  /** Supplied by the office, with an approved disposition schedule behind it. */
  | 'office-policy'
  /** Nothing was supplied. Nothing may be inferred. */
  | 'awaiting-office-policy';

export interface RetentionRule {
  readonly recordTypeKey: string;
  readonly label: string;
  readonly classification: DataClassification;
  /**
   * How long the office keeps it. **`null` means no schedule is recorded**, and
   * must never be rendered as zero, as "indefinite", or as a default.
   */
  readonly periodInYears: number | null;
  readonly provenance: RetentionProvenance;
  /** The issuance the period comes from. `null` while none has been supplied. */
  readonly basis: string | null;
  /** What the office intends to happen at the end of the period. */
  readonly disposalNote: string | null;
}

/**
 * Every record type, with nothing filled in.
 *
 * Deliberately not a partial list: showing three of ten types with schedules
 * would imply the other seven need none.
 */
export const RETENTION_RULES: readonly RetentionRule[] = [
  'resident',
  'resident-sector',
  'household',
  'case-note',
  'assistance-request',
  'document',
  'release',
  'referral',
  'programme',
  'audit',
].map((key) => ({
  recordTypeKey: key,
  label: key,
  classification: 'personal' as DataClassification,
  periodInYears: null,
  provenance: 'awaiting-office-policy' as const,
  basis: null,
  disposalNote: null,
}));

export const RETENTION_NOTICE =
  'No records disposition schedule has been supplied to this application. Nothing here deletes ' +
  'anything, and no period below is a recommendation. The MSWDO’s schedule, approved under RA ' +
  '9470, is what governs how long each record series is kept.';

export const RETENTION_UNSET_DISPLAY = 'No schedule recorded';

export function describeRetention(rule: RetentionRule): string {
  if (rule.periodInYears === null || rule.provenance === 'awaiting-office-policy') {
    return RETENTION_UNSET_DISPLAY;
  }
  const years = rule.periodInYears;
  return years === 1 ? 'Kept for 1 year' : `Kept for ${years} years`;
}

/**
 * Whether the office still owes somebody a schedule for this record type.
 *
 * Rendered on the governance screen, on the same reasoning as
 * `awaitsConfirmation` for the intake review windows (`DL-68`): a gap nobody is
 * reminded about becomes permanent.
 */
export function awaitsPolicy(rule: RetentionRule): boolean {
  return rule.provenance === 'awaiting-office-policy';
}

export function rulesAwaitingPolicy(rules: readonly RetentionRule[]): number {
  return rules.filter(awaitsPolicy).length;
}
