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

### The three "ordinary" mappings were not ordinary, and looking found something larger

Three writes were left as straightforward mapping work. All three turned out to be blocked, and the
blockers matter more than the mapping would have.

**`ProgramDraft` cannot satisfy the create endpoint.** `POST admin/programs` requires `code`,
`owner_office`, `service_type` and `benefit_type`. The console's draft has **none of them** — it
carries a `category` and a `responsibility`, whose vocabularies are not those fields. This is the
same shape as the intake `category`: a required field with no console source, and a decision about
what the office records rather than a naming exercise.

**A document cannot be uploaded at all**, and this is the sharp one.

* `DocumentVersionDraft.file` is `DocumentFile` — `fileName`, `mimeType`, `byteSize`, `pageCount`.
  **Metadata. There are no bytes.**
* The endpoint reads `$request->file('file')` — a multipart upload.
* `FileTransport`, built in TAB 09 for exactly this, with progress, cancellation and 413 handling,
  and fully tested, is **injected by nothing but its own spec**.
* There is **no `<input type="file">` anywhere in `src/app`**.

So it is not that the payload is unmapped. **No screen has ever offered a file**, and the transport
built to carry one has never been connected.

`check:documents-transport` passes throughout, and correctly: every rule it enforces is a
prohibition — nothing deletes a version, nothing builds its own URL, nothing writes a file to
browser storage — and prohibitions hold trivially where the feature is absent. A green transport
check says nothing about whether an upload works.

### 24 of 113 port methods are reachable from no screen

Measured by searching `features/`, `shared/` and `core/` for a call to each port method. Four were
spot-checked by hand, because "no caller" has been a wrong conclusion in this codebase before.

Three of the twenty-four are consequential:

| Port method | What cannot be done from any screen |
| --- | --- |
| `recordDocument` / `requestDocument` | upload a document, or ask an applicant for one |
| `send` | **send a referral** — the one irreversible outward act |
| `createBatch` | create a payout session |

That last group reframes an open question. The `DL-81` concern — that a referral's lawful basis
cannot be recorded in the same act as the sending, because the API takes it through three calls —
is real but currently academic: **nothing sends a referral**, because nothing calls `send`.

The caveat on the number: it is a textual search for `.method(` and could miss a dynamic dispatch.
It is a measurement, not a gate. A gate would be the honest next step, on the pattern
`check:wire-adoption` and `check:routes` already follow.

### `check:port-adoption`, and the question the other two assume

`check:routes` asks whether a request would reach a real endpoint at that verb. `check:wire-adoption`
asks whether its body would be understood. **Both assume somebody makes the request.**

This asks the prior question, and it is the one that had no gate. A port method can be declared,
implemented on both adapters, covered by tests on both, and pass every check in this repository —
while being reachable from no screen. Every check stays green, because none of them runs it.

**25 of 149 port methods are in that state**, and the grouping is where the meaning is:

| Port | Unreached | What that means |
| --- | --- | --- |
| `AssistanceRequestRepository` | 4 | a document cannot be uploaded or asked for |
| `FamilyRepository` | 4 | relationships cannot be ended, family history is unread |
| `ReferralRepository` | 4 | **a referral cannot be drafted or sent** |
| `ReleaseRepository` | 3 | a payout session cannot be created |
| `BeneficiaryRepository` | 3 | the duplicate and enrollment views are unbuilt |

Four unreached methods on one port is a **missing screen**, where the same four scattered across a
list read as four unrelated oversights. That is why the output groups them.

**The number is a floor.** A call is found by searching for `.methodName(` in `features/`,
`shared/` and `core/`, which is textual: a method named `list` or `remove` will match something
eventually whether or not it is the port's. So the check can call a method adopted when it is not,
and will never invent an orphan. For a ratchet that is the safe direction — one that cries wolf is
one somebody turns off — but the real count is at least this.

Making it exact needs a type-aware pass that resolves each receiver to its injected token, and a
wrong precise answer would be worse than a plain search nobody mistakes for exact.

### Document upload, built

The gap `check:port-adoption` was written to expose is closed for the first of its methods.

**What had to change, and why none of it was a mapping problem:**

* `DocumentVersionDraft.file` was a `DocumentFile` — `fileName`, `mimeType`, `byteSize`,
  `pageCount`. That is the shape of a version **already stored**. As a draft field it meant the
  console could describe a file it had no way to send. It is now a `File`: the bytes.
* The endpoint reads a multipart `file`, so `recordDocument` goes through `FileTransport` — built
  in TAB 09 with progress, cancellation and 413 handling, and until now injected by nothing but its
  own spec.
* `DocumentPanel` gained a file input. There had been **no `<input type="file">` anywhere in
  `src/app`**.

**The upload sits below the version history, not above it.** Replacing a document is the act the
append-only model exists to make safe (`DL-77`), and a file input at the top is one somebody uses
before they have seen the version they are about to supersede.

