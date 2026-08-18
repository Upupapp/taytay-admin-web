# TAB 01 — Contract reconciliation

**Sequence:** Backend Integration Master Command (2026-08-18), command 2 of 20
**Date:** 18 August 2026
**Severity:** P0 — six of the eight divergences
**Verdict:** **CERTIFIED — complete on both sides.** Live-call evidence deferred; no staging API exists.

---

## Objective, as stated

> `api.contract.ts` and `api.client.ts` describe what the backend actually serves, the P1
> error-code defect is fixed at its source, and a request from the console is well-formed the
> first time it leaves the browser.

All three achieved.

## Precondition

Stated as *"a running backend to observe, not merely a document to read."* No staging API and no
PostgreSQL exist here, but the backend **is** runnable, so every shape was taken from the
application itself — `ApiResponse`, `Page::meta()`, `config/cors.php`, the router — never from
prose. Criteria needing a live round-trip are recorded as deferred rather than claimed.

## Backend (steps 1–3)

**F-08 fixed at source.** `$code->name` → `$code->value` in `OpenApiGenerator.php:189` and
`GenerateTypesCommand.php:98`; both artefacts regenerated. `ApiResponse::error()` always wrote
the backing value, so the wire was never wrong — the contract was. Every client that did what
`conventions.md` §4 instructs and branched on `code` matched nothing, ever.

**Why three green gates missed it.** `lguids:openapi --check` and `lguids:types --check` compare
generated to committed: they verify *currency, never correctness*, and agree with each other
whichever string the generator picks. `ApiContractTest` already compared the document to real
responses — but `observedEnumValues()` only drives **successful** ones, so no error body was
ever inspected.

**The new gate, watched failing.** `every_error_code_the_api_emits_is_published_with_the_value_it_emits`
reads `error.code` out of rendered bodies and never mentions `->name` or `->value`: four genuine
HTTP round-trips (401, 422, 405, 404) plus every `ErrorCode` rendered through
`ApiResponse::error()`. Mutation transcript: reintroducing the defect fails it with
*"The API returned `UNAUTHENTICATED` over HTTP and openapi.json does not publish it."* Restored,
green, 46 assertions.

**Pagination published.** The `Pagination` schema existed and was referenced by **nothing** —
`meta` was a bare `{"type":"object"}` on every response, which is how a consumer ends up
inventing `meta.pageSize`. `has_more` was served and published by neither artefact. Now
`Pagination` carries all five keys as required; `Meta` requires `request_id`; `PaginatedMeta`
makes `pagination` required; responses reference the right one. **257 `Meta` references against
zero.**

## Console (steps 4–10)

| Divergence | Closed by |
| --- | --- |
| D1 base path | absolute origin + `/api/v1`, both environments |
| D3 authentication | **`withCredentials` removed** — a CORS refusal, not a `401`; nothing could catch it |
| D4 pagination | `toPage` reads `meta.pagination`; `toQueryParams` emits `per_page`, clamped to 100 |
| D5 sorting | leading `-` on `sort`; the `direction` parameter is gone |
| D6 error envelope | `readApiError` → `ApiFailure`; branch on `code`, keep `details`, show `request_id` |
| D8 headers | `X-Client-Channel: admin-console` |

D2 and D7 are **TAB 05's** by design. `API_ENDPOINTS` untouched — repointing paths here would
mix two commands' diffs in one review.

The interceptor now treats `INVALID_STATE_TRANSITION` as a domain outcome rather than "the
server responded with 409", reports the `Retry-After` wait on a `429`, and lets forms own
`VALIDATION_FAILED` so nothing says the same thing twice. `readApiError` is total: an HTML proxy
page, a `413` rejected before Laravel saw it, and status `0` all yield a usable failure.

**`check:contract`** — seven rules, each proven to fail on its own planted regression
(`withCredentials`, relative/unversioned base, `toPage` ignoring `meta.pagination`, `pageSize`,
a `direction` parameter, a dropped `request_id` or channel header, a wire name outside the
seam). Its first version failed on the comment explaining why `withCredentials` was removed — a
rule tripping its own documentation teaches people to delete the explanation, so it now strips
comments and reasons about code.

## Verification

| | |
| --- | --- |
| Console `npm run verify` | **green** — 73 files, **1454 tests**, 21 checks, clean build |
| Backend suite | **907 passed, 6742 assertions** |
| `vendor/bin/pint --test` | passed |

## Documentation corrected

`CLAUDE.md` rule 5 claimed session credentials travel in an HTTP-only cookie set by the API. They
never have — ADR 0005 chose bearer tokens precisely to avoid widening cookie scope and adding a
CSRF surface. Left standing, it would have had TAB 02 build the wrong thing.

## Guardrails observed

The backend was **not** bent to the console: `supports_credentials` untouched, CORS not widened,
Sanctum stateful domains not enabled. No domain model touched. No `any`, `@ts-ignore` or
non-null assertion. No check weakened.

## Deferred — needs a live environment

A live `GET /api/v1/health` and one authenticated paginated list against staging; the
validation-failure screenshot; a network trace. The mechanisms are built and unit-tested; the
evidence needs an API to talk to.

## Git

Backend `eec71e6`, console `2efcabf`, supervisor `cea41f5`. Local only — nothing pushed.

## Next

**TAB 02 — Authentication and session.** In-memory bearer token, real MFA, reload survival,
server-side revocation on sign-out.
