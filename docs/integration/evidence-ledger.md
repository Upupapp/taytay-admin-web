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
the evidence; it does not execute it.**

---

#### RESOLVED 2026-08-29 — the owner has decided: the repositories stay **PUBLIC**.

The recommendation above stood on the record for eleven days and was not accepted. That is the
correct shape for a decision of this kind — it was made deliberately, by the party entitled to
make it, against a written recommendation — and it is recorded here as taken, not as
outstanding. Nothing in the reasoning above is withdrawn; it was argued, considered and
overruled, which is different from being wrong or from being ignored.

Measured at the time of the decision: `GET https://api.github.com/repos/Upupapp/{repo}` returns
**HTTP 200** for `taytay-admin-web`, `taytay-backend` **and** `taytay-mobile-app` — three
repositories, not the two this entry originally named.

**The consequence that matters: the two controls below were written as temporary, holding only
"until it is settled". It is now settled the other way, so they do not lapse — they become
permanent, and they are the whole of the compensating control.** A decision to remain public
converts them from a stopgap into the standing mitigation, and anyone reading this entry later
must not read "resolved" as "the controls can relax".

- The secret scan is a **permanent pre-push gate**. Every push to a public repository is a
  publication, and there is no second opinion after one.
- No environment file, fixture or seed may **ever** carry a real value. Confirmed true again on
  2026-08-29.

**Stated honestly: the first control is not mechanically enforced in this repository.**
`npm run verify` does not run `docs/integration/tools/secret-scan.php`, and adding a PHP
dependency to a Node gate is a change worth deciding rather than slipping in. What *is*
mechanical is `check:bundle`, which fails on credential-shaped strings and seed markers in the
built output — that covers the artefact, not the source and not the history. The gap between
"the built bundle is clean" and "nothing secret has ever been committed" is real, and it is
discipline that closes it today. Recorded as a known limit of the mitigation rather than left
to be discovered.

**Under RA 10173 this remains a decision the office should be able to point to.** The
recommendation, the evidence, the reasoning and the decision are all in this file, which is what
"made on the record" means. The equivalent entry belongs in `taytay-backend` and
`taytay-mobile-app`; neither is this repository's to write.

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
- **Splits are kept, not collapsed.** Newsfeed (7 v 2), events (10 v 4), release (4 v 1). The
  release split is the highest-value row in the table: separation of duties is asserted by a
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
- **`ReleaseRepository` — 3.** Batch list, batch detail, and `approverFor` — the last is what
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

### The pattern behind L-12 to L-14, and the consolidated TAB 07 input

Four resources in, the same shape had appeared four times, so it was measured rather than
discovered a fifth time. [`tab-07-input.md`](./tab-07-input.md) is the result.

**The field counts are comparable** — wire 11–27, domain 8–21 — so this is not a size problem. It
is a **composition** problem: the console's models carry structured sub-objects the wire flattens
or does not send (`eligibility`, `responsibility`, `disclosure`, `assessment`, `checklist`,
`sectors`).

**One root cause.** The console was built against a mock *it also authored*, so its models are
shaped by what the screens wanted and the API's projections by what the modules own. Nobody was
wrong; the two were never compared, and TAB 05 is the first thing that has tried to satisfy one
from the other. That is why the gaps cluster in the same place every time.

**`AssistanceProgram` is the sharpest, and is why programmes are recorded as *cannot be
constructed*.** `ProgramResponsibility` requires a `statement` — *"what the office may honestly
tell an applicant, in one sentence"* — and `sources`. The wire carries `owner_office`,
`decided_by`, `authority` and `funding_source_label`, and neither of the two. Synthesising one
produces a record the domain's own validator rejects: `claim-without-source` is a defined problem
code, and so is **`national-programme-claimed-as-owned`**. CLAUDE.md states that AICS is a DSWD
programme with DSWD-disbursed funds and that recording it otherwise *"was a defect, not a wording
preference"*.

A guessed mapping there does not produce a slightly-wrong field. It produces the console telling an
applicant that the municipality runs a programme it does not run.

**A note on what a "maps cleanly" row means.** In `port-mapping.md` it means *the route matches*.
It does not mean the payload fills the model. That distinction was not visible until mappers were
written against real field names, and it is the main thing this stretch of TAB 05 established.

### Notifications mapped — and the distinction that makes it possible

`GET me/notifications` is the cleanest resource so far, and the reason is worth stating because it
is the rule the rest of TAB 05 turns on.

Three domain fields are absent from the payload and are nevertheless **determined, not guessed**:

| Field | Value | Why it is not an invention |
| --- | --- | --- |
| `channel` | `'inbox'` | That is what the endpoint *is* |
| `autoDismissMs` | `null` | An inbox entry is not a toast; nothing dismisses it on a timer |
| `recipientId` | `null` (the caller) | The route is `me/…`; there is no other person it could be about |

**A field the endpoint's own contract fixes is not the same as a field nobody sent.** Compare
`household.mapper.ts`, where the absent field was a claim about a household's vulnerability and
the mapper was therefore left unwritten. That is the whole line, and it is why some resources map
and others cannot.

Two smaller judgements, both tested:

- An unrecognised `priority` becomes `'info'`, never `'error'`. An inbox that cries wolf on every
  unfamiliar type is an inbox people stop reading, which is how the one real alert gets missed.
- An unrecognised `subject_type` yields **no action** rather than a guessed route. A link that
  404s is worse than no link, because the user concludes the record is gone rather than that the
  console failed to understand the reference.

The payload carries `subject_type` and `subject_id` and **no narrative**, which the console
preserves: a notification says something happened and points at it, and the record itself is read
over the authenticated API behind its own permission — the same rule the push payload follows.

`npm run verify` green — 81 files, **1513 tests**, 22 checks.

### Audit rows mapped — the row that must not carry values

`DL-114` splits the trail in two: reading *that* a record changed is oversight, and reading *what
it changed to* is access to the record. The list is designed to be scrolled and filtered by
somebody reviewing other people's work, so a row reading `monthlyIncome: 3,200 → 18,000` would
disclose a resident's income to every reviewer who filtered by date.

