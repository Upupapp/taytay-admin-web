import type { Permission } from '../access/permission';

/**
 * What global search may return, and — more importantly — what it may not.
 *
 * Search is the widest surface in this application. It crosses six record types,
 * it is reached from every screen, and a mistake here leaks in a way no single
 * feature can: one query, six modules, every barangay.
 *
 * So a hit has a **fixed, closed shape**. There is no `snippet: string` and no
 * `matchedText` — nothing that can carry a sentence somebody wrote about a
 * family. Every field on `SearchHit` is drawn from the same small set of
 * attributes an office already puts on a list row: who or what it is, its
 * reference, its barangay, its status.
 */

export type SearchEntityType =
  | 'resident'
  | 'household'
  | 'family'
  | 'case'
  | 'assistance-request'
  | 'program';

export const SEARCH_ENTITY_LABELS: Readonly<Record<SearchEntityType, string>> = {
  resident: 'Residents',
  household: 'Households',
  family: 'Families',
  case: 'Cases',
  'assistance-request': 'Assistance requests',
  program: 'Programmes',
};

/** Singular, for the count sentence under each group. */
export const SEARCH_ENTITY_SINGULAR: Readonly<Record<SearchEntityType, string>> = {
  resident: 'resident',
  household: 'household',
  family: 'family',
  case: 'case',
  'assistance-request': 'assistance request',
  program: 'programme',
};

/**
 * What each type costs to see at all.
 *
 * Applied per group rather than to search as a whole: a disbursement officer
 * searching a name should find the resident and the request behind a payout,
 * and find no case file, because they hold no case access (`DL-08`).
 */
export const SEARCH_ENTITY_PERMISSIONS: Readonly<Record<SearchEntityType, Permission>> = {
  resident: 'resident.view',
  household: 'household.view',
  family: 'family.view',
  case: 'case.view',
  'assistance-request': 'request.view',
  program: 'program.view',
};

export const SEARCH_ENTITY_ORDER: readonly SearchEntityType[] = [
  'resident',
  'assistance-request',
  'case',
  'household',
  'family',
  'program',
];

/**
 * One result.
 *
 * Every field is a **safe snippet**: a name already disclosed for the reading
 * user (`DL-38`), a reference number, a barangay, a status label. There is
 * deliberately no free-text field of any kind — see `search-safety.ts` for why
 * that absence is enforced rather than merely intended.
 */
export interface SearchHit {
  /** `type:id`, composed. The hit is a view of a record, not a record. */
  readonly key: string;
  readonly type: SearchEntityType;
  /** The disclosed display name or title. Never a raw record field. */
  readonly title: string;
  /** Control number, case reference, household code. Safe to show on a list. */
  readonly reference: string | null;
  readonly barangayLabel: string | null;
  /** The domain status label, from the catalog. Never an invented sentence. */
  readonly statusLabel: string | null;
  routerLink: readonly string[];
}

export interface SearchGroup {
  readonly type: SearchEntityType;
  readonly label: string;
  readonly hits: readonly SearchHit[];
  /** How many matched in total, which may exceed what is listed. */
  readonly total: number;
  /** True when `hits` is a page of a longer list, so the screen can say so. */
  readonly isTruncated: boolean;
  /** Where to see all of them, with the term carried through. */
  readonly seeAllLink: readonly string[];
  readonly seeAllParams: Readonly<Record<string, string>>;
}

export interface SearchResults {
  /** Echoed back, so a screen cannot show results beside a different term. */
  readonly term: string;
  readonly groups: readonly SearchGroup[];
  readonly total: number;
  /**
   * Types this account cannot search at all.
   *
   * Reported rather than silently omitted: "no cases matched" and "you cannot
   * see cases" are different answers, and a user who is not told the difference
   * concludes the record does not exist.
   */
  readonly withheldTypes: readonly SearchEntityType[];
}

/** How many hits a group shows before offering the full list. */
export const HITS_PER_GROUP = 5;

/**
 * Short queries are refused rather than run.
 *
 * Two characters against a municipal registry returns most of it, which is not
 * a search — it is a directory dump with a filter box on top, and it puts far
 * more on screen than the question asked for.
 */
export const MIN_SEARCH_LENGTH = 2;

export function isSearchable(term: string): boolean {
  return term.trim().length >= MIN_SEARCH_LENGTH;
}

export function totalHits(groups: readonly SearchGroup[]): number {
  return groups.reduce((sum, group) => sum + group.total, 0);
}

/**
 * What the results amount to, in counts.
 *
 * Counts rather than a verdict, the same rule as a payout session (`DL-90`) and
 * a work queue: "3 residents, 1 case" is a sentence somebody can act on, and it
 * is also what a screen reader announces before the list itself.
 */
export function describeResults(results: SearchResults): string {
  if (results.total === 0) {
    return 'Nothing matched.';
  }
  const parts = results.groups
    .filter((group) => group.total > 0)
    .map((group) => {
      const noun =
        group.total === 1
          ? SEARCH_ENTITY_SINGULAR[group.type]
          : SEARCH_ENTITY_LABELS[group.type].toLowerCase();
      return `${group.total} ${noun}`;
    });
  return `${parts.join(', ')}.`;
}

/**
 * The sentence shown when a type was not searched.
 *
 * Names the types rather than saying "some results are hidden", because a user
 * who cannot tell *which* record type they are missing cannot ask the right
 * person for access.
 */
export function describeWithheld(results: SearchResults): string | null {
  if (results.withheldTypes.length === 0) {
    return null;
  }
  const names = results.withheldTypes.map((type) => SEARCH_ENTITY_LABELS[type].toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Your account does not cover ${list}, so those were not searched.`;
}
