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
   No token is placed in `localStorage`, `sessionStorage`, a cookie, a URL or a
   log by this app. Authentication is a **first-party bearer token** held in a
   private field of an injectable service (ADR 0005, ADR 0006); TAB 02 builds
   the holder. This rule previously said credentials travel in an HTTP-only
   cookie set by the API — they never have. The API sets
   `supports_credentials => false`, so a credentialed request is refused by the
   browser before any application code runs, and `withCredentials` was removed
   in TAB 01. Never widen the server to make a request succeed.
6. **Money is integer centavos** (`Money` in `domain/shared/money.ts`). No
   floating-point arithmetic on amounts, anywhere, ever. Format only at render
   time via `PesoPipe`.
7. **Every status is defined once, in the domain**, as a `StatusCatalog` plus a
   `StatusTransitions` map. No feature hard-codes a status label, colour or
   allowed transition.
8. **Every route is lazy and permission-guarded** and mirrors the permissions of
   its navigation entry, so a user is never shown a link that bounces them.
9. **Pushing to `main` is authorised by the owner; production is not.**
   Direct pushes to `main`, no pull request and no required review — the owner
   asked for that explicitly. Still forbidden: force-push, history rewriting,
   deployment, and any production access or data operation.
   **No CI workflow files are committed** — the owner has no Actions credit, so
   `.github/workflows/` stays out of every commit and the gates run locally
   instead (`npm run verify` here, `phpunit` + `pint` in the backend). A full
   sweep of both runs before any push.
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
npm run verify     # lint + typecheck + repository checks + test + build
```

The repository checks are `check:brand`, `check:shell`, `check:access`,
`check:vulnerability`, `check:case-audit`, `check:intake`, `check:programs`,
`check:beneficiary`, `check:documents`, `check:referrals`, `check:visits`,
`check:releases`, `check:money`, `check:work`, `check:reports`, `check:search` and
`check:governance`, `check:hardening`, `check:community`, `check:newsfeed` and
`check:events`, `check:contract`, `check:contract-drift`, `check:consumer-contract`,
`check:mapper-adoption`, `check:permission-parity`, `check:environments`,
`check:bundle`, `check:routes`, `check:wire-adoption` and `check:port-adoption`.
Each enforces a rule a comment could not, and each was validated against planted
regressions. Do not weaken one to make a change pass.

**Three of them are ratcheted baselines rather than pass/fail rules**, because
they count a body of pre-existing debt too large to fail the build on:

- `check:routes` compares every composed request path against the backend's own
  published route snapshot, vendored here with its commit and sha256. It found
  61 paths that 404 — including, at the time, every money write.
- `check:wire-adoption` counts write bodies sent **without an explicit
  `toWire…` mapper**. The API validates `snake_case` and this console posts
  camelCase domain objects, so each is a 422 nobody has ever seen. It is not a
  casing problem: `ResidentDraft` nests `name`, `address` and `contact` where the
  API wants them flat, which is why the generic converter this file forbids could
  never bridge it.

- `check:port-adoption` counts port methods **no screen calls**. A method can be
  declared, implemented on both adapters, tested on both, and pass every other
  gate while being reachable from nowhere — because none of the others runs it.
  It found that a document cannot be uploaded, a payout session cannot be
  created, and **a referral cannot be sent**. Its number is a *floor*: the search
  is textual and under-reports, which is the safe direction for a ratchet.

All three print their count on every run and **fail when the number grows**. A
baseline is never an allow-list: nothing in any of them is acceptable, and gate
line 05/07 stays NO-GO until they reach zero.

The three answer different questions, and a green answer to one says nothing
about the others. `check:routes` asks whether a request would reach a real
endpoint at that verb; `check:wire-adoption` asks whether its body would be
understood; `check:port-adoption` asks whether anybody makes the request at all.

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

**The environment matrix is four configurations** (TAB 12): `local-mock`, `local-api`, `staging`
and `production`, each with its own `dataSource`, `apiBaseUrl` and console origin. `npm start`
serves local-mock; `ng serve --configuration local-api` serves the same console against a backend
on this machine.

`dataSource` was `'mock'` in **both** environments, including production — the combination the
master command names as having shipped once already. `check:environments` now fails the build on
it, and `check:bundle` inspects the built artefact for seed data, because a tree-shaking assumption
is not a guarantee. The seam is two files swapped by `angular.json` rather than a runtime `if`, so
a production build cannot reach the mock: it never imports it (`DL-136`). The API exists;
TAB 01 reconciled `data/http/api.contract.ts` against it, so that file now
describes what `/api/v1` actually serves rather than what the console hoped for.
TAB 05 repoints the twenty adapters and TAB 12 flips the flag per environment —
flipping it before the adapters are repointed would 404 every screen.

`data/http` and `core/http` are the **transport seam**: the only two places
allowed to name a `snake_case` wire field. Adapters map wire shapes into the
domain explicitly — never a generic recursive case-converter, which cannot tell
a field name from a key inside a free-text note. `npm run check:contract`
enforces the seam, the versioned base URL, the pagination and sort shapes, the
error envelope and the absence of `withCredentials`.

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

### A case is not an assistance request

A **case** is the office's continuing involvement with a household; an
**assistance request** is one intervention inside it, and a case usually
outlives several (`DL-52`). A case names its interventions explicitly through
`linkedRequestIds` — never "every request this person ever filed", because one
person may be the subject of two open cases at once.

`closed` is **terminal** (`DL-53`). A situation that recurs is a new case naming
the old one through `continuesCaseId`; there is no `reopen`, and there must not
be. `case.close` is held apart from `case.manage` because ending the office's
involvement with a family is a decision, not a step.

Every material change to a case appends a `CaseEvent` **in the same act as the
change**, and every mutation on `CaseRepository` takes a required `reason`
(`DL-54`). There is no update or delete anywhere in `MockCaseStore` or the port.
`npm run check:case-audit` fails the build if a mutator stops appending, a
mutation loses its reason, a status falls out of one of its four maps, or
closure stops being terminal.

The **next action** is an open `CaseTask`, never derived from the status
(`DL-55`). A status says what the process expects; a task says what this office
undertook to do, by when, and who owes it.

Case notes have two tiers. A `protected` note is withheld **in the data layer**:
reads return `CaseNoteView` whose `body` is `null`, and the entry is still
listed so nobody reads a partial file as a complete one (`DL-58`).

### Intake advises; it never decides

The duplicate and previous-assistance check is **evidence** (`DL-60`).
`IntakeAdvisory` carries no score, no total, no `eligible` and no
`recommendation`; each signal states the rule it applied, its finding and the
records it read, and all three are rendered. There are two tones — `note` and
`caution` — and neither blocks: a caution asks the encoder for a sentence before
filing, and the sentence is kept. `assessmentReadiness` behaves the same way, and
gates nothing.

`npm run check:intake` fails the build on a decision-shaped field, a blocking
tone, an exported scoring or auto-approving function, a signal that stops
stating its rule, or a request template binding `[disabled]` to the advisory or
the readiness list.

The intake flow is **four sections of one route** (`DL-62`), with the step in the
URL and the applicant's context panel outside the step switch — fetched once
through `ResidentRepository.getProfile` and never retyped. A saved intake is a
`draft` with **no control number** (`DL-63`); the number is issued at filing.

### The catalog holds the policy, and says whose it is

Programme rules are **records, not code** (`DL-66`). Eligibility is a list of
`EligibilityGuideline`s — each with a weight, a basis and whether anybody has
actually read the source — and the screens render whatever they are given. No
component may branch on a programme code or id; `npm run check:programs` fails
the build if one does.

Every programme carries a `ProgramResponsibility` saying who administers it, who
holds the funds and what the municipality's part is (`DL-65`). A national
programme recorded as one the municipality runs is refused by the domain, by the
adapter and by the checker. **AICS is a DSWD programme with DSWD-disbursed
funds**; the office refers into it and may augment. The seed said otherwise
before TAB 12 and that was a defect, not a wording preference.

Guidance never gates. Three weights — `expected`, `usual`, `context` — and none
of them refuses anybody, on the same doctrine as `DL-42` and `DL-60`.

The intake review windows live in `ReviewWindowPolicy` (`DL-68`), built from the
TAB 11 constants so the two cannot drift, and a window still marked
`convention-pending-confirmation` says so on screen until somebody records the
check.

### A beneficiary is a standing, not a record

There is no `Beneficiary` entity and no `BeneficiaryId` (`DL-71`). The
beneficiary registry is a **projection over the resident registry**, keyed on
`ResidentId` throughout, and the four roles — resident, applicant, recipient,
programme member — are **derived** from live requests, released payouts and
standing enrollments. They are not exclusive, and none of them is ever stored as
a flag. `npm run check:beneficiary` fails the build on a beneficiary identifier
or a stored standing.

Both the resident profile and the beneficiary record assemble history through
**one** function, `historySummaryFor`. Two assemblies of the same history
eventually disagree, in front of the family.

**Duplicate review compares without disclosing** (`DL-73`). A `MatchSignal`
carries an attribute, an outcome and the rule applied — never a value — so the
review panel cannot leak a birth date it was never handed. Three resemblance
bands order the queue and decide nothing.

**There is no merge** (`DL-74`). Resolving a pair records a finding with a
required reason and the reviewer's name; `same-person` supersedes a record
without deleting it, and `distinct-people` is recorded so the pair stops
resurfacing. `beneficiary.review-duplicates` is deliberately withheld from
intake, who usually created the second record, and from the auditor, whose
oversight must not be able to alter the identities it checks.

### Replacing a document appends; it never overwrites

A document is an append-only list of versions (`DL-77`). Replacing one marks the
previous version superseded **with a required reason** and adds a new one.
Nothing in the domain, the ports or either adapter removes a version, and
`npm run check:documents` fails the build if anything tries.

The superseded copy is the evidence of what the office actually read when it
decided. A request approved in March on a certificate replaced in June must stay
explicable in December.

**A document is asked for as `required`, `optional` or `conditional`** (`DL-76`),
replacing the old `isMandatory` boolean. A conditional document states its
circumstances in words and starts `undecided`; the software never evaluates the
condition, and a person rules on it with a recorded reason. An undecided
conditional is **not** counted against the applicant — it is a decision the
office owes.

**Requirement completion counts; it never decides** (`DL-78`). `RequirementCompletion`
carries no `isComplete`, `isEligible` or percentage-as-verdict, and
`describeCompletion` says in words that eligibility remains a caseworker's
decision. This is the fourth surface where a checklist could quietly become an
eligibility engine, and the one where the temptation is strongest.

**Document numbers are masked to their last four characters** by default, and
opening a file is a separate grant (`document.download`) obtained through the
data layer rather than a URL on the model — with a warning shown first, composed
from what the server said rather than from a client-side guess.

### A referral summary leaves the building

Everything else here is read inside the office. A referral summary is handed to
**another organisation**, and once it is printed or sent nothing can be taken
back. So it is **composed, not laid out** (`DL-81`): the minimum is the client's
name, the reference and the reason, and every field beyond that is chosen
individually with a stated need (`DL-82`).

**A referral cannot be sent without a lawful basis** — client consent, statutory
mandate, or vital interest. The basis is **its own recorded act**
(`recordDisclosureBasis`), and every field beyond the minimum is chosen one at a
time with a stated need (`shareField`); `send` takes only an id.

The guarantee lives on the **server**, which refuses the transition without a
basis *inside its row lock* — not in a parameter shape (`DL-140`, superseding
`DL-81`'s mechanism). The old `send(id, plan)` posted a plan to an endpoint that
accepts no body, so it guaranteed the mock and nothing else.

The sheet comes from `summaryFor`, never from a screen assembling one out of a
fuller record it happens to hold. `npm run check:referrals` fails the build if a
referral template renders a resident field directly.

**Overdue is derived** from the follow-up date, never stored (`DL-83`): a stored
flag needs a nightly job to stay true and is wrong every morning until it runs.

### A visit record says whose claim each line is

"The roof is missing sheets", "she says he has not sent money since March" and
"the household appears unable to meet its food costs" are a fact, a report and a
judgement. Written as one paragraph they become indistinguishable, and six
months on a different worker reads all three as established fact about the
family.

So a `VisitObservation` carries its **kind** — observed, client-said,
third-party-said, worker-assessed — and a third-party account must name who said
it (`DL-85`). The entry form asks for the kind *first*: a worker who has already
written a paragraph will not go back and reclassify it. Observations are
appended, never edited or removed.

**This is not a tracking product.** There is no coordinate, no check-in, no
route and no geolocation call anywhere in the visit model, its adapters or its
screens, and `npm run check:visits` fails the build if one appears (`DL-86`).
The master command forbids continuous tracking, covert tracking and geofencing;
those are easy to refuse as features and easy to acquire as an innocuous field.

**Field capture is honest about what has been saved** (`DL-87`). Exactly one
state means the office record has it, and a failed send says plainly that
nothing was queued in the background. A worker who believes a visit was filed
and returns to find it was not has been failed twice.

### Newsfeed and Events extend what exists; residents never publish

Nineteen keys join the **existing** `PERMISSIONS` array — there is no second
RBAC, because `check:access` generates the office reference from that array and
would not see one (`DL-122`). They are kebab-case like every other key, and the
audit seams extend `AuditAction` for the same reason: a second vocabulary would
need a second explorer.

Roles were **mapped, not invented**. Publishing and moderation sit with the
MSWDO head, because a post goes out in the office's name; the auditor holds only
`view` and `view-insights`; caseworkers hold neither module.
`events.export-registrations` and both `view-insights` keys are classified
**read-only**, or the auditor silently becomes a mutating role.

**The resident contract is types only** (`DL-123`). No resident component, route
or template exists in this repository. A resident may read and respond — view,
react, comment, share, register. A resident may **never** publish, moderate, see
a registration list or mark attendance: the municipality speaks in its own name
and residents answer. `ResidentPostView` names the office rather than the member
of staff; `ResidentEventView` reports places left rather than how many
neighbours signed up.

### A post goes outward, and nothing brings it back

`published → archived` and nothing else (`DL-124`). No unpublish, no retract, no
unsend: archiving removes a post from the feed **going forward** and reaches
nobody who already read it, and the badge says so. The warning is shown **before
the publish button**, not as a confirmation after — somebody deciding reads it,
somebody who has decided dismisses it. `archived → published` is allowed,
because taking a post down can itself be a mistake.

**An image is described before it is published** (`DL-125`). `PostImage.altText`
is a required `string`; `postProblems` refuses to publish without it and
deliberately lets a **draft** save without it, because a half-written post is
somebody working, not an accessibility failure. The field sits beside the image
— a description behind an "advanced" disclosure is one that stays empty — and
the message names the resident it fails rather than the rule it broke.

**Reach is counts** (`DL-126`). `reactionCount` and `commentCount`, and no
method anywhere that could answer *which* residents reacted, read or shared. A
field held "for later" is a field somebody displays; the question is left
unanswerable at the port, as with `SearchRepository.search` (`DL-109`).

**Hiding keeps the words; removal deletes them** (`DL-127`). `Comment.body` is
nullable for exactly that reason. This is the one place where the append-only
doctrine is not followed for a record's *content*: keeping a comment that named
a child, forever, so an append-only rule reads cleanly preserves the harm the
removal was for. The **act** is append-only; the **words** are not. Removal is
the only act on the screen behind a modal and its confirmation offers hiding as
the alternative; hiding takes its reason inline. Nothing offers to restore what
was removed.

Scheduling is **derived from the clock**, never from a job having run, and there
is no timer anywhere in the module. `npm run check:newsfeed` fails the build on
any of the above.

### An event is the office's side of somebody else's workflow

Residents register in a **separate mobile app**. This module creates events and
manages what arrives; there is no method, anywhere, that signs a resident up
(`DL-123`).

**Registration availability is derived** (`DL-128`) — `not-required | not-open |
open | closed | full`, computed from the plan, the clock, the count and the
status. No stored `registrationState`: a flag about the passage of time is
wrong every morning until a job fixes it (`DL-83`).

**The client counts; the backend decides** (`DL-129`). The command forbids
inventing backend concurrency guarantees, so `EventCapacitySummary` carries a
required `asOf` and no `hasRoom`/`canRegister`/`isFull`, and the screen prints
both the timestamp and the sentence saying the system of record decides who
gets the last place. Promotion from the waitlist is **offered even when the
office's own figures say full** — warned, not blocked, like a self-release
(`DL-91`) — because a place may have opened a second ago and only the server
knows.

**A registrant list is composed** (`DL-130`): reference, display name,
barangay, date, two statuses, and notes behind a grant. Nothing else, ever. The
display name goes through `discloseResident`, the same reader the residents
module uses — a second surface formatting it would hand an events clerk the
full name of somebody shown elsewhere as "Cordero, M." (`DL-38`).

**Cancelling is one-way, and "past" is not "completed"** (`DL-131`). An event
that is back on is a new event naming the old; one *registration* is freely
restored, because that is a person's place rather than a public announcement.
`hasFinished` is the clock's opinion and `completed` is the office's, and the
gap between them is where attendance is marked — so that nothing turns an
unmarked registrant into a no-show. A no-show is a claim about a person, and
only somebody who was there can make it.

No ticketing, pricing, seat maps, promo codes, payment, recurring events, event
chat or event comments. No share link, because there is no deep-link contract
to honour one (`DL-32`). `npm run check:events` fails the build on all of it.

### Degraded connection: warn, never queue

`NetworkStatus` observes `navigator.onLine` and drives a **warning only**
(`DL-118`). Nothing is queued, nothing is retried in the background, and nothing
is marked saved on the strength of it — this is an admin system with no backend
strategy for offline integrity, and `DL-87` already settled that a failed send
must say plainly that nothing was held.

The banner is `role="status"` rather than `alert`, and its reconnected message
is dismissed by a person rather than a timer, because it says work was *not*
kept. No notice may promise a send, a sync or a retry.

**One debounce window** (`DL-119`). `SEARCH_DEBOUNCE_MS` and `debouncedTerm`
live in `@shared/state/debounced`; no screen declares its own. Only the **typed
term** is debounced — a dropdown is a single deliberate act and takes effect at
once.

**A shared primitive is defined once, or it is not shared** (`DL-120`).
`.field`, `.card` and `.btn` belong to `styles.scss`. A feature stylesheet that
redefines one is not extending it, it is replacing it on that screen — which is
how five of them came to render the same form control three different ways.

### The audit trail says what changed, never what it changed to

`AuditRow` carries actor, action, entity, a summary in words, a source, and
**which fields moved with how sensitive each is**. It carries no old value and
no new value, and `toAuditRow` has no parameter that could take one. The
recorded values are `AuditEntryDetail`, a separate read behind
`audit.view-detail` (`DL-114`).

The split is structural rather than a rendering rule, because an audit list is
the one screen designed to be scrolled and filtered by somebody reviewing *other
people's* work: a row reading `monthlyIncome: 3,200 → 18,000` discloses a
resident's income to every reviewer who filters by date.

`audit.view-detail` is held by the **auditor and not the head**. Reading the
trail is oversight; reading the values is access to the record.

**Deactivation ends a live session** (`DL-116`). `canHoldSession` lives in the
domain and both `signIn` and `currentUser` ask it, so an account switched off at
10am cannot keep its grants until the person happens to sign out. An
administrator cannot deactivate the account they are signed in as.

**An account and a directory entry are different records** (`DL-115`).
`StaffUser` answers who may do what; `StaffProfile` holds employee ID, unit and
contact details — which are personal information about an employee, with the
same protection a resident's has. One identity, two facets, keyed on
`StaffUserId`.

**Retention invents nothing** (`DL-113`). No disposition schedule was supplied,
so every period is `null`, the provenance is `awaiting-office-policy`, and the
screen says "No schedule recorded" — never a zero, never a default. An office
that believes it may delete after five years, and does, cannot undo it.

**A correction is raised, considered and answered, never applied silently**
(`DL-117`). `applied` and `refused` each require an outcome in words and are
terminal, like a closed case (`DL-53`). The capture screen is **not built**, and
the governance page says so rather than offering a form that goes nowhere.

**There is no invite or reset flow.** Accounts are provisioned by an
administrator outside this console (`DL-32`), and the screens say so — a
half-built invite form is worse than none, because whoever fills it in
reasonably believes an account now exists.

### Search reads only what it may show

The searchable fields and the displayable fields are the **same closed set**
(`DL-109`): names, reference numbers, barangay, status. `NEVER_SEARCHED` names
what is refused on both sides — note bodies, findings, remarks, outcomes,
PhilSys digits, income, sectors, birth dates.

Matching on free text discloses it even with no snippet rendered: type a
condition, get back one resident, and the office has said what is in that
person's file. `SearchHit` therefore has no `snippet`, `context`, `matchedText`
or `excerpt`, and `SearchRepository.search` takes a term and nothing else.

**A recent search is not written down** (`DL-110`). No `localStorage`, no
`sessionStorage`, no cookie. There is no way to tell a safe query from an unsafe
one — "Dela Cruz" is a surname and also a street — so nothing is persisted, the
list lives in a signal for the tab, and the screen says so.

**A record type that was not searched is named** (`DL-112`), never silently
omitted: an officer who sees no case concludes none was ever opened, which is a
wrong answer delivered with confidence.

**Saving a view for the office is a separate grant** (`DL-111`). A personal view
is a preference; a shared one is office configuration whose *name* describes a
population to every colleague and outlives whoever wrote it. `view.share` is
held by the head as well as the administrator.

### Reporting exposes as little as it can get away with

Fourteen reports, thirteen of them **aggregate**. The fourteenth names people,
and it has to argue for itself (`DL-104`): a stated
`personLevelJustification`, the higher `report.export` permission rather than
`report.view`, and a caution on screen. `reportProblems` refuses a definition
that breaks any of those, and the catalogue is **data** like programme
eligibility (`DL-66`) — no screen branches on a report id.

**An aggregate is not automatically anonymous** (`DL-105`). "Barangay San Juan:
1 VAWC survivor served" names somebody. Counts of people or households below
`SMALL_CELL_THRESHOLD` are **withheld** — never dropped (a missing row reads as
"none"), never rounded (that puts an untrue figure in a report), never a zero
(an absence of service is the finding), and the drill-down goes with them. The
**total is taken before suppression** and labelled, so a reader adding up the
visible rows is not misled. The threshold is
`convention-pending-confirmation` and says so, like the review windows
(`DL-68`). Nothing anywhere can ask for the unsuppressed set.

**An export carries its own conditions, inside the file** (`DL-106`): the
report, the question, the filter in words, when and by whom, whether it names
people, whether anything was withheld, and the RA 10173 handling rule. It is
**composed by the data layer**, like a payout manifest (`DL-92`). A person-level
export is warned about **before** the file exists.

**Staff workload counts what people carry; it does not rank them** (`DL-107`).
No rate, no score, no index, and rows ordered alphabetically — sorting by volume
is what turns a workload table into a league table.

**A chart that is not a table is a claim nobody can check** (`DL-108`).
`ChartTable` already *is* a real table; TAB 19 extends it rather than adding a
charting library, and `ReportSeries.summary` is required rather than optional.

### Three surfaces: what is owed, what happened, what is wrong

A user must be able to tell "FYI" from "action required" at a glance, so the
application keeps three concepts apart and never lets a screen blur them
(`DL-96`):

- **A work item** (`domain/work`) is something a named person must *do*. It has
  an owner, usually a date, and a completion.
- **A notification** (`domain/notifications`) is something that *happened*. Read
  or unread. No owner, no date, no completion.
- **An office alert** (`domain/work/office-alert.ts`) is a *condition of the
  data*. Nobody completes it; somebody fixes the record and it goes.

**Nothing is sent anywhere.** `NotificationChannel` is `toast | inbox | both`
and must never gain email, SMS, push or a webhook: the LGU supplied no mail
relay, gateway or credentials, and a channel that silently no-ops leaves an
office believing a family was told to come on Tuesday.

**A work queue is a view, and `WorkRepository` is read-only** (`DL-97`). There
is no second task system: acting on an item goes to the repository that owns the
record. Only a `case-task` is manageable, and the screen says so on every other
row rather than offering a snooze that would do nothing. Task acts go through
`CaseRepository.addTask` / `completeTask` / `assignTask` / `rescheduleTask`,
each taking a reason and appending an event (`DL-54`, `DL-99`). "Snooze" is a
recorded change of date, never a hidden timer.

**An alert gates nothing** (`DL-98`) — the fifth surface where a signal could
become a decision engine, after `DL-42`, `DL-60`, `DL-66` and `DL-78`. It states
its basis, because an alert nobody can check is one an office learns to dismiss.

**Overdue is obvious without red-only signalling** (`DL-102`). Lateness is
carried by a sentence on every row (`describeLateness`), a worded bucket
heading, and position — colour is the fourth carrier and the only optional one.

**No service standard was supplied, so undated work reports waiting, not
lateness** (`DL-101`). An assistance request in assessment has no deadline;
inventing one would be fabricating policy. It carries `waitingSince` and the
screen says "Waiting 9 days", never "3 days overdue".

**A queue holds only what a named person owes.** A possible duplicate has no
assignee and no date, so it is an alert with a count, not 182 rows (`DL-103`).

### A release is tracked; it is not posted

The master command asks for release tracking, and supplies no chart of accounts,
no fund codes, no bank integration and no posting rules. So none are invented
(`DL-89`). `fundingSourceLabel` is a **label the office was given**, held as
text and posting to nothing; `approvingReference` is a document reference.
There is no ledger, journal entry, account code, bank account or posting date
anywhere in the release domain, its adapters or its screens, and
`npm run check:releases` fails the build if one appears. The boundary is stated
**on the screen**, because a rule an office never sees is one it discovers by
being wrong about it.

**A payout session has no status of its own** (`DL-90`). `ReleaseBatch` is a
plan — a date, a venue, an officer, a list — and what it amounts to is derived
by counting its members. Screens show **counts, not a state**: "38 of 41
released, 2 deferred" names the problem, where "partially complete" hides the
two people still waiting. Each beneficiary keeps their own status through the
batch, start to finish.

**Deferred is the office's failing; unclaimed is nobody's** (`DL-94`). Every
`DeferralReason` is the office's own — funds not yet arrived, a missing
signature, a voucher error. Unclaimed means nobody came, and the screen does not
guess why. Collapsing the two blames a household for the office's missing
countersignature, and the record reads that way to every worker afterwards.

**Goods are counted, never valued** (`DL-93`). `Disbursement.amount` is
`Money | null`: an in-kind release carries a description and no amount, because
nobody at the MSWDO priced that sack of rice and an invented figure appears in
reports as though somebody did. `sumReleased` filters goods out rather than
coercing them to zero; a manifest reports a money total **and** a separate count
of goods.

**The payout list leaves the building** (`DL-92`), so it is composed by the data
layer like a referral summary (`DL-82`) — a name, a masked voucher, what is
handed over, and blank space for a signature. No birth date, no address, no
sector, no reason for assistance. The acknowledgement column is left empty on
purpose: pre-filling it is how a sheet comes back signed for somebody who was
never there.

### Separation of duties

No single non-administrator role may both approve a request and release its
money. This is asserted by a test in `domain/access/permission.spec.ts`; if a
role change breaks it, the role change is wrong, not the test.

Separated permissions do not guarantee separated **people** — an administrator
holds both by definition. `isSelfRelease` compares the release against who
actually approved, read from the data layer rather than inferred from a role,
and the screen warns before the money moves (`DL-91`). It **warns rather than
blocks**: a small office on a bad day may have one person available, and
refusing the payout punishes the family for the office's staffing.

### A household is not a family

A household is an address; a family is a claim about who belongs to whom
(`DL-47`). One household may hold **many** families, and a family may have
**no** household while it is between addresses. Relationships are recorded
resident-to-resident, so they survive either person moving. Never add a field or
a query that assumes one household is one family — `ResidentProfile` lists
`householdMembers`, not "family", for exactly this reason.

Relationship and family history is **append-only** (`DL-48`): ending a
relationship or moving a person records an event with actor, time and reason,
and never deletes what was true before.

### Vulnerability indicators are advisory, always

A household vulnerability factor is evidence a caseworker reads, never a
decision the software makes (`DL-42`). Nothing may derive eligibility,
entitlement or an amount from `VulnerabilitySnapshot`, and
`npm run check:vulnerability` fails the build if anything tries — including a
decision-shaped field name on the advisory types. Every factor states its rule,
its arithmetic and the records it read, and can be overridden by a person with a
reason that is recorded against their name.

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
   (RA 9344) require `request.view-sensitive`. **Redaction happens in the data
   layer, not in the template** (`DL-38`, superseding the presentation-only rule
   this section carried before TAB 07): resident reads return a `ResidentView`
   whose withheld attributes have already been removed, so a screen cannot leak
   a field it never received. Identity and means (`philsysLastFour`,
   `monthlyIncome`) are a second, wider tier behind `resident.view-sensitive`.
   The API enforces its own copy of all of it.
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

**The poverty threshold is the exception, and the pattern to follow.** It is
sourced from a named PSA publication with its geography, reference year,
publication date and URL held in the code beside the figure, and cited on screen
(`DL-46`, `domain/households/poverty-threshold.ts`). Any published statistic
this application relies on gets the same treatment: never a bare constant, never
an invented working number.

---

## 7. UI primitives — use these, do not re-invent

All but the last two rows live in `src/app/shared/` and are exported from
`@shared/index`. `HasPermissionDirective` is in `@core/access/` because it
depends on the session.

| Primitive                                                            | Use for                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `StatusBadge`                                                        | Any workflow status. Pass the domain catalog + value.                    |
| `DataTable`                                                          | Any list. Presentational only: rows in, intent out.                      |
| `Modal`                                                              | Focused decisions — confirmations, short forms.                          |
| `Drawer`                                                             | Context beside a list, when the user must keep their place.              |
| `LoadingIndicator` / `Skeleton`                                      | Busy states. Prefer skeletons for tables.                                |
| `EmptyState`                                                         | Nothing to show. Distinguish `empty` from `no-results`.                  |
| `AsyncContent`                                                       | Wraps a `ViewState<T>`: skeleton, error panel, or content.               |
| `PageHeader`                                                         | Page title block + primary actions.                                      |
| `ChartTable`                                                         | A breakdown. It **is** a real table; never add a second one.             |
| `SavedViewsBar`                                                      | Named filters above any list whose filters live in the URL.              |
| `ResidentSummaryCard`                                                | One resident, said the same way on every screen.                         |
| `PersonPicker`                                                       | "Who is this for?" — the only sanctioned resident search.                |
| `VulnerabilitySnapshotPanel`                                         | Household indicators. Advisory only — see `DL-42`.                       |
| `RelationshipGraph`                                                  | Family relationships. The graph **is** the list — see `DL-50`.           |
| `StatusTransition`                                                   | Any lifecycle move. Generic; captures the reason and refuses without it. |
| `CaseTimeline`                                                       | A record's history. An ordered list, no connectors — see `DL-56`.        |
| `ToastHost`                                                          | Mounted once by `App`. Never place toast markup in a feature.            |
| `PesoPipe`, `BarangayNamePipe`, `PersonNamePipe`, `RelativeTimePipe` | Formatting.                                                              |
| `HasPermissionDirective` (`@core/access/`)                           | `*appHasPermission="'request.approve'"`.                                 |

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
  The conformance target is **WCAG 2.2 Level AA** (`docs/reference-audit/decision-log.md`,
  DL-20).
- **Comments** explain _why_, never _what_. Do not narrate the code.

---

## 9. Reference hierarchy

When sources conflict, the higher entry wins:

1. **The active Master Command / TAB instruction.**
2. **This `CLAUDE.md`.**
3. **Repository evidence** — existing code, tests, `git log`. The working tree
   may be dirty; reconcile, never discard. This includes
   [`docs/reference-audit/`](./docs/reference-audit/README.md): where each module
   comes from (`FSM-*`), which interaction patterns are binding (`EPL-*`), and
   every deliberate divergence (`DL-*`). Cite those ids; to overturn one, add a
   superseding `DL-*` entry rather than changing behaviour silently.
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
