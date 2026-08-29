# Actions only you can take

Everything in the integration sequence that cannot be done in code, in one place. Each entry says
what it is, why nobody can automate it, and what it unblocks.

**Automated so far, for contrast:** the local API (`tools/local-api.sh up` in the backend),
the secret scan (a CI job in both repositories), the whole console gate (`npm run verify` —
lint, typecheck, 22 repository checks, 1,532 tests, production build), and the contract artefacts
(`lguids:openapi`, `lguids:types`, both `--check`-able in CI).

---

## 1. Accounts and access — minutes each

### 1.1 GitHub token: `workflow` scope

**Status: blocking right now.** Two CI files are written, tested and sitting uncommitted, because
pushing anything under `.github/workflows/` needs it.

- Classic token → github.com/settings/tokens → tick **`workflow`** → *Update token*
- Fine-grained → Repository permissions → **Workflows: Read and write**

**Unblocks:** the console's first CI pipeline at all, and the standing secret-scan gate in both
repositories. Until then, `main` is verified only by whatever ran on a laptop.

### 1.2 Repository visibility — decision D-00-01

Both repositories are **public**. The recommendation is private for both.

This is not about the code being secret. It is that a public repository publishes the schema of a
welfare registry, a 61-key authorization model and the privacy design of a system processing VAWC,
child-protection and medical records — and RA 10173 asks a personal-information controller for
organizational measures proportionate to what is processed. Public is a legitimate answer; it
should be a recorded decision rather than a default nobody chose.

**Unblocks:** the TAB 19 gate line for TAB 00. One toggle each in repository settings.

### 1.3 Branch protection on `main`

No protection on either repository: force-push and deletion are both possible today.

Needed: no force-push, no deletion, required status checks once CI is running, at least one
reviewer on pull requests.

**Unblocks:** the rest of TAB 00 step 2. Do it *after* 1.1, so the CI checks exist to require.

### 1.4 Docker Desktop or OrbStack

**The single highest-value install.** The repository already ships `docker-compose.yml` with
PostgreSQL 18, Redis, MinIO and Mailpit.

Everything proven so far ran on **SQLite**, so response shapes are real and **nothing about
concurrency, row locking or `lockForUpdate` is** — release-gate blocker 4 is untouched, and
`artisan migrate` has never run against real PostgreSQL.

**Unblocks:** TAB 05 step 10 properly, all of TAB 06 (which needs real interactions to record),
TABs 08–11, and the money and event-capacity work that cannot be proven on SQLite at all.

---

## 2. Decisions — an hour each, and they block code

### 2.1 The programme catalog — the sharpest one

Does the programme payload carry `ProgramResponsibility`, or does the console keep its own
catalog?

`ProgramResponsibility` requires `administeredBy`, `fundsHeldBy`, `lguRole`, a `statement`
(*"what the office may honestly tell an applicant, in one sentence"*) and `sources`. The API sends
`owner_office`, `decided_by`, `authority` and `funding_source_label` — no statement, no sources.

Synthesising one produces a record the domain's own validator rejects, and the failure mode is not
a wrong field: **it is the console telling an applicant that the municipality runs a programme it
does not run.** AICS is DSWD-administered with DSWD-disbursed funds, and CLAUDE.md records that
getting this wrong before *"was a defect, not a wording preference"*.

**Blocks:** `ProgramRepository` entirely, and the intake screens behind it.

### 2.2 The case model — ADR 0044, awaiting ratification

I have proposed **Option A** (a case is the office's continuing involvement; an assistance request
is one intervention inside it) and **supersede, not merge** for duplicate identity. Both are
recorded with reasoning.

It needs the **MSWDO head, a social worker and an intake officer** in one room, walking a real
recurring family through both models: a medical grant in March, a child's schooling in June, a
follow-up visit in September.

Everything built so far is true under all three options, so a different answer costs nothing to
adopt.

**Blocks:** the continuing-involvement module, six permission keys (`case.*` ×5 and
`resident.merge`), and eleven `CaseRepository` methods.

### 2.3 Fix `barangay_id` (L-15) — backend, small, and it is a contract violation

The API sends `"barangay_id": 2` — the raw auto-increment key — on residents and households.
`conventions.md` §6 forbids exactly this: *"Auto-increment primary keys are internal and must never
appear in a payload."*

The console tolerates it at two call sites so records are not dropped, and the tolerance is
one-way, so nothing here needs changing when it is fixed. Expose the barangay's UUID, or its code.

