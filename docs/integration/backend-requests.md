# What this console needs from `taytay-backend`

Every ask this repository has of the API, in one place, with the evidence and what it blocks.

**It is short on purpose.** The first draft was long, and most of it was wrong: routes filed as
missing turned out to be published under names a guessed substring search never found (`DL-150`).
Everything below has been checked against `routes.published.json` **and** the controller behind it,
because two paths sharing a verb can mean different things (`DL-141`).

Nothing here is a defect report about the backend's judgement. Several entries are places where the
API's model is arguably better than this console's, and say so.

---

## 1. Genuinely absent, and blocking

### 1.1 `POST .../assessment/complete` has nowhere to put two fields — **L-17**

`complete` accepts `recommendation`, `reason` and `findings`. A caseworker also records a
**recommended amount** and **whether a home visit was made**, and neither reaches the office record.

The welfare schema holds exactly one amount column anywhere — `releases.amount_centavos`, money
actually handed over. `welfare_cases` has none and `assessments` has none, so this is the same gap as
`requestedAmount` and `approvedAmount` (`DL-144`): the console models money on the request, the API
models it only on the release. **One decision covers all three, and it is the office's.**

`welfare_cases.needs_home_visit` is not a home for the second field. *Needs* is a plan and
*conducted* is a fact, and it is read-only in any case — projected by `CaseController`, written by no
endpoint.

**Blocks:** an approver cannot see what the assessor recommended paying.
**Console meanwhile:** states the absence above both controls, enforced by `check:intake` only while
the mapper is still dropping them.

### 1.2 `decide` cannot say which duplicate record survives — `DL-148`

`POST admin/resident-duplicates/{pair}/decide` takes `decision` and `note`. The canonical record is
settled in `merge`, and this console never calls merge (`DL-74`).

So a `same-person` finding says *these two records are one person* and not *and this is the one to
use* — while superseding is the part that stops the second record being used again. A pair decided
`same-person` still has two live entries, and the next clerk to search finds both.

**Two ways out, and the office picks:** `decide` grows a canonical field, or `merge` is accepted as
the act that supersedes and `DL-74`'s ban is revisited — it was written about *deleting* a record,
not about pointing one at another.

**Blocks:** duplicate resolution does not resolve anything.

### 1.3 `PATCH admin/assistance-intakes/{intake}` — no counterpart of any kind

`POST admin/assistance-intakes` creates; nothing amends. The console assumes a counter intake can be
corrected before filing. Of the seven non-case unwired paths, this is the only one with no published
route that could serve it.

**Blocks:** a clerk who mistypes at the counter has no way back.

---

## 2. One line each, and each removes a client-side approximation

### 2.1 `as_of` on `summaryFor` — `DL-149`

`GET admin/events/{event}/registration-summary` answers counts with no timestamp. `DL-129` requires
the moment to travel with the numbers, so this console stamps **when it read them** and words every
screen "read at" rather than "as of" — read time is *later* than count time, so the stronger wording
would claim the data is fresher than it is.

One field would let the screen state the fact instead of inheriting it.

### 2.2 A household role, or the relationships already stored — `DL-145`, `DL-146`

`household_memberships` carries `effective_from`, `effective_to` and `end_reason`, and **no role**.
The resident profile prints a member's relationship to the head beside their name, so it cannot show
the household composition at all: the panel says it could not be read rather than rendering an empty
list, which would assert nobody else lives at the address.

Either the membership row gains a role, or the API publishes the resident-to-resident relationships
it already stores (`DL-47`'s model, and the better one).

**Blocks:** `check:mapper-adoption` cannot come below 43; the household panel shows nothing.

### 2.3 `requested_by` on a document request — `DL-151`

The document-request projection carries `id`, `requirement_id`, `state`, `channel`, `message`,
`needed_by`, `requested_at`, `closed_at`, `withdrawn_reason` and `is_applicant_overdue` — and no
requester. The console holds the field as `null` rather than inventing one.

The record exists so that an applicant who says they were never told can be checked against
something. "The office asked" without "and this is who" is a weaker record than it looks.

### 2.4 `deactivate` accepts no reason — `DL-147`

`DELETE staff/{staff}` takes no body. The office asks its administrators why an account is being
switched off, and the answer is captured and discarded.

**Also, and larger:** there is **no reactivation route at all**. The console refuses the action
rather than failing an administrator who believes they have restored a colleague's access.

---

## 3. Privacy — the API sends more than the console may show

### 3.1 The duplicate-pair projection carries names and birth dates — `DL-73`

`pairProjection` sends each side's `name` and `birth_date` in full. `DL-73` exists so that "the
review panel cannot leak a birth date it was never handed": a `MatchSignal` carries an attribute, an
outcome and the rule applied, never a value.

The console discards both, which is not protection — the payload reaches the browser. Duplicate
review is deliberately withheld from intake and from the auditor precisely because it is a wide read
of two identities at once.

**Ask:** send what the queue displays — a masked label and the signals — and put the values behind
the same grant the comparison already costs.

---

## 4. Where the API's model wins, and this console will change instead

Recorded so nobody files them as requests.

| Console | API | Verdict |
| --- | --- | --- |
| `GET admin/assistance-requests/advisory` | `.../{case}/advisory` | per-case is right; advisory is *about* a case |
| `POST admin/reports/{}/export` | `POST admin/exports` | **better**: the permission comes from the report, not the route — `DL-104` server-side |
| `GET admin/events/{}/registrants/export` | the same `POST admin/exports` | one export resource beats one per surface |
| `GET admin/privacy/corrections` | `GET admin/resident-corrections` | naming only |
| `POST admin/families/transfers` | `POST admin/households/{household}/transfers` | a transfer is between **addresses**; `DL-47` says the console is the one confusing household with family |
| `POST .../{case}/document-requests` | `.../{case}/requirements/{requirement}/document-requests` | **adopted** (`DL-151`) — a document is asked for against the **requirement** that needs it |

---

## 5. Out of scope here

The ten `admin/cases*` paths are blocked on ADR 0044 and are not a request — the model is still being
ratified. `L-15` (`barangay_id` as an auto-increment key), `L-16` (`reasonForRequest` absent) and
`L-18` (referral destination as free text) are already in `manual-actions.md` §2 and are not repeated.

---

*Derived from `node tools/check-routes.mjs --nearest`, the vendored route snapshot, and the
controllers behind each route. Regenerate the candidate list before adding to this file — the first
version of this document was written from guessed substring searches and was wrong four times over
(`DL-150`).*