**The API agrees, and the payload proves it:** `changed_fields` carries field *names*, and the
values live behind `audit.view-detail` on a separate resource. The mapper's job is to keep that
true, so it reads names and nothing else — there is deliberately no branch that could pick up a
value if one ever appeared. Asserted directly: a payload carrying `old`/`new` alongside a field
name produces a row whose serialised form contains neither number.

**Unknown classification fails to the most sensitive, not the least.** A field the console cannot
classify is treated as `sensitive-personal` rather than `public`. This is the one place in the
trail where failing open would itself disclose something, so it fails closed — the same direction
as TAB 03's unknown-permission handling, for the same reason.

`npm run verify` green — 82 files, **1519 tests**, 22 checks.

### Where the mappers stand

**Written:** `wire.ts` (the shared layer), residents, households, notifications, audit rows.
**Deliberately not written, each with the reason in the file:** `toHouseholdSummary` (L-14),
programmes (`ProgramResponsibility` cannot be synthesised), assistance-request list rows (L-13).

The four that are written share a property the three that are not do not have: **every field the
wire omits is either fixed by the endpoint's own contract, or is honestly absent.** None of them
required the console to state something about a household, a family or a programme that nobody
sent.

---

## TAB 13 (brought forward) — F-09 closed: the console now has a hosting configuration

Brought forward out of order because it is a **precondition for any deployment**, and because
until it exists the console's authentication model is unsound however correct the code is.

The sweep recorded F-09: *no* hosting configuration of any kind — no `netlify.toml`, no
`_headers`, no `_redirects`, no `Dockerfile`. ADR 0005 and ADR 0006 both name a strict
Content-Security-Policy among the mitigations for the XSS exposure bearer tokens carry, and the
backend's topology document is unambiguous: *"If the policy below is not deployed, the residual
risk both ADRs accepted is unmitigated, not merely undocumented."*

ADR 0006 holds the token in memory precisely so injected script cannot read a **persisted**
credential — but it can still read a variable. The CSP is what closes that.

### What was added

| File | Why both |
| --- | --- |
| `netlify.toml` | Source of truth: CSP, companion headers, SPA fallback, cache policy, and a deploy-preview context pinned to the **staging** API |
| `public/_headers`, `public/_redirects` | Ship **inside the bundle**, so the policy survives a host configured from a dashboard, or a move to a different static host |

Both confirmed present in `dist/…/browser/` after a production build.

### Three decisions worth stating

- **No `'unsafe-inline'` in `style-src`.** Angular emits component styles as inline `<style>`
  blocks, and the sanctioned answer is `ngCspNonce` with a per-response nonce. Adding
  `'unsafe-inline'` to make the build work is the exact silent weakening the topology document
  warns about — it re-opens the injection path the whole policy exists to close.
- **`Strict-Transport-Security` is deliberately absent.** It cannot be undone from the server: a
  browser that has seen it refuses plain HTTP for the whole `max-age`, so a certificate problem
  locks the office out of its own console with no server-side remedy. It goes in **after** the
  domain and certificate chain are confirmed, and the ordering is the decision.
- **Deploy previews reach staging only, and carry `noindex`.** Anybody can create a site on a
  shared hosting domain, so a preview trusted by the production API would be a public front door
  to residents' records.

### The rules, mutation-tested

`check:contract` gains five, each proven against its own planted regression: `'unsafe-inline'`
added, a wildcard `connect-src`, `frame-ancestors` dropped, HSTS set early, and the SPA fallback
removed.

**And it bit the same way twice.** The first version read this file's own comments as
configuration — the paragraphs explaining the CSP and stating why HSTS is absent — and failed on
its own documentation. Exactly the failure TAB 01 recorded when `check:contract` first tripped on
the comment explaining `withCredentials`. A rule that fails on its own explanation teaches people
to delete the explanation, so both checkers now strip comments and read only configuration.

### Still not deployable, and this does not change that

The `<approved-domain>` placeholders are real hostnames somebody must supply, and the backend's
release gate remains **NO-GO** on blockers no engineering closes: no DPO holds `audit.view`, no
approved retention schedule, and no backup has ever been restored. What changed is that the
console is no longer *missing a control it depends on* — TAB 13's remaining work is verification
against a deployed origin, which needs an origin.

---

## TAB 05 step 10 — the API was run, and the mappers were checked against it

**The console's target ran for the first time in this integration.** No Docker, no PostgreSQL and
no package manager exist on this machine, so the backend was migrated against a **file database**,
seeded, and served over HTTP on `127.0.0.1:8000`.

| Step | Result |
| --- | --- |
| `artisan migrate` | all 38 migrations, **100 tables** |
| `artisan db:seed` | 5 barangays, 5 households, 13 residents |
| `artisan serve` | live; `GET /api/v1/health` → `200` |

### What that proved, on the wire rather than in a document

| Divergence | Verified |
| --- | --- |
| **F-08** | `VALIDATION_FAILED`, `UNAUTHENTICATED`, `METHOD_NOT_ALLOWED` — SCREAMING_SNAKE_CASE, matching what TAB 01 published. The console's `code` branching matches reality |
| **D6** | `{error:{code,message,details,request_id}}`, with `details` as `field → [messages]` — parsed by `readApiError` field for field |
| **D4** | `meta.pagination` with **all five keys including `has_more`**. The console's old `meta.pageSize`/`totalItems` appear nowhere |
| **D5** | `?per_page=2` honoured and echoed. `pageSize` would have been ignored and every list silently served the default 25 |
| **TAB 03** | `GET /me` returns server-resolved `permissions[]` and `roles[]`, ingested by `fromServerIdentity` |

### TAB 02's acceptance criterion, met end to end

*"Sign in with MFA, work, sign out; the revoked token is refused by the API on the next call."*

1. Password on an unenrolled account → **`mfa-enrolment-required`**, `expires_at` **15 minutes**.
   Before the TAB 02 fix this same request returned `201` and a full twelve-hour session.
2. That restricted token: `GET admin/residents` → **`403 FORBIDDEN`** with the enrolment message;
   `POST me/mfa` → **`201`**; `GET me` → **`200`**. The restriction is real, not advisory.
3. Enrolled a factor with a live TOTP code, signed in again → **`mfa-required`** + challenge, then
   `auth/tokens/mfa` → a session with `expires_at` **12 hours**.
