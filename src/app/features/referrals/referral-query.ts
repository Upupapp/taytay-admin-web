import {
  DEFAULT_PAGE_SIZE,
  REFERRAL_DESTINATION_LABELS,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_URGENCY_LABELS,
  type PageRequest,
  type ReferralDestination,
  type ReferralFilter,
  type ReferralSortField,
  type ReferralStatus,
  type ReferralUrgency,
  type SortDirection,
} from '@domain/index';

/**
 * The URL is the filter (`DL-36`), as on every other list here.
 *
 * The vocabularies are validated against the domain catalogs rather than
 * against literal lists, so a status added to the catalog is filterable
 * immediately and one removed stops being accepted — without this file being
 * remembered.
 */
export interface ReferralQuery {
  readonly filter: ReferralFilter;
  readonly page: PageRequest<ReferralSortField>;
}

export interface ParamReader {
  get(name: string): string | null;
}

const SORT_FIELDS: readonly ReferralSortField[] = [
  'referredAt',
  'urgency',
  'status',
  'followUpOn',
];

export const DEFAULT_REFERRAL_SORT = { field: 'referredAt', direction: 'desc' } as const;

export function readReferralFilter(params: ParamReader): ReferralFilter {
  const filter: {
    search?: string;
    status?: ReferralStatus;
    destination?: ReferralDestination;
    urgency?: ReferralUrgency;
    overdueOnly?: boolean;
    openOnly?: boolean;
  } = {};

  const search = params.get('q')?.trim();
  if (search) {
    filter.search = search;
  }

  const status = params.get('status');
  if (status && status in REFERRAL_STATUS_CATALOG) {
    filter.status = status as ReferralStatus;
  }

  const destination = params.get('destination');
  if (destination && destination in REFERRAL_DESTINATION_LABELS) {
    filter.destination = destination as ReferralDestination;
  }

  const urgency = params.get('urgency');
  if (urgency && urgency in REFERRAL_URGENCY_LABELS) {
    filter.urgency = urgency as ReferralUrgency;
  }

  if (params.get('overdue') === 'true') {
    filter.overdueOnly = true;
  }
  if (params.get('open') === 'true') {
    filter.openOnly = true;
  }

  return filter;
}

export function readReferralPage(params: ParamReader): PageRequest<ReferralSortField> {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  const sortParam = params.get('sort');
  const directionParam = params.get('direction');

  const field: ReferralSortField =
    sortParam && (SORT_FIELDS as readonly string[]).includes(sortParam)
      ? (sortParam as ReferralSortField)
      : DEFAULT_REFERRAL_SORT.field;
  const direction: SortDirection = directionParam === 'asc' ? 'asc' : 'desc';

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: DEFAULT_PAGE_SIZE,
    sort: { field, direction },
  };
}

export function readReferralQuery(params: ParamReader): ReferralQuery {
  return { filter: readReferralFilter(params), page: readReferralPage(params) };
}
