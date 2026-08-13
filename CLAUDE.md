# Taytay Rizal Social Welfare — Project Constitution

Authoritative rules for this repository. Read this before changing anything. It
exists so that no future command has to re-explain the stack, the boundaries or
the reference hierarchy.

---

## 1. What this repository is

The **Angular staff console** for the Municipal Social Welfare and Development
Office (MSWDO) of **Taytay, Rizal, Philippines**. It is used by office staff —
intake officers, social workers, the MSWDO head, disbursing officers, barangay
focal persons and auditors — to run assistance casework from intake through to
payout.

It is a **front end only**. It owns no database, no server-side rendering of
business pages, and no business rules that money or eligibility depend on.

### Sibling repositories (separate local repos, not in this tree)

| Concern             | Location                                              | Relationship                                                                |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Backend / API       | `Desktop\Taytay_Rizal_LGUIDS_Backend`                 | Owns persistence, authorization enforcement, and the API this app consumes. |
| Resident mobile app | `Desktop\Taytay_Rizal_LGUIDS_Resident_Mobile_Flutter` | Beneficiary-facing Flutter app against the same backend.                    |

Never implement backend or mobile concerns here. If a task appears to require
one, stop and say so.

---

## 2. Non-negotiable rules

1. **No Laravel, no Blade, no PHP, no server-rendered templates in this repo.**
   The backend is a separate repository. A `.php`, `.blade.php` or PHP-templating
   dependency appearing here is a defect.
2. **Strict TypeScript stays on.** `strict`, `noUncheckedIndexedAccess`,
   `noImplicitOverride`, `noPropertyAccessFromIndexSignature`,
   `noImplicitReturns`, `noFallthroughCasesInSwitch` and Angular
   `strictTemplates` are enabled in `tsconfig.json`. Do not weaken them, and do
   not add `any`, `@ts-ignore` or non-null `!` assertions to get past them.
3. **Views never import mock data.** Features depend on domain tokens
   (`RESIDENT_REPOSITORY`, `ASSISTANCE_REQUEST_REPOSITORY`, …). Only
   `src/app/data/data-access.providers.ts` may reference `data/mock` or
   `data/http`.
4. **Client-side permission checks are a usability feature, never a security
   boundary.** The API re-checks every permission. Hiding a button is not
   protection.
5. **Secrets and credentials are never read, printed, stored or committed.**
   No token is placed in `localStorage` by this app; session credentials travel
   in an HTTP-only cookie set by the API.
6. **Money is integer centavos** (`Money` in `domain/shared/money.ts`). No
   floating-point arithmetic on amounts, anywhere, ever. Format only at render
   time via `PesoPipe`.
7. **Every status is defined once, in the domain**, as a `StatusCatalog` plus a
   `StatusTransitions` map. No feature hard-codes a status label, colour or
   allowed transition.
8. **Every route is lazy and permission-guarded** and mirrors the permissions of
   its navigation entry, so a user is never shown a link that bounces them.
9. **Do not push, force-push, merge protected branches, deploy, or touch
   production.** Local commits only, unless a command explicitly says otherwise.
10. **Preserve existing architecture.** Migrations (state library, UI kit,
    styling approach) require an explicit instruction, not an inference.

---

## 3. Stack

| Layer            | Choice                                           | Notes                                                     |
| ---------------- | ------------------------------------------------ | --------------------------------------------------------- |
| Framework        | **Angular 22**                                   | Standalone components; no NgModules.                      |
| Language         | **TypeScript 6**, strict                         | `module: preserve`, target ES2022.                        |
| Change detection | **Zoneless**                                     | No `zone.js` dependency. Use signals.                     |
| Reactivity       | **Signals first**, RxJS at the data boundary     | `toSignal` / `toObservable` bridge them.                  |
| Routing          | `@angular/router`, lazy `loadComponent`          | `withComponentInputBinding()` enabled.                    |
| Styling          | **SCSS + CSS custom properties**                 | Tokens in `src/styles.scss`. No CSS framework, no UI kit. |
| HTTP             | `provideHttpClient` + functional interceptors    | `core/http/api.interceptors.ts`.                          |
| Testing          | **Vitest** via `@angular/build:unit-test`, jsdom | `describe` / `it` / `expect` globals.                     |
| Lint             | **angular-eslint** flat config                   | `eslint.config.js`; template a11y rules on.               |
| Formatting       | **Prettier**                                     | `.prettierrc`, 100 columns, single quotes.                |