4. `DELETE auth/tokens/current` → `GET me` went **200 → 401**. Sign-out revokes server-side.

### TAB 03's step 8, met by accident and then on purpose

The seeded account holds `security_officer`, which does not carry `resident.view`. A direct call to
`admin/residents` was refused **`403 FORBIDDEN`**, with `details.required_permission` naming the
grant. That is the *"call the endpoint directly with a token that lacks it"* criterion, satisfied
against a running server — and it also gives TAB 16 the field a refusal message should quote.

### Two operational findings

- **The MFA challenge needs a shared, persistent cache.** With `CACHE_STORE=array` the challenge
  issued by one request does not exist for the next, and the second factor always answers *"that
  sign-in attempt has expired"*. Production uses Redis and is unaffected; anyone running locally
  must not use the array store, and it belongs in the setup notes.
- **The sign-in routes hard-depend on Redis being reachable.** With Redis down, `POST auth/tokens`
  answers `500 SERVER_ERROR` from the rate limiter before validation runs — so a Redis outage
  presents as "the server is broken", not "sign-in is throttled". Worth a degradation test in
  TAB 15.

### The recorded fixtures

Six payloads captured verbatim into `src/app/data/http/recorded/`, with **bearer tokens and MFA
challenges replaced by `<redacted-…>`** — a credential in a fixture is a credential in the
repository, and this one is public. A test asserts no token-shaped string survives.

This is what step 10 asked for: *"not hand-written fixtures, which drift toward what the author
expected. Capture them from staging."*

### What this does **not** prove

The database was **SQLite, not PostgreSQL**. Response shape does not vary by driver, so everything
above holds — but nothing about concurrency, row locking or `lockForUpdate` is proven, and
**release-gate blocker 4 stands untouched**. `artisan migrate` against real PostgreSQL remains
unrun, and TAB 00 step 5 stays open.

`npm run verify` green — 83 files, **1532 tests**, 22 checks.

---

## CI — the console had none, and the scan became a standing gate

Found immediately after the first push: the backend has a pipeline; **the console had no CI at
all.** Twenty-two repository checks and 1,532 tests existed and ran only when somebody remembered
to run them locally, so the answer to *"is `main` green?"* was *"probably"*. Twenty-six commits
were published before anything verified them.

`.github/workflows/ci.yml` now runs on every push and every pull request, in the backend's own
style and with no `continue-on-error` anywhere: `npm ci` (the install is itself a check — a
populated `node_modules` masks a broken one), `npm run verify`, and two artefact checks that
nothing else would catch:

- **`_headers` and `_redirects` reach the bundle.** They are the fallback copies of the CSP and
  the SPA fallback. A build-configuration change that stopped copying them would silently remove
  the policy ADR 0005 and ADR 0006 depend on.
- **No credential-shaped string in `dist/`.** The recorded fixtures carry redacted tokens; this
  keeps that true.

### The secret scan is now a job, in both repositories

TAB 00 said the scan becomes *"a standing pre-push gate rather than a one-off"* while a repository
is public. It now is — a separate job, so a finding reads as *"do not publish"* rather than
*"a test is flaky"*.

Making it a gate required two fixes to the scanner, and both are the interesting part.

**An accepted-findings allowlist.** Five hits across the two repositories are real matches on
synthetic values: fixtures inside tests that exist to prove credentials *do not* leak, and a
historical blob of this ledger from before TAB 01 redacted a quotation. Without a way to accept
them the gate is permanently red, and **a permanently red gate is one everybody learns to
ignore** — worse than not having it. The alternative people reach for is loosening the pattern,
which blinds the scanner to the real thing too. So the pattern stays sharp and each accepted hit
is listed by `rule|path` with a reason somebody wrote, in a file whose whole purpose is to be
argued with.

Mutation-tested with a planted AWS key: still caught, with the allowlist in place.

**It was scanning unreachable objects.** `--batch-all-objects` also yields dangling blobs left by
aborted operations — a `git add` followed by a reset, a rebase. Those can never be pushed and no
history rewrite removes them, so reporting them produces alarms nobody can action. Found the way
these things usually are: the planted probe kept being reported after it was removed. The scan now
reads objects reachable from refs, via `git rev-list --objects --all`.

Both repositories: **0 findings**, 1 and 3 accepted respectively.

Console verify green — 83 files, 1,532 tests, 22 checks. Backend 914 tests, Pint clean.

---

## Field visits — the first complex resource that maps

Worth recording as clearly as the failures, because it shows what "good" looks like on this seam.

A visit was **created through the running API**, an observation recorded against it, and the
result read back. The detail endpoint returns 19 fields — `observations`, `checklist`, `outcome`,
`service_needs`, `declined_reason`, everything the visit screens read. `toFieldVisit` is written
and tested against those recorded payloads.

**Both vocabularies already agreed, string for string:** `VisitStatus` (5) and `VisitPurpose` (6).
The first attempt failed validation because *I* sent `assessment` rather than
`initial-assessment` — my input was wrong, not the API.

**And the API enforces the doctrine the console documents.** Recording an attribution on anything
other than a third-party account is refused: *"Only something said by a third party carries an
attribution."* That is `DL-85` — the rule that keeps "the roof is missing sheets", "she says he
has not sent money since March" and "the household appears unable to meet its food costs" from
collapsing into one paragraph a later worker reads as established fact. Both sides reached it
independently, and the server holds the line.

### One constraint recorded rather than papered over

The list payload has **11 fields and no `observations` key**; the detail has 19. A mapper filling
`observations: []` from a list row would be claiming a worker recorded nothing — which on a
*completed* visit is a claim about that worker's diligence.

An empty list is honest for a newly scheduled visit and dishonest for a completed one read from a
list row, and the model has no way to say "not loaded". So the constraint is stated in the mapper:
**screens must fetch the detail before showing "no observations recorded"**. Same shape as L-14,
caught before it shipped rather than after.

`recordedBy` is left empty rather than invented — the payload does not name the recorder, and a
wrong name against somebody's observation is worse than none.

### Where the mappers now stand