### 2.4 The assistance request cannot be built from the API (L-16, L-17) — backend

Two fields the console's model requires do not exist on the API side at all:

- **Why the household applied.** `reasonForRequest` is required in the domain; `welfare_cases` has
  no narrative or reason column, only `priority_reason`, which is about urgency. Not withheld by a
  permission — absent. A console that cannot show why a family applied cannot support the decision
  it asks a social worker to make.
- **Any amount.** `requestedAmount` and `approvedAmount` have no counterpart; money lives on
  releases. That may be the better model, but it is a *different* model, and TAB 08 must settle it.

**Blocks:** `AssistanceRequestRepository` — the console's busiest surface. Both gaps are pinned by
test, so they fail the day they are closed.

### 2.5 Referral destinations are free text (L-18) — backend, and it has a privacy consequence

`ReferralDestination` is a closed union of eight Philippine destinations in the console —
`dswd-field-office`, `hospital-msw`, `philhealth`, `peso`, `barangay-vaw-desk`,
`women-and-children-protection-desk`, `other-lgu-office`, `ngo-partner`. The API validates
`destination_type` as `['sometimes','string','max:48']` and sent `health-facility`.

**Two of the console's eight are protection desks.** Whether a referral is going to one governs
how much may be disclosed and whether `referral.disclose-protected` applies. Against a free string
the console cannot tell, so it cannot apply the rule.

Either the API adopts the controlled vocabulary, or the office accepts that destination type is
descriptive and protection handling is driven by something else — but it needs deciding, not
defaulting.

**Blocks:** `ReferralRepository` (13 methods).

### 2.6 Self-release: block or warn? (L-19) — **the office decides, and it is the sharpest one**

Walked end to end against the running API. It refuses at the *person* level, twice:

- *"The person who endorsed a case may not approve it."*
- *"The person who approved this assistance cannot also release it."*

The console takes the **opposite** position, deliberately (`DL-91`): it warns and lets the officer
proceed, because *"a small office on a bad day may have one person available, and refusing the
payout punishes the family for the office's staffing."*

Both are defensible. **They cannot both be executed.** And today the console's screen warns and
then proceeds — against this API the proceed always fails, so **the warning becomes a lie**: it
tells an officer they may continue with care, and the server refuses. A one-officer office gets a
family turned away with no path forward in the product.

Either the API relaxes to warn-and-record with the self-release audited, or the console stops
offering the path and says a second officer is required. **Take it to the same session as the case
model (2.2)** — it is the same kind of question and the same people answer it.

### 2.7 Two smaller ones

- **`HouseholdBand` cannot say "we did not ask"** (L-14). Either it gains an unassessed member,
  the list screen stops rendering a band, or the endpoint carries the snapshot. Until then a
  household list would claim *"no vulnerability factors present"* on data nobody sent.
- **An assistance summary type** (L-13). Console-side, small — say the word and I will do it.

---

## 3. Appointments and approvals — weeks, and they gate launch

These are release-gate blockers 1–3. **No engineering closes any of them**, and they have the
longest lead times in the whole document. Start them before anything else on this page.

### 3.1 Appoint a Data Protection Officer

`audit.view` sits **only** with `data_protection_officer`, and nobody holds that role. The audit
trail is being written now and cannot be read by anyone. The first time it is needed is during an
incident — the worst possible moment to discover that.

Giving it to the MSWDO head instead would be the auditee reading their own audit, which is why it
is not already assigned.

### 3.2 Approve the retention schedule

Until a DPO approves one, `mayPurge()` refuses everything. That is the safe direction and not a
steady state: indefinite accumulation of residents' personal data is itself an exposure under
RA 10173.

### 3.3 Perform a restore

Nobody has ever restored a backup. RPO and RTO are unset — deliberately, because they are business
decisions about how much welfare data Taytay can afford to lose, not numbers engineering should
invent.

**A backup that has never been restored is a hypothesis.**

### 3.4 Also needed before launch

- **Place the six parked protection permissions.** `vulnerability.view-protected`,
  `document.view-sensitive`, `case-note.view-protected`, `safeguarding.view`,
  `safeguarding.manage`, `referral.disclose-protected` currently sit with the MSWDO head because
  no protection-officer role exists. Reading a survivor's safety plan is not an administrative
  task.
- **Decide who may hold `document.share`.** Held by nobody today; the outward-sharing path is
  built and refused.
