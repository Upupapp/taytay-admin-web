import { TAYTAY_BARANGAYS, type BarangayId, type FamilyFilter } from '@domain/index';

/**
 * The URL is the filter here too (`DL-36`).
 *
 * There is no page and no sort in it: the API orders families by reference number and pages by
 * cursor, and a cursor is where a reading stopped, not an address somebody could share (`DL-161`).
 */
export interface FamilyQuery {
  readonly filter: FamilyFilter;
}

export interface ParamReader {
  get(name: string): string | null;
}

export function readFamilyFilter(params: ParamReader): FamilyFilter {
  const filter: {
    search?: string;
    barangayId?: BarangayId;
    unhousedOnly?: boolean;
    includeDissolved?: boolean;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((candidate) => candidate.id === barangay)) {
    filter.barangayId = barangay as BarangayId;
  }

  if (params.get('unhoused') === 'true') {
    filter.unhousedOnly = true;
  }
  if (params.get('dissolved') === 'true') {
    filter.includeDissolved = true;
  }

  return filter;
}

export function readFamilyQuery(params: ParamReader): FamilyQuery {
  return { filter: readFamilyFilter(params) };
}

export function familyFilterParams(filter: FamilyFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.search) {
    params['q'] = filter.search;
  }
  if (filter.barangayId) {
    params['barangay'] = filter.barangayId;
  }
  if (filter.unhousedOnly) {
    params['unhoused'] = 'true';
  }
  if (filter.includeDissolved) {
    params['dissolved'] = 'true';
  }
  return params;
}
