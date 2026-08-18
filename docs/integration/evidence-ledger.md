# Evidence ledger — Taytay Rizal Social Welfare Angular console

Append-only record for the *Admin Portal & Backend Integration Master Command* (sweep dated
18 August 2026). One row per command. Every figure in this file was produced by running the
tool named beside it on the machine named beside it — never copied from the master command.

Its companion is `docs/integration/evidence-ledger.md` in the backend repository. Where a
command touches both sides, both ledgers carry the entry and cross-reference the other.

**Convention.** A command appends: what was measured before, what changed, what was measured
after, and the artefact that proves it. A command that changes nothing still appends — a
measurement is a result.

---

## TAB 00 — Baseline, remotes and the evidence ledger

| | |
| --- | --- |
| Date | 18 August 2026 |
| Executing machine | macOS (Darwin 25.5.0), Apple silicon — **not** the machine the sweep was run on |
| Console HEAD at start | `6df92acbf4604a27e36b3598bc086e4711f3267a` (71 commits, branch `main`) |
| Backend HEAD at start | `22cb10d8eb3c687f959ad7f5084454db8df82fb8` (48 commits, branch `main`) |
| Status | Local half complete. Four steps are environmental and remain open — see *Open, not done* |

### Toolchain measured on this machine

| Tool | Version | Note |
| --- | --- | --- |
| Node | v24.19.0 | |
| npm | 11.17.0 | Install performed with `npm ci`, from the committed lockfile |
| PHP | 8.4.23 (Herd, NTS) | Not on `PATH`; lives in `~/Library/Application Support/Herd/bin` |
| Composer | 2.10.1 | |
| PHP extensions | `gd` `exif` `pdo_pgsql` `redis` `bcmath` all present | Every extension TAB 00 requires |
| PostgreSQL | **absent** | No server, no client |
| Redis | **absent** | |
| Docker / Compose | **absent** | The repository's `docker-compose.yml` cannot be used here |
| gitleaks | **absent** | Substitute scanner written for this command — see below |

> **F-25 does not hold on this machine.** The sweep recorded "no PHP toolchain is installed";
> that was measured on the Windows machine. Here PHP 8.4.23 runs the backend suite. The
> backend's `composer.json` requires `php: ^8.3`, which 8.4.23 satisfies, so running on 8.4
> is in-contract rather than a deviation. Recorded because a later command that assumes 8.3
> exactly would be assuming something nobody checked.

### Baseline — measured, not quoted

**Console** (`/Users/user/development/taytay-admin-web`)

| Measure | Measured | Sweep stated | Agrees |
| --- | --- | --- | --- |
| `npm run verify` | **green** | green | yes |
| Test files / tests | **71 / 1437** | 71 / 1437 | yes |
| Repository checks | **20 named checks, all passed** | 21 checks | see note |
| Production build | **succeeded**, no style-budget warning | clean build | yes |
| Angular / TypeScript | 22.1.0 / 6.0.2 | Angular 22, TS 6 | yes |
| `dataSource` | `'mock'` in `environment.ts` **and** `environment.development.ts` | mock in both | yes — **F-01 reproduces** |
| `apiBaseUrl` | `'/api'` (prod), `'http://localhost:8000/api'` (dev) | same | yes — **F-03 reproduces** |
| Git remote | `origin` → `https://github.com/Upupapp/taytay-admin-web.git` | **no remote at all** | **no — changed since the sweep** |

Note on the check count: `npm run verify` runs lint, typecheck, **20** named `check:*` scripts,
tests and build. The sweep's "21 repository checks" counts one more than the `package.json`
script list contains. The 20 are: brand, shell, access, vulnerability, case-audit, intake,
programs, beneficiary, documents, referrals, visits, releases, work, reports, search,
governance, hardening, community, newsfeed, events.

**Backend** (`/Users/user/development/taytay-backend`)

| Measure | Measured | Sweep stated | Agrees |
| --- | --- | --- | --- |
| Test suite | **906 passed, 6696 assertions**, 72 test files | 889 passing | **no — see L-01** |
| Registered routes | **266 total** = 263 under `api/v1/` + 3 framework | 262 | **no — see L-01** |
| Routes under `admin/` | **174** | 173 | **no — see L-01** |
| OpenAPI paths / schemas | **221 / 54** | 221 / 54 | yes |
| Migrations | **38** | 38 | yes |
| ADRs | **42 numbered** (43 files incl. index) | 42 | yes |
| Release gate | **NO-GO**, four blockers open | NO-GO | yes |

### Findings raised by this command

**L-01 — the sweep's backend counts are wrong; the measured ones supersede them.**
TAB 00 states that a different number "is the first finding of this command, not a rounding
error", so it is recorded as one.

- *Tests.* Measured 906. The suite declares exactly **906 `#[Test]` attributes** across 72
  files and uses **no data providers**, so the count is unambiguous and 889 cannot be
  reconciled with this HEAD by any counting convention. Both repositories are at the commit
  counts the sweep recorded (71 and 48), so this is a mis-measurement in the sweep, not drift.
- *Routes.* Measured 266 registered. Three are framework routes (`sanctum/csrf-cookie`,
  `GET|PUT storage/{path}`) which the sweep evidently excluded; that accounts for the shape of
  its figure but not its value, because 263 remain under `api/v1/` against a stated 262, and
  174 sit under `admin/` against a stated 173. The residual is one uncounted `admin/` route.

  **Consequence for later commands.** TAB 05 builds its 147-row mapping from
  `php artisan route:list`, not from this document or the sweep — the master command already
  says so, and L-01 is the reason it says so. Any command that checks its work against "262"
  or "889" is checking against a figure that was never true here.

**L-02 — the backend suite requires `memory_limit` above the PHP CLI default, and nothing says so.**
On a clean clone with PHP's default 128M,
`Tests\Feature\Api\V1\MediaSecurityTest::a_derived_rendition_is_bounded_by_its_variants_longest_edge`
exhausts memory inside GD (`imagecreatetruecolor`, `modules/Files/Domain/ImageDerivative.php:102`)
and the run dies with *"Premature end of PHP process"* — a fatal, not a failure, so the
reported exit status is misleading. With `-d memory_limit=1G` the same clone passes 906/906.
CI is green because its PHP image raises the limit; a developer's laptop is not. Not fixed
here: TAB 00's guardrail is *"Do not fix anything in this command."* It belongs in the
backend's setup documentation or `phpunit.xml`, and is carried forward to TAB 18's
configuration checklist.

