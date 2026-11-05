import type { CursorPage, CursorRequest } from '@domain/index';

/**
 * THE API CONTRACT, AS THE NODE API SERVES IT.
 *
 * The Laravel API this file used to describe was retired on 2026-10-20 (`DL-164`). What follows is
 * read from the Node service's published spec, vendored beside this file as
 * `contract/openapi.json` with its commit and sha256 in `contract/openapi.source.json`, and checked
 * against it on every build (`check:contract-drift`, `check:routes`, `check:response-shape`).
 *
 * Envelope, both halves:
 *
 *   item         -> { "data": {...}, "meta": {} }
 *   list         -> { "data": [...], "meta": {} }
 *   cursor page  -> { "data": [...], "meta": { "pagination": { "has_more", "next_cursor" } } }
 *   error        -> { "error": { "code", "message", "details", "request_id" } }
 *
 * A successful answer carries **no** `request_id`; the `X-Request-Id` header is the only place a
 * success names itself, and it is the one header the API exposes across origins.
 *
 * THIS FILE IS THE ONLY PLACE WIRE SHAPES ARE NAMED. Everything below is `snake_case` because that
 * is what crosses the wire; the domain is camelCase and must never learn that HTTP exists. Adapters
 * map between the two explicitly — `npm run check:contract` fails the build if a wire-shaped field
 * name appears outside `data/http`.
 *
 * Deliberately NOT a generic recursive case-converter. A converter cannot tell a field name from a
 * key inside a free-text note or an opaque identifier, so it renames things it was never asked to
 * rename and the failure surfaces months later inside a case file.
 */

/**
 * Error codes the API emits. Branch on these; never on `message`.
 *
 * Held here rather than generated, because the Node API publishes its vocabulary only inside
 * `openapi.json` (`ErrorEnvelope.error.code.enum`), and a TypeScript type cannot be read out of a
 * JSON file at compile time. Restating it is safe only because it is not trusted:
 * `check:contract-drift` compares this union **and** the runtime list below against the vendored
 * enum on every build, so a code the API adds or drops fails the build here rather than surprising
 * a screen.
 *
 * The three lowercase codes are the API's, not a typo: email and password-reset verification use
 * them, and the console must recognise them as codes rather than treat them as unknown.
 */
export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_FAILED'
  | 'code_invalid'
  | 'code_expired'
  | 'code_locked'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

/**
 * The same vocabulary as a runtime value, because a union vanishes at build time and
 * `isApiErrorCode` has to check something at run time. `check:contract-drift` holds the two
 * together.
 */
const API_ERROR_CODES: readonly string[] = [
  'INVALID_JSON',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'VALIDATION_FAILED',
  'code_invalid',
  'code_expired',
  'code_locked',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
];

/**
 * TREAT THE VOCABULARY AS OPEN. A new code is an additive change on the API's side, so a wire
 * `code` is typed `string` and narrowed here rather than declared exhaustive — an unrecognised code
 * must degrade to a generic failure, never throw.
 */
export function isApiErrorCode(code: string): code is ApiErrorCode {
  return API_ERROR_CODES.includes(code);
}

/**
 * `meta.pagination` on a cursor page. There is no total, no page number and no page count: the
 * server does not compute them, and nothing here may pretend it did.
 */
export interface ApiPagination {
  readonly has_more: boolean;
  readonly next_cursor: string | null;
}

export interface ApiCursorPageResponse<TItem> {
  readonly data: readonly TItem[];
  readonly meta: { readonly pagination: ApiPagination };
}

/** A whole list, answered at once with `meta: {}` — barangays, news categories, banners. */
export interface ApiListResponse<TItem> {
  readonly data: readonly TItem[];
  readonly meta: Readonly<Record<string, never>>;
}

export interface ApiItemResponse<TItem> {
  readonly data: TItem;
  readonly meta: Readonly<Record<string, never>>;
}

/**
 * `details` is `field -> [messages]` for a validation failure, and a bare number for the counters
 * the API reports alongside one (`retry_after`, `attempts_remaining`).
 */
export type ApiErrorDetails = Readonly<Record<string, readonly string[] | number>>;

export interface ApiErrorBody {
  readonly error: {
    /** Typed `string`, not the union — see `isApiErrorCode`. */
    readonly code: string;
    readonly message: string;
    readonly details: ApiErrorDetails;
    readonly request_id: string;
  };
}

/**
 * The largest `limit` the API accepts. Unlike the retired API it **refuses** rather than clamps
 * (`limit` is validated 1–50), so asking for more is a 422 on every list — clamped here so the
 * request is always one the server will answer.
 */
export const MAX_LIMIT = 50;

/**
 * The paths this console actually calls, and nothing else.
 *
 * Every entry must be a path the vendored spec publishes (`check:routes`, a hard rule). The forty
 * Laravel paths that stood here went with the API that served them (`DL-165`): a port with no Node
 * route is bound to an adapter that makes no request at all (`unserved-repositories.ts`), so it
 * needs no path, and a path kept "for later" would be a 404 waiting for somebody to wire it.
 */
export const API_ENDPOINTS = {
  /** The signed-in account, and the capabilities the server resolved for it. */
  me: 'me',
  /** Revokes every refresh token of the signed-in account, server-side. */
  signOut: 'auth/sign-out',
  /** The caller's own inbox. Cursor-paged; marking read is `POST {id}/read` and `POST read`. */
  notifications: 'notifications',
  /**
   * Residents' ID verification requests, admin only (`verification.review`). Cursor-paged, filtered
   * by `status`; decided with `POST {id}/approve` and `POST {id}/reject` (`DL-167`).
   */
  verificationRequests: 'admin/verification-requests',
  /** Stored images. Only `GET {id}/content` is read, as bytes, after a reader is warned. */
  media: 'media',
  /**
   * Residents' conversations with an office (`DL-168`, `office-inbox.manage`). Cursor-paged; one by
   * `{id}`, its messages at `{id}/messages`, and `POST {id}/messages`, `{id}/read`, `{id}/close`.
   */
  threads: 'threads',
  /** The office directory. Public and cursor-paged; read in full for a picker (`DL-161`). */
  offices: 'offices',
  /**
   * Every app account, admin only (`DL-168`). Cursor-paged; `PATCH {id}/role` and
   * `PATCH {id}/office`. There is no read of one account.
   */
  adminUsers: 'admin/users',
} as const;

/** The one place `meta.pagination` becomes a domain `CursorPage`. */
export function toCursorPage<TItem>(response: ApiCursorPageResponse<TItem>): CursorPage<TItem> {
  const pagination = response.meta.pagination;

  return {
    items: response.data,
    hasMore: pagination.has_more,
    nextCursor: pagination.next_cursor,
  };
}

/**
 * Flattens a `CursorRequest` plus a filter into the query parameters this API accepts.
 *
 * Emits `limit`, `cursor` and the filter — and **never** `page`, `per_page` or `sort`. The API's
 * query schemas are not strict: an unknown key is not refused, it is dropped. So a `sort` sent here
 * would be ignored while a header arrow asserted an order the rows do not have, and a `page` would
 * fetch the first rows again for ever. A parameter the server ignores is worse than one it
 * refuses, because nothing on the screen looks wrong.
 */
export function toQueryParams(
  request: CursorRequest,
  filter: Record<string, unknown> = {},
): Record<string, string> {
  const params: Record<string, string> = {
    limit: String(Math.min(Math.max(1, request.limit), MAX_LIMIT)),
  };

  if (request.cursor) {
    params['cursor'] = request.cursor;
  }

  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = String(value);
    }
  }

  return params;
}
