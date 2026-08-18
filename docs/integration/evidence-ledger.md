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
- `tests/Feature/Console/ReadinessCommandTest.php:98–99` — `postgres://lguids:hunter2@…` and
  its redacted form, the input and expectation of `it_redacts_credentials_out_of_driver_errors`.

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