**L-03 — the console now has a remote, and it is public.**
See the visibility decision below. This closes F-14 as written (the 71 commits are no longer
in one place) and simultaneously opens the condition F-28 describes for the backend.

### Secret scan — both repositories, full history

`gitleaks` is not installed and no package manager is available on this machine, so an
equivalent scanner was written for this command
(`docs/integration/tools/secret-scan.php`, committed alongside this ledger). It reads
`git cat-file --batch-all-objects --batch`, so it sees **every blob ever committed** on any
branch — not the working tree — and attributes each hit to a path via
`git rev-list --objects --all`. Rules: private keys, AWS access-key ids, Google API keys,
GitHub tokens, Slack tokens, live Stripe keys, JWTs, DSNs carrying a password, Laravel
`base64:` app keys, GCP service-account material, and assignment of any
password/secret/token/key to a non-placeholder literal.

| Repository | Blobs seen | Text blobs scanned | Findings |
| --- | --- | --- | --- |
| taytay-admin-web | 986 | 985 | **0** |
| taytay-backend | 953 | 953 | **3, all synthetic** |

The three backend hits are fixtures inside tests whose purpose is to assert that credentials
*do not* leak, and each was read to confirm it:

- `tests/Feature/Api/V1/CredentialLeakageTest.php:64` — `'correct-horse-battery-staple'`, the
  password posted by `a_password_never_reaches_the_log_or_the_response`.
- `tests/Feature/Console/ReadinessCommandTest.php:98–99` — a Postgres DSN carrying a fake
  password and its redacted form: the input and expectation of
  `it_redacts_credentials_out_of_driver_errors`.

**Verdict: clean.** No live credential is present in either history. Nothing requires rotation
on disclosure grounds.

This does not make the backend's public history harmless — a public repository still publishes
the schema, the authorization model and the privacy design, which is what F-28 is about. It
means only that the specific risk of a *leaked credential* is not among the consequences.

### Clean-clone reproduction

TAB 00 acceptance requires a fresh clone to build and test green on a machine that has never
seen the project. This machine had never seen either repository before today.

- **Console.** Cloned fresh from `Upupapp/taytay-admin-web`; `npm ci` from the committed
  lockfile; `npm run verify` green — 71 files, 1437 tests, 20 checks, production build.
- **Backend.** Cloned fresh into a scratch directory; `composer install --prefer-dist`
  succeeded; `php -d memory_limit=1G vendor/bin/phpunit` → **906 passed, 6696 assertions**,
  identical to the configured working copy. Subject to L-02.

### Decisions taken in this command

**D-00-01 — Repository visibility: both repositories are public; the recommendation is private, and the change is the owner's to make.**
Measured directly: an unauthenticated `GET https://api.github.com/repos/Upupapp/{repo}` returns
**HTTP 200 for both** `taytay-admin-web` and `taytay-backend`.

The master command's guardrail is *"Default to private. This is a municipal system holding
personal data of residents; a public repository is a choice somebody has to make deliberately
and record."* The reasoning holds and is strengthened by what these repositories contain: 38
migrations describing the shape of a welfare registry, a 61-key authorization model, the
privacy design, and the release gate naming its own unclosed blockers. Under RA 10173 the
personal-information controller is obliged to implement organizational security measures
proportionate to the sensitivity of the data being processed; publishing the design of the
system that processes VAWC, child-protection and medical records is a decision that should be
made on the record, by the office, rather than inherited as a default from a repository
creation dialog.

Changing visibility is a GitHub account action and lies outside the boundary set for this work
(no push, no remote administration, no deployment). **This entry records the recommendation and
the evidence; it does not execute it.** Until it is settled:

- The secret scan in this command becomes a **standing pre-push gate**, not a one-off. Every
  push to a public repository is a publication.
- No environment file, fixture or seed may carry a real value. Confirmed true today.

*Open action, owner: repository owner. Blocks the TAB 19 gate line for TAB 00.*

**D-00-02 — The measured baseline is authoritative; the sweep's stated figures are not.**
Where this ledger and the master command disagree, the ledger governs, because these numbers
were produced by running the tools here and the master command's own methodology note says the
measurement is what is reported. Carried into TAB 05 and TAB 06, both of which check their work
against route and test counts.

**D-00-03 — Ledger location and shape.**
`docs/integration/evidence-ledger.md` in each repository: inside `docs/`, which both
repositories already treat as the durable record, and separate from the per-module READMEs so
that an integration entry is never confused with a feature's documentation. Append-only, newest
command last, one section per TAB.

**D-00-04 — The prior supervisor state is preserved, not overwritten.**
The console's `.claude/master-supervisor/state.json` records the completed 26-TAB build
sequence. The integration sequence tracks separately in
`.claude/master-supervisor/integration/state.json` so that the record of how the console was
built survives the record of how it was integrated.

### Open, not done — environmental, and outside the boundary

These are TAB 00 steps that cannot be completed on this machine or under this authorization.
They are listed as open rather than quietly dropped, and each blocks the TAB 19 gate line for
TAB 00.

| # | Step | Why it is open | Owner |
| --- | --- | --- | --- |
| 2 | Create a **private** remote for the console; protect `main` on both repositories | Remote administration and pushing are outside the authorized boundary. A remote now exists but is public (D-00-01); branch protection is unset on both | Repository owner |
| 3 | Settle the backend's public remote | Owner decision; see D-00-01 | Repository owner |
| 4 | Provision a working backend environment (PostgreSQL 18, Redis, MinIO, Mailpit) | None of PostgreSQL, Redis, Docker or a package manager exists on this machine. The repository ships `docker-compose.yml` and it cannot be run here | Deployment |
| 5 | `php artisan migrate` against **real PostgreSQL** | Blocked by the above. The 38 migrations do execute — the suite runs every one of them on in-memory SQLite — but Postgres-specific behaviour is unproven here, which is exactly the gap release-gate blocker 4 names | Deployment |
| 6 | Seed a usable dataset across every role | Needs a database. `DemoDataSeeder`, `AccessControlSeeder` and `BarangaySeeder` already exist and are the starting point | Backend |
| 7 | Stand up staging | Deployment action, outside the boundary | Deployment |

