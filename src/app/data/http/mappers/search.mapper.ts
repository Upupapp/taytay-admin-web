import {
  ASSISTANCE_STATUS_CATALOG,
  CASE_STATUS_CATALOG,
  PROGRAM_STATUS_CATALOG,
  SEARCH_ENTITY_LABELS,
  SEARCH_ENTITY_ORDER,
  barangayName,
  type SearchEntityType,
  type SearchGroup,
  type SearchHit,
  type SearchResults,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { field, int, oneOf, str } from './wire';

/**
 * Global search, from the Node API (`DL-189`).
 *
 * | Wire                                            | Domain                         | Absent or wrong means      |
 * | ----------------------------------------------- | ------------------------------ | -------------------------- |
 * | `term`                                          | `term`, echoed                 | the answer refused         |
 * | `groups[]{type,total,hits[]}`                   | `SearchGroup`, a zero dropped  | the answer refused         |
 * | `hits[]{id,title,reference,barangay_id,status}` | `SearchHit`                    | the answer refused         |
 * | `not_searched[]{type,why}`                      | `withheldTypes`                | the answer refused         |
 *
 * **The whole answer or none of it.** A group or a hit that cannot be read is not dropped: a
 * search that quietly loses its cases says "no cases matched", which is the wrong answer delivered
 * with confidence (`DL-112`). For the same reason every one of the six types must be accounted for —
 * searched, or named as not searched — or the answer is refused.
 *
 * **A hit carries what it shows and nothing else** (`DL-109`). The mapper reads the five fields the
 * server sends and no others: there is no snippet to read, and nothing here would render one.
 */

/** Where "see all" goes, carrying the term into that list's own search filter. */
const SEE_ALL_LINKS: Readonly<Record<SearchEntityType, readonly string[]>> = {
  resident: ['/residents'],
  household: ['/households'],
  family: ['/families'],
  case: ['/cases'],
  'assistance-request': ['/assistance-requests'],
  program: ['/programs'],
};

/** A resident's status on the wire, in the words the mock adapter and the registry use. */
const RESIDENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  active: 'Active',
  inactive: 'Inactive',
};

/** The status label from the type's own catalog; `null` for a value the console does not know. */
function statusLabel(type: SearchEntityType, status: string | null): string | null {
  if (status === null) {
    return null;
  }
  switch (type) {
    case 'resident':
      return RESIDENT_STATUS_LABELS[status] ?? null;
    case 'assistance-request': {
      const value = oneOf(
        status,
        Object.keys(ASSISTANCE_STATUS_CATALOG) as (keyof typeof ASSISTANCE_STATUS_CATALOG)[],
      );
      return value === null ? null : ASSISTANCE_STATUS_CATALOG[value].label;
    }
    case 'case': {
      const value = oneOf(
        status,
        Object.keys(CASE_STATUS_CATALOG) as (keyof typeof CASE_STATUS_CATALOG)[],
      );
      return value === null ? null : CASE_STATUS_CATALOG[value].label;
    }
    case 'program': {
      const value = oneOf(
        status,
        Object.keys(PROGRAM_STATUS_CATALOG) as (keyof typeof PROGRAM_STATUS_CATALOG)[],
      );
      return value === null ? null : PROGRAM_STATUS_CATALOG[value].label;
    }
    case 'household':
    case 'family':
      return null;
  }
}

function toHit(type: SearchEntityType, wire: unknown, barangays: BarangayIndex): SearchHit | null {
  const id = str(field(wire, 'id'));
  const title = str(field(wire, 'title'));
  if (id === null || title === null) {
    return null;
  }
  if (title.trim() === '') {
    return null;
  }
  const reference = str(field(wire, 'reference'));
  const barangay = barangays.toConsole(str(field(wire, 'barangay_id')));
  return {
    key: `${type}:${id}`,
    type,
    title,
    reference,
    // A barangay the console does not know is left unnamed rather than placed somewhere else.
    barangayLabel: barangay === null ? null : barangayName(barangay),
    statusLabel: statusLabel(type, str(field(wire, 'status'))),
    routerLink: [SEE_ALL_LINKS[type][0] ?? '/', id],
  };
}

function toGroup(wire: unknown, term: string, barangays: BarangayIndex): SearchGroup | null {
  const type = oneOf(field(wire, 'type'), SEARCH_ENTITY_ORDER);
  const total = int(field(wire, 'total'));
  const rawHits = field(wire, 'hits');
  if (type === null || total === null) {
    return null;
  }
  if (total < 0 || !Array.isArray(rawHits)) {
    return null;
  }
  const hits: SearchHit[] = [];
  for (const raw of rawHits) {
    const hit = toHit(type, raw, barangays);
    if (hit === null) {
      return null;
    }
    hits.push(hit);
  }
  if (hits.length > total) {
    return null;
  }
  return {
    type,
    label: SEARCH_ENTITY_LABELS[type],
    hits,
    total,
    isTruncated: total > hits.length,
    seeAllLink: SEE_ALL_LINKS[type],
    seeAllParams: { search: term },
  };
}

/**
 * `GET office/search?q=` → `SearchResults`, or `null` when any part of it cannot be read.
 *
 * @consumes GET office/search
 */
export function toSearchResults(wire: unknown, barangays: BarangayIndex): SearchResults | null {
  const term = str(field(wire, 'term'));
  const rawGroups = field(wire, 'groups');
  const rawNotSearched = field(wire, 'not_searched');
  if (term === null) {
    return null;
  }
  if (!Array.isArray(rawGroups) || !Array.isArray(rawNotSearched)) {
    return null;
  }

  const searched: SearchGroup[] = [];
  for (const raw of rawGroups) {
    const group = toGroup(raw, term, barangays);
    if (group === null) {
      return null;
    }
    searched.push(group);
  }

  const withheld: SearchEntityType[] = [];
  for (const raw of rawNotSearched) {
    const type = oneOf(field(raw, 'type'), SEARCH_ENTITY_ORDER);
    // Not searched for want of the key, or because a caseload is not given the registry's search
    // (`DL-183`): either way the account does not cover the type, and the screen says which.
    const why = oneOf(field(raw, 'why'), ['not-permitted', 'caseload'] as const);
    if (type === null || why === null) {
      return null;
    }
    withheld.push(type);
  }

  // Every type answered for exactly once: searched, or named as not searched.
  const accounted = [...searched.map((group) => group.type), ...withheld];
  if (
    accounted.length !== SEARCH_ENTITY_ORDER.length ||
    SEARCH_ENTITY_ORDER.some((type) => !accounted.includes(type))
  ) {
    return null;
  }

  const order = (type: SearchEntityType): number => SEARCH_ENTITY_ORDER.indexOf(type);
  // A type searched with nothing found is not a group on screen, as the mock adapter answers it.
  const groups = searched
    .filter((group) => group.total > 0)
    .sort((a, b) => order(a.type) - order(b.type));
  return {
    term,
    groups,
    total: groups.reduce((sum, group) => sum + group.total, 0),
    withheldTypes: [...withheld].sort((a, b) => order(a) - order(b)),
  };
}
