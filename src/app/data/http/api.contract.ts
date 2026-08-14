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
  savedViews: 'saved-views',
  programs: 'programs',
  assistanceRequests: 'assistance-requests',
  disbursements: 'disbursements',
  referrals: 'referrals',
  staff: 'staff',
  session: 'session',
  notifications: 'notifications',
  dashboardSummary: 'dashboard/summary',
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