Do not add a dependency without a stated reason. Prefer the platform and what
Angular already ships.

### Commands

```bash
npm start          # ng serve (development environment, mock adapters)
npm run build      # ng build (production configuration)
npm test           # ng test  (Vitest)
npm run lint       # ng lint
npm run typecheck  # tsc --noEmit against the app tsconfig
npm run verify     # lint + typecheck + test + build
```

---

## 4. Architecture

Hexagonal (ports and adapters), one direction of dependency:

```
features ──▶ shared ──▶ domain ◀── data (mock | http)
    │                     ▲
    └──────▶ core ────────┘
```

```
src/
  environments/          Build-time config. Reached only through APP_ENVIRONMENT.
  app/
    domain/              Pure TypeScript. Models, status catalogs, transition
                         rules, and the repository *ports* + injection tokens.
                         No Angular UI, no HTTP, no mock data.
    data/                Adapters that implement the ports.
      mock/              In-memory adapters + seed data.
      http/              HTTP adapters + the provisional API contract.
      data-access.providers.ts   ← THE ONLY mock/http switch.
    core/                App-wide singletons: session, permissions, guards,
                         interceptors, notifications, navigation, error handler.
    shared/              Reusable UI primitives, pipes and view-state helpers.
    features/            Routed screens. One folder per feature.
    layout/shell/        The authenticated application frame.
```

### Rules that follow from the shape

- `domain/` imports nothing from `core`, `data`, `shared` or `features`.
- `features/` never imports from `data/`.
- `core/` may import `domain/` and `data/data-access.providers` only.
- Cross-feature UI belongs in `shared/`; if two features need it, move it there
  rather than importing across feature folders.
- Path aliases: `@domain/*`, `@data/*`, `@core/*`, `@shared/*`, `@features/*`,
  `@env/*`. Use them instead of deep relative paths.

### The mock/HTTP seam

`environment.dataSource` is `'mock'` or `'http'`.
`provideDataAccess()` binds every port to one adapter set. Flipping the flag
swaps the whole application. **No component, route or feature file changes.**

`dataSource` is currently `'mock'` in both environments because no API exists
yet. `data/http/api.contract.ts` documents the envelope the API is expected to
honour and is explicitly provisional — reconcile it first when the API lands,
and adjust adapters, never domain models.

---

## 5. Domain rules that must not drift

### Assistance lifecycle

```
draft → submitted → intake-review → assessment → endorsed → approved
      → scheduled → released → completed
```

- `returned` is the "needs more from the applicant" branch, re-entering at
  `intake-review`.
- `rejected`, `completed`, `cancelled`, `expired` are terminal.
- Transitions are enforced by `ASSISTANCE_STATUS_TRANSITIONS`. Never move a
  request by assigning `status` directly.

### Separation of duties

No single non-administrator role may both approve a request and release its
money. This is asserted by a test in `domain/access/permission.spec.ts`; if a
role change breaks it, the role change is wrong, not the test.

### Data scope

`all-barangays` | `own-barangay` | `assigned-cases`. A `barangay-link` account is
confined to its own barangay. The UI must not offer filters a user cannot use.

---

## 6. Privacy and handling of personal data

This application handles sensitive personal information about indigent
residents. The Philippine **Data Privacy Act of 2012 (RA 10173)** applies.

1. **Data minimisation.** Do not add a field to a domain model without a stated
   operational need.
2. **PhilSys (RA 11055).** Only the **last four digits** of a PSN are ever held
   or displayed. Never introduce a field for the full PSN.
3. **Sensitive sectors.** Records flagged `vawc-survivor` (RA 9262) or `cicl`
   (RA 9344) are masked in list views and require `request.view-sensitive`.
   Masking is a presentation decision — the API enforces its own copy.
4. **No personal data in logs, telemetry, analytics or error messages.** The
   global error handler shows a non-technical message; detail goes to the
   console in development only.
5. **Accountability.** Domain models carry `AuditStamp`; access and change are
   attributable via `AuditEntry`.

Sector definitions reference: RA 9994 (senior citizens), RA 7277 as amended by
RA 10754 (PWD), RA 8972 as amended by RA 11861 (solo parents), RA 11310 (4Ps),
RA 9262 (VAWC), RA 9344 (CICL). Crisis-intervention intake follows DSWD AICS
practice. **These citations were written from established statute knowledge and
were not re-verified against an online primary source in an offline run** — a
TAB that depends on the precise text of an issuance must verify it first.

