import type { IsoDate } from '../shared/ids';

/**
 * Who actually runs a programme, and what this office's part in it is.
 *
 * TAB 12's third acceptance criterion is that **national and LGU programme
 * responsibilities are not misrepresented**. That is not a matter of wording on
 * a screen; it is a field on the record, because the wording is generated from
 * it (`DL-65`).
 *
 * The failure this prevents is concrete and was already present in the seed
 * before this TAB: AICS was described as funded by the "Municipal social welfare
 * fund". It is not. AICS is a DSWD programme with DSWD-disbursed funds, and an
 * LGU refers into it. Telling an applicant otherwise sets an expectation the
 * office cannot meet, and claims a national programme as municipal work.
 */
export type AdministeringAgency =
  'dswd' | 'doh' | 'deped' | 'dole' | 'other-national' | 'lgu-taytay';

export const ADMINISTERING_AGENCIES: readonly AdministeringAgency[] = [
  'dswd',
  'doh',
  'deped',
  'dole',
  'other-national',
  'lgu-taytay',
];

export function isNationalAgency(agency: AdministeringAgency): boolean {
  return agency !== 'lgu-taytay';
}

/**
 * What the MSWDO does for this programme.
 *
 * `owner` means the municipality decides and pays. `referrer` means it takes the
 * application and passes it to the agency that decides. `augmenter` means it
 * adds municipal funds to a national grant. `facilitator` means it helps the
 * resident apply and holds no funds at all.
 *
 * Only one of these may be claimed alongside a national administering agency,
 * and it is not `owner` — see `responsibilityProblems`.
 */
export type LguRole = 'owner' | 'augmenter' | 'referrer' | 'facilitator';

export const LGU_ROLES: readonly LguRole[] = ['owner', 'augmenter', 'referrer', 'facilitator'];

/**
 * Where a statement about responsibility came from.
 *
 * `verifiedOn` is `null` when the citation was recorded from a supplied
 * reference rather than retrieved and read. The distinction is kept because
 * `CLAUDE.md` §6 requires it: a citation nobody checked is labelled as such
 * rather than presented as checked.
 */
export interface ResponsibilitySource {
  readonly title: string;
  readonly url: string;
  readonly verifiedOn: IsoDate | null;
}

export interface ProgramResponsibility {
  /** The agency whose programme this is. */
  readonly administeredBy: AdministeringAgency;
  /** Who releases the money. Often the same agency; deliberately separate. */
  readonly fundsHeldBy: AdministeringAgency;
  readonly lguRole: LguRole;
  /**
   * What the office may honestly tell an applicant, in one sentence.
   *
   * Held as data rather than composed in a template so that a correction is a
   * change to the record, not a hunt through components (`DL-66`).
   */
  readonly statement: string;
  readonly sources: readonly ResponsibilitySource[];
}

/* ── The rule that makes the criterion enforceable ─────────────────────────── */

export type ResponsibilityProblemCode =
  | 'national-programme-claimed-as-owned'
  | 'lgu-role-without-statement'
  | 'claim-without-source'
  | 'funds-claimed-without-holding';

export interface ResponsibilityProblem {
  readonly code: ResponsibilityProblemCode;
}

/**
 * Refuses a responsibility record that would misrepresent the office.
 *
 * Pure, so the adapter, a screen and the build checker all apply the same rule.
 * `tools/check-programs.mjs` runs it over every seeded programme, and the
 * repository runs it on every write, so a misdescribed programme cannot be
 * saved and cannot ship.
 */
export function responsibilityProblems(
  responsibility: ProgramResponsibility,
): readonly ResponsibilityProblem[] {
  const problems: ResponsibilityProblem[] = [];

  // The load-bearing one. A DSWD programme is not the municipality's to own,
  // however much municipal work goes into it.
  if (isNationalAgency(responsibility.administeredBy) && responsibility.lguRole === 'owner') {
    problems.push({ code: 'national-programme-claimed-as-owned' });
  }

  // Claiming to add municipal money while the money is held elsewhere is the
  // same misrepresentation from the other direction.
  if (
    responsibility.lguRole === 'augmenter' &&
    responsibility.fundsHeldBy !== 'lgu-taytay' &&
    responsibility.administeredBy !== 'lgu-taytay'
  ) {
    problems.push({ code: 'funds-claimed-without-holding' });
  }

  if (responsibility.statement.trim().length < STATEMENT_MIN_LENGTH) {
    problems.push({ code: 'lgu-role-without-statement' });
  }

  // A claim about another agency's programme needs somewhere it came from.
  if (isNationalAgency(responsibility.administeredBy) && responsibility.sources.length === 0) {
    problems.push({ code: 'claim-without-source' });
  }

  return problems;
}

export const STATEMENT_MIN_LENGTH = 20;

export function isResponsibilityValid(responsibility: ProgramResponsibility): boolean {
  return responsibilityProblems(responsibility).length === 0;
}

/** True when the office should not imply it decides the outcome. */
export function decidesElsewhere(responsibility: ProgramResponsibility): boolean {
  return responsibility.lguRole === 'referrer' || responsibility.lguRole === 'facilitator';
}
