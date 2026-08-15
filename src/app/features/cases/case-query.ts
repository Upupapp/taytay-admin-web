import {
  CASE_CATEGORIES,
  CASE_QUEUE_IDS,
  DEFAULT_PAGE_SIZE,
  TAYTAY_BARANGAYS,
  type BarangayId,
  type CaseCategory,
  type CaseFilter,
  type CaseQueueId,
  type CaseSortField,
  type CaseStatus,
  type PageRequest,
  type SortDirection,
  type StaffUserId,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`).
 *
 * The queue lives here with everything else, which is the whole point: a
 * caseworker can send a colleague "the overdue cases in Dolores" as a link, and
 * a browser refresh does not silently return them to a different queue.
 */
export interface ParamReader {
  get(name: string): string | null;
}

const SORT_FIELDS: readonly CaseSortField[] = [
  'reference',
  'opened',
  'status',
  'nextAction',
  'updatedAt',
];

const STATUSES: readonly CaseStatus[] = [
  'intake',
  'assessment',
  'intervention',
  'monitoring',
  'on-hold',
  'referred-out',
  'closed',
];

export function readCaseFilter(params: ParamReader): CaseFilter {
  const filter: {
    search?: string;
    status?: CaseStatus;
    category?: CaseCategory;
    barangayId?: BarangayId;
    assignedTo?: StaffUserId;
    queue?: CaseQueueId;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const status = params.get('status');
  if (status && (STATUSES as readonly string[]).includes(status)) {
    filter.status = status as CaseStatus;
  }

  const category = params.get('category');
  if (category && (CASE_CATEGORIES as readonly string[]).includes(category)) {
    filter.category = category as CaseCategory;
  }

  const barangay = params.get('barangay');
  if (barangay && TAYTAY_BARANGAYS.some((candidate) => candidate.id === barangay)) {
    filter.barangayId = barangay as BarangayId;
  }

  const queue = params.get('queue');
  if (queue && (CASE_QUEUE_IDS as readonly string[]).includes(queue)) {
    filter.queue = queue as CaseQueueId;
  }

  return filter;
}

export function readCasePage(params: ParamReader): PageRequest<CaseSortField> {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const sortParam = params.get('sort');
  // Defaults to what is owed soonest, because that is what a queue is for.
  const field: CaseSortField =
    sortParam && (SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as CaseSortField)
      : 'nextAction';
  const direction: SortDirection = params.get('direction') === 'desc' ? 'desc' : 'asc';

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: { field, direction },
  };
}

export function readCaseQuery(params: ParamReader): {
  readonly filter: CaseFilter;
  readonly page: PageRequest<CaseSortField>;
} {
  return { filter: readCaseFilter(params), page: readCasePage(params) };
}

export function caseFilterParams(filter: CaseFilter): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.search) {
    params['q'] = filter.search;
  }
  if (filter.status) {
    params['status'] = filter.status;
  }
  if (filter.category) {
    params['category'] = filter.category;
  }
  if (filter.barangayId) {
    params['barangay'] = filter.barangayId;
  }
  if (filter.queue) {
    params['queue'] = filter.queue;
  }
  return params;
}