**The accepted-document rule moved into the domain.** It lived in `data/http` while only the
transport used it; the moment a screen needed to refuse a file *before* sending, that placement
forced `shared/` to import from `data/`, which the architecture forbids. The constraint was pointing
at something true — "a PDF, a JPEG or a PNG, and no more than ten megabytes" is a rule of the office,
not a fact about HTTP. `FileTransport` now uses the same rule rather than its own copy.

It is a courtesy, never the boundary: `FileStore::store()` still decides, and checks the
classification's own limit as well as this ceiling. What the client-side check buys is that a
caseworker on a slow connection learns their scan is too large **without waiting for all of it to
arrive**.

Two details the tests pin down. Size is reported **before** type, because somebody whose 40 MB scan
is also a TIFF needs the thing they must act on first — rescanning smaller fixes both, and being
told about the format sends them to convert a file that would still be refused. And a file of
*exactly* the maximum is accepted, because the server's rule is `size > max`: refusing at `>=` would
send a caseworker to rescan a document the office would have taken.

A failed upload says so plainly and never says "saved" (`DL-87`). A document the office believes it
holds, and does not, is the failure this whole model exists to prevent.

### A payout session can be opened

`createBatch` was implemented on both adapters and called by no screen. The payout-session page
listed sessions and printed their manifests; **nothing in the console could create one.**

**The session is created, then each release is added as its own act.** The API takes the session
alone and members through `POST admin/release-batches/{batch}/releases`, one at a time. That shape
is right rather than merely imposed: a batch arriving with its membership baked in would make *"when
did this family get scheduled"* unanswerable, because there would be no separate act to record.

**A member that fails does not lose the session.** The chain stops and returns the batch as it
stands, and the screen says *which* state it is in — `DL-90` already holds that a batch has no
status of its own and what it amounts to is derived by counting its members, so a half-filled
session is a countable, visible thing rather than an error.

The message names the shortfall rather than counting it. *"3 releases could not be added"* tells a
disbursing officer to check all of them; saying how many of how many, and warning that anybody
missing will not be expected at the table, tells them what to do on the day.

**Only releases that are ready are offered.** A session is a plan for a table on a day; offering one
already paid, or one nobody has approved, would put a name on a payout list that should not be
there.

**The idempotency key is held on the component**, not made per attempt. A retry must carry the same
key or the server treats it as a second, genuine session — which on a payout is a second table
expecting the same families.

The officer is whoever opens it. The API sets `opened_by` from the authenticated actor and ignores
what a client sends, so the console agrees with the server rather than asserting something it could
get wrong.

### The 20 unreached ports, categorised

One pass over what `check:port-adoption` counts, so that twenty items become a handful of decisions.

| Category | Count | What it needs |
| --- | --- | --- |
| **Live endpoint, no screen** | 11 | building — nothing blocks them |
| **Wrong path or verb** | 5 | a mapping fix, mostly already recorded in `port-mapping.md` |
| **No endpoint at all** | 2 | a backend decision |
| **Blocked on ADR 0044** | 2 | the case-model session |

**A pattern worth naming, and fixed here.** Three `BeneficiaryRepository` methods asked for
`admin/beneficiaries/{id}/enrollments`, `/duplicates` and `/identity-findings`. **None of those
paths exists.** The API serves each as a filtered collection of the thing itself, which is the wire
expressing `DL-71`: there is no `Beneficiary` entity and no `BeneficiaryId`, the registry is a
projection over residents keyed on `ResidentId`.

Reading them as sub-resources of a beneficiary was the console asserting an entity its own model
denies — and all three 404'd. They now read `admin/enrollments?residentId=`,
`admin/resident-duplicates?residentId=` and `admin/residents/{resident}/duplicate-findings`.

**One apparent finding was my own tooling.** The categorising script reported
`FieldVisitRepository.forResident` pointing at `admin/referrals`; two ports declare a method of
that name and the script matched the first. The adapter is correct. Checked before reporting,
because "no caller" and "wrong path" have both been wrong conclusions in this codebase before.

**What is left is mostly ordinary.** Eleven methods have a live endpoint and no screen: a family's
membership and kinship history, a request's notes, a payout session's detail, a resident's
household, a person's referrals and visits, a staff account. None is blocked; each is a screen
somebody has not built yet, and the gate now says so on every run.

### The family cluster, closed

All four `FamilyRepository` methods now reach a screen.

* **`familiesOf` and `historyForResident`** on the resident record, in their own panel. A household
  is an address and a family is a claim about who belongs to whom (`DL-47`), and one person may
  belong to more than one — folding them into the household panel is the assumption that rule
  exists to remove.
* **`historyForResident` in particular was written and shown nowhere.** `DL-48` makes family history
  append-only, and the office had been accumulating a record no screen could read.
