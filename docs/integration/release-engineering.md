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

### The intake write, and why it has no mapper

`IntakeDraft` is the one draft in the console that cannot be mapped as a naming exercise, and both
reasons are worth stating because neither is a field name.

**`category` is required by `POST admin/assistance-intakes` and the draft has no field for it.** It
decides the `CaseType` — medical, educational, relief, livelihood — and an unrecognised value falls
through to generic assistance. The console holds a `programId`; the category lives on the
*programme*, which the mapper cannot reach without a lookup.

Defaulting it would classify **every walk-in as generic assistance**: a silent misclassification of
a family's situation, on the record, from the first screen. So nothing is sent.

**`channel` and `source` are different vocabularies.** The console offers `walk-in`,
`barangay-referral`, `encoded` and `online`; the endpoint accepts `walk-in`, `barangay-referral`
and `legacy-import`. Two console values would be refused outright; one API value has no console
equivalent. `requestedAmount`, `referredBy` and the requirement entries have no counterpart at all.

It stays counted by `check:wire-adoption`. Closing it needs a decision about where the intake
category comes from — the programme, or a question the intake form starts asking — and that is a
question about what the office is recording, not about field names.

### The verb is part of the contract

`check:routes` originally compared paths alone, and that let a whole class of defect through
reporting a clean result: **a request sent to a real path with the wrong method.**

The programme composer wrote to `POST /programs` — the public catalog a resident may browse, which
the API serves `GET`-only. The path existed, so nothing objected. The request would have been
refused by a router that never reached the application, on the one screen that creates the
programmes everything else references.

Comparing `VERB path` instead found **five more**, none of them visible before:

| The console sent | The API serves |
| --- | --- |
| `POST programs` | `POST admin/programs` — writes are an office act, reads are public |
| `PATCH programs/{}` | `PATCH admin/programs/{}` |
| `PATCH admin/families/{}/members/{}` | `DELETE` only; the head is set by `POST .../head` |
| `POST admin/assistance-requests/{}/document-requests` | `GET` there; `POST` is under the requirement |
| `POST admin/resident-duplicates` | `GET`; a decision goes to `.../{pair}/decide` |

The first three are fixed. The last two need identifiers the console does not hold — a requirement
id, and the API's own pair id where the console models a pair by its two residents — so they stay
counted.

Two smaller findings came out of the fixes and are recorded rather than papered over:

* **Only the head of a family is settable.** Other family roles have no endpoint, so the adapter
  refuses loudly instead of quietly posting a head change for a role nobody asked for. Who heads a
  family is a claim about that family (`DL-47`).
* **`POST admin/families/{family}/head` accepts no reason**, while `DL-48` holds that family
  history is append-only *with* a reason. The act reaches the trail; the sentence explaining it
  does not.

### Two shapes the wire mapping exposed

**Retiring a resident is not a field correction.** `setActive` PATCHed the resident record with
`{ isActive }`; the correction endpoint accepts neither the field nor the act. `POST
admin/residents/{resident}/activation` is where it belongs, and it **requires a reason** — a record
switched off is one whose history must stay attributable.

The port has no `reason` parameter, so the adapter composes one. That is weaker than asking the
person and is recorded as a gap: the honest fix is for the screen to ask, the way the sector basis
now does. Sending a required field blank would be refused by the server and reported to the user as
a failed save, which is worse than a generic reason and tells them nothing.

**A relationship belongs to the resident it is about.** `recordRelationship` posted all four fields
to the collection; the API scopes relationships under the subject, with the other person in the
body. That shape is `DL-47` expressed as a route — recorded resident-to-resident so the record
survives either person moving.

### What is left, and why

Fifteen writes remain unmapped. They divide into three kinds, and only the first is ordinary work:

* **Live endpoints, ordinary mapping** — the programme draft, the assessment, the document
  versions. Nothing blocks these but time.
* **Shape mismatches needing a decision** — `setChecklist` sends an array of codes where the API
  ticks one item per call; `AssessmentDraft` carries findings and an amount where the endpoint opens
  a template and answers questions. Neither is a naming difference.
* **Endpoints that do not exist at that verb** — counted separately by `check:routes`, and mapping
  a payload against a handler nobody can read would be speculation.
