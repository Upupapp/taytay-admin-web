import {
  CASE_CATEGORIES,
  CASE_QUEUE_IDS,
  TAYTAY_BARANGAYS,
  type BarangayId,
  type CaseCategory,
  type CaseFilter,
  type CaseQueueId,
  type CaseStatus,
  type StaffUserId,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`).
 *
 * The queue lives here with everything else, which is the whole point: a
 * caseworker can send a colleague "the overdue cases in Dolores" as a link, and
 * a browser refresh does not silently return them to a different queue.
 *
 * There is no sort and no page number in it: the office record answers newest opened first, a
 * cursor page at a time, and a page number would name a page nobody can ask for (`DL-161`,
 * `DL-179`).
 */
export interface ParamReader {
  get(name: string): string | null;
}

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

/** The filter, and nothing else: the server orders the list and pages it by cursor. */
export function readCaseQuery(params: ParamReader): { readonly filter: CaseFilter } {
  return { filter: readCaseFilter(params) };
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