---

## 7. UI primitives — use these, do not re-invent

All but the last two rows live in `src/app/shared/` and are exported from
`@shared/index`. `HasPermissionDirective` is in `@core/access/` because it
depends on the session.

| Primitive                                                            | Use for                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| `StatusBadge`                                                        | Any workflow status. Pass the domain catalog + value.         |
| `DataTable`                                                          | Any list. Presentational only: rows in, intent out.           |
| `Modal`                                                              | Focused decisions — confirmations, short forms.               |
| `Drawer`                                                             | Context beside a list, when the user must keep their place.   |
| `LoadingIndicator` / `Skeleton`                                      | Busy states. Prefer skeletons for tables.                     |
| `EmptyState`                                                         | Nothing to show. Distinguish `empty` from `no-results`.       |
| `AsyncContent`                                                       | Wraps a `ViewState<T>`: skeleton, error panel, or content.    |
| `PageHeader`                                                         | Page title block + primary actions.                           |
| `ToastHost`                                                          | Mounted once by `App`. Never place toast markup in a feature. |
| `PesoPipe`, `BarangayNamePipe`, `PersonNamePipe`, `RelativeTimePipe` | Formatting.                                                   |
| `HasPermissionDirective` (`@core/access/`)                           | `*appHasPermission="'request.approve'"`.                      |

### Async screens

Model async state as `ViewState<T>` (`idle | loading | ready | error`), never as
loose booleans. Lift a repository call with `toViewState()`, hold it with
`toSignal()`, render it with `AsyncContent`. This is what guarantees a screen
cannot show "no results" while still loading.

`features/residents/resident-list-page.ts` is the reference implementation for
list screens; `features/dashboard/dashboard-page.ts` for read-only summaries.

### Notifications

Raise messages through `NotificationStore` (`info` / `success` / `warning` /
`error`, or `notify()` for full control). It decides toast versus inbox. Errors
persist until dismissed and always reach the inbox.

---

## 8. Conventions

- **Components**: standalone, `ChangeDetectionStrategy.OnPush`, `selector`
  prefixed `app-`, class named without a `Component` suffix (`DashboardPage`,
  `DataTable`), file named `kebab-case.ts`.
- **Inputs/outputs**: signal APIs — `input()`, `input.required()`, `model()`,
  `output()`. No `@Input()`/`@Output()` decorators.
- **Injection**: `inject()` in field initialisers. No constructor parameter
  injection.
- **Templates**: built-in control flow `@if` / `@for` / `@switch` / `@let`. No
  `*ngIf` / `*ngFor`. Always `track` in `@for`.
- **Identifiers**: branded types (`ResidentId`, `AssistanceRequestId`, …).
  `asId<T>()` is the only sanctioned cast, and adapters own it.
- **Accessibility is not optional.** Visible focus, real `<button>`/`<a>`
  semantics, labelled controls, `aria-sort` on sortable headers, live regions
  for async status. Template a11y lint rules are on — do not disable them.
- **Comments** explain _why_, never _what_. Do not narrate the code.

---

## 9. Reference hierarchy

When sources conflict, the higher entry wins:

1. **The active Master Command / TAB instruction.**
2. **This `CLAUDE.md`.**
3. **Repository evidence** — existing code, tests, `git log`. The working tree
   may be dirty; reconcile, never discard.
4. **Angular official documentation** (`angular.dev`) for framework questions.
   Assume Angular 22 idioms — signals, standalone, zoneless, built-in control
   flow.
5. **Philippine statutes and DSWD issuances** for domain questions. Prefer the
   primary text over secondary summaries.
6. **Sibling repositories** (backend, resident mobile) as read-only context for
   contracts and vocabulary.

If a required decision is not settled by the above, choose the option that is
easiest to reverse, implement it, and state the assumption in the report.

---

## 10. Definition of done for any TAB

- `npm run verify` passes: lint, strict typecheck, tests, production build.
- New behaviour has focused tests. Domain rules are tested at the domain level.
- No feature imports mock data; the seam still flips cleanly.
- No `any`, `@ts-ignore`, `!` assertions, or disabled lint rules added.
- No PHP/Blade artefacts.
- The working tree is reconciled and committed locally; nothing pushed.
- Gaps, assumptions and anything that could not be verified are reported plainly.