Steps 1, 8 and 9 — the secret scan, the ledger and the baseline — are complete.

### Artefacts

| Artefact | Location |
| --- | --- |
| Secret scanner | `docs/integration/tools/secret-scan.php` (this repository) |
| Secret-scan output, both repositories | recorded in full above |
| Console verify transcript | reproducible: `npm ci && npm run verify` |
| Backend test transcript | reproducible: `php -d memory_limit=1G vendor/bin/phpunit` |
| Route measurement | reproducible: `php artisan route:list --json` |
| Baseline SHAs | console `6df92ac`, backend `22cb10d8` — recorded above |

### Verdict

**TAB 00 — locally complete, environmentally blocked.** The starting line is measured,
reproducible and written down; the history of both repositories is proven clean of
credentials; and the ledger is open. The backup, the private remote, the branch protection and
the staging environment are not in place, and none of them can be put in place from here.

---

## TAB 01 — Contract reconciliation (console half)

| | |
| --- | --- |
| Date | 18 August 2026 |
| HEAD at start | `f540cd2` |
| Severity | P0 — six of the eight divergences |
| Backend half | `taytay-backend` ledger, TAB 01 section, commit `eec71e6` |

### Precondition

TAB 01's stated precondition is *"a running backend to observe, not merely a document to read."*
No staging API and no PostgreSQL exist here. The backend **is** runnable, so every shape below
was taken from the application itself — `ApiResponse`, `Page::meta()`, `config/cors.php`, the
router — rather than from prose. Acceptance criteria that need a live call are recorded as
deferred rather than claimed.

### What changed, and which divergence it closes

| # | Divergence | Change |
| --- | --- | --- |
| D1 | Base path | `apiBaseUrl` is now an **absolute origin plus `/api/v1`** in both environments. The relative `/api` assumed same-origin; the topology is `admin.<domain>` calling `api.<domain>`, so it resolved against the static host and never reached Laravel. Production carries a placeholder domain — a real hostname is a deployment fact, and TAB 12 owns the environment matrix |
| D3 | Authentication | **`withCredentials: true` removed.** Against an API with `supports_credentials => false` this is refused by the browser before any application code runs — a CORS failure, not a `401`, so nothing could catch it and the only symptom was a console message. Removed outright rather than made conditional: there is no configuration in which it is correct against this API |
| D4 | Pagination | `ApiListResponse` reads `meta.pagination.{page,per_page,total,total_pages,has_more}`; `toPage` maps it into the domain `Page`. `toQueryParams` emits `per_page` and clamps it to 100 |
| D5 | Sorting | Descending is a leading `-` on `sort`. The `direction` parameter is gone — the server has none, so sorting was silently ignored while the grid's header arrow asserted an order the data did not have |
| D6 | Error envelope | New `ApiFailure` + `readApiError` read `{ error: { code, message, details, request_id } }`. The interceptor branches on `code`, surfaces `message`, keeps `details` for forms and shows the `request_id` |
| D8 | Headers | `X-Client-Channel: admin-console` added; `Accept: application/json` kept |

D2 (the `admin/` route namespace) and D7 (field casing per resource) are **TAB 05's**. TAB 01
settles the envelope; TAB 05 repoints the twenty adapters. `API_ENDPOINTS` is deliberately
untouched — rewriting paths here would mix two commands' diffs in one review and leave neither
checkable.

### The error interceptor, in more detail

Previously it looked for `{ message }` — a shape this API has never sent. So every failure
rendered *"The server responded with 422"*, the field-level `details` a form needed were
dropped, and the `request_id` a caseworker would be asked to quote was never displayed.

Now the raw `HttpErrorResponse` is translated once into an `ApiFailure` and **that** is
rethrown, so a form reads `details` without re-parsing a body and nothing downstream needs to
know the wire shape. Branching is on `code`, never `message`:

- `VALIDATION_FAILED` raises no toast — the form owns it and renders `details` beside the
  fields. A toast as well would say the same thing twice, less usefully.
- `INVALID_STATE_TRANSITION` is a **domain outcome**, not a transport fault: somebody moved the
  record on while this screen was open, and the user is told that rather than "409".
- `RATE_LIMITED` reports the `Retry-After` wait in plain words.
- Status is a **fallback only**, used where no envelope arrived — a refusal that never reached
  the application still has to send the user somewhere sensible.

`readApiError` is deliberately total. An HTML error page from a proxy, a `413` rejected before
Laravel saw it, or a status `0` all produce a usable failure. A parser that can throw while
explaining a failure turns one broken screen into a blank one.

### The transport seam (step 6)

`data/http` and `core/http` are the only two directories allowed to name a `snake_case` wire
field: the first holds the adapters and the contract, the second holds the interceptors, which
must read the error envelope to translate it. Everything else works in the application's own
vocabulary.

**No generic recursive case-converter, deliberately.** A converter cannot distinguish a field
name from a key inside a free-text note or an opaque identifier, so it renames things it was
never asked to rename and the failure surfaces months later inside a case file. Per-resource
mappers are TAB 05's, written adapter by adapter against recorded real responses; TAB 01
establishes the boundary and the rule that enforces it.

`ApiFieldErrors` is redeclared in `core/http` rather than imported from `data/http`, because
`core` does not depend on an adapter (CLAUDE.md §4).

### `check:contract` (step 10), and its mutation transcript

Seven rules, in the style of the existing twenty checks. Every one of these divergences
compiled and typechecked cleanly for the life of the defect — the envelope is cast at the
boundary, so strict TypeScript cannot see any of them. That is why they are a checker and not a
type.

Each rule was proven to fail on its own planted regression before being trusted:

