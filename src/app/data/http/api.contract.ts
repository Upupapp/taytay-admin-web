import type { Page, PageRequest } from '@domain/index';

/**
 * THE API CONTRACT, AS THE BACKEND ACTUALLY SERVES IT.
 *
 * Reconciled against the running backend in TAB 01 — its router, its response
 * builder and its paginator — not against prose. The header this file used to
 * carry ("No backend exists for this workspace yet… the contract the front end
 * will hold the API to") described a wish, and six of the eight divergences the
 * integration sweep found were the gap between that wish and `/api/v1`.
 *
 * A stale disclaimer is worse than none, so it is gone rather than softened.
 *
 * Envelope, both halves:
 *
 *   item  -> { "data": {...}, "meta": { "request_id": "…" } }
 *   list  -> { "data": [...], "meta": { "request_id": "…", "pagination": {…} } }
 *   error -> { "error": { "code", "message", "details", "request_id" } }
 *
 * THIS FILE IS THE ONLY PLACE WIRE SHAPES ARE NAMED. Everything below is
 * `snake_case` because that is what crosses the wire; the domain is camelCase
 * and must never learn that HTTP exists. Adapters map between the two
 * explicitly — `npm run check:contract` fails the build if a wire-shaped field
 * name appears outside `data/http`.
 *
 * Deliberately NOT a generic recursive case-converter. A converter cannot tell
 * a field name from a key inside a free-text note or an opaque identifier, so it
 * renames things it was never asked to rename and the failure surfaces months
 * later inside a case file.
 */

/** Error codes the API emits. Branch on these; never on `message`. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'SERVER_ERROR'
  | 'SERVICE_UNAVAILABLE';

const API_ERROR_CODES: readonly string[] = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'INVALID_STATE_TRANSITION',
  'VALIDATION_FAILED',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'SERVER_ERROR',
  'SERVICE_UNAVAILABLE',
];

/**
 * TREAT THE VOCABULARY AS OPEN. A new code is an additive change on the API's
 * side, so a wire `code` is typed `string` and narrowed here rather than
 * declared exhaustive — an unrecognised code must degrade to a generic failure,
 * never throw.
 *
 * TAB 06 replaces this declaration with the backend's generated `types.ts`,
 * vendored with a recorded source SHA, at which point a backend enum change
 * becomes a TypeScript error here instead of a runtime surprise.
 */
export function isApiErrorCode(code: string): code is ApiErrorCode {
  return API_ERROR_CODES.includes(code);
}

/** `meta.pagination` — all five keys, exactly as `Page::meta()` builds them. */
export interface ApiPagination {
  readonly page: number;
  readonly per_page: number;
  readonly total: number;
  readonly total_pages: number;
  readonly has_more: boolean;
}

export interface ApiMeta {
  /** Matches the `X-Request-Id` response header. Quote it to a support desk. */
  readonly request_id: string;
  readonly pagination?: ApiPagination;
}

export interface ApiListResponse<TItem> {
  readonly data: readonly TItem[];
  readonly meta: ApiMeta & { readonly pagination: ApiPagination };
}

export interface ApiItemResponse<TItem> {
  readonly data: TItem;
  readonly meta: ApiMeta;
}

/** `details` is `field -> [messages]` for a validation failure. */
export type ApiErrorDetails = Readonly<Record<string, readonly string[]>>;

export interface ApiErrorBody {
  readonly error: {
    /** Typed `string`, not the union — see `isApiErrorCode`. */
    readonly code: string;
    readonly message: string;
    readonly details?: ApiErrorDetails;
    readonly request_id?: string;
  };
}

/**
 * The server clamps rather than rejects, so asking for more than this is not an
 * error — it is a silent disagreement between what the grid thinks it requested
 * and what it received. Clamp here so the two never differ.
 */
export const MAX_PER_PAGE = 100;

export const API_ENDPOINTS = {
  /*
   * PATHS ARE TAB 05's, NOT THIS COMMAND'S. TAB 01 settles the envelope; TAB 05
   * repoints all twenty adapters against the real router, where most of these
   * gain the `admin/` prefix the backend uses for staff routes. They are left
   * alone here on purpose — rewriting them now would mix two commands' diffs in
   * one review and leave neither checkable.
   */
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
  /**
   * The signed-in account, and the permissions the **server** resolved for it.
   * Replaces the cookie-era `session` endpoint, which the API never had.
   * TAB 03 moves the console onto the permissions this returns.
   */
  me: 'me',
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

/**
 * The one place `meta.pagination` becomes a domain `Page`.
 *
 * The console previously read `meta.{page,pageSize,totalItems,totalPages}`,
 * which the API has never sent. Every list rendered as a single empty page and
 * `toPage()` read `undefined` four times without anything failing loudly —
 * a shape mismatch a build cannot see, because the envelope was cast.
 */
export function toPage<TItem>(response: ApiListResponse<TItem>): Page<TItem> {
  const pagination = response.meta.pagination;

  return {
    items: response.data,
    page: pagination.page,
    pageSize: pagination.per_page,
    totalItems: pagination.total,
    totalPages: pagination.total_pages,
  };
}

/**
 * Flattens a `PageRequest` plus an arbitrary filter into the query parameters
 * this API accepts.
 *
 * Two things the previous version got wrong, both silent:
 *
 *  * `pageSize` — the server reads `per_page` and ignored the rest, so every
 *    list quietly fell back to the default of 25.
 *  * `sort` + `direction` — the server encodes descending as a leading `-` on
 *    `sort` and has no `direction` parameter, so a descending sort was served
 *    ascending and the grid's header arrow asserted an order the data did not
 *    have. A lie a user acts on is worse than an error they can see.
 */
export function toQueryParams(
  page: PageRequest<string>,
  filter: Record<string, unknown> = {},
): Record<string, string> {
  const params: Record<string, string> = {
    page: String(page.page),
    per_page: String(Math.min(page.pageSize, MAX_PER_PAGE)),
  };

  if (page.sort) {
    params['sort'] = (page.sort.direction === 'desc' ? '-' : '') + page.sort.field;
  }

  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = String(value);
    }
  }

  return params;
}