| Written, against recorded responses | Cannot be constructed |
| --- | --- |
| residents, households, notifications, audit rows, **field visits** | programmes, assistance requests (L-16/L-17), household summaries (L-14), assistance list rows (L-13) |

`npm run verify` green — 85 files, **1,550 tests**, 22 checks.

---

## TAB 06 — the generated contract, vendored and checked

### Step 1 — the console consumes the backend's artefact instead of restating it

`docs/api/types.ts` is vendored to `src/app/data/http/contract/types.ts`, with its provenance
recorded beside it: repository, **full commit SHA**, file `sha256`, and the date.

`ApiErrorCode` is now **re-exported from the vendored file** rather than declared in
`api.contract.ts`. That is the whole point of the exercise: a backend enum change becomes a
**TypeScript error in this console** instead of a runtime surprise. Restating the union locally
would have put the console back exactly where TAB 01 found it — holding a second description of
the API and discovering the difference in production.

### Step 2 — `check:contract-drift`, and what it can and cannot know

Four rules, each mutation-tested:

| Rule | Planted regression | Result |
| --- | --- | --- |
| The vendored file matches its recorded `sha256` | a line appended by hand | **caught** |
| Provenance identifies a commit unambiguously | full SHA replaced with the short one | **caught** |
| The runtime list matches the compile-time union | `RATE_LIMITED` removed from `API_ERROR_CODES` | **caught** |
| Wire vocabulary stays behind the transport seam | the contract imported from `features/` | **caught** |

The third is the one worth explaining. A TypeScript union does not exist at run time, and
`isApiErrorCode` has to check *something* — so the vocabulary is described twice, once as a type
and once as an array. **Two descriptions of one thing is the exact shape of every divergence this
integration has found**, so the pair is checked rather than trusted. A code in the union but
missing from the list means the console silently treats a real error as unrecognised.

**What this check cannot know** is whether the backend has moved since that commit — this
repository holds no copy of it. That is the provider half of TAB 06: a backend CI job replaying
recorded consumer expectations against the real router, failing when a response stops satisfying
one. Stated here rather than left implied, because a drift check that sounds like it watches the
backend and does not is worse than none.

`npm run verify` green — 89 files, 1,566 tests, **23 checks**.

### Step 3 — the consumer half of a real contract test

`tools/emit-consumer-expectations.mjs` derives, from the mappers themselves, what this console
requires off the wire: the `field(wire, '…')` reads, and the null-guards that decide whether a
record survives. The backend vendors the output and replays it against its real router.

It is **derived, never written**. A hand-maintained expectations file would be a third description
of the API beside the mapper and the controller, and `--check` fails when a mapper changes what it
reads and the committed file still describes the old shape — mutation-tested by relaxing a guard,
which flipped `birth_date` from required to optional and was caught.

Eight interactions, 24 required fields. `required` is the set worth gating: absence makes the
mapper return `null`, the record is dropped, and the list is simply shorter with nothing on screen
saying so.

### L-22 — the mapping layer is proven, and unused

Twenty adapter classes. **Forty-five reads. Zero mappers.** Every read in `http-repositories.ts`
still does:

```ts
return this.api.page<ResidentView>(API_ENDPOINTS.residents, page, filter);
```

That generic is an assertion, not a conversion. It tells TypeScript the `snake_case` payload *is* a
`ResidentView`; nothing at run time makes that true. `barangay_id` never becomes
`address.barangayId`, and the property a template reads comes back `undefined` — which renders
blank rather than raising anything.

So TAB 05's mappers are tested, correct, and not on the path any screen takes. **The console is
presently no safer than it was before they existed.** Repointing twenty adapters is TAB 12's work.

What belongs here is that the gap can only close: `check:mapper-adoption` records the ceiling of 45
and fails **in both directions** — a forty-sixth cast, and a cast removed without lowering the
number in the same commit. Both mutation-tested. A ceiling rather than an allowlist because a list
somebody edits routinely is a list nobody reads.

It is a ratchet, not a gate. It does not claim the 45 are acceptable; it guarantees the
forty-sixth cannot arrive quietly, which is the only thing a check can honestly promise while the
work is outstanding.

`npm run verify` green — 89 files, 1,566 tests, **25 checks**.

### L-23 — most of the console's permission vocabulary does not exist on the server

Chasing a stale line in the backend's gap list (G-09: *"the catalog holds 2 of about 31
permissions"*) turned up something much larger, and it is the most consequential divergence this
integration has found.

|  | count |
| --- | --- |
| permission keys the console defines | 70 |
| permission keys the API publishes (`AccessControlPermission`) | 61 |
| **keys both sides agree on** | **30** |
| console keys with no server counterpart | 40 |
| server keys the console never asks for | 31 |

The 30 that match are the assistance-request lifecycle, referrals, visits, reports, staff, events
and newsfeed — the spine of the product, and it holds. What diverges is everything around it.

**Why this is not cosmetic.** `fromServerIdentity` keeps only the keys it recognises from the list
the server sends, and invents nothing — correct, and the fail-closed behaviour TAB 02 built
deliberately. So a key the API has never heard of can never be held by anyone, and the guard on it
refuses every user in every role, permanently.

Measured against `app.routes.ts`: **24 of 43 permission-guarded routes are unreachable**, including
`dashboard.view` — the landing page.

They are not one problem, and the fixes differ:

* **naming divergence over an act both sides implement** — the console splits `resident.create` and
  `resident.update`; the API grants `resident.manage`. Likewise `release.*` against the API's
  `request.release`;
* **concepts the API genuinely does not have** — `case.view` awaits ADR 0044, `beneficiary.*` is a
  projection this console invented (`DL-71`), and `dashboard.view` and `settings.manage` have no
  server counterpart at all.

Which is which is the API owner's and the office's decision, not a checker's — it is on the master
TODO. `check:permission-parity` holds the line meanwhile, failing in both directions: a new
unreachable guard, and a guard reconciled without lowering the number. Both mutation-tested.

**Nothing is broken today**, because the console still runs on mock adapters where every route
opens. It breaks the day TAB 12 flips `dataSource` — and it breaks as a blank console rather than
an error, which is why it is recorded here at full size rather than left for that TAB to discover.

---

## TAB 09 — documents and files

