# Release engineering (TAB 18)

## Deployment order is a fact about the diff, not a judgement

*"The API deploys before the console when the console needs a new endpoint; the console deploys
before the API when the API removes one. Write down which, per release."*

What makes this hard is that **one direction is invisible**. Adding an endpoint is deliberate —
whoever writes the console call knows the API must ship first. Removing one is not: a controller
method deleted during a tidy-up, a route file reorganised, a resource collapsed into another. None
of those feel like a breaking change, and the console still calling the path finds out in
production.

So the order is read off two mechanical artefacts rather than remembered:

| Signal | Where | Order |
| --- | --- | --- |
| A line added to the backend's `routes.published.json` | backend diff | **API first** |
| A line removed from it | backend diff | **Console first** |
| `check:routes` fails here after re-vendoring | this repository | **API first** — the console is ahead |
| Both an addition and a removal in one release | both | **Split the release** |

### Why "both" means split

A release that adds an endpoint the new console needs *and* removes one the old console calls has
no safe ordering. API first, and the removal lands while the old console is deployed. Console first,
and the new console calls an endpoint that does not exist yet. Either way something 404s.

The answer is two releases, not a shorter deployment window. This is the case a per-release note
written from memory never catches, because each half looked fine to the person who made it.

Rolling back reverses the table — and that is the opposite of the order everybody has just
rehearsed forward, decided under pressure. Written here for that reason.

## `check:routes`, and what it found on its first run

The check compares `API_ENDPOINTS` against the backend's own generated route snapshot, vendored
here with its commit and sha256 like `types.ts` — a vendored artefact that cannot say where it came
from is one nobody can tell is stale.

Its first run found **two endpoints that would have 404'd every screen that used them**:

* `work` was `'work'`; the API serves `admin/work/*`.
* `reports` was `'reports'`; the API serves `admin/reports`.

Both were correct when written — TAB 07 had not built those surfaces yet, and the comment beside
them said so. TAB 07 built them under `admin/`, and these two values were never moved. Nothing
caught it: the mock served both happily, the types were right, every test was green, and the only
way to see it was to ask the API.

That is the whole argument for this check. Twenty adapters were repointed by hand in TAB 05, once,
and nothing has re-checked them since.

## `cases` is a 404 sentinel and is asserted absent

`API_ENDPOINTS.cases` holds `admin/cases` — a route that used to exist and no longer does — so an
adapter wired to it fails loudly rather than quietly succeeding against `admin/assistance-requests`
(L-07). All eleven `CaseRepository` methods remain blocked on ADR 0044.

The check asserts it stays **absent** rather than skipping it, so that the day the API publishes a
case surface, the build says to wire it. A skipped entry would stay silent on exactly the day
somebody needs telling.

## What is not done, and cannot be here

* **No pipeline.** `.github/workflows/` is not committed — there is no Actions credit — so the gate
  is `npm run verify` here and `phpunit` + `pint` in the backend, run before every push. A gate
  enforced by discipline is what TAB 18 explicitly asks to replace, and this one is.
* **The previous build is not proven redeployable**, because nothing is deployed.
* **Rollback is not rehearsed or timed**, for the same reason.

---

## The write side: `check:wire-adoption` (TAB 19)

`check:routes` finds requests sent to a path that does not exist. This finds requests sent to a path
that does, **with a body the endpoint cannot read**.

`this.api.post<Resident, ResidentDraft>(…)` sends the domain object verbatim. The generic is an
assertion, not a conversion — it tells TypeScript the domain object *is* the request body, and the
compiler has no way to disagree. So the request carries `birthDate` where the API validates
`birth_date`, and every field is rejected at once with a 422 nobody has ever seen, because this
console has never run against the API.

**26 of 62 write bodies are in that state.**

### It is not a casing problem

`ResidentDraft` nests `name`, `address` and `contact`. The API wants `first_name`, `middle_name`,
`last_name`, `suffix`, `barangay_id`, `street_address`, `purok_or_sitio`, `mobile_number` and
`email` — **flat**. `ReleaseBatchDraft` has a `title` and a `venue`; the endpoint validates `name`
and `location`.

No transformation could be inferred from either, which is why `CLAUDE.md` forbids a generic
recursive converter and why every mapper in `data/http/mappers/to-wire.ts` is written out by hand.

### Laravel makes the failure quieter, not louder

Unknown keys are **ignored**, not rejected. So sending `title` to an endpoint that wants `name` does
not error — the request succeeds, the value is discarded, and a payout session is created with no
name. To the office that reads as their own mistake.

That is why each mapper names the fields it does *not* send, with the reason. A field silently
dropped by an outbound mapper is indistinguishable from a field nobody filled in.

### Write against the handler, never the document

The first draft of `to-wire.ts` mapped three payloads from what the domain types and
`port-mapping.md` implied. **All three were wrong** — it invented a `followUpOn` the visit draft does
not have, a `basis` the disclosure plan does not have, and a body for
`POST admin/referrals/{referral}/send`, which accepts none.

### A gap that finding exposed

`POST admin/referrals/{referral}/send` takes **no body**. The lawful basis and the shared fields are
recorded through `POST .../authority` and `POST .../shared-fields` beforehand.

`DL-81` requires the basis recorded **in the same act as the sending**, *"so there is no window in
which a sendable referral has none"* — and `ReferralRepository.send` takes the disclosure plan as a
parameter for exactly that reason. Across three separate calls that window exists. Either the API
needs to accept the plan on `send`, or `DL-81` needs superseding with the weaker guarantee the
sequence can actually offer. **It is an open decision, not a wiring detail.**
