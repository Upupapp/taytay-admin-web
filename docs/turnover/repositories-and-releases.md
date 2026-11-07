# Repositories and releases

## The three repositories

All three are in the GitHub organisation `Upupapp`, and all work is committed on `main`. The
commits below are the latest on each `main` on **2026-11-07**, before this package was committed;
each local copy was level with `origin/main` when read.

| Repository          | Part           | URL                                          | Branch | Latest commit on 2026-11-07                                                                                                               |
| ------------------- | -------------- | -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `taytay-admin-web`  | Staff console  | https://github.com/Upupapp/taytay-admin-web  | `main` | `bfe43e7`, 2026-11-07: "Every dashboard figure opens exactly what it counted, and the texts residents accept are published here (DL-186)" |
| `taytay-backend`    | API            | https://github.com/Upupapp/taytay-backend    | `main` | `0f1ffec`, 2026-11-07: "feat(app-config): an administrator publishes the privacy notice the way the Terms of Use are published"           |
| `taytay-mobile-app` | Residents' app | https://github.com/Upupapp/taytay-mobile-app | `main` | `6a77e88`, 2026-11-07: "Docs: backend gaps 21 and 22 closed in the app, and the document-requests page follows"                           |

Other facts about the repositories:

- **Tags.** The only tag is `laravel-archive` in `taytay-backend` (commit `e2dcbb5`, 2026-08-31).
  It holds the retired Laravel backend, which was replaced by the Node API on 2026-10-20
  (`DL-164`). It is history: do not restore it into the working tree.
- **Visibility.** The owner decided on the record that the three repositories stay **public**
  (launch gate line 00, measured 2026-08-29). This was not re-checked for this package. Because
  they are public, no secret may ever be committed; see
  [accounts-and-credentials-register.md](accounts-and-credentials-register.md).
- **Versions.** No release is tagged or numbered. `taytay-admin-web/package.json` says `0.0.0`,
  `taytay-backend/package.json` says `0.1.0`, and the app's `pubspec.yaml` says `1.0.0+1`. A
  release is identified by the commit hash that was built and deployed, so record that hash every
  time you deploy: the documented redeploy steps do not record it on the server.
- **Each repository has its own `CLAUDE.md`**, the project constitution for that repository. Read
  it before changing anything. Its rules outrank other documents in that repository.

## No hosted build service (CI), on purpose

There is **no GitHub Actions workflow** in any of the three repositories, and none may be
committed: the owner has no Actions credit, and decided that the checks run on the developer's
machine instead (console `CLAUDE.md` §2, rule 9; backend `CLAUDE.md`; requirements constraint
C-4). `taytay-mobile-app/.github/` holds only a pull-request template and `contract-baseline.yml`,
not a workflow.

The consequence is that nothing checks a push automatically. Whoever pushes runs the gates below
first; the console's rule is "a full sweep of both [console and backend] runs before any push".

Pushing to `main` directly, without a pull request or review, is authorised by the owner.
Force-pushing, rewriting history, deploying, and any production access remain forbidden without
the owner's explicit authorisation.

## Staff console: `taytay-admin-web`

Requirements: Node.js and npm (Angular 22, TypeScript 6). No Docker needed.

```bash
npm install
npm start                                  # local-mock: http://localhost:4200, sample data, no backend
npx ng serve --configuration local-api     # against a backend on this machine (see below)
```

For `local-api`, start the backend first with `npm run dev:memory` in `taytay-backend`. It signs
in through the backend's development token verifier: type any e-mail and pick staff or admin.

Builds:

```bash
npm run build                              # production configuration (the default)
npx ng build --configuration staging       # the build copied to the staging server
```

The output is `dist/taytay-social-welfare/browser`. Which API a build talks to is fixed at build
time by the files in `src/environments/`, swapped by `angular.json`; a production build cannot
contain sample data.

Checks:

```bash
npm run verify     # every gate below, in order; the one to run before a push
npm run lint       # angular-eslint, including template accessibility rules
npm run typecheck  # strict TypeScript
npm test           # Vitest unit and component tests
npm run build      # production build
```

