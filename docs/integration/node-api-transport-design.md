# Console transport + staff sign-in: Laravel `/api/v1` -> Node `/api/v1`

Read-only investigation, 2026-11-05. Console = `taytay-admin-web` (HEAD 0968768). Backend =
`taytay-backend` (HEAD 727c8e3; `openapi/openapi.json` last changed b71b39a, sha256
`f390b753431243ce817f4378d3e4d815db25fc2a26c4351ef030d9a046817184`, 102 operations).
ADR 0005/0006 are NOT in either working tree: they live at backend tag `laravel-archive`
(`docs/adr/0005-cross-origin-authentication.md`, `docs/adr/0006-admin-console-authentication.md`).

**Headline before any detail:** only 1 of 40 `API_ENDPOINTS` base paths (`me`) is published by
the Node API. The Node admin surface is a CMS for the citizen app (news, offices, services,
hotlines, banners, app config, ID verification, digital IDs, users/roles, audit). It has no
residents registry, assistance requests, cases, referrals, releases, visits, programmes,
reports, events or dashboard. Moving the transport is tractable; moving the *screens* is not
something a transport change can do (section 7, R1).

---

## 1. Console transport today

| Piece | Where | What it does |
|---|---|---|
| `ApiClient` | `src/app/data/http/api.client.ts` | `baseUrl` from `APP_ENVIRONMENT.apiBaseUrl` (L35). `page()` L37-45 (offset paging via `toQueryParams`, `toPage`). `everyPage()` L71-102: loops `page=1..`, stops on `totalPages`, **throws** past `PAGE_CEILING=20` (L26), never truncates (DL-161). `collection()` L104-111 (bare `data` array). `item()` L114, `optionalItem()` L140-150 (404 -> `null`, everything else propagates). `post/postVoid/deleteVoid/delete/patch` L164-216 unwrap `data`. `Idempotency-Key` from `WriteIntent` L223-225. |
| Wire contract | `src/app/data/http/api.contract.ts` | Envelope doc L14-18. `API_ERROR_CODES` L54-68 (13 Laravel codes) mirrors vendored union. `ApiPagination {page,per_page,total,total_pages,has_more}` L85-91. `ApiMeta.request_id` **required** L93-97. `MAX_PER_PAGE=100` L127. `API_ENDPOINTS` L129-229 (40 entries, `cases` is a 404 sentinel). `toPage` L239-249. `UPLOAD_POLICY` 10 MB L266-269. `toQueryParams` L284-304 (`page`, `per_page`, `sort` with `-` prefix, filters verbatim). |
| Headers interceptor | `src/app/core/http/api.interceptors.ts` L39-51 | On **every** HttpClient request: `Accept`, `X-Client-Channel: admin-console`, `AuthTokenHolder.authorization()`. Not scoped to the API origin. |
| Error interceptor | same file L67-135 | `readApiError`, branch on `code` (L89): `UNAUTHENTICATED` -> `session.endExpiredSession()` + `/sign-in?returnUrl` (L90-105); `FORBIDDEN` -> `/forbidden`; `VALIDATION_FAILED` silent (form owns it); `INVALID_STATE_TRANSITION`, `RATE_LIMITED` warn; default error toast. Status fallback only for 401/403 (L141-150). Rethrows `ApiFailure`. |
| Error parsing | `src/app/core/http/api-failure.ts` | `readApiError` L50-61 reads `{error:{code,message,details,request_id}}`, falls back to `X-Request-Id` header, `Retry-After` header (L125-135). `isDetails` L99-107 accepts only `string[]` values: one numeric value discards the whole `details`. |
| Token holder | `src/app/core/auth/auth-token.holder.ts` | `#token`, `#expiresAt` private (L22-23); `hold` L26, `authorization()` L36, `hasToken`, `expiresAt`, `clear` L56. No getter, not a signal (ADR 0006). |
| Session | `src/app/core/auth/session.store.ts` | `load()` L62 (bootstrap via `provideAppInitializer`, `core/core.providers.ts` L41-50), `signIn` L84, `completeSecondFactor` L109, `signOut` L151 (adapter revokes then clears), `endExpiredSession` L161. Talks only to `STAFF_REPOSITORY`. |
| Port | `src/app/domain/ports/repositories.ts` L1015-1046 | `currentUser`, `signIn(email,password) -> SignInOutcome`, `completeMfa`, `signOut`. Outcome/union types in `domain/access/credentials.ts` L25-47, L103-105. |
| Staff adapter | `src/app/data/http/http-repositories.ts` L1881-2123 | `currentUser` L1904 (no token -> `null`, no round-trip). `signIn` L1925 `POST auth/tokens {email,password,device_name}`; `completeMfa` L1939 `POST auth/tokens/mfa`; `signOut` L1968 `DELETE auth/tokens/current` then `tap(clear)`. `readSignIn` L1975-2019 holds token then `GET me`. `MeWire` L2038-2048 (`permissions[]`, `roles[]`, `scope`, `barangay_id`). `toIdentity` L2057 -> `fromServerIdentity` (`domain/access/staff-user.ts` L74-103: fail-closed on unknown keys; role fallback `'auditor'` L95). `toSignInError` L2103-2123 (uniform message, `throttled` distinct). |
| Sign-in screen | `src/app/features/auth/sign-in-page.ts` | Only uses `SessionStore` (L114 `signIn`, L152 `completeSecondFactor`). No transport knowledge: survives the move unchanged. |
| Environments | `src/environments/*.ts`, `angular.json` L67-94 | `local-api` -> `http://localhost:8000/api/v1` (Laravel port). staging/prod `https://api[-staging].<approved-domain>/api/v1`. `local-mock` swaps `data-access.providers.ts` for `.mock.ts` (DL-136 seam). |
| CSP | `netlify.toml` L50 (doctrine "connect-src names ONE API origin"), L62 prod, L123 staging | `connect-src 'self' https://api[-staging].<approved-domain>`. |
| Vendored contract | `src/app/data/http/contract/` | `types.ts` + `source.json` (Laravel `docs/api/types.ts`, ba7f5e2); `routes.published.json` + `routes.source.json` (293 routes, f004930); `response-envelopes.json` (287, 1aef8d6); baselines `unwired-paths.json` 15, `shape-mismatches.json` 12, `unmapped-writes.json` 8, `unreached-ports.json` 11. All Laravel. |

