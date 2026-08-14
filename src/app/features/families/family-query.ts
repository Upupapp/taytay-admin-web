import {
  DEFAULT_PAGE_SIZE,
  TAYTAY_BARANGAYS,
  type BarangayId,
  type FamilyFilter,
  type FamilySortField,
  type PageRequest,
  type SortDirection,
} from '@domain/index';

/** The URL is the filter here too (`DL-36`). */
export interface ParamReader {
  get(name: string): string | null;
}

const SORT_FIELDS: readonly FamilySortField[] = ['reference', 'name', 'size', 'updatedAt'];

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

export function readFamilyPage(params: ParamReader): PageRequest<FamilySortField> {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const sortParam = params.get('sort');
  const field: FamilySortField =
    sortParam && (SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as FamilySortField)
      : 'reference';
  const direction: SortDirection = params.get('direction') === 'desc' ? 'desc' : 'asc';

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: { field, direction },
  };
}

export function readFamilyQuery(params: ParamReader): {
  readonly filter: FamilyFilter;
  readonly page: PageRequest<FamilySortField>;
} {
  return { filter: readFamilyFilter(params), page: readFamilyPage(params) };
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
