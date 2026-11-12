import {
  RESIDENT_AGE_GROUPS,
  SEXES,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTORS,
  type BarangayId,
  type ResidentAgeGroup,
  type ResidentFilter,
  type Sex,
  type VulnerabilitySector,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`).
 *
 * Everything that decides which residents the list is showing — search,
 * barangay, sector, age band — is readable from the address bar, which is what
 * makes a saved view a link, a drill-down from the dashboard land on the right
 * rows, and the back button behave. Nothing about the query is held privately in
 * the component.
 *
 * There is no page or sort here since `DL-174`: the registry is read a cursor
 * page at a time in the server's own order, and a cursor is a position in one
 * reading, not an address anybody could return to.
 *
 * Malformed parameters degrade to *no filter* rather than throwing or guessing.
 * A page showing everything is recoverable; a page silently showing the wrong
 * subset is not.
 */
export interface ResidentQuery {
  readonly filter: ResidentFilter;
}

export interface ParamReader {
  get(name: string): string | null;
}

export function readResidentFilter(params: ParamReader): ResidentFilter {
  const filter: {
    search?: string;
    barangayId?: BarangayId;
    sector?: VulnerabilitySector;
    ageGroup?: ResidentAgeGroup;
    sex?: Sex;
    includeInactive?: boolean;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((candidate) => candidate.id === barangay)) {
    filter.barangayId = barangay as BarangayId;
  }

  const sector = params.get('sector');
  if (sector && (VULNERABILITY_SECTORS as readonly string[]).includes(sector)) {
    filter.sector = sector as VulnerabilitySector;
  }

  const ageGroup = params.get('ageGroup');
  if (ageGroup && (RESIDENT_AGE_GROUPS as readonly string[]).includes(ageGroup)) {
    filter.ageGroup = ageGroup as ResidentAgeGroup;
  }

  const sex = SEXES.find((candidate) => candidate === params.get('sex'));
  if (sex !== undefined) {
    filter.sex = sex;
  }

  if (params.get('inactive') === 'true') {
    filter.includeInactive = true;
  }

  return filter;
}

export function readResidentQuery(params: ParamReader): ResidentQuery {
  return { filter: readResidentFilter(params) };
}

/**
 * The filter as bare query params — what a saved view stores and what a chip
 * navigates to: "seniors in San Juan" is a population, not a scroll position.
 */
export function residentFilterParams(filter: ResidentFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.search) {
    params['q'] = filter.search;
  }
  if (filter.barangayId) {
    params['barangay'] = filter.barangayId;
  }
  if (filter.sector) {
    params['sector'] = filter.sector;
  }
  if (filter.ageGroup) {
    params['ageGroup'] = filter.ageGroup;
  }
  if (filter.sex) {
    params['sex'] = filter.sex;
  }
  if (filter.includeInactive) {
    params['inactive'] = 'true';
  }
  return params;
}