`npm run verify` runs lint, the strict typecheck, **50 repository checks** (`check:…` in
`package.json`), the tests, the production build and `check:bundle`, which inspects the built
files for sample data. Each repository check enforces one rule from `CLAUDE.md` that a comment
could not, for example `check:money` (amounts in centavos), `check:case-audit` (every case change
is recorded with a reason), `check:environments` (no production build on sample data) and
`check:contract` (requests match the API's published contract). `CLAUDE.md` §3 describes each one.
Do not weaken a check to make a change pass.

The secret scanner is **not** part of `npm run verify` (launch gate line 00): it reads the whole
git history, so it is run by hand before a push with `npm run scan:secrets` (`tools/secret-scan.mjs`,
Node, no extra dependency). It scans every blob reachable from any branch or tag, accepts only the
findings a reviewer listed in `docs/integration/secret-scan-allowlist.txt`, and exits with a failure
on anything else. On 7 November 2026 it reported four findings outside that list; see
[known-limitations-and-open-items.md](known-limitations-and-open-items.md), section 9. It replaced
the Laravel-era PHP scanner, which was removed.

## API: `taytay-backend`

Requirements: Node.js 20 or newer; PostgreSQL 16 for migrations (Docker Compose is enough).

```bash
npm install
cp .env.example .env
docker compose up -d --wait
npm run migrate
npm run dev                # listens on port 3000
```

Without Docker:

```bash
npm install
npm run dev:memory         # every route on 127.0.0.1:3000, in-memory database, mock tokens
```

`npm run dev:memory` migrates and seeds an in-memory database on start and discards everything
when it stops. It refuses to run with `NODE_ENV=production`.

Checks, run before every push:

```bash
npm test                   # node:test suites in tests/
npm run typecheck
npm run build
```

Database scripts: `npm run migrate` applies the SQL files in `migrations/` (37 files on
2026-11-07); `npm run migrate:prod` is the same runner with production TLS rules; `npm run seed`
adds the five barangays, a starting list of offices, and sample programmes and document types for
development or a staging demonstration. The seed refuses to run with `NODE_ENV=production`.

The OpenAPI document is `openapi/openapi.json`, served at `GET /docs`. The console keeps a
vendored copy at `src/app/data/http/contract/openapi.json`, refreshed with
`node tools/vendor-openapi.mjs`; its contract checks measure against that copy.

## Residents' app: `taytay-mobile-app`

Requirements: Flutter stable (developed against **3.44.0**, Dart 3.12.0); the Android SDK; for
iOS, macOS with Xcode.

```bash
flutter pub get

# Synthetic data and a mock identity; Firebase is never started
flutter run --flavor dev --dart-define=TAYTAY_ENV=dev --dart-define=TAYTAY_DATA=mock

# Staging: the Node API on the shared Linode, staging Firebase project
flutter run --flavor staging --dart-define=TAYTAY_ENV=staging \
            --dart-define=TAYTAY_API_BASE_URL=https://taytay-api.139-162-51-165.sslip.io/api/v1 \
            --dart-define-from-file=env/firebase.staging.json
```

Every build except the mock one needs the four `TAYTAY_FIREBASE_*` values in a gitignored
`env/firebase.<env>.json` file (copy `env/firebase.example.json`). They are public Firebase
identifiers, the one named exception to "no secret in a `--dart-define`".

Checks:

```bash
flutter analyze            # must be clean: no errors, warnings or infos
flutter test
```

`tool/certify.sh` runs the gates against a commit from a clean worktree rather than a lived-in
working tree, and stamps the commit hash it certified.

Release builds (Android App Bundle and APK with `--flavor prod`, iOS IPA) are built on a signing
machine with the commands in `docs/release.md` and `docs/release/README.md`. They cannot be made
yet: there is no production API address, no production Firebase project, no Android upload
keystore and no Apple Team ID. See [environments-and-hosting.md](environments-and-hosting.md).
Google Play App Signing will hold the app signing key; the upload key is created by Paul with the
Play Console listing and handed to the municipality at turnover (mobile decision D-186).

## Known test caveats

These are recorded by the developer and were **not re-run** for this package, because this
computer has too little memory to run the suites alongside other work.

- **27 golden-image tests in the app fail on the developer's PC only.** The reference images were
  made with Flutter 3.44; the developer's PC renders fonts differently (its Flutter is recorded as
  3.47). Run them on a machine with the reference Flutter version before treating a failure as a
  defect.
- **Timing flakes under memory pressure:** the console's `digital-ids.spec.ts`, the backend's
  `retry_after` test in `tests/email-otp.test.ts`, and first-test timeouts. Each passes when run
  alone.