| Rule | Planted regression | Result |
| --- | --- | --- |
| 1 | `withCredentials: true` reintroduced | **caught** |
| 2 | `apiBaseUrl` reverted to relative `/api` | **caught** |
| 4 | `toPage` stops reading `meta.pagination` | **caught** |
| 5 | emits `pageSize` instead of `per_page` | **caught** |
| 5 | emits a `direction` parameter | **caught** |
| 6 | envelope reader drops `request_id` | **caught** |
| 6 | interceptor drops `X-Client-Channel` | **caught** |
| 7 | a wire field name placed in `features/` | **caught** |

One finding from writing it, worth keeping: the first version scanned raw source and failed on
the *comment explaining why `withCredentials` was removed* — a rule tripping its own
documentation, which teaches a team to delete the explanation rather than keep the guard. The
checker now strips comments and reasons only about code.

### Verification

| Check | Result |
| --- | --- |
| `npm run verify` | **green** |
| Test files / tests | **73 / 1454** (was 71 / 1437 — two new spec files, 17 new tests) |
| Repository checks | **21**, including the new `check:contract` |
| Production build | clean |
| Backend suite | 907 passed, 6742 assertions; Pint clean |

New specs: `data/http/api.contract.spec.ts` (pagination mapping, `per_page`, clamping, sort
encoding, the error-code guard rejecting the PHP case names the contract used to publish) and
`core/http/api-failure.spec.ts` (envelope reading, field details, header fallback,
`Retry-After`, and the three malformed-body paths).

### Documentation corrected

`CLAUDE.md` rule 5 stated that *"session credentials travel in an HTTP-only cookie set by the
API."* They never have — ADR 0005 chose first-party bearer tokens precisely to avoid widening
cookie scope and adding a CSRF surface. Left standing, that sentence would have had TAB 02
implement the wrong thing. Rewritten, with the transport-seam rule and `check:contract` added
to §4.

### Guardrails observed

- **The backend was not bent to the console.** `supports_credentials` untouched, CORS not
  widened, Sanctum stateful domains not enabled. The only backend changes publish what was
  already served and add a test.
- **No domain model touched.** `Page`, `PageRequest` and every domain type are unchanged;
  the adapter maps into them.
- No `any`, no `@ts-ignore`, no non-null assertion. No check weakened.

### Deferred — needs a live environment

- *"A single live call from the console to `GET /api/v1/health` and one authenticated list
  endpoint returns parsed, correctly-paginated data in staging"* — no staging API exists.
- *"A deliberately invalid write renders the server's field-level messages beside the fields,
  with the request id visible"* — the mechanism is built and unit-tested; the screenshot needs
  a running API and is TAB 05's to capture once adapters are repointed.
- A network trace of a successful paginated call.

### Verdict

**TAB 01 complete on both sides.** The console now describes the API that exists, the P1 defect
is fixed at its source with a gate that has been watched failing, and the six envelope
divergences are closed and guarded. Two divergences (D2, D7) belong to TAB 05 by design.

---

## TAB 02 — Authentication and session (console half)

| | |
| --- | --- |
| Date | 18 August 2026 |
| HEAD at start | `18b42bb` |
| Backend half | `taytay-backend` commit `cc2ae05`, and [ADR 0043] |
| Status | Console flow complete and unit-tested. Three items deferred, listed below |

### What was built

**`AuthTokenHolder` (step 1).** The access token lives in a `#private` class field and nowhere
else — not `localStorage`, not `sessionStorage`, not a cookie, never a URL or a log. Deliberately
**not a signal**: a signal is readable by any component that injects the service, and a template
that can read a token can render one. The only operations are `hold`, `authorization()`,
`hasToken()`, `expiresAt()` and `clear()`; there is no getter for the value. A test asserts the
token does not appear in `JSON.stringify` and that the instance has no enumerable keys, because a
token on an enumerable property reaches a log line or an error report without anybody deciding it
should.

**The real flow (step 2).** `HttpStaffRepository` now calls `POST auth/tokens` with
`{email, password, device_name}`, handles the three answers the API actually gives, and holds the
token *before* calling `GET me` — the one ordering in the flow that matters, because `me` is
authenticated by it. `signOut()` is `DELETE auth/tokens/current`, and the token is dropped **only
after the API confirms**: clearing it first would show a signed-out screen over a credential that
still worked, and would make the failure invisible, because the request that would have revoked it
now goes out unauthenticated.

**The second-factor step (step 3).** One labelled field, `autocomplete="one-time-code"`,
paste never blocked, and nothing that auto-advances — six boxes that move focus per digit are
announced as six unlabelled inputs and strand anybody who mistypes. The challenge expiry is shown
on screen rather than discovered by typing into a dead form, and a recovery-code path is named.

**`SignInOutcome` as a discriminated union**, not a nullable user beside a flag. The most
important assertion in the new suite is that an outstanding challenge is **not** a session: if
`mfa-required` set a user, every guard in the application would let that half-authenticated caller
through and the second factor would be decorative.

**Refusals (step 6).** A wrong password, an unknown address, a locked account and a deactivated one
produce one identical message. Throttling is the single exception, because it discloses nothing
about the account — it is a fact about this caller's rate — and the user can act on it once told
how long. A transport error never reaches the form: a test asserts a connection string cannot leak
into it.

**Expiry (step 5, partial).** A `401 UNAUTHENTICATED` ends the session locally without a
round-trip — `signOut()` would present the credential that was just rejected and answer `401`
again — and carries the current URL so the user returns to the screen they were on.

**The mock keeps the seam honest.** The mock adapter issues a challenge too. A mock that signed
people straight in would be an offline path that skips a control the real one applies, and the
second-factor screen would go unexercised until somebody pointed the console at staging. Its
development code is deliberately **not** surfaced on the sign-in screen: a view importing from
`data/mock` is the one thing CLAUDE.md §2.3 forbids outright, and a convenience hint is not worth a
hole in the seam.

### `check:auth` (step 7), and its mutation transcript

| Rule | Planted regression | Result |
| --- | --- | --- |
| No web storage anywhere in application code | `localStorage.getItem` added | **caught** |
| The holder exposes no getter | `get token()` added | **caught** |
| No credential-less sign-in | `signInAs` reintroduced | **caught** |
| Only the staff adapter may hold a token | — (rule present) | — |
| Sign-out revokes server-side | `signOut` changed to clear locally and call another path | **caught** |