### Checks that read the transport/contract, and what re-pointing does to each

| Check | Reads | Under the Node spec |
|---|---|---|
| `check:routes` (`tools/check-routes.mjs`) | `routes.published.json` + sha in `routes.source.json` (L48-66); floor `<100` (L73); `API_ENDPOINTS` base paths as **hard rule** (L139-150); `INTENTIONALLY_ABSENT.cases` (L123); composed paths from `http-repositories.ts` vs `unwired-paths.json` ratchet (L176+, verb-aware). | Derive `VERB path` list from vendored `openapi.json` (paths x methods). Hard rule fails for 39/40 base paths -> see 3.9 (unserved binding), never demote to a baseline. Floors become relative to the recorded `operationCount`. |
| `check:response-shape` | `response-envelopes.json` (floor `<200`, L58); helper table `NEEDS` L90; `reads<40` L157; `READ_HELPERS` guard L169. Doctrine: `collection` is never right (no `ApiResponse::collection`). | Envelope per GET derived from spec schema: `data` array + `meta.pagination` -> `cursor-page`; `data` array, `meta {}` -> `list` (real: `/barangays`, `/news/categories`, admin banners/links/hotlines lists); object -> `item`. `collection` becomes correct exactly for `list` -> supersede DL-156's "never" with a new DL (it was a fact about Laravel). |
| `vendor-response-envelopes.mjs` | `../taytay-backend/**/*.php` (L45-58) | **Obsolete** (no PHP). Envelopes are derived at check time from the one vendored spec. |
| `check:contract` | `api.contract.ts` rule 4 needs `per_page,total_pages,has_more` (L155-174); rule 5 `-sort` (L176-191); rule 6 error envelope (L193-205); `X-Client-Channel` required (L208); `apiBaseUrl` ends `/api/v1`; CSP connect-src no wildcard (L298). | Rewrite rules 4/5 for `limit`, `cursor`, `next_cursor`, `has_more`; **forbid** emitting `page`, `per_page`, `sort` (Node's zod query schemas are non-strict: unknown keys are silently dropped). Rule 6 unchanged. Channel rule depends on 6.2. |
| `check:contract-drift` (`check-vendored-contract.mjs`) | `contract/types.ts` sha vs `source.json` (L41-42); `API_ERROR_CODES` == vendored union (L75-85); seam import rule. | Vendor `openapi.json` + `openapi.source.json` (repo, commit, sha256, operationCount). Compare `API_ERROR_CODES` to `components.schemas.ErrorEnvelope...code.enum`. |
| `check:consumer-contract` (`emit-consumer-expectations.mjs`) | `data/http/mappers/*.mapper.ts` -> `docs/integration/consumer-expectations.json`. Laravel backend replayed it. | Node has no replay test. Strengthen console-side: each required field must exist in that operation's response schema in the vendored spec. Expectations for removed (unserved) mappers go with them. |
| `check:query-params` | Filter keys must be snake/lowercase; `TRANSPORT_KEYS={page,per_page,sort}` L78; `CEILING=53` L229; admits it checks shape not existence. | `TRANSPORT_KEYS={limit,cursor}`. Upgrade to **existence** against the operation's declared query params (strictly stronger). New measure -> record a new ceiling as a new measure, with DL. |
| `check:wire-adoption` | write bodies in `http-repositories.ts` vs `unmapped-writes.json`. | Mechanics unchanged. Optional strengthening: body keys vs spec `requestBody` properties (several Node schemas are `.strict()` -> 422 on unknown keys). Re-baseline. |
| `check:mapper-adoption` | `CEILING=71` (L61) over adapter reads. | Unchanged mechanics; a drop caused by deleting unserved adapters must be recorded as removal, not repair. |
| `check:permission-parity` | `AccessControlPermission` in `contract/types.ts` (L50) vs `permissionGuard('…')` in `app.routes.ts` (43 guards); `CEILING=24`. | Node publishes **no** permission vocabulary -> 43/43 unreachable. Re-point at the `permissions` enum the backend publishes on `/me` (6.4); record the new count as a baseline with DL. |
| `check:auth` | storage ban L64-84; holder `#token`/no getter L90-105; `IMPERSONATION` L111; `HOLD_ALLOWED` L127; sign-out must call `auth/tokens/current` L144-160; no `ROLE_DEFINITIONS` in deciders L173-191. | Rule 5 path -> Node revocation route (6.3). Extend rule 2 to `#refreshToken`; extend rule 6 to `src/app/data/http/` (an adapter computing permissions from a role is the same second authority). Add: no `firebase` import (REST choice); mock-verifier identity only in the file `angular.json` swaps in. |
| `check:environments` | 4 env files; credential-shaped key regex `\b(apiKey|…)\b\s*:` (L90); prod never mock/localhost/http; env origin must appear in CSP. | `local-api` -> port 3000. The Firebase Web API key needs an **explicit** rule, not a name that slips the regex (`webApiKey:` does not match `\bapiKey\b`). See 3.12. |
| `check:bundle` | `dist/.../browser`; `SECRET_PATTERNS` incl. Google key `AIza…` (L123); seed markers. | Will fire on the Firebase Web API key in either sign-in option. Accept per-environment fingerprint via an accepted-findings file (precedent: `docs/integration/secret-scan-allowlist.txt`). Add markers so the mock-verifier identity can never ship. |
| `check:headers` | CSP directives, no wildcard. | Passes with two exact Google origins; doctrine comment in `netlify.toml` L50 changes -> DL. |
| `check:port-adoption`, `check:scanners` | ports/features; scanner regex hygiene. | Unaffected. Any new scanner must tolerate whitespace around dots (DL-143). |
| `check:documents-transport` | `file-transport.ts` vs `UPLOAD_POLICY`. | Node media limit is 5 MB (`http/error-handler.ts` L34-36), console says 10 MB. |

---

## 2. Node wire contract (facts, with sources)

- **Success**: `{ data, meta }` (`src/http/envelope.ts` L9-11). `meta` is `{}` or `{ pagination }`. **No `meta.request_id`** on success.
- **Error**: `{ error: { code, message, details, request_id } }`, `details` always present, default `{}` (`envelope.ts` L13-21). Codes + status (`src/http/errors.ts` L1-15): `INVALID_JSON` 400, `UNAUTHENTICATED` 401, `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409, `PAYLOAD_TOO_LARGE` 413, `VALIDATION_FAILED` 422, `code_invalid|code_expired|code_locked` 422 (lowercase, OTP), `RATE_LIMITED` 429, `INTERNAL_ERROR` 500 (message always "Something went wrong."), `SERVICE_UNAVAILABLE` 503. Absent vs Laravel: `BAD_REQUEST`, `METHOD_NOT_ALLOWED`, `INVALID_STATE_TRANSITION`, `UNSUPPORTED_MEDIA_TYPE`, `SERVER_ERROR`. `details` values are `string[] | number` (`errors.ts` L20; `retry_after`, `attempts_remaining`). Validation details: `field.path -> [messages]` (`http/validate.ts` L26-60).
- **Paging** (cursor, `src/http/paging.ts`): query `limit` 1..50 default 20, `cursor` (base64url of `createdAt|uuid`); meta `pagination: { has_more, next_cursor }` (L3-11, L43-60). No total, no page number, **no sort parameter anywhere**. Bad cursor -> 422 `details.cursor`. Paged GETs: admin/users, admin/verification-requests, offices, news, services, threads, threads/{id}/messages, notifications, admin/audit, households.
- **`X-Request-Id`**: echoed if incoming matches `^[A-Za-z0-9-]{8,80}$`, else a UUID; set on every response (`http/request-id.ts` L7-14). Readable cross-origin only if exposed (6.1).
- **`X-Client-Channel`**: **not read, not logged, not mentioned anywhere** in the backend (grep: zero hits). No channel vocabulary exists. `Idempotency-Key`: also not implemented.
- **Rate limit** (`http/rate-limit.ts` L18-40, wired `app.ts` L78): in-memory, per process, 120 req / 60 s per `ip:method:path`, exempt `/api/v1/health` and `/docs`; 429 with `Retry-After` and `details.retry_after`. No `trust proxy` anywhere, so behind the nginx in `docs/deploy-linode.md` every client is `127.0.0.1`. OTP has its own limiter. Body limit 100 kb, URL <= 2048 (`http/limits.ts`).
- **CORS**: **none.** No `cors` dependency (`package.json` L20-30), no header, no env var. `docs/integration-readiness.md` L34 lists "Netlify CORS" as still to connect. A browser call from the console is refused today.
- **Auth chain** (`app.ts` L75-89): `requestId -> requestLog -> limitRequestTarget -> rateLimit -> json -> authenticate -> (health, docs) -> resolveUser -> rejectClosedAccount -> modules`.
  - `authenticate` (`auth/middleware.ts` L13-38): no header -> guest; non-Bearer or unverifiable -> 401.
  - Firebase (`auth/firebase-auth-verifier.ts` L18-34, `firebase-admin-client.ts` L36-40): `verifyIdToken(token, checkRevoked=true)`; uid -> `subjectId`; custom claim `role` used only if in `registered|verified|staff|admin`, else `registered`.
  - `resolveUser` (`auth/resolve-user.ts` L10-28): if a `users` row exists for the uid, **the DB role replaces the claim** and adds `userId`, `officeId`, `closedAt`.
  - Row creation: every module's `currentUser()` calls `users.getOrCreate(uid, tokenRole)` (`modules/users/repository.ts` L97-117) — the first authenticated call (e.g. `GET /me`) inserts the row with the token's role.
  - Becoming staff/admin: `PATCH /api/v1/admin/users/{id}/role` (`modules/users/routes.ts` L220-243), admin only, never self, audited; demotion from `verified` revokes the digital ID. The first admin must come from a claim present before first contact, or a DB edit. No staff-creation endpoint; no seed users (`src/dev/seed.ts`).
  - `requireRole` (L44-59): guest -> 401, wrong role -> 403. Usage: `'admin'` x32, `'staff','admin'` x3 (news writer `modules/news/routes.ts` L28, digital-id verify, households list).
  - Closed accounts: 409 `CONFLICT` on everything but public reads and `GET /me` (`auth/closed-account.ts` L9-43).
- **`GET /api/v1/me`** (`modules/users/routes.ts` L48-50, any authenticated role) -> `userProfileJson` (`modules/users/repository.ts` L437-464): `id, firebase_uid, name, birthdate, sex, mobile, email, email_verified, barangay_id, address, street, purok, avatar_media_id, verification_status, verification_decided_at, rejection_reason, role, office_id, closed, closed_at, created_at, updated_at`. **No `permissions`, no `roles[]`, no `scope`.** `barangay_id` is the person's residence, not a staff scope.
- **Mock verifier** (`auth/mock-id-token-verifier.ts` L12-23): `Authorization: Bearer mock:<role>:<subjectId>`, role in `registered|verified|staff|admin`, subject `[A-Za-z0-9._-]{1,64}`. Default `AUTH_VERIFIER=mock`; production refuses mocks (`.env.example` L14-17, `config.ts`).
- **Run locally**: `docker compose up -d --wait`, `npm run migrate`, `npm run dev` (tsx watch) -> **port 3000** (`config.ts` L7). `GET /docs` serves the spec unwrapped. `tests/openapi-routes.test.ts` asserts every registered route is documented, so the spec is a trustworthy route snapshot.

---

## 3. Proposed console changes, file by file

1. **`src/environments/environment.model.ts`**: add `firebaseWebApiKey: string | null` (null for local-*). Kept a plain public identifier field, classified by DL (3.12), not hidden behind a name the credential regex misses.
2. **`environment.local-api.ts`**: `apiBaseUrl: 'http://localhost:3000/api/v1'`. **staging / production**: Node origins (placeholders stay until domains are approved) and **separate** Firebase projects' Web API keys (staging must not authenticate against production identities).
3. **`angular.json`** (`local-api` config, beside L78-79): add fileReplacement `src/app/data/http/identity/identity.provider.ts` -> `identity.provider.mock-verifier.ts`. Same DL-136 technique: the production bundle never imports the mock composer.
4. **New `src/app/data/http/identity/identity.provider.ts`** (Firebase REST, section 4): `signIn(email,password)`, `finalizeMfa(code)`, `refresh()`, `forget()`. Keeps the refresh token in its own `#refreshToken`. Uses `new HttpClient(inject(HttpBackend))` so neither interceptor touches Google calls. Returns `{ idToken, expiresAt }` grants; does **not** call `hold()`.
5. **New `identity.provider.mock-verifier.ts`** (dev only): composes `mock:<roleClaim>:<subject>` at runtime from the typed email (subject = email with `@` -> `.`, filtered to `[A-Za-z0-9._-]`, max 64) and a dev-only role-claim choice (`staff|admin`, labelled "used only the first time this subject reaches the API; the database role wins afterwards"). Password ignored and the screen says so. `expiresAt: null`, `refresh()` is a no-op. No token literal is committed. Method names must stay clear of check:auth's `IMPERSONATION` list *and its spirit*: it presents a credential the API verifies; it is not a local identity.
6. **`src/app/data/http/http-repositories.ts` `HttpStaffRepository`** (L1881-2123):
   - `signIn` -> `identity.signIn` -> `tokens.hold(grant)` -> `GET me` -> `toIdentity`. If `role` is not `staff|admin`, or `closed`, drop the token **locally only** (no revoke: revoking would sign a resident out of their phone) and fail with the uniform `invalid-credentials` message.
   - `completeMfa` -> `identity.finalizeMfa`. `signOut` -> `POST auth/sign-out` (6.3) then `tap(() => { tokens.clear(); identity.forget(); })`.
   - New `refreshSession()` -> `identity.refresh()` -> `hold()`; failure -> `SessionStore.endExpiredSession()`.
   - Delete `DEVICE_NAME`, `SignInWire`, `authUrl`. Rewrite `MeWire` to read **only** `id, name, email, role, office_id, closed`, plus `permissions?`, `scope?` once 6.4 lands. Never map `birthdate/sex/mobile/address` (minimisation, CLAUDE.md §6.1). `barangayId: null` — never the residence `barangay_id`. `roles: [role]`, `roleLabel` from role, `permissions: me.permissions ?? []`, `scope: toScope(me.scope)` (narrowest on absence, L2071).
7. **`src/app/core/auth/auth-token.holder.ts`**: add `expiresWithin(ms): boolean`. Nothing else; refresh token is not here.
8. **`src/app/core/http/api.interceptors.ts`**: scope `apiHeadersInterceptor` to `url.startsWith(apiBaseUrl)` so no bearer/channel header ever leaves for another origin. Before attaching, if `tokens.expiresWithin(60_000)`, await a single shared in-flight refresh via a core token `SESSION_REFRESHER` (bound in `data-access.providers.ts` to `HttpStaffRepository.refreshSession`). On-demand, no timer, nothing in the background (DL-118 spirit). `httpErrorInterceptor`: ignore non-API URLs; drop the dead `INVALID_STATE_TRANSITION` case or keep it tolerated; `CONFLICT` stays default. `X-Client-Channel` only if 6.2 lands.
9. **`src/app/data/data-access.providers.ts`**: bind served ports to Node adapters; bind every port with no Node route to an explicit `Unserved*` adapter that makes **no request** and errors with a stated sentence ("This part of the console has no server yet"). Remove those ports' entries from `API_ENDPOINTS` so check:routes' hard rule stays hard and true. Delete the Laravel-era adapter code rather than leave unread dead code (DL-143's "surface nothing is reading"); it stays recoverable at the pre-migration commit. Owner decision (R1).
10. **`src/app/data/http/api.contract.ts`**: envelope header -> Node; `API_ERROR_CODES` -> the 13 Node codes; `ApiPagination {has_more,next_cursor}`; `ApiMeta.request_id` removed from success types; `ApiErrorBody.details: Record<string, readonly string[] | number>`; `MAX_PER_PAGE` -> `MAX_LIMIT = 50`; `toPage` -> `toCursorPage`; `toQueryParams` emits `limit`, `cursor`, filters, never `page/per_page/sort`; `API_ENDPOINTS` -> Node paths only (+ `cases` sentinel); `UPLOAD_POLICY.maxBytes` 5 MB where uploads go to `POST /media`.
11. **`src/app/data/http/api.client.ts`**: `page()` -> `cursorPage(path, {limit, cursor}, filter): Observable<CursorPage<T>>`; `everyPage()` follows `next_cursor` until `null`, still **throws** past `PAGE_CEILING` (20 x 50 = 1,000 rows, was 2,000); `collection()` kept for spec `list` envelopes; writes unchanged (same `{data,meta}`). `Idempotency-Key`: Node ignores it — stop attaching it to Node routes (no Node write carries an intent today) rather than imply replay safety.
12. **`src/app/domain/shared/pagination.ts`** (L8-15): add `CursorPage<T> { items, nextCursor, hasMore }` + `CursorRequest`. `Page<T>` stays for mock/unserved ports. Screens on cursor ports say "first 50, more available", never "page 1 of N".
13. **`src/app/core/http/api-failure.ts`**: `isDetails` keeps `string[]` entries and drops numeric counters instead of discarding everything; `retryAfterSeconds` falls back to `details.retry_after` when the header is not exposed.
14. **`src/app/domain/access/staff-user.ts`** L95: the `'auditor'` fallback would label every Node admin "auditor" wherever `role` is shown. Make the adapter's `roleLabel` win and review `StaffRole` consumers (follow-up, domain change).
15. **`netlify.toml`** L62/L123: `connect-src 'self' https://api[-staging].<approved-domain> https://identitytoolkit.googleapis.com https://securetoken.googleapis.com`; rewrite the L50 doctrine comment ("one API origin and the identity provider's two endpoints, exact, never a wildcard").
16. **`src/app/data/http/contract/`**: replace with `openapi.json` + `openapi.source.json`; delete Laravel snapshots and `vendor-response-envelopes.mjs`; add `tools/vendor-openapi.mjs` (copies from `../taytay-backend/openapi/openapi.json`, records commit/sha/operationCount).
17. **Docs**: new DL entries (`docs/reference-audit/decision-log.md`) for: Node replaces Laravel; cursor paging; `collection` legitimate on `list` (supersedes DL-156 part); Firebase Web API key is a public identifier; CSP adds identity origins; unserved-port binding; refresh in memory. Update `CLAUDE.md` §1 sibling path (`Documents\GitHub\taytay-backend`, not `Desktop\…`), §2 rule 5 (no Laravel `supports_credentials`; Node CORS per 6.1), §2 rule 9 / §3 (backend gates are `npm test`, `npm run typecheck`, not phpunit/pint).

---

## 4. Staff sign-in design

| | Firebase Web modular SDK (`initializeAuth(app,{persistence: inMemoryPersistence})`) | Firebase Auth REST (identitytoolkit + securetoken) |
|---|---|---|
| Dependency | Adds `firebase` (large package tree; `check:deps` surface; bundle grows by tens of KB — measure). | None. ~150 lines on `HttpBackend`. CLAUDE.md §3: "Do not add a dependency without a stated reason. Prefer the platform." |
| Token storage | Memory with `inMemoryPersistence`; must use `initializeAuth`, never `getAuth` (defaults to IndexedDB/localStorage and pulls the popup/redirect iframe). | Memory: id token in `AuthTokenHolder.#token`, refresh token in the provider's `#refreshToken`. |
| Hidden storage | `firebase/app` heartbeat service writes to IndexedDB (`firebase-heartbeat-database`) — no token, but contradicts check:auth's "no web storage at all". **Verify in DevTools before deciding.** | None. |
| ADR 0006 "no getter" | `auth.currentUser.getIdToken()` / `.refreshToken` are public on an object any injector holding `Auth` can reach. Needs a confinement rule. | Fits as-is: two private fields, nothing to read. |
| Refresh | Automatic. | Hand-written: `POST securetoken.googleapis.com/v1/token?key=…` (form: `grant_type=refresh_token&refresh_token=…`) -> `{id_token, refresh_token, expires_in}`; on-demand from the interceptor. |
| Sign-in | `signInWithEmailAndPassword`. | `POST identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=…` `{email,password,returnSecureToken:true}` -> `{idToken, refreshToken, expiresIn, localId}`; errors `INVALID_LOGIN_CREDENTIALS / EMAIL_NOT_FOUND / INVALID_PASSWORD / USER_DISABLED` -> `invalid-credentials`, `TOO_MANY_ATTEMPTS_TRY_LATER` -> `throttled`, else `unavailable`. |
| MFA (TOTP) | `getMultiFactorResolver` + `TotpMultiFactorGenerator`. | `mfaPendingCredential` on sign-in -> `v2/accounts/mfaSignIn:finalize` with the TOTP code. Hand-written; verify request shape against Identity Platform docs. Either way needs the Identity Platform upgrade (R7). |
| Testability | Needs SDK mocking. | `HttpTestingController`, like every other adapter. |
| CSP / key | Same two Google origins; same public Web API key. | Same. |

**Recommendation: REST.** It adds no dependency, keeps both tokens in private fields with no
getter (ADR 0006 and check:auth rules 1-2 hold unchanged in letter and spirit), writes nothing to
web storage, and is tested the same way as the rest of the transport. The cost is ~150 lines of
protocol we own and an MFA flow to hand-write; both are bounded and the protocol is the one the
SDK itself calls. Revisit only if MFA via REST proves fragile.

Rejected: a backend sign-in proxy (API takes the password and calls identitytoolkit). It keeps
the key out of the bundle and CSP at one origin, but contradicts the backend's own design
("Sign-in itself stays in the Firebase client", `docs/integration-readiness.md` L26) and puts
staff passwords through the API.

**Reload** still signs the user out (memory only, as ADR 0006 accepted). The refresh token is
long-lived but revocable server-side (`checkRevoked=true` already) — the "short-lived, revocable,
server-side" refresh ADR 0006 asked for, provided 6.3 exists.

**Dev with the mock verifier**: backend `npm run dev` (3000, `AUTH_VERIFIER=mock`), console
`ng serve --configuration local-api` (mock-verifier identity swapped in by `angular.json`). Sign in
with any email; the first contact for a subject creates its row with the chosen claim
(`mock:admin:alice.dev.local` once to bootstrap an admin), after which promotions go through
`PATCH /admin/users/{id}/role`. Two independent guards keep it out of production: the bundle
never contains it (check:bundle marker), and the production API refuses mock tokens.

**Role -> session mapping**:
- Node role `staff|admin` is the only thing the server decides. The console's 7 `StaffRole`s
  and 75 `PERMISSIONS` have no server counterpart.
- `fromServerIdentity` already fails closed: with no `permissions` on `/me`, no guarded route
  opens. That is the honest outcome, not a bug.
- Do **not** compute permissions from `role` in the adapter. It is the same second authority
  check:auth rule 6 forbids, one folder over.
- The fix is backend 6.4: `/me` returns server-resolved `permissions[]` and `scope` that the
  server also enforces. Which console keys those become is an owner/office decision.
- `scope` absent means `assigned-cases`. `barangayId` is null. `office_id` is ignored until the
  console has an office concept.
- Deactivation (DL-116): an admin demotes the role (effective on the next request, because the
  DB role is read per request) or closes the account (Firebase disable makes the
  `checkRevoked` verification fail).

---

## 5. Contract checks: re-point, retire, keep honest

- **Re-point at the vendored `openapi.json`**: `check:routes`, `check:response-shape`,
  `check:contract-drift`, `check:contract` (pagination + query rules), `check:query-params`,
  `check:permission-parity` (on the `/me` permissions enum), `check:consumer-contract` (strengthened
  to check fields against response schemas), `check:auth` rule 5 path.
- **Retire**: `vendor-response-envelopes.mjs`, `routes.published.json`, `routes.source.json`,
  `response-envelopes.json`, the Laravel `types.ts`/`source.json`, the backend-replay half of
  the consumer contract.
- **Unchanged**: `check:port-adoption`, `check:scanners`, `check:wire-adoption`,
  `check:mapper-adoption` mechanics; every domain check (`check:intake`, `check:releases`, …).
- **Honest ratchets**:
  1. Re-point and re-baseline in **one commit per check**, each with a DL entry stating old
     count, new count, and cause ("API replaced, not code regressed"). Never edit the rule text
     in the same commit as the baseline.
  2. Hard rules stay hard. The base-path rule passes by **removing** what Node does not serve
     (3.9), not by turning it into a baseline.
  3. Reach floors (`<100` routes, `<200` envelopes, `<40` reads, `<20` endpoints) become
     relative. Floors on the spec come from the recorded `operationCount`. Floors on the code
     come from counting raw `this\s*\.\s*api\s*\.` call sites, which must equal reads + writes
     extracted. That is stronger than a magic number, and lowering one is never the fix.
  4. A changed *measure* (query-params: shape -> existence) is recorded as a new measure with
     its own first value, not as "raised the ceiling".
  5. New ratchet `unserved-ports` (count of ports bound to `Unserved*`), shrink-only. Launch
     gate stays NO-GO while it is non-zero, unless the owner retires those screens.
  6. Expect jumps: `permission-parity` 24 -> 43 until 6.4. `unwired-paths` and
     `shape-mismatches` reset to whatever the surviving Node adapters measure.

---

## 6. Backend changes required (taytay-backend)

1. **CORS middleware** in `src/app.ts` before `rateLimit` (between L76 and L78), so preflights
   and every error response (401/429/500) carry the headers. Without them the console sees
   status 0, not the envelope.
   - `CORS_ALLOWED_ORIGINS`: comma list of exact origins. Dev default `http://localhost:4200`
     only when not production. Production requires https and refuses `*`.
   - Production API: the Netlify console origin (custom domain once approved). Staging API: the
     staging site, plus deploy previews if wanted, via an anchored pattern for this one site
     only (`^https://deploy-preview-\d+--<site>\.netlify\.app$`). Previews use staging per
     readiness L34, never production.
   - No `Access-Control-Allow-Credentials`. Methods `GET, POST, PATCH, DELETE`.
   - Allow-Headers `Authorization, Content-Type, Accept, X-Request-Id, X-Client-Channel`.
   - Expose-Headers `X-Request-Id, Retry-After` (neither is safelisted). `Vary: Origin`,
     `Max-Age: 600`.
   - Add the variable to `.env.example` and `config.ts`, and the boot refusal to production config.
2. **Channel**: log `X-Client-Channel` in `request-log` against an allow-list
   (`mobile | citizen-web | admin-console`), never as authority. If declined, the console stops
   sending it and supersedes check:contract L208 by DL.
3. **Server-side sign-out**: `POST /api/v1/auth/sign-out` (any authenticated role).
   - Add `revokeSessions(uid)` to `IdentityAdmin` (`src/identity/identity-admin.ts` L6-11),
     using Admin SDK `revokeRefreshTokens`. Mock: no-op. Document it in `openapi.json`.
   - Revokes **all** of that user's sessions (R5).
4. **`/me` for staff/admin**: add `permissions: string[]` and `scope`, resolved from a server
   table and enforced by the same routes. Enumerate the keys in the `UserProfile` schema.
   Consider a slimmer staff profile without birthdate/address/sex/mobile.
5. **Staff provisioning**: a CLI (`npm run` script on the deploy host) to create a Firebase user
   and set the first role. Today the first admin needs a DB edit or a pre-set claim.
6. **Recommended**: `app.set('trust proxy', 1)` behind nginx. Otherwise the 120/min limiter is
   shared by every client. Even with it, all MSWDO staff behind one office NAT share it.

---

## 7. Risks and unknowns

- **R1 Surface mismatch (blocking).** 39/40 base paths and essentially every casework port have
  no Node route. After the move, `dataSource:'http'` serves sign-in, `/me`, notifications,
  audit, users/roles, news, and little else that matches a console screen (Node news and
  households have different models). Owner must decide: build casework in Node, or retire
  screens. Until then `Unserved*` adapters say so plainly.
- **R2 Authority model.** Node has two staff roles. The console's separation of duties
  ("nobody approves and releases", `domain/access/permission.spec.ts`) cannot be enforced by
  `staff|admin`. Client checks are never the boundary (rule 4), so this must be a server table.
- **R3 Paging.** No totals, no sort, max 50. Every grid with numbered pages or sortable headers
  must change. Unknown query keys are silently ignored (fail-open filters).
- **R4 Public Web API key** in the bundle trips check:bundle/check:environments by design.
  Needs a DL classifying it as a public identifier, a per-environment accepted fingerprint,
  and a manual GCP key restriction (HTTP referrers = console origins; APIs = Identity Toolkit
  + Token Service).
- **R5** Sign-out revokes every device of that user, including their own resident app.
- **R6** One Firebase project holds residents and staff. Node's public
  `/auth/password-reset/*` applies to staff accounts too. `GET /me` auto-creates a row for any
  Firebase account that reaches it.
- **R7 MFA.** Firebase TOTP needs the Identity Platform upgrade (unknown if enabled). Until then
  staff have password-only sign-in, a regression from Laravel's enforced enrolment.
- **R8** `/me` returns personal fields. The mapper must ignore them. `barangay_id` is residence
  and must never become scope.
- **R9** Success `meta` has no `request_id`. Support references depend on Expose-Headers (6.1).
- **R10** The upload limit is 5 MB on Node vs 10 MB in the console. Node media mime types are
  not yet compared.
- **R11** Unverified here, verify before relying on: the Firebase SDK heartbeat IndexedDB
  write; exact REST MFA request shapes; whether email-enumeration protection (which returns
  `INVALID_LOGIN_CREDENTIALS`) is on for the project.
- **R12** Stale docs: console CLAUDE.md §1 backend path, §2 rule 5 CORS wording, §3 backend
  gates. ADRs 0005/0006 survive only at backend tag `laravel-archive`; restate the binding parts
  in a console DL so they don't hang on an archived tree.
