import {
  DEFAULT_PAGE_SIZE,
  RESIDENT_AGE_GROUPS,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTORS,
  type BarangayId,
  type PageRequest,
  type ResidentAgeGroup,
  type ResidentFilter,
  type ResidentSortField,
  type SortDirection,
  type VulnerabilitySector,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`).
 *
 * Everything the list is showing — search, barangay, sector, age band, page,
 * sort — is readable from the address bar, which is what makes a saved view a
 * link, a drill-down from the dashboard land on the right rows, and the back
 * button behave. Nothing about the query is held privately in the component.
 *
 * Malformed parameters degrade to *no filter* rather than throwing or guessing.
 * A page showing everything is recoverable; a page silently showing the wrong
 * subset is not.
 */
export interface ResidentQuery {
  readonly filter: ResidentFilter;
  readonly page: PageRequest<ResidentSortField>;
}

export interface ParamReader {
  get(name: string): string | null;
}

const SORT_FIELDS: readonly ResidentSortField[] = ['name', 'barangay', 'birthDate', 'updatedAt'];

export const DEFAULT_RESIDENT_SORT = { field: 'name', direction: 'asc' } as const;

export function readResidentFilter(params: ParamReader): ResidentFilter {
  const filter: {
    search?: string;
    barangayId?: BarangayId;
    sector?: VulnerabilitySector;
    ageGroup?: ResidentAgeGroup;
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

  if (params.get('inactive') === 'true') {
    filter.includeInactive = true;
  }

  return filter;
}

export function readResidentPage(params: ParamReader): PageRequest<ResidentSortField> {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const sortParam = params.get('sort');
  const directionParam = params.get('direction');

  const field: ResidentSortField =
    sortParam && (SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as ResidentSortField)
      : DEFAULT_RESIDENT_SORT.field;
  const direction: SortDirection = directionParam === 'desc' ? 'desc' : 'asc';

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: { field, direction },
  };
}

export function readResidentQuery(params: ParamReader): ResidentQuery {
  return { filter: readResidentFilter(params), page: readResidentPage(params) };
}

/**
 * The filter as bare query params — what a saved view stores and what a chip
 * navigates to. Page and sort are deliberately excluded: "seniors in San Juan"
 * is a population, not a scroll position.
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
  if (filter.includeInactive) {
    params['inactive'] = 'true';
  }
  return params;
}