The whole of web storage is refused rather than "storage of anything that looks like a token": a
rule about *what* is stored needs somebody to judge each case correctly forever, and a rule about
*whether* does not. `DL-110` already refuses it for search terms, for the same reason.

### A check that earned its keep

The existing `check:access` failed the build on the new `session.store.spec.ts`, flagging a
password literal in a fixture. It was right to — the rule is that no credential is committed, and
a spec is not an exemption. The spec now uses the same non-credential constant `auth.spec.ts`
already used.

### Verification

| Check | Result |
| --- | --- |
| `npm run verify` | **green** |
| Test files / tests | **75 / 1474** (was 73 / 1454) |
| Repository checks | **22**, including the new `check:auth` |
| Backend suite | 909 passed, 6758 assertions |

Twenty-one existing spec files were updated for the port change — mechanical, and the port had to
change: `signIn` returning `AuthenticatedUser` could not express the answer the API actually gives.

### Deferred, and why

- **Enrolment in the console.** The API now answers `mfa-enrolment-required` for a staff account
  with no factor, and issues a token that can reach enrolment and nothing else. The console
  **drops that token deliberately** and says what must happen and to whom: holding it would give
  this application a session that looks real to every guard and can do nothing, which is worse
  than no session, because the caseworker would find out one refused screen at a time. Building
  the enrolment screen is carried to TAB 03, which touches this surface anyway.
- **Refresh.** Decided, not built — ADR 0043 §4. Every place a refresh credential could live is
  refused by an accepted decision, and ADR 0006's residual risk is unmitigated until TAB 13
  deploys the CSP.
- **The pre-expiry warning and in-progress form preservation.** Step 5 asks for a warning before
  the token lapses with an offer to extend, and for a form to survive a session boundary.
  "Extend" is refresh by another name and waits on the same decision. Preserving the form needs
  re-authentication *in place* — an overlay that keeps the screen mounted rather than routing away
  — which is the right design and is not built. What exists today returns the user to the same
  URL; six paragraphs of assessment typed into an unsaved form would still be lost. Recorded
  rather than glossed: it is the specific harm ADR 0006 names.
- **Live acceptance.** "Sign in with MFA, work, sign out; the revoked token is refused by the API
  on the next call" needs a running API. Every step is unit-tested against the shapes the backend
  was measured to produce; none has been exercised end to end.

---

## TAB 03 — Authorization convergence (steps 1–4: the reconciliation and the decisions)

| | |
| --- | --- |
| Date | 18 August 2026 |
| HEAD at start | `9ae4caa` |
| Deliverable | [`docs/access/permission-reconciliation.md`](../access/permission-reconciliation.md) |
| Status | **Partial.** Steps 1–4 complete. Steps 5–9 — applying it — not started |

### Why this is a separate, earlier deliverable

TAB 03 step 1 says to build the table **before proposing any change**, because *"a rename applied
to a key that was actually a split loses a distinction the domain was drawing on purpose."* That
turned out to be the operative risk: of the 87 keys with no counterpart on the other side, only
nine are simple renames. Four are console splits over a coarser backend key, two are console
merges over a finer backend split, and six cannot be decided at all until TAB 04 settles what a
case is.

Applying a naive rename pass first would have destroyed four deliberate distinctions and produced
a vocabulary that agreed on strings while disagreeing on meaning — which is worse than the
disagreement, because it looks settled.

### Measured

68 console keys, 61 backend keys, **21 identical**, 47 console-only, 40 backend-only, **zero shared
role names**. Every sweep figure for this TAB reproduced exactly, unlike its route and test counts
(L-01), so both were enumerated rather than assumed.

### L-06 (P1) — the console guards field visits with `case.view`

`app.routes.ts:345` guards the visit list with `permissionGuard('case.view')`. The console has no
`visit.*` key at all; the backend has `visit.view` and `visit.manage`.

**A role holding `case.view` but not `visit.view` sees the Field visits link, opens it, and is
refused by the API.** This is not a prediction about cutover — the two vocabularies disagree
today, and it is exactly the "unusable product" TAB 03 exists to prevent. Closed by adopting the
backend's dedicated keys and repointing the guard.

### Decisions

- **Convention.** The backend's catalog is canonical in *location*; the console's is canonical in
  *form* — one kebab-case `resource.action`, two segments. The backend enum currently mixes three
  conventions (kebab, `snake_case`, and three dotted segments) in one vocabulary. Six backend keys
  are renamed; none changes what is granted.
- **Splits are kept, not collapsed.** Newsfeed (7 v 2), events (10 v 4), disbursement (4 v 1). The
  disbursement split is the highest-value row in the table: separation of duties is asserted by a
  console test today, and a single `request.release` cannot express it — TAB 08 would have to build
  the split anyway.
- **Merges are undone.** Field visits get their own keys (L-06); documents adopt the backend's
  `manage`/`verify` split, because verifying a document is the act the office is accountable for.
- **`document.view-full-number` is kept** and becomes a *backend* key. Masking a document number to
  its last four characters is a data-minimisation rule under RA 10173, and seeing the whole number
  should cost a permission.
- **Roles: backend names are canonical, the console's staff set is canonical.** `auditor` must not
  be merged into `lgu_staff` — it holds `audit.view-detail` where the head does not, and merging
  would give the person checking the work the grants of the people doing it. Three backend roles
  with no MSWDO counterpart are kept and simply never appear in this console.
- **Six keys deferred to TAB 04**, and deliberately not decided here: `case.*` (five) and
  `resident.merge`. `case.close` is held apart from `case.manage` because ending the office's
  involvement with a family is a decision rather than a step (`DL-53`) — a distinction that
  survives under TAB 04 option A and evaporates under option B. Wiring them now would bake in an
  answer nobody has given.
- **`settings.manage` withdrawn** — nothing reads it.
- **Data scope is open**, not assumed equivalent. It needs the same row-by-row treatment against
  `ScopeResolver`, and its acceptance criterion cannot be proven without a running API.

### Not done — TAB 03 steps 5–9