*"What the office read when it decided must stay readable, and reachable only by the people
entitled to it."*

### The console had no file transport at all

The command says so, and it was accurate: the **domain** was well shaped — grant-based opening,
append-only versions, conditional applicability, no URL on the model — and there was no way to
move a byte. `data/http/file-transport.ts` is that, built once.

| Requirement | How it is met |
| --- | --- |
| Multipart upload with progress | `HttpEventType.UploadProgress`, reported as bytes sent |
| Cancellation | the subscription's — unsubscribe aborts, so there is no `cancel()` to forget |
| Client-side size and type check | a **courtesy**, run before a byte leaves; the server re-checks leading bytes |
| The policy | a **parameter**, read from the API's own `accepts` block — never a constant here |
| 413 | including the `status: 0` case — see below |
| Opening a granted file | `documents/${grant.handle}` and nothing else |
| Browser storage | never written to; asserted with a spy on `Storage.prototype.setItem` |

### The 413 that does not look like one

If nginx rejects a body before Laravel sees it, the response carries **no CORS headers**, so the
browser refuses to expose it and reports `status: 0` — indistinguishable, to naive code, from the
server being down. A console that says *"could not reach the server"* there sends somebody to check
their wifi over a file that is simply too big.

So `status === 0` on an upload is reported as **too large**, carrying the real figures so a screen
can say *"12 MB, and the limit is 10"*. It is a guess, and it is the right one: being wrong costs a
retry, which the user would attempt anyway; being wrong the other way costs a support call. The
deployment half — `client_max_body_size` above the application limit — is in
[`manual-actions.md`](./manual-actions.md), because it cannot be fixed from a repository.

### `check:documents-transport`

The four guardrails plus the storage one, each mutation-tested:

| Planted regression | Result |
| --- | --- |
| a code path that deletes a document version | **caught** |
| a screen building a document byte URL from an identifier | **caught** |
| a public object URL | **caught** |
| a downloaded file written to browser storage | **caught** |
| a domain field for an unmasked document number | **caught** |

**Two rules of mine needed correcting rather than routing around.** The first version of the URL
rule flagged the *grant-issuing* endpoint, which is legitimate — the console must build
`.../documents/{version}/access` to ask for a grant, and that returns JSON after an authorization
decision. A check that fires on correct code teaches somebody to weaken the check.

And `check:contract` flagged the new spec for containing an API origin. Specs are now exempt from
that **one** rule, narrowly: a test asserting the URL a request used proves the base was applied,
which is the opposite of the defect the rule catches. Mutation-tested afterwards to confirm an
adapter hand-building a URL is still caught — an exemption that blunts the rule is worse than the
inconvenience it removed.

### What TAB 09 asked the API for

Only one thing was missing, and it was precise: **the grant did not say where the scanner got to.**
The version listing had `scan_status` all along, and the listing is not the moment that matters —
the grant is what a client holds at the instant it opens the file.

The warning is now composed **on the server**, for the same reason the payout manifest is: a
sentence assembled by a screen stops being true when a new case appears, and nobody notices because
the screen still renders something. An unscanned file says so first: accountability is a fact about
the record, risk is a fact that should change what somebody does next.

Enforcement was already correct and untouched — an infected file is never served, and a pending one
is viewable inside the office but cannot be shared.

### Retention: access expires, disposal waits

A person-level export becomes **unreachable** on schedule — expired, another person's, unknown and
no-longer-permitted all answer NOT FOUND alike. The bytes are **not** deleted, and that is
deliberate rather than an omission: `mayPurge()` refuses everything while the retention schedule is
unapproved, because an office that believes it may delete after five years, and does, cannot undo
it. Appointing the DPO and approving the schedule is the same manual item that has blocked this
since TAB 07.

### Unverified because the environment does not exist

TAB 09's precondition — *"Object storage provisioned with separate private and public
credentials"* — is unmet. Two buckets, least-privilege keys, and signed-URL issuance against a real
store are **designed and unproven**. The access-grant model does not depend on the store, so it
holds; the storage posture does not.

---

## TAB 12 — cutover engineering

*"Flipping one flag is the easy part. Deciding what happens when it is wrong is the command."*

### The environment matrix

| | `dataSource` | API | devtools |
| --- | --- | --- | --- |
| `local-mock` | mock | localhost (unused) | on |
| `local-api` | http | `http://localhost:8000/api/v1` | on |
| `staging` | http | `https://api-staging.<approved-domain>/api/v1` | on |
| `production` | http | `https://api.<approved-domain>/api/v1` | off |

Each names itself, because *"which build is this?"* is the first question asked about an
environment nobody can attach a debugger to, and `production: boolean` cannot tell `local-mock`
from `local-api`.

### The misconfiguration that had already shipped

`environment.ts` carried `production: true` **and** `dataSource: 'mock'`. Nothing objected: the
build succeeded, every test passed, the bundle was valid, and the application would have served
invented residents to whoever opened it.

`check:environments` fails the build on that and five more, each mutation-tested:

| Planted regression | Result |
| --- | --- |
| production selecting the mock | **caught** |
| production pointing at localhost | **caught** |
| production over plaintext | **caught** |
| developer tooling in production | **caught** |
| something shaped like a credential | **caught** |
| a staging build able to reach production | **caught** |
| an API host no CSP allows | **caught** |

### `check:bundle` found the real defect on its first run

It inspects the **artefact**, because TAB 12 says an assumption is not a guarantee. It reported
`Marilou` and `Bautista family` in `main-*.js` — seed records in a production build.

The cause was structural. The seam was one module holding both adapter sets, chosen at runtime:

```ts
environment.dataSource === 'http' ? httpProviders() : mockProviders()
```

A **runtime** decision over **static** imports, so every mock repository — and through them the
whole seed registry — stayed reachable from a live import. It is now two files swapped by
`angular.json` exactly as environments are (`DL-136`): a production build cannot reach the mock
because it never imports it. Initial bundle **43 kB**, artefact clean.

### Three mistakes of mine, and what each would have cost

1. **A staging API host no CSP allowed.** I wrote `staging-api.<approved-domain>` where
   `netlify.toml` had long said `api-staging.<approved-domain>`. Both plausible; together, a console
   that loads perfectly and cannot reach its API — every request blocked by the browser before it
   leaves, with nothing in any server log to explain it.
