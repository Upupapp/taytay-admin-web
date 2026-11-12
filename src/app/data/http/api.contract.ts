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
  | 'VERIFICATION_REQUIRED'
  | 'BIOMETRIC_CONSENT_REQUIRED'
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
  'VERIFICATION_REQUIRED',
  'BIOMETRIC_CONSENT_REQUIRED',
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
  /**
   * Stored images. `GET {id}/content` is read as bytes — a resident's, only after a reader is warned;
   * a banner's, to show it (`DL-170`). `POST` stores a banner's image, as a form.
   */
  media: 'media',
  /**
   * Residents' conversations with an office (`DL-168`, `office-inbox.manage`). Cursor-paged; one by
   * `{id}`, its messages at `{id}/messages`, and `POST {id}/messages`, `{id}/read`, `{id}/close`.
   */
  threads: 'threads',
  /** The office directory. Public and cursor-paged; read in full for a picker (`DL-161`). */
  offices: 'offices',
  /**
   * Every app account, admin only (`DL-168`). Cursor-paged; `PATCH {id}/role`,
   * `PATCH {id}/office` and `PATCH {id}/office-role` (`DL-173`). There is no read of one account.
   */
  adminUsers: 'admin/users',
  /**
   * The barangays as the API keys them, whole and public (`DL-173`): what a barangay link's scope
   * names. Not `TAYTAY_BARANGAYS`, whose ids are this console's own.
   */
  barangays: 'barangays',
  /**
   * The office's resident registry (`DL-174`): people the MSWDO serves, not app accounts. Cursor-
   * paged and alphabetical; one by `{id}`; `POST`, `PATCH {id}`, `POST {id}/deactivate` and
   * `{id}/reactivate` with a reason, `POST {id}/sectors` and `{id}/sectors/{sector}/end` with a
   * reason. Every answer is already redacted for the reader by the server.
   */
  officeResidents: 'office/residents',
  /**
   * Imports of the office's own lists (`DL-214`, `resident.import`): `GET` a cursor page, `POST` a
   * file (multipart); one by `{id}`; `PUT {id}/mapping`, `POST {id}/rows/{row}/resolve` with a
   * reason, `POST {id}/commit`.
   */
  officeImports: 'office/imports',
  /**
   * Residents' sector applications (`DL-215`, `resident.update`): `GET` a cursor page by status;
   * one by `{id}`; `{id}/proofs/{mediaId}` as bytes; `POST {id}/approve` and `{id}/return`.
   */
  officeSectorApplications: 'office/sector-applications',
  /**
   * The office's household register (casework phase 1c): an address and who lives there, recorded
   * by staff — not the residents' app households at `households`. Cursor-paged by reference number,
   * `resident_id` naming the one household a person is in; one by `{id}`; `POST` to register;
   * `POST {id}/membership`, `{id}/corrections` and `{id}/corrections/{code}/withdraw` with a reason.
   * Redacted for the reader by the server, the vulnerability snapshot included.
   */
  officeHouseholds: 'office/households',
  /**
   * Families (casework phase 1c, `DL-47`): cursor-paged by reference number; one by `{id}`; `POST`
   * to record one with its founding members and a reason; `POST transfers` to move a person between
   * families; `POST {id}/members/{residentId}/role`. A person's families, relationships and history
   * live under `office/residents/{id}/…`, because a relationship is between two people, not a
   * family. Members are redacted for the reader by the server.
   */
  officeFamilies: 'office/families',
  /**
   * Saved views (casework phase 1c, `DL-111`): `GET ?resource=`, answered whole; `POST`; `DELETE
   * {id}`. A shared one needs `saved-view.share` to create or take away.
   */
  officeSavedViews: 'office/saved-views',
  /**
   * The programme catalogue (casework phase 1d, `DL-176`): cursor-paged by name, `q`, `category`,
   * `status`; one by `{id}`; `{id}/requirement-templates`, answered whole; `POST` and `PATCH {id}`
   * with the whole draft and a reason (`DL-177`). Refusals name the console's own rules.
   * Utilization is not served.
   */
  officePrograms: 'office/programs',
  /**
   * Requirement templates (`DL-177`): `GET`, whole, retired included; `POST` with a code and a
   * reason; `PATCH {code}` with the documents whole and a reason; `POST {code}/retire` with a
   * reason, one way. `program.view` reads, `program.manage` writes.
   */
  officeRequirementTemplates: 'office/requirement-templates',
  /**
   * Assistance requests (casework phase 2a, `DL-177`): cursor-paged — filed requests newest filing
   * first, drafts only with `status=draft` — by `q` (part of a control number), `status`,
   * `program_id`, `barangay_id`, `open_only`; one by `{id}`; `POST` and `PATCH {id}` with the whole
   * draft; `POST {id}/file` with the acknowledgement or none; `POST {id}/status` with a reason;
   * `advisory?resident_id&program_id` and `{id}/advisory`; `{id}/notes`, whole, and appended to.
   * Redacted by the server. Phase 2b (`DL-178`): `assigned_to` on the list; `{id}/assignment`;
   * `{id}/assessment`, `…/answers`, `…/complete`; `{id}/requirements/{rid}/review`, `…/applicability`,
   * `…/documents` (a form) and `…/documents/{vid}/access`; `{id}/document-requests`, `…/withdraw`.
   */
  officeAssistanceRequests: 'office/assistance-requests',
  /**
   * Cases (casework phase 3, `DL-179`): cursor-paged, newest opened first, by `q` (part of a case
   * reference), `queue`, `status`, `category`, `barangay_id`, `assigned_to`, `resident_id`;
   * `queue-counts` and `assignees`, answered whole; one by `{id}`, the workspace; `POST` to open
   * one; `{id}/status`, `{id}/assignment`, `{id}/notes`, `{id}/tasks` and each task's `complete`,
   * `assignment` and `reschedule`, and `{id}/requests` — every write with a reason, answered with
   * the workspace. Redacted for the reader by the server.
   */
  officeCases: 'office/cases',
  /**
   * Releases (casework phase 4, `DL-180`): cursor-paged, newest prepared first, by `q` (part of a
   * release or request reference), `status`, `kind`, `method`, `batch_id`, `resident_id`,
   * `request_id`, `scheduled_from`, `scheduled_to`, `open_only`; `queue`, every open release whole;
   * one by `{id}`; `POST` to prepare one; `{id}/release`, `{id}/acknowledgement`, `{id}/deferral`
   * and `{id}/status`. Every write carries `idempotency_key` in its body.
   */
  officeReleases: 'office/releases',
  /** Payout sessions (`DL-180`): whole, counted from their members; `POST` to open; `{id}/manifest`. */
  officeReleaseBatches: 'office/release-batches',
  /**
   * Referrals (casework phase 5, `DL-181`): cursor-paged, newest drafted first, by `q` (part of the
   * reference or the receiving office's name), `status`, `destination`, `urgency`, `resident_id`,
   * `case_id`, `request_id`, `overdue_only`, `open_only`; `queue`, every open referral whole; one by
   * `{id}`; `{id}/summary`, the sheet the server composed (null before a basis); `POST` to draft;
   * `{id}/basis`, `{id}/shared-fields` (one field per call), `{id}/send` (no body), `{id}/status`,
   * `{id}/outcome`, `{id}/follow-up` and `{id}/notes`. Redacted for the reader by the server.
   */
  officeReferrals: 'office/referrals',
  /** The provider directory (`DL-181`): whole, by name; one by `{id}`. Read-only. */
  officeServiceProviders: 'office/service-providers',
  /**
   * Field visits (`DL-181`): cursor-paged, what is owed first, by `q` (the reference), `status`,
   * `purpose`, `assigned_to`, `resident_id`, `case_id`, `from`, `to`, `overdue_only`, `mine`; one by
   * `{id}`; `POST` to schedule; `{id}/observations`, `{id}/checklist` and `{id}/close`. No field for
   * where anybody was (`DL-86`).
   */
  officeVisits: 'office/visits',
  /**
   * The dashboard (`DL-182`): one summary, answered whole, by `barangay_id`, `category` and
   * `period`. Every figure is counted by the server under the scope of the list it opens; a group
   * the reader's lists would refuse — payouts, the residents' app — is null, never zero.
   */
  officeDashboard: 'office/dashboard',
  /**
   * Global search (`DL-189`): `?q=` and nothing else, answered whole — every type searched with its
   * total and at most five hits, and every type not searched named with why (`DL-112`).
   */
  officeSearch: 'office/search',
  /**
   * The work queues (`DL-189`), read-only: `mine` and `team` (`staff.view`) by `?as_of=`, answered
   * whole; `alerts` a bare list with no parameters.
   */
  officeWorkMine: 'office/work/mine',
  officeWorkTeam: 'office/work/team',
  officeWorkAlerts: 'office/work/alerts',
  /**
   * Reports (`DL-190`): the catalogue a bare list; `{id}` one report's figures, already suppressed
   * on the server, by `period`, `barangay_id`, `program_id` and `status`; `{id}/export` the same
   * as a file composed on the server with its conditions inside it (`report.export-person-level`).
   */
  officeReports: 'office/reports',
  /**
   * Governance (`DL-191`). `office/staff` the staff directory, a bare list (`staff.view`); `{id}`
   * one account; `{id}/deactivate` and `{id}/reactivate` with `{ reason }` (`staff.manage`, never
   * the caller's own). `office/audit` the office's trail, a cursor page (`audit.view`), and
   * `office/audit/{id}` what it recorded about one entry, which is no value (`audit.view-detail`).
   * `office/governance/…` the classifications, the empty retention schedule and the correction
   * requests (`settings.manage`).
   */
  officeStaff: 'office/staff',
  officeAudit: 'office/audit',
  officeGovernanceClassifications: 'office/governance/classifications',
  officeGovernanceRetention: 'office/governance/retention',
  officeGovernanceCorrections: 'office/governance/corrections',
  /**
   * Events (`DL-192`). `office/events?view=` one of the six views, a bare list read whole
   * (`event.view`); a draft is created by `POST` and replaced by `PATCH {id}` while it is one;
   * `{id}/publish|cancel|complete|archive` with `{ reason }`; `{id}/capacity` counts stamped by the
   * server; `{id}/metrics` (`event.view-insights`); `{id}/registrants` the composed list and
   * `{id}/registrants/export` the same as a file; `{id}/history` the office's acts with their
   * reasons; `{id}/registrations/{registrationId}/cancel|restore|promote|waitlist` with
   * `{ reason }` and `…/attendance` with `{ attendance }`. Residents register in their own app, on
   * routes this console never calls (`DL-123`).
   */
  officeEvents: 'office/events',
  /**
   * The beneficiary registry (`DL-187`): a projection over the resident registry, keyed on the
   * resident's id. Cursor-paged and alphabetical, by `q`, `barangay_id`, `role`, `received_from`,
   * `received_to` and `with_open_duplicate_review`; one record by `{residentId}`, with
   * `{residentId}/duplicates` and `{residentId}/findings` answered whole.
   */
  officeBeneficiaries: 'office/beneficiaries',
  /**
   * The duplicate-review queue (`DL-148`, `DL-187`): cursor-paged; `detect` runs a detection pass;
   * `{id}/preview?canonical_resident_id=` and `{id}/decide` act on one pair. There is no merge.
   */
  officeDuplicatePairs: 'office/duplicate-pairs',
  /**
   * How much each programme has been used, counted from releases handed over (`DL-187`); one
   * programme by `{programId}`. A reader who does not read payouts is answered `readable: false`
   * with a sentence, never a zero.
   */
  officeProgramUtilization: 'office/program-utilization',
  /** The open social-worker accounts a request can be assigned to (`DL-178`, `request.assess`). */
  officeSocialWorkers: 'office/social-workers',
  /** The published assessment forms, current versions, answered whole (`DL-178`). */
  officeAssessmentTemplates: 'office/assessment-templates',
  /**
   * A document's bytes for a single-use grant (`DL-178`): `POST` with the handle in the body —
   * never a path a request log keeps — answered with the bytes, not an envelope.
   */
  officeDocumentFiles: 'office/document-files',
  /**
   * Residents' document requests (`DL-184`) — "issuance" on the wire, because "document request"
   * is the casework act above. The catalogue residents read: public, active types only, answered
   * whole (`meta: {}`).
   */
  issuanceTypes: 'issuance-types',
  /**
   * The office's catalogue (`issuance-type.manage`), retired types included, answered whole;
   * `POST` and `PATCH {id}` with a reason; `POST {id}/retire` with a reason, one-way.
   */
  officeIssuanceTypes: 'office/issuance-types',
  /**
   * Residents' requests as the issuing office reads them (`issuance-request.manage`): cursor-paged,
   * newest filed first, by `status` and `type_id`; one by `{id}`; `POST {id}/status` with the words
   * the resident reads; `POST {id}/attachments/{attachmentId}/access` for a single-use grant.
   */
  officeIssuanceRequests: 'office/issuance-requests',
  /** A request's file for a grant: `POST` with the handle in the body, answered with the bytes. */
  officeIssuanceFiles: 'office/issuance-files',
  /**
   * The office directory, written (`DL-170`, `office.manage`): `POST` and `PATCH {id}` as forms,
   * because they carry the banner; `DELETE {id}`. Read through `offices`, which is public.
   */
  adminOffices: 'admin/offices',
  /**
   * Tulong pages as residents read them — public, cursor-paged, leaving out a page hidden from the
   * catalogue — and one by `{slug}`, hidden or not (`DL-170`).
   */
  services: 'services',
  /** Tulong pages, written (`service.manage`): JSON, except `POST {id}/media`, a form. */
  adminServices: 'admin/services',
  /** Every hotline, shown and hidden, at most a hundred (`hotline.manage`); written as JSON. */
  adminHotlines: 'admin/hotlines',
  /**
   * The home screen's banners and links, admin only (`DL-170`, `home.manage`): every banner, shown
   * and hidden, and every link, each answered whole; written as JSON. A banner's image is stored
   * first through `POST media` (a form) and then named by its id.
   */
  adminBanners: 'admin/home/banners',
  adminLinks: 'admin/home/links',
  /** The home screen as the app is given it — public, one object. */
  home: 'home',
  /** The residents' app's settings — public, one object, read by every app (`DL-170`). */
  appConfig: 'app/config',
  /** The same settings, changed (`app-config.manage`): one JSON `PATCH` of only what changed. */
  adminAppConfig: 'admin/app/config',
  /** Checks the card a resident's QR code names (`digital-id.verify`, `DL-171`). */
  digitalIdVerify: 'digital-id/verify',
  /**
   * A card by its own id: `POST {id}/suspend`, `{id}/revoke`, `{id}/reissue` (`digital-id.manage`).
   * An account’s card is read and issued at `admin/users/{id}/digital-id`. `GET` lists every card
   * issued, cursor-paged, with the lifecycle counts in `meta.counts` (`DL-212`).
   */
  adminDigitalIds: 'admin/digital-ids',
  /**
   * Balita (`news.write`, `DL-171`). `GET` is the residents' list — published only, cursor-paged;
   * one by `{id}` (a draft to its office and administrators); `POST` and `PATCH {id}` as forms;
   * `{id}/pin` by `POST` and `DELETE`; the cover's bytes at `{id}/cover`.
   */
  news: 'news',
  /** Balita's five categories, a bare list. */
  newsCategories: 'news/categories',
  /** The API's audit trail (`audit.view`, `DL-171`). Cursor-paged, newest first; read-only. */
  adminAudit: 'admin/audit',
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

  return { ...params, ...toFilterParams(filter) };
}

/**
 * A filter as query parameters: a key whose value is absent is left out rather than sent empty, so
 * an optional filter that was not chosen narrows nothing (the queue counts take the list's
 * optional filters, `DL-179`).
 */
export function toFilterParams(filter: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = String(value);
    }
  }
  return params;
}
