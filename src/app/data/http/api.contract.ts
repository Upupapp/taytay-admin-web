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

/**
 * Error codes the API emits. Branch on these; never on `message`.
 *
 * **Re-exported from the vendored contract, not restated here.** TAB 06 pulls
 * `docs/api/types.ts` in from the backend as a build artefact with its source
 * commit recorded, so a backend enum change is a **TypeScript error in this
 * console** rather than a runtime surprise. Restating the union locally would
 * put the console back where TAB 01 found it: holding a second description of
 * the API and discovering the difference in production.
 */
export type { ApiErrorCode } from './contract/types';

import type { ApiErrorCode } from './contract/types';

/**
 * The same vocabulary as a runtime value.
 *
 * TypeScript unions vanish at build time and `isApiErrorCode` has to check
 * something at run time, so this list exists — and `check:contract` fails the
 * build if it drifts from the vendored union, which is the only reason it is
 * safe to have two of them.
 */
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
   * REPOINTED IN TAB 05 against `php artisan route:list`, one row per line of
   * `docs/integration/port-mapping.md`.
   *
   * The `admin/` prefix confers no authority — it is a routing convention that
   * keeps permission-guarded staff endpoints out of the public namespace, and
   * the console follows it rather than arguing with it.
   *
   * Two deliberate exceptions, both measured rather than assumed:
   *
   *  * `staff` carries **no** prefix. All nine staff routes sit at `/staff`,
   *    against the general rule (ledger finding L-10).
   *  * `programs` reads from the **public catalog** surface; only writes are
   *    under `admin/`.
   */
  residents: 'admin/residents',
  households: 'admin/households',
  families: 'admin/families',
  savedViews: 'admin/saved-views',
  /** Reads are public-catalog; `admin/programs` takes the writes. */
  programs: 'programs',
  programsAdmin: 'admin/programs',
  /** The duplicate-review queue. `/decide` records a finding; `/merge` is unused (ADR 0044). */
  residentDuplicates: 'admin/resident-duplicates',
  /**
   * The intervention. Renamed from `cases` in TAB 04 — ADR 0007 §2 always
   * called it this, and the implementation had drifted.
   */
  assistanceRequests: 'admin/assistance-requests',
  assistanceIntakes: 'admin/assistance-intakes',
  enrollments: 'admin/enrollments',
  releases: 'admin/releases',
  releaseBatches: 'admin/release-batches',
  referrals: 'admin/referrals',
  serviceProviders: 'admin/service-providers',
  visits: 'admin/visits',
  /** No `admin/` prefix — see L-10. */
  staff: 'staff',
  /** The signed-in account and the permissions the server resolved for it. */
  me: 'me',
  notifications: 'me/notifications',
  tasks: 'tasks',
  dashboard: 'admin/dashboard',
  exports: 'admin/exports',
  search: 'admin/search',
  auditEntries: 'admin/audit-entries',
  residentCorrections: 'admin/resident-corrections',
  privacyRetention: 'admin/privacy/retention',
  newsfeed: 'admin/newsfeed',
  newsfeedComments: 'admin/newsfeed-comments',
  events: 'admin/events',

  /*
   * ── Aliases the adapters still use, and the routes they truly resolve to ──
   *
   * These keep the existing call sites compiling while the adapters are
   * rewritten port by port (TAB 05 steps 2–10). Each points at what the mapping
   * proved exists.
   */
  relationships: 'admin/residents',
  beneficiaries: 'admin/beneficiaries',
  identityReview: 'admin/resident-duplicates',
  fieldVisits: 'admin/visits',
  staffAccounts: 'staff',
  audit: 'admin/audit-entries',
  governance: 'admin/privacy',
  dashboardSummary: 'admin/dashboard',

  /*
   * NO COUNTERPART — do not wire this.
   *
   * `cases` is the continuing-involvement entity, which has no endpoint at all
   * and is blocked on ADR 0044's ratification. The value below is deliberately
   * the route that **used to** exist and no longer does, so an adapter wired to
   * it fails loudly at 404 rather than quietly succeeding against
   * `admin/assistance-requests` — which is the "looks like success when wrong"
   * trap TAB 04 exists to prevent (ledger L-07).
   *
   * `check:routes` knows this one is intentional and asserts it stays absent;
   * the day the API publishes it, that check fails and says to wire it.
   */
  cases: 'admin/cases',

  /*
   * REPOINTED IN TAB 18, and they were wrong from the day TAB 07 landed.
   *
   * This comment used to say `work` and `reports` were surfaces TAB 07 would
   * build. It built them — at `admin/work/*` and `admin/reports` — and these two
   * values were never moved, so the adapters called `/api/v1/work/mine` and
   * `/api/v1/reports` and both 404. Every work-queue screen and every report.
   *
   * Nothing caught it. The mock served both happily, the types were right, the
   * tests were green, and the only way to see it was to ask the API. That is
   * what `check:routes` now does on every build.
   */
  work: 'admin/work',
  reports: 'admin/reports',
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