2. **The rule I added to catch that could not fail.** `new URL` throws on the `<approved-domain>`
   placeholder, so the `catch` skipped silently and the check passed unconditionally. A check that
   cannot fail is worse than no check: it reports a guarantee nobody has. It compares origins
   textually now.
3. **`check:contract` had stopped checking.** It named `environment.development.ts`, which the
   matrix replaced — so the rule that guards the versioned base URL had quietly lost its subject.
   It discovers the files now rather than listing them.

`public/_headers` had also drifted from `netlify.toml`: hashed assets were `immutable` in one and
unspecified in the other, and `_headers` is the copy that ships **inside** the bundle. Both now
agree, `media/` included.

### What this does **not** mean

**Production is correctly configured and would not work.** Setting `dataSource: 'http'` makes the
configuration honest; it does not make the console ready:

* **L-22** — 45 adapter reads still cast wire payloads straight to domain types without a mapper,
  so `barangay_id` never becomes `address.barangayId` and lists render blank rather than erroring.
* **L-23** — 24 of 43 permission-guarded routes ask for keys this API never sends, including
  `dashboard.view`. Those screens are unreachable for every role.

Before TAB 12 this was invisible: production said `mock`, so it "worked" by serving fiction. It is
now visible as two named findings with ratchets holding them, which is the point. **Neither is
TAB 12's to fix** — L-22 is adapter work, L-23 is a vocabulary decision on the master TODO — and a
production deploy before both are closed would put a blank console in front of the office.

### Blocked

* **Step 4, the dual-run.** Needs staging. It would also not be meaningful yet: with L-22 and L-23
  open, the diff between mock and API is *predictably* enormous and already explained, so running
  it now would produce noise rather than findings.
* **Step 7, cutover instrumentation.** Error rate, API failure rate by status and page-load timing
  need a host and a dashboard, and there is neither.
* **The rollback rehearsal.** Written up in [`rollback.md`](./rollback.md) and honestly marked as an
  estimate rather than a measurement — five minutes, from the hosting model, not from a run.

---

## TAB 13 — console security hardening

*"The Content-Security-Policy is not hardening polish. Two accepted risks depend on it."*

### Why the severity is real

ADR 0005 and ADR 0006 chose a first-party bearer token held in a private field over a cookie, and
that choice **accepted** a residual XSS risk on the stated basis that a strict CSP would contain it.
A token in memory has no `HttpOnly` to fall back on: the thing between an injected script and a
caseworker's session is `script-src 'self'`.

### `style-src` was missing entirely

The policy had `default-src`, `script-src`, `connect-src`, `object-src`, `base-uri`,
`frame-ancestors`, `form-action` and `img-src` — and no `style-src`. So Angular's build-time
critical-CSS block, **2,324 characters of inline `<style>` in `index.html`**, fell through to
`default-src 'self'` and would have been blocked. The console would have rendered unstyled on its
first deploy.

The obvious fix is `style-src 'self' 'unsafe-inline'`, and the command names that exact move as
*"the exact silent weakening the topology document warns about."*

**Fixed by changing the feature.** `inlineCritical: false` in `angular.json` removes the inline
block: the production `index.html` now carries **zero** inline `<style>` and one external
stylesheet, so `style-src 'self'` needs no nonce, no hash and no exception.

That is also why no per-response nonce was built. TAB 13 asks for one, and a nonce requires a
dynamic response — an edge function rewriting `index.html` on a static host. With nothing inline
there is nothing to nonce, which is a smaller system that is easier to keep correct. The app has no
literal `style=` attribute anywhere, and Angular's `[style.x]` bindings go through the CSSOM rather
than being parsed as inline attributes, so they are unaffected.

### `check:headers`, mutation-tested

| Planted regression | Result |
| --- | --- |
| `unsafe-inline` added to make the build work | **caught** |
| `unsafe-eval` in `script-src` | **caught** |
| a directive dropped entirely | **caught** |
| a wildcard source | **caught** |
| a companion header removed | **caught** |
| HSTS enabled before the certificate chain is confirmed | **caught** |
| `netlify.toml` and `public/_headers` drifting apart | **caught** |
| `upgrade-insecure-requests` dropped | **caught** |

The HSTS rule is a refusal rather than a requirement: it cannot be undone from the server, and a
wrong `max-age` locks every browser out of the console for its duration. Its absence is documented
in `netlify.toml`, and the first version of this check failed the build on that comment — telling
somebody to delete the sentence explaining the decision.

### Secrets in the artefact, not just in history

`docs/integration/tools/secret-scan.php` reads git history and **skips minified bundles**,
reasonably: a megabyte of transpiled JavaScript defeats a generic entropy rule.

That left the case TAB 13 names — *"anything a build variable could have baked in."* A static
host's build variables are public, and a value read at build time never appears in git at all. It
appears for the first time in the artefact, which is where nothing was looking.

`check:bundle` now scans the built files for **shaped** credentials rather than entropy — private
keys, AWS/Google/GitHub/Stripe/Slack formats, and anything assigned to a credential-shaped name.
Four planted secrets, four caught.

### Already correct, and verified rather than changed

* **CORS**: `allowed_origins` from an environment variable with an empty pattern list,
  `supports_credentials => false`, and seven tests including *"the origin allow list is never a
  wildcard"* and *"an unlisted origin is never echoed back"*.
* **Trusted proxies**: read from `config('api.trusted_proxies')` and applied in
  `SharedServiceProvider` — without which rate limiting collapses to one shared key and every audit
  entry is attributed to the load balancer.
* **Supply chain**: lockfile committed, `npm audit --omit=dev --audit-level=high` reports **0
  vulnerabilities** and now runs in `verify`.

### Blocked

**Step 6 — verify by inspection.** *"Fetch the deployed console and the deployed API and read the
response headers. A policy in a file is not a policy in production."* Nothing is deployed, so every
claim above is about files. That distinction is the command's own, and it stands: this TAB has made
the policy correct and unweakenable **in the repository**, and has proven nothing about what a
browser will actually receive.