Applying the table. That is: the backend renames plus a migration over stored role-permission
rows; the new keys on both sides; the console moving onto the permissions `GET /api/v1/me`
resolves, with `ROLE_DEFINITIONS` demoted to documentation and test fixture and a check that fails
the build if a guard reads it at runtime; fail-closed handling of unknown keys in both directions;
regenerating `permission-matrix.md`; the direct-call refusal tests; and the scope reconciliation.

Steps 8 and 9 need a running API in any case — *"call the endpoint directly with a token that
lacks it and confirm 403"* cannot be done here.

### Verification

No code changed. `npm run verify` green (75 files, 1474 tests, 22 checks); backend 909 passed.

---

## TAB 03 — Authorization convergence (console half, steps 5–9)

| | |
| --- | --- |
| Date | 18 August 2026 |
| Backend half | `taytay-backend` commit `4eead78` |
| Status | Steps 5, 6, 7 and 9 complete. Step 8 needs a running API |

### Step 5 — the console renders from what the server resolved

`fromServerIdentity()` builds the identity from the `permissions[]` and `roles[]` that
`GET /api/v1/me` returns. `toAuthenticatedUser()` — which computed permissions from
`ROLE_DEFINITIONS` — is retained **only** for the mock adapter and tests, which have no server to
ask.

This is the change that matters most in this TAB. With 21 of 68 keys in common and no shared role
names, a console computing its own answer would have hidden things the server allows and shown
things it refuses, from the first authenticated page load — and both are reported as "the system
is broken".

**The role is now presentation only.** It labels the account on screen; nothing branches on it.

### Step 6 — failing closed in both directions

- A key the **server** sends that this console does not know is **ignored**. It guards nothing
  here, so honouring it would grant something no screen has been reasoned about.
- A key this console expects that the **server** never sends is simply absent, so the feature stays
  hidden.

Both are silent to the user and loud to a developer: `unknownPermissions` carries the drift, and
`SessionStore` logs it **once per session** — not per check, because a permission is asked about
hundreds of times a screen and a warning that repeats is a warning people filter out. The message
carries permission keys only, never personal data.

The scope is narrowed the same way: an unrecognised scope string becomes the **narrowest**
(`assigned-cases`), never the widest. A value the console does not understand must not widen what
somebody can reach.

### L-06 closed — field visits have their own grants

`visit.view` and `visit.manage` join the array, and `app.routes.ts` guards the visit screens with
`visit.view` instead of `case.view`. Grants were assigned so **no role loses reach it had**: intake
and the auditor keep read access (they held `case.view`), and the social worker — the person who
went to the house — gets `visit.manage`.

### Step 7 — the matrix

Renamed and extended, now 70 permissions × 7 roles, with a pointer to the reconciliation table.
`check:access` kept it honest throughout: it failed the build 31 times while the rename was
half-applied, which is exactly its job.

### Step 9 — data scope

Already agreed. `role_assignments.scope_type` and the console's `DataScope` are the same three
strings. What remains is behavioural, not lexical, and needs a running API.

### Four checkers encoded the old vocabulary

`check:reports`, `check:community` and `check:events` each hard-coded permission strings, and
`check:reports`' regex (`[a-z.]+`) could not even express a hyphenated key. Each was updated to
the canonical name — the same rule, a new spelling, never a weakened one.

One of them taught something worth keeping: `check:community` derived the permission from the route
segment (`` `${module}.view` ``), so making the resource singular broke it. **The URL was
deliberately left plural.** A bookmarked link is a promise to a caseworker, and renaming a
permission is no reason to break one; the checker now maps route segment to resource explicitly.

### Verification

| Check | Result |
| --- | --- |
| `npm run verify` | **green** |
| Test files / tests | **76 / 1481** (was 75 / 1474) |
| Repository checks | 22 |
| Backend suite | 912 passed, 6761 assertions |

`check:auth` gains a sixth rule: nothing under `core/access/`, `session.store.ts` or
`session-state.ts` may read `ROLE_DEFINITIONS`. Scoped to the **deciders** rather than every
reader — the administration screen renders the matrix for the office, which is the map's
legitimate use, and forbidding that would only push it somewhere less visible. Mutation-tested.

### Deferred

- **Step 8 — direct-call refusal tests** (`403`, or `404` where existence is itself a privilege)
  need a running API. This is the acceptance criterion that proves enforcement is server-side, and
  it cannot be met here.
- **Six keys wait on TAB 04**: `case.*` (five) and `resident.merge`.
- **The backend gaining the console's finer splits** lands with the endpoints that enforce them in
  TAB 07 — a permission with no enforcement point is decoration.

---

## TAB 04 — The case collision (console half)

| | |
| --- | --- |
| Date | 18 August 2026 |
| Decision record | [ADR 0044](../adr/0044-what-a-case-is.md) · backend copy `57e76a3` |
| Status | Decision recorded; status vocabularies reconciled; option-specific build outstanding |

### The decision, and its honest status

**Option A — two entities**, and **supersede rather than merge**. Recorded as *accepted in
principle, pending MSWDO ratification*: the working session with the head, a social worker and an
intake officer has not happened, and the ADR says so rather than implying a mandate.

What makes deciding early safe is that **everything built is true under all three options**. The
option-specific half — the continuing-involvement entity — is not built.

### L-07 — the overlap is one state, and that is worse than none

`assessment` is in both the console's 7-state case catalog and the 13-state assistance lifecycle.
Nothing else is.

A mis-wired `CaseRepository` would therefore render one status correctly and blank twelve. A screen
that is *partly* right reads as incomplete data, not as broken wiring — so the trap comes with its
own cover story. Now pinned by test at exactly one; a second coincidence has to be a decision.

### Step 4 — reconciled by measurement, and three of four already agreed

`status-vocabularies.spec.ts` walks all of them against the API's enums. Referral (8), field visit
(5) and enrolment (3) are **identical on both sides** and needed no work.