* **`changeMemberRole`** on the family record. Only the head is settable; the adapter refuses the
  other roles loudly rather than quietly posting a head change for a role nobody asked for.
* **`endRelationship`** had invented its route. The comment above it argued that ending a
  relationship is a recorded act rather than a deletion, so it must be a POST — **the doctrine was
  right and the verb was ours.** The API serves `DELETE` under the resident the relationship is
  about, and the server records the event either way.

That is the second time in this programme a correct principle produced an invented route; the
vulnerability-factor `clear` was the first. The pattern is worth naming: *a rule about what the
system must remember is not a rule about which HTTP verb carries it.*

**One gap stays recorded rather than papered over.** `POST admin/families/{family}/head` accepts no
reason, while `DL-48` requires one on every family change. The act reaches the trail; the sentence
explaining it does not. The call site still passes a reason so the port's contract is honoured
rather than the argument quietly disappearing at the one place a reader would look for it.

### Not every unreached port is a missing screen

Building the "9 live-endpoint screens" turned up a distinction the earlier categorisation missed:
**some unreached methods duplicate a composite the screen already fetches.**

* `ResidentRepository.getHousehold(householdId)` returned a bare `Household` by id, while
  `HouseholdRepository.getById` returns the fuller `HouseholdDetail` for the same record — a
  second read of one thing, from a port that does not own it. **Zero callers anywhere. Removed.**
* `BeneficiaryRepository.enrollmentsFor` returned what `BeneficiaryDetail.enrollments` already
  carries. **Removed**, and the mock spec that used it now reads the detail — the rule it asserts is
  unchanged, only the door it comes through.

Building screens for those would have created exactly what `DL-71` warns about: *two assemblies of
the same history eventually disagree, in front of the family.* Deleting them lowers the count
honestly, which building a duplicate screen would not have.

`duplicatesFor` is the same shape and was **kept**: its mock spec asserts a real withholding rule
(candidates are empty for a viewer without `beneficiary.review-duplicates`), and losing that
coverage is not worth one point on a counter.

**One genuinely missing read was built.** `FieldVisitRepository.forResident` — home visits on the
resident record. No composite carries them, and a visit is often the only record of what the office
actually saw.

### A panel a role may not read is absent, never fatal

Adding that panel broke the whole record for a role without visit access: the refusal propagated
and the page rendered nothing. An intake officer looking up an address would have seen a blank
screen because they cannot read home visits.

The three side panels now degrade to empty. That makes the refused state look like the empty state,
which is the one thing `DL-112` argues against — it is accepted here as the lesser harm, and the
panel headings stay visible so nobody reads a missing panel as a missing record.

**The port-adoption count is optimistic by one.** Two ports declare `forResident`, and the check's
search is textual, so calling `FieldVisitRepository.forResident` also credits
`ReferralRepository.forResident`. That is the under-reporting the check names in its own output.

### The twelve remaining unmapped writes are not twelve pieces of mapping

Working through them showed that only one was a mapping job. The rest divide into three kinds, and
**none of the other eleven can be closed from this repository**:

| Kind | Count | What it needs |
| --- | --- | --- |
| Blocked on ADR 0044 | 3 | `assign`, `assignTask`, `rescheduleTask` — the case surface |
| No endpoint at that verb | 4 | `transferResident`, `setAccountActive`, `requestDocument`, `resolveIdentity` |
| A required field the console does not collect | 4 | the programme draft and the intake draft |
| **Ordinary mapping** | **1** | the visit checklist — done |

**`ProgramDraft`** cannot satisfy `POST admin/programs`, which requires `code`, `owner_office`,
`service_type` and `benefit_type`. The console holds a `category` and a `responsibility`, and those
are not those fields. **`IntakeDraft`** is the `category` question already recorded above.

**`AssessmentDraft` is a shape mismatch, not a missing field.** The console models an assessment as
free-text findings plus a recommended amount; the API models it as a template that is opened,
answered question by question, and completed with a **required `recommendation`**. That the console
has no recommendation is not an oversight — `DL-60` and `DL-78` hold that the assessment advises and
never decides, and the decision is a status transition made by a person. Reconciling the two is a
doctrine conversation, not a mapper.

### The checklist could not express an unticking

`setChecklist` sent `{ checkedCodes: [...] }` in one request to an endpoint that validates a single
`{ code, checked, note }`, so every save was refused. That much was a plain mismatch.

The interesting half is what the fix required. The API records **one line at a time and touches
nothing else**, so a list of ticks alone cannot say which lines were *cleared* — a worker who
removed a tick would have found it back. The port now carries every line with the state it should
end in, and the adapter sends one call per line in order.

The mock had been hiding it: it rebuilt the whole list from the ticked codes, so absent meant
unticked. That is a different rule from the server's, and a mock that is more convenient than the
thing it stands in for is one a screen gets built against.