**Step 9's CI half.** The checks exist and run in `npm run verify`; there is no CI to run them in,
by the owner's decision. A header regression fails a local gate rather than a build.

---

## TAB 16 — accessibility, language and content

*"Real names are longer than seed names, and a caseworker reads this screen forty times a day."*

Most of this TAB needs a person at a screen — keyboard order, screen-reader announcements, an older
monitor in a bright office. Three things did not, and one of them was a disclosure.

### The search term was in the URL

TAB 16's guardrail: *"Never put a resident's name in a page title, a browser tab or a URL that a
screenshot or a shared link would carry."*

The search screen wrote the term to `?q=`, and both a test and `check:search` enforced that
deliberately, citing `DL-36`: *"A search should be a link somebody can send a colleague, and the
back button should behave."*

So a search for `Dela Cruz` put that name in the address bar — in every screenshot of that screen,
in every pasted link, and in **browser history**, which outlives the session and belongs to whoever
sits at that desk next. `DL-110` had already reached this conclusion for storage; the URL is
persistence, and was simply a surface that entry did not name.

Now held in a signal for the tab (`DL-137`). `DL-36` is **narrowed rather than overturned**: filter
state stays in the URL, because a barangay, a status and a date range are office vocabulary that
describe no individual. What is lost is a shareable search link — and the colleague is staff with
the same access, who can type the name themselves.

`check:search` now enforces the opposite of what it enforced, with the supersession written into
the rule.

### Field errors reached nobody

Step 8: *"The server responded with 422 tells a caseworker nothing. It should name the field, say
what is wrong, and say what to do — assembled from the API's [details], which TAB 01 made
available."*

TAB 01 made `details` available and **nothing ever read it**. A validation failure showed the
envelope's generic sentence, so a form with one bad field said only that something was wrong, on a
screen with fourteen inputs.

`describeFailure` assembles them now, and **uses the API's wording verbatim**. Field names are
humanised mechanically — `street_address` → "Street address" — because the wire name is the
server's vocabulary; the *message* stays the server's, because a layer that rephrased it would be a
second description of every validation rule in the system, drifting from the one that refuses.

### Contrast, computed rather than eyeballed

Twenty token pairs at WCAG 2.2 AA, and **all of them already passed** — the palette was sound.
Mutation-tested against four regressions.

**The first version of this check was wrong, and it is worth recording why.** It compared the
luminance of the status tints and failed when two were within 0.01 — which fired immediately on a
palette that is fine. Six pale background tints share a narrow luminance band by design; separating
them enough to be told apart in greyscale would mean redesigning the palette to satisfy a rule
stricter than WCAG, for no accessibility gain.

WCAG 1.4.1 requires that colour is not the **only** means of conveying information, and `StatusBadge`
renders `{{ label() }}` — every status is a word before it is a colour. The greyscale test is how
you *demonstrate* that, not the thing itself. The check now asserts the label, which is what would
actually break.

### The Filipino question, decided

**Not localised** (`DL-138`), and the reasoning is on the record. The mobile client speaks to
residents, who are entitled to their own language; this console is used by staff who work in English
— the forms, the DSWD issuances and the reports filed upward are all English, and a console saying
*"Naipasa"* against a form saying *"Endorsed"* would add a translation step to every act.

The deciding argument is the guardrail: *"Do not machine-translate welfare terminology. A
mistranslated status is a mistranslated decision."* Words like `endorsed`, `deferred` and
`unclaimed` were argued over in earlier commands; translating them is the MSWDO's decision about
their own vocabulary.

**Cheap to reverse**, which is why it can be taken now: every screen already reads its text from a
`*.copy.ts` file, so adding a locale is a translation job rather than a rewrite.

### Blocked — and it is most of the TAB

Steps 1–6 in full: the audit against real data, the keyboard walkthrough, the screen-reader
walkthrough with NVDA and a mobile reader, zoom to 200% at 320 CSS pixels, the office's actual
hardware and browser, and the WCAG 2.2 additions. **Automated checks catch roughly a third of
issues; the rest need a person**, and that person needs a running console against real data.

Step 7, the string review with the MSWDO, and step 12, the print paths, are the same: they need the
office.

### L-24 — the filter panel narrows nothing, and the list it returns is complete

Swept 2026-08-29 against a green `npm run verify` (all 38 checks, 93 spec files, production
build clean). `L-22` recorded the inbound half of this expression; this is the outbound half of
the same line, and it is the more serious of the two.

```ts
return this.api.page<ResidentView>(API_ENDPOINTS.residents, page, filter);
```

`toQueryParams` (`api.contract.ts`) and `toParams` (`http-repositories.ts:1901`) copy every
filter key **verbatim**. Neither converts case. `per_page` is hand-written `snake_case` two
lines above `toQueryParams`' copy loop — the convention is stated and then not applied to
anything that came from the domain.

**Measured on the API side, not assumed.** Across every `V1` controller the accepted query
parameters are `snake_case` exclusively — `barangay_id`, `assigned_to`, `resident_id`,
`program_id`, `overdue_only`, `open_only`, `as_of`, `verification_tier` — and a grep for a
camelCase parameter returns **nothing, in any module**.

**The failure mode is 200, not 4xx.** `ReferralController::index`:

```php
foreach (['status', 'urgency', 'destination_type', 'resident_id'] as $filter) {
    $value = $request->query($filter);
    if (is_string($value) && $value !== '') { $query->where($filter, $value); }
}
```

`?residentId=…` leaves `$request->query('resident_id')` null, the `where` never runs, and the
endpoint answers with the whole queue under a heading that says it was narrowed.

**What this is not.** It is not an authorisation bypass and it must not be reported as one.
Every list controller scopes before it filters; `ResidentController` says so in a comment —
`barangay_id` is *"narrowing only … asking for a barangay outside it yields nothing rather than
widening anything"*. The actor's barangay scope holds throughout. What is lost is the
narrowing, inside that scope: for a barangay clerk, their own barangay; for a
municipality-scoped supervisor, every resident of a municipality of 397,111.