**Releases diverge**: nine console states against six, three shared. The console has no catalog
entry for `ready`, `failed` or `cancelled` — a release arriving in any of them renders blank today
— and draws six distinctions the API cannot express. The two that matter are `unclaimed` and
`needs-correction`: `DL-94` holds that **deferred is the office's failing and unclaimed is
nobody's**, so collapsing them would blame a household for the office's missing countersignature.
TAB 08 owns the reconciliation; the tests pin the gap so it cannot widen quietly.

### Outstanding

The continuing-involvement module; the six permission keys TAB 03 held back (`case.*` ×5 and the
`resident.merge` / `beneficiary.review-duplicates` alignment); and the citizen-facing projection —
`welfare_case_events` carries `is_citizen_visible` and `citizen_message`, the console's `CaseEvent`
has no such concept, so **a caseworker cannot yet tell which of their notes a resident will read.**

### Verification

`npm run verify` green — **77 files, 1491 tests**, 22 checks, clean build.

---

## TAB 05 — Repoint the adapters (step 1: the authoritative mapping)

| | |
| --- | --- |
| Date | 18 August 2026 |
| Deliverable | [`docs/integration/port-mapping.md`](./port-mapping.md) |
| Status | Step 1 complete. Steps 2–10 (the rewrite) not started |

### 148 rows, not 147

`completeMfa` was added to `StaffRepository` in TAB 02. Two of the sweep's per-port counts were
also wrong — `HouseholdRepository` is 5, not 6; `EventRepository` is 14, not 13 — and the errors
cancelled in its total, the same pattern as L-01.

| Status | Count |
| --- | --- |
| maps cleanly | **66** |
| maps with transformation | **46** |
| **no counterpart** | **36** |

### Built from the router, and it mattered

The mapping was generated from `php artisan route:list` and `openapi.json`, with **every route
verified to exist** before the row was accepted. The first pass flagged **28 rows whose route did
not exist as written** — routes I had inferred from the console's method names and the sweep's
prose. Each was corrected against the real router. Had the mapping been written from the endpoint
matrix, those 28 would have become 28 adapters that compile, typecheck and 404.

That is the command's own point — *"the call sites are typing; the mapping is the work"* — and it
is now evidence rather than advice.

### Three findings from the exercise

**L-08 — the supersede doctrine is already implemented.** `POST admin/resident-duplicates/{pair}/decide`
and `POST .../preview` **both exist**. ADR 0044 chose supersede over merge as a doctrinal decision;
it turns out to need **no backend change at all** — `/decide` records the finding, `/preview` shows
what would follow, and `/merge` simply goes unused. The sweep listed only `/merge`, which made the
conflict look sharper than it is.

**L-09 — the release manifest exists.** `GET admin/release-batches/{batch}/manifest` is registered.
The sweep implied the manifest was missing. What is genuinely absent is the batch **list** and
**detail**.

**L-10 — the staff surface is not under `admin/`.** All nine staff routes sit at `/staff`, not
`/admin/staff`, which contradicts the general rule that staff routes carry the prefix. Every
`StaffRepository` and `GovernanceRepository` row is a transformation for that reason alone.

### The 36 no-counterpart rows, handed to TAB 07 in writing

- **`CaseRepository` — all 11.** Blocked on TAB 04 ratification, not on TAB 07. Do not wire.
- **`FamilyRepository` — 4 of 8.** No list, no detail, no families-for-resident, no kinship
  history. The write side exists; this is the read side of the same aggregate.
- **`WorkRepository` — all 3.** Derived queues over the Tasks module.
- **`ReportRepository` — 2 of 3.** No catalogue, no synchronous run.
- **`BeneficiaryRepository` — 3.** The projection, and the findings history.
- **`DisbursementRepository` — 3.** Batch list, batch detail, and `approverFor` — the last is what
  separation of duties needs, and TAB 08 cannot assert it without one.
- **`ProgramRepository` — 3.** Utilisation, and the read side of requirement templates.
- **Others** — `FieldVisitRepository.mine` (scope, not a resource), `NewsfeedRepository.history`,
  `EventRepository.metrics`/`history`, `GovernanceRepository.classifications`,
  `AssistanceRequestRepository.advisoryFor` (computed console-side by design).
- **`NotificationRepository.create` — delete the port method.** The API is read-only for the actor;
  a client that mints its own notifications asserts something the server never agreed to.

### Not started

Steps 2–10: the adapter rewrite itself, in dependency order, each proven in staging. **No staging
API exists**, so "proven in staging" cannot be met here; the adapters can be written against the
mapping and unit-tested against recorded shapes, and the acceptance criteria that need a live API
are deferred.

### Step 3 — `API_ENDPOINTS` repointed (D2 closed for the constants)

Every endpoint constant now names a route the mapping proved exists, with the `admin/` prefix
where the backend uses it. Two exceptions are measured rather than assumed: `staff` carries no
prefix (L-10) and `programs` reads from the public catalog surface while writes go to
`admin/programs`.

`cases` is left pointing at `admin/cases` — **a route that no longer exists.** That is deliberate.
The continuing-involvement entity has no endpoint and is blocked on ADR 0044's ratification, so an
adapter wired to it must fail loudly at 404 rather than quietly succeed against
`admin/assistance-requests`, which is exactly the trap L-07 describes. A placeholder that 404s is
safer than one that returns somebody else's records.

`npm run verify` green — 77 files, 1491 tests, 22 checks.

### Still to do in TAB 05

The adapter bodies themselves (steps 2, 4–10): per-resource `snake_case` → domain mappers, the
`Idempotency-Key` on retryable writes, honest `404` handling, integer centavos and ISO dates
end to end, deleting `NotificationRepository.create`, and adapter tests against **recorded real
responses**. The last of those cannot be done here — there is no staging API to record from, and
"proven in staging" is the acceptance criterion for every step in this command.

### Step 9 — `NotificationRepository.create()` deleted

The API's inbox is **read-only for the actor**: `GET me/notifications` and the two read-marking
routes, and nothing that mints one. The port offered `create()` anyway, so the console could
assert a notification the server never issued — and the "record" would exist in exactly one
browser tab.

Removing it exposed what the method was actually for: **local UI messages**. Every toast the
console raises — "Request failed", "Saved" — went through it. Those are messages this tab is
showing its user, not office records, so they are now built by `toLocalNotification()` in the
domain and sent nowhere.

