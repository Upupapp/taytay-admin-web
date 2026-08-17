import type { Page, PageRequest } from '@domain/index';

/**
 * PROVISIONAL API CONTRACT.
 *
 * No backend exists for this workspace yet, so the shapes below are the
 * contract the front end will hold the API to, not a description of something
 * already built. When the API TAB lands, reconcile this file first and adjust
 * the adapters — never the domain models.
 *
 * Envelope:
 *   list  -> { "data": [...], "meta": { page, pageSize, totalItems, totalPages } }
 *   item  -> { "data": {...} }
 * Errors -> standard HTTP status codes; body `{ "message": string }`.
 */
export interface ApiPageMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

export interface ApiListResponse<TItem> {
  readonly data: readonly TItem[];
  readonly meta: ApiPageMeta;
}

export interface ApiItemResponse<TItem> {
  readonly data: TItem;
}

export const API_ENDPOINTS = {
  residents: 'residents',
  households: 'households',
  families: 'families',
  relationships: 'relationships',
  cases: 'cases',
  savedViews: 'saved-views',
  programs: 'programs',
  beneficiaries: 'beneficiaries',
  /**
   * The duplicate-review queue and its findings. A sibling of `beneficiaries`
   * rather than a nested path: the queue is worked across the whole registry,
   * not from inside one person's record.
   */
  identityReview: 'beneficiaries/identity-review',
  assistanceRequests: 'assistance-requests',
  disbursements: 'disbursements',
  releaseBatches: 'release-batches',
  referrals: 'referrals',
  serviceProviders: 'service-providers',
  fieldVisits: 'field-visits',
  staff: 'staff',
  session: 'session',
  notifications: 'notifications',
  dashboardSummary: 'dashboard/summary',
  /**
   * Work queues are **read-only** and derived server-side, for the same reason
   * they are derived here: an item is a view of a record, and acting on it goes
   * to that record's own endpoint (`DL-97`).
   */
  work: 'work',
  /**
   * Reports are computed server-side under the same aggregate-first and
   * small-cell rules, and the export is composed there for the same reason it
   * is composed here: a file that leaves the office must carry its own
   * conditions (`DL-104`, `DL-105`, `DL-106`).
   */
  reports: 'reports',
  /**
   * One search endpoint with one parameter. No field list and no note flag: the
   * server applies the same closed set of searchable fields (`DL-109`).
   */
  search: 'search',
  /**
   * Governance. `audit` returns rows with no recorded values; the values are a
   * separate resource behind their own permission (`DL-114`).
   */
  staffAccounts: 'governance/accounts',
  audit: 'governance/audit',
  governance: 'governance',
  /** Posts and their comments. Nothing here returns who reacted (`DL-126`). */
  newsfeed: 'newsfeed',
  /**
   * Events and the registrations residents make in the mobile app.
   *
   * `.../registrants` returns the composed view, never resident records — the
   * server applies the same closed set this application does (`DL-130`), and
   * no endpoint answers "who else is on the list" more fully than the screen.
   */
  events: 'events',
} as const;

export function toPage<TItem>(response: ApiListResponse<TItem>): Page<TItem> {
  return {
    items: response.data,
    page: response.meta.page,
    pageSize: response.meta.pageSize,
    totalItems: response.meta.totalItems,
    totalPages: response.meta.totalPages,
  };
}

/** Flattens a `PageRequest` plus an arbitrary filter into flat query params. */
export function toQueryParams(
  page: PageRequest<string>,
  filter: Record<string, unknown> = {},
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(page.page),
    pageSize: String(page.pageSize),
  };
  if (page.sort) {
    params['sort'] = page.sort.field;
    params['direction'] = page.sort.direction;
  }
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = String(value);
    }
  }
  return params;
}