**Why every gate stayed green.** The single-word keys need no conversion, so `status`,
`search`, `category`, `q` and `scope` work — and a filter panel that half works demonstrates
itself with the half that does. `check:routes` compares path and verb, and the path is right at
that verb. `check:wire-adoption` reads `args[1]`, the request **body**, and returns early on a
read. `check:contract` governs the envelope. **Query parameters were covered by nothing.**

**Counted: 54 keys** — 40 across 13 `*Filter` interfaces, 14 hand-written at call sites
(`{ residentId: id }` at `:1434` and five more like it). Both halves are counted because both
are places somebody must edit.

`check:query-params` is the counter, and it is a ratchet on the same terms as
`check:mapper-adoption`: it fails when the number grows **and** when it shrinks without the
ceiling being lowered in the same commit. Proven red in both directions before it was trusted —
at ceiling 46 against 54 found, and against a planted `barangay_id` rename that made it report
53 and demand the ceiling move.

**What the counter does not cover, stated so a green run is not over-read.** It compares
**shape**, not existence: a key passes if the wire could carry it as written. Whether the
endpoint has that filter at all is a different question, and one instance is already known —
`http-repositories.ts:664` sends `{ view, ... }` to `admin/newsfeed` and **no `view` parameter
is read anywhere in the Content module**. It is lowercase, so it passes the check, and it is
discarded by the API. It is in neither number. A green run means *no new key was added in a
case the API cannot read*; it does not mean the filters work. **54 is a floor.** The claim that
the filters work needs the recorded consumer expectations replayed against the real router,
which is TAB 06's backend half and has never run.

**Not fixed here, deliberately.** The conversion belongs at the transport seam, in
`toQueryParams` and `toParams`, and converting there changes what forty-odd screens send in one
commit against an API this console has never once talked to. That is a change to make when
there is a staging deployment to watch it against — the same condition lines 02, 13, 16 and 17
of the launch gate are waiting on. Recorded, counted, and held.

### L-25 — the console does not model the case type the API restricts

The API's `CaseType` (`modules/Welfare/Domain/CaseType.php`) has seven values and says of one:

> `Protective` … a protection case concerns a VAWC survivor, a child at risk or a trafficking
> survivor, and **its very existence is sensitive**. It is gated by `request.view-sensitive`
> **everywhere — list, detail and count** … knowing a protection case exists for a named person
> is most of the disclosure.

The console has no `CaseType`. `SocialCase.category` is a `CaseCategory`, a **different**
seven-value vocabulary — `crisis-intervention`, `child-protection`, `family-welfare`,
`older-persons`, `disability-support`, `gender-based-violence`, `livelihood` — which shares
exactly **one** member with the API's set (`livelihood`), and whose own doc comment says it
*"Drives nothing — it is how a supervisor finds the child protection files."*

`WelfareCaseType` is present in the vendored contract and referenced by nothing, which is
correct: `check:contract-drift` rule 3 forbids importing wire vocabulary outside the transport
seam. That is the point worth recording rather than the unused type. The vendored contract's
stated purpose is that *"a change to the API's vocabulary becomes a TypeScript error here"* —
a mechanism that can only fire for a type something imports, and rule 3 means almost nothing
does. **Three of the fifty-six published vocabularies are referenced; a parity checker exists
for exactly one** (`check:permission-parity`, L-23), and the one time anybody compared a second
by hand it found two seven-value sets sharing one member.

No leak is claimed and none is demonstrated: the admin case surface is among the paths
`check:routes` already counts as absent, so nothing renders a protective case today. The
finding is that **when that surface is built, the restriction the API states three times has no
counterpart on this side**, and nothing in the repository would notice. It belongs with ADR
0044, which is where the case model is being decided.

### L-26 — every sortable column in the console is inert against the API

Found while measuring L-24, and it is the same shape one layer along: a parameter the console
sends carefully and the API does not read.

`docs/api/conventions.md` §5 **declares** sorting:

> Sorting: `?sort=field` / `?sort=-field` (leading `-` = descending), restricted to an
> endpoint-declared allow-list.

`toQueryParams` implements the console's half faithfully, `-` prefix and all. Seven list pages
wire a real `(sortChanged)` handler through `SortSpec` into `PageRequest.sort` — residents,
cases, requests, referrals, beneficiaries, households and releases — so a caseworker clicking a
column header produces a request that is correct by the published convention.

**Nothing reads it.** `PaginationParams::fromRequest` takes `page` and `per_page` and nothing
else. No list controller reads `sort` in any module. The single hit for `'sort'` across the
API's controllers is `SearchController`, where it is a **column stored on a `SavedView` row**,
not an ordering applied to a query. Each list applies its own fixed order instead —
`ResidentRegistry::query()` is `orderBy('last_name')->orderBy('first_name')`,
`ReferralRepository::inWorkingOrder()` is overdue-then-urgency-then-age.

**Corrected against myself while writing this:** the first reading of `ResidentController::index`
looked like an unordered paginated query, which would have made pagination unstable — rows
appearing on two pages or none. It is not: the ordering is on the registry's builder rather than
in the controller, one call up. Pagination is stable. The finding is the ignored parameter and
nothing worse, and the larger claim is withdrawn rather than left standing in a weaker form.

**Why it looks like it works.** The mock sorts in memory — `mock-resident.repository.ts:83`
calls `sortItems(...)` with the requested field and direction — so every column header behaves
correctly in development and in all 93 spec files. This is the launch gate's own caveat
reaching a specific feature: *green against a mock*.

**No checker is added for this, deliberately**, and the reason matters. Ten of the console's
sort fields are camelCase (`updatedAt`, `nextAction`, `submittedAt`, `referenceNumber`,
`scheduledFor`, `followUpOn`, `lastAssistanceAt`, `referredAt`, `birthDate`, `totalReleased`),
so a check in the shape of `check:query-params` would fire on them — and converting them to
`snake_case` would change nothing, because the parameter is discarded whatever it says. A check
that can be satisfied without fixing the defect is worse than no check: it converts an open
finding into a closed one. This belongs to the API.

**Hand-off recorded in `docs/integration/manual-actions.md` §2.8.** Either the API implements
the allow-list §5 already promises, or §5 is amended to say sorting is not offered and the seven
column headers come out of the console. Both are small; the current state — a documented feature,
a faithful client and no server — is the only option that misleads a caseworker.