Two consequences had to be implemented rather than described:

- **`markRead` on a local message marks it read locally.** Sending a `local-` id to
  `POST me/notifications/{id}/read` would ask the API about something it never issued and be
  answered with a `404` — which the user would see as a failure to dismiss their own toast.
- **`markAllRead` marks the local ones unconditionally** and merges, because the server's answer
  replaces only what the server knows about, and it knows about none of them.

### Step 8 — `Idempotency-Key`, generated per intent

`WriteIntent` carries one key across however many attempts an act takes. The key is made when the
officer commits — pressing Release, submitting an intake — not per HTTP call.

**That distinction is the whole mechanism.** A key generated per attempt defeats it exactly: the
retry carries a different key, the server sees a second genuine request, and on the release
surface that is a second payout to the same household. Omitting `intent` sends no key at all,
which is correct for a write that is not safely replayable and should fail rather than silently
repeat.

Tested at the level that matters: one key across attempts, different keys for different acts.

`npm run verify` green — 78 files, **1494 tests**, 22 checks.

### Step 5 — absence is not failure

`optionalItem` mapped any empty body to `null`, so a transport failure and a genuine absence
produced the same answer. A screen would render "no record found" when the truth was "we could not
ask" — and for a caseworker checking whether a household has an open referral, those are opposite
conclusions, only one of which is safe to act on.

Now only a `404` becomes `null`. A `500`, a refused cross-origin request and a dropped connection
all propagate, so the screen shows a failure rather than an absence.

`404` is also what the API returns when the actor may not *know* the record exists
(`conventions.md` §4). The console cannot tell those apart either — which is the point of the
convention, not a limitation of the client.

### Steps 4 and 6 — the mapping layer, and the first resource mapped

`data/http/mappers/wire.ts` holds the primitives every per-resource mapper is built from, and
`resident.mapper.ts` is the first resource, written against the field names `openapi.json` now
publishes rather than against the console's idea of what a resident looks like.

**Still no generic recursive case-converter, deliberately.** A converter cannot tell a field name
from a key inside a free-text note or an opaque identifier, so it renames what it was never asked
to rename and the failure surfaces months later inside a case file.

Everything in the layer is **total**: a missing, null or wrongly-typed wire value yields the
domain's "absent" rather than throwing. A mapper that can throw turns one unexpected field into a
blank screen, and the field that surprises you is never the one you were watching. `oneOf` never
widens — an unrecognised status becomes absent rather than passing through, which is the L-07
failure mode in miniature. `int` rejects a non-integer rather than rounding it, because the only
numbers this API sends are counts and centavos.

### L-12 — the resident payload does not carry what the resident screens need

Writing the first mapper made the gap visible immediately. The detail payload publishes 19 fields;
the domain `Resident` needs four that are **not among them**:

| Domain field | Where it actually lives |
| --- | --- |
| `householdId` | `GET admin/residents/{resident}/households` — a separate call returning a collection |
| `sectors` | `GET admin/residents/{resident}/vulnerability`, behind its own permission |
| `philsysLastFour` | absent — identity tier, `resident.view-sensitive` |
| `monthlyIncome` | absent — means tier, same permission |

They are mapped to their absent value and **not invented**. That is the honest reading, and the
reason the endpoint withholds them is the same reason the console masks them: they are a wider
tier than the record itself.

The consequence is recorded for TAB 07 rather than papered over — `getProfile` will have to
assemble four calls or receive a projection built for it. `verification_tier` and `verified_at`
come back with **no domain counterpart at all** (the console has never modelled KYC, which is the
citizen surface) and are dropped deliberately rather than carried as unmapped extras.

### On the fixtures

The mapper's tests use the **published** payload field for field, not responses recorded from a
running API. TAB 05 step 10 asks for the latter — *"not hand-written fixtures, which drift toward
what the author expected"* — and no staging API exists here. What these prove is that the mapper
agrees with the published contract, which is a strictly weaker claim and stated as such.

`npm run verify` green — 79 files, **1501 tests**, 22 checks.

### Households mapped — and two findings that stopped a mapper being written

**L-13 — the console's assistance request has no summary type.**
`HouseholdRepository` returns `Page<HouseholdSummary>` and `HouseholdDetail`; the API publishes an
8-field list projection and a 21-field detail one. The two sides draw the summary/detail line in
the same place, and households map comfortably as a result.

`AssistanceRequestRepository.list` returns **`Page<AssistanceRequest>`** — the full model — while
the API's list projection carries 11 fields against a domain model needing seventeen, including
`requirements`, `assessment`, `statusHistory` and both money fields. Mapping a list row into it
means eight fields blanked per row, on the console's busiest screen. The honest fix is a summary
type in the domain, which is a domain change and therefore not TAB 05's to make (the command's own
guardrail: *"if a feature file needs editing to make an adapter work, the mapping is wrong, not
the feature"* — here it is the port that is wrong). Recorded for TAB 07.

**L-14 — `HouseholdBand` cannot say "we did not ask", so one mapper was not written.**
`HouseholdSummary.band` is `'none' | 'watch' | 'elevated' | 'high'`. The list payload does not
carry the vulnerability snapshot — it sits behind its own permission at `/vulnerability` — so a
summary mapper would have to put something in `band`, and the only available something is
`'none'`.

On screen that reads as **"no vulnerability factors present"**: a positive claim about a
household, made on the strength of data nobody sent, about exactly the households the office
exists to notice.

TAB 05 step 5 settled the same question for a different field — *"never render an empty record
where the truth is 'we could not ask'"*. So `toHouseholdSummary` **was not written**, and the
reason is recorded in the file where somebody would go looking for it. Three ways out, all
decisions and none belonging in an adapter: `HouseholdBand` gains an unassessed member, the list
screen stops rendering a band, or the endpoint carries the snapshot.

`isIndigent` is the related trap and is asserted by test: it is *"a recorded classification, made
by a person… never derived from the vulnerability snapshot"* (`DL-42`), and the temptation when a
field is missing is to compute it from the factors that are present. That would be an automated
eligibility decision by another name.

`npm run verify` green — 80 files, **1506 tests**, 22 checks.