- **Enrol every staff account in MFA before cutover.** Since TAB 02 an unenrolled staff account
  signs in to an enrolment-only session. That is correct, and on the first morning it is a support
  queue if nobody has prepared for it.

---

## 4. Deployment inputs — needed before anything ships

- **Real hostnames.** `admin.<domain>` and `api.<domain>`. Placeholders currently sit in
  `netlify.toml`, `public/_headers` and both environment files.
- **`CORS_ALLOWED_ORIGINS`** set to those exact origins — never a wildcard, never a
  `*.netlify.app` pattern, because anybody can create a site on that domain.
- **`TRUSTED_PROXIES`** set to the private CIDR. Without it, rate limiting collapses to one shared
  key and every audit entry is attributed to the load balancer.
- **Object storage** with separate private and public credentials, neither able to read the
  other's bucket.
- **HSTS only after certificates are confirmed** — it cannot be undone from the server, and a
  certificate problem then locks the office out of its own console.

---

## What is genuinely automated

| Task | Command |
| --- | --- |
| Local API — migrate, seed, serve | `tools/local-api.sh up` (backend) |
| A usable local staff login | `tools/local-api.sh staff` |
| Throw the local database away | `tools/local-api.sh reset` |
| Full console gate | `npm run verify` |
| Full backend gate | `composer test` and `vendor/bin/pint --test` |
| Secret scan, whole history | CI job in both repositories, allowlist at `docs/integration/secret-scan-allowlist.txt` |
| Contract currency | `php artisan lguids:openapi --check`, `lguids:types --check` |

Everything on this page above that table is on it because a script cannot appoint a person, decide
a policy, or agree what a case is.

---

## TAB 09 — the two things a repository cannot fix

### 1. `client_max_body_size` must sit **above** the application limit

The API accepts uploads up to **10 MB** (`AcceptedMediaType::MAX_BYTES`). nginx must allow more
than that — 12 MB is a reasonable margin:

```nginx
client_max_body_size 12m;
```

**Why the margin matters, rather than matching exactly.** If nginx rejects the body first, it
answers before Laravel ever sees the request, so the response carries **no CORS headers**. The
browser then refuses to expose it and reports `status: 0` — which is indistinguishable from the
server being unreachable.

The console now handles that case: a `0` on an upload is reported as *too large*, with the real
figures, rather than as a network failure. That is a deliberate guess and it is the right one —
being wrong costs a retry, being wrong the other way sends somebody to check their wifi over a
file that is simply too big. But it is a fallback. With the margin set, **Laravel answers first**,
the message is precise, and the guess stops being reachable.

Also raise `upload_max_filesize` and `post_max_size` in PHP above 10 MB, for the same reason: a
PHP-level rejection produces a truncated body rather than a clean refusal.

### 2. Object storage is still not provisioned

TAB 09's own precondition: *"Object storage provisioned with separate private and public
credentials."* It is not, so three things are **designed and unverified**:

* **two buckets, one writer, least-privilege keys, neither key able to read the other's bucket** —
  the code targets an `object-storage` disk and a `public` disk and never writes anything
  citizen-derived to the second, but nothing has proven the keys are actually separate;
* signed-URL issuance against a real store;
* that a durable public URL genuinely cannot be constructed for a private object.

Everything proven so far ran on the local disk. The access-grant model — opaque, single-use,
expiring, issued after a server-side decision — does not depend on the store, so it holds. The
*posture* does.

### 2.8 Sorting is published and unimplemented (L-26) — backend, and it decides a console change

`docs/api/conventions.md` §5 promises `?sort=field` / `?sort=-field` against an
endpoint-declared allow-list. `PaginationParams::fromRequest` reads `page` and `per_page` only,
and **no list controller in any module reads `sort`**. The console sends it on every paged read
and offers a working column header on seven list screens; against the mock they sort, against
the API they cannot.

Two ways to close it, and somebody has to pick:

* **Implement §5.** An allow-list per list endpoint — residents, assistance requests, referrals,
  releases, visits, households, beneficiaries — mapping a published field name to a column. Small
  and mechanical, and it makes the console's existing UI correct with no console change.
* **Amend §5** to say sorting is not offered, and the seven `(sortChanged)` handlers and their
  column affordances come out of the console.

Not a console decision either way: the console cannot implement server-side ordering, and it
should not remove a working affordance while the published contract still promises it.

**Do not "fix" this by snake_casing the ten camelCase sort fields.** That makes the parameter
well-formed and still ignored, and closes the finding without changing the behaviour.