### The case study was posted to the endpoint that starts one

`recordAssessment` posted the whole `AssessmentDraft` to
`POST admin/assistance-requests/{case}/assessment`. That path is the server's **`open`** action: it
takes one field, `template_code`, and starts a blank assessment from a published template. It does
not take findings, an amount or a home visit, and it would have refused the console's body for a
missing `template_code` before reading any of it.

The endpoint that signs findings is `POST .../assessment/complete`, and `check:routes` never saw
the difference because both paths exist and both take `POST`. A verb-aware path check answers
"is there an endpoint here"; it cannot answer "is it *this* endpoint", and nothing in the suite
does.

Three things follow, and only the first is fixed.

**The recommendation was missing entirely.** `complete` requires it — `in:recommend-approve,
recommend-deny,recommend-refer,insufficient-information` — and `AssessmentDraft` had no field for
it, so the console could not have completed an assessment even against the right path. The four
values are now in the domain (`domain/intake/assessment.ts`) with the backend enum's own wording
preserved: they are advisory verbs, and `insufficient-information` is a first-class answer rather
than an absence, which is why it is the empty draft's default. Defaulting to `recommend-approve`
would put a recommendation on a form nobody has filled in.

This is `DL-60` and `DL-78` doctrine, not an exception to it. The enum's docblock is explicit —
"A RECOMMENDATION IS NOT A DECISION… A human with approval authority decides" — and completing an
assessment moves a case to `endorsed` at most. The console was not holding the line by omitting the
field; it was failing to record the assessor's advice at all.

**Two of the draft's fields have nowhere to go.** `recommendedAmount` and `homeVisitConducted` have
no counterpart on `complete`, and `toWireAssessment` sends neither. A caseworker fills both in and
the office record keeps neither. Folding the amount into `findings` would put a figure in free text
where no report can find it; inventing keys would 422 the save. This needs a decision about where
the office records a recommended amount, which is a question about the record rather than about
field names.

**`complete` requires an assessment already open, and nothing opens one.** The server refuses with
"No assessment is in progress for that case." unless `open` ran first with a `template_code`, and
this console never reads `GET admin/assessment-templates` — it has no notion of a template at all.
So the save still fails; it now fails against the endpoint that could succeed, which is the half of
the fix that does not require choosing a template vocabulary the office has not published.

### Four checks had stopped watching part of the surface

Adding three adapter methods should have moved `check:routes` from 120 composed paths to 123. It
moved it by nothing at all — the new calls were not reported as unwired, they were not seen.

The extractor walked `/this\.api\.(\w+)\s*[<(]/`, contiguous. Every call written as

```ts
return this.api
  .item<Record<string, unknown>>(API_ENDPOINTS.assessmentTemplates)
  .pipe(map(toAssessmentTemplates));
```

— the shape Prettier produces the moment a chain wraps — matched nothing. That is worse than an
unwired path being reported, because the count *looked healthy*: the paths were absent from both
sides of the comparison, so the ratchet was green about a surface it was not reading.

The same contiguous pattern was in three more tools. Widening all four to allow whitespace around
the dots:

| check                | scanned before | scanned after | debt found |
| -------------------- | -------------- | ------------- | ---------- |
| `check:routes`       | 120 paths      | **127**       | 0 new 404s |
| `check:wire-adoption`| 64 writes      | **70**        | 0 new unmapped |
| `check:mapper-adoption` | 44 reads    | **48**        | 1 real, 3 wire-typed |
| `check:query-params` | 77 calls       | **81**        | 1 unreadable key |

Thirteen calls were invisible. Eleven of them turn out to be fine, which is luck rather than
design — the point is that nothing was checking. Two were real, pre-existing debt hidden by the
blind spot rather than introduced by this change: an unmapped `optionalItem<HouseholdDetail>` and
one more camelCase filter key the API silently ignores. Both ceilings were raised by exactly one,
and each records why.

`check:mapper-adoption` also gained a distinction it needed. Its rule is that a generic is an
assertion rather than a conversion — `api.page<ResidentView>` tells TypeScript a snake_case payload
is a domain object and nothing at run time makes that true. But `api.item<MeWire>(…).pipe(map(toMe))`
asserts only that the payload is the wire shape it really is, and then converts it. Counting that as
debt marks the fix as the defect. Reads typed `…Wire` or `Record<string, unknown>` are now excluded,
and neither can be an escape hatch: the first is this repository's declared convention for a payload
shape, and the second asserts nothing a template could read a camelCase property off.

**A ratchet that silently stops watching part of the surface is the failure this whole class of
tooling exists to prevent.** All four widened scanners were mutation-tested — a domain type on a
chained read, a camelCase body on a chained write, and a renamed body key each fail the check.
