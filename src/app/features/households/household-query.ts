import {
  DEFAULT_PAGE_SIZE,
  HOUSEHOLD_BANDS,
  TAYTAY_BARANGAYS,
  type BarangayId,
  type HouseholdBand,
  type HouseholdFilter,
  type HouseholdSortField,
  type PageRequest,
  type SortDirection,
} from '@domain/index';

/**
 * The URL is the filter here too (`DL-36`), so a barangay-level snapshot is a
 * link somebody can paste into an email rather than a set of clicks they have
 * to describe.
 */
export interface HouseholdQuery {
  readonly filter: HouseholdFilter;
  readonly page: PageRequest<HouseholdSortField>;
}

export interface ParamReader {
  get(name: string): string | null;
}

const SORT_FIELDS: readonly HouseholdSortField[] = ['reference', 'barangay', 'size', 'updatedAt'];

export function readHouseholdFilter(params: ParamReader): HouseholdFilter {
  const filter: {
    search?: string;
    barangayId?: BarangayId;
    indigentOnly?: boolean;
    minimumBand?: HouseholdBand;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((candidate) => candidate.id === barangay)) {
    filter.barangayId = barangay as BarangayId;
  }

  const band = params.get('band');
  // `none` is not a filter — every household is at least `none`, so accepting
  // it would produce a control that appears to do something and does not.
  if (band && band !== 'none' && (HOUSEHOLD_BANDS as readonly string[]).includes(band)) {
    filter.minimumBand = band as HouseholdBand;
  }

  if (params.get('indigent') === 'true') {
    filter.indigentOnly = true;
  }

  return filter;
}

export function readHouseholdPage(params: ParamReader): PageRequest<HouseholdSortField> {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const sortParam = params.get('sort');
  const field: HouseholdSortField =
    sortParam && (SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as HouseholdSortField)
      : 'reference';
  const direction: SortDirection = params.get('direction') === 'desc' ? 'desc' : 'asc';

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: { field, direction },
  };
}

export function readHouseholdQuery(params: ParamReader): HouseholdQuery {
  return { filter: readHouseholdFilter(params), page: readHouseholdPage(params) };
}

export function householdFilterParams(filter: HouseholdFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.search) {
    params['q'] = filter.search;
  }
  if (filter.barangayId) {
    params['barangay'] = filter.barangayId;
  }
  if (filter.minimumBand) {
    params['band'] = filter.minimumBand;
  }
  if (filter.indigentOnly) {
    params['indigent'] = 'true';
  }
  return params;
}

export function isHouseholdFilterActive(filter: HouseholdFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.barangayId !== undefined ||
    filter.minimumBand !== undefined ||
    filter.indigentOnly === true
  );
}
