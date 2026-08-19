# MASTER TODO — manual tasks only

**Everything on this list needs a person. Nothing here can be coded.**

Anything that *can* be automated is not on this list — it has been done, or it is in the backlog
as engineering work. Detail and reasoning for each item live in
[`docs/integration/manual-actions.md`](docs/integration/manual-actions.md); this page is the list.

Last updated: 19 August 2026, after TAB 07.

---

## 🔴 Blocking right now

- [x] ~~**Add `workflow` scope to the GitHub token**~~ — **moot.** CI is deliberately not run
      (no Actions credit), so the two workflow files stay uncommitted by design rather than by
      blocker. `docs/` and the local gates carry what they would have enforced.

- [ ] **Install Docker Desktop or OrbStack** — *now blocking a P0 acceptance criterion*
      Everything proven so far ran on SQLite. Nothing about concurrency, row locking or
      `lockForUpdate` is proven, and `migrate` has never run against real PostgreSQL.
      → **TAB 08 step 8 is unmet because of this**: "two officers releasing the same payout
      simultaneously must produce one success and one refusal", which the command says must be
      proven on real PostgreSQL. On SQLite the test would pass for a reason unrelated to the code,
      so `ReleaseConcurrencyTest` is an honest skip rather than a false green.
      → Unblocks: TAB 05 step 10 properly, all of TAB 06, TABs 08–11, release-gate blocker 4.

---

## 🟠 Decisions — an hour each, and code is waiting on them

- [ ] **Settle the permission vocabulary** (L-23 / backend G-09a) — *now the largest one*
      Only **30 of the console's 70** permission keys exist on the API. **24 of 43 guarded routes
      are unreachable, including the dashboard.** Two separate calls:
      1. *Naming* — the console splits `resident.create` / `resident.update`; the API grants
         `resident.manage`. Same act, two spellings. Pick one. (API owner, ~1 hour.)
      2. *Concepts the API lacks* — `dashboard.view`, `settings.manage`, `beneficiary.*`,
         `family.view`. Each needs an endpoint before it needs a permission.
      → Nothing is broken today; it breaks the day TAB 12 flips to the real API, as a blank
      console rather than an error.

- [ ] **Self-release: block or warn?** (L-19) — *the sharpest one*
      The API refuses at the person level; the console warns and proceeds on purpose. Both are
      defensible, they cannot both be executed, and today the console's warning is a lie.
      → Take to the same session as the case model.

- [ ] **Is a person in one family, or several?** (backend G-24) — *new, and it blocks a screen*
      The API allows **one** open family membership per resident and refuses the second, because two
      memberships count a person twice in per-family grants — the double-payment problem one level
      down. The console's model is plural and treats a grandmother counted with her own family and
      her daughter's as ordinary.
      → Both are coherent, only one can be executed. The API's argument is money; the console's is
      not erasing how households in Taytay actually compose. Same session as the case model.

- [ ] **Confirm the intake advisory's windows** (backend G-29) — *30 minutes, low stakes*
      90 days for a repeat grant under the same programme, 12 months for any assistance. Neither
      came from a DSWD issuance. The advisory **does not block**, so a wrong window adds or omits a
      caution rather than refusing anybody — a usefulness question, not an entitlement one.

- [ ] **Ratify the case model** — ADR 0044 proposes Option A + supersede-not-merge
      Needs the MSWDO head, a social worker and an intake officer, walking one recurring family
      through both models.
      → Unblocks: the continuing-involvement module, six permission keys, 11 `CaseRepository` methods.

- [ ] **Programme catalog**: does the API carry `ProgramResponsibility`, or does the console keep
      its own catalog?
      → Failure mode is the console telling an applicant the municipality runs a programme it does
      not. Blocks the intake screens.

- [ ] **Referral destinations**: controlled vocabulary or free text? (L-18)
      Two of the console's eight destinations are protection desks, and the rule about what may be
      disclosed depends on knowing which.

- [ ] **Duplicate review**: how much may a reviewer see? (L-21)
      The API sends both residents' birth dates; the console withholds values by design.

- [ ] **Household band**: add an "unassessed" value, drop the band from the list, or have the
      endpoint carry the snapshot (L-14)
      → Until then a household list would claim "no vulnerability factors present" on data nobody
      sent.

---

## 🟡 Backend fixes — small, and each has a recorded test that fails until done

- [ ] **Two spellings of one report id** (backend G-27) — console `program-utilisation`, API
      `program-utilization`. Not a matter of taste once a client routes on it.
- [ ] **A household head is not enrolled as a member** (backend G-23) — a write-path change with a
      backfill behind it: what happens to heads who have since moved out?
- [ ] **A post records when it was archived and not why** (backend G-30) — the one question worth
      asking about a removed post. The event side already records its reason.
- [ ] **Family member roles cannot be recorded** (backend G-22) — the schema has no role column, so
      four of the console's six roles are unknowable and none is guessed.

- [ ] **`barangay_id` is an auto-increment key** (L-15) — `conventions.md` §6 forbids it outright
- [ ] **No field for why a household applied** (L-16) — `reasonForRequest` has no source at all
- [ ] **No amount on an assistance request** (L-17) — money lives only on releases
- [ ] **`available_transitions` advertises `released`, which the endpoint refuses** (L-20)

---

## 🔵 Repository administration

- [ ] **Decide whether the other three clients publish contract expectations**
      Four clients consume the API; only the admin console publishes what it reads, so citizen web,
      citizen mobile and verifier devices could each lose a field they depend on with CI green.
      `taytay-mobile-app` is on this machine and reads the wire in the same shape (5 DTOs), so
      generating its file is small — but it is a third repository, outside the two this Master
      Command joins.
      → Adding one is a data change: drop the generated file into `docs/api/consumers/`.


- [ ] **Decide repository visibility** — both are public today; recommendation is private for both
- [x] ~~**Protect `main`** with required checks and a reviewer~~ — **declined by the owner,
      19 August 2026.** Pushes go straight to `main` with no pull-request review, and no CI
      workflow is committed because there is no Actions credit. The gates therefore run locally
      before every push, and that is now the only thing standing between a mistake and `main`.
      → Worth revisiting the day a second person commits to either repository.

---

## ⏳ Appointments and approvals — weeks of lead time, and they gate launch entirely

**Start these before anything else on this page. No engineering shortens any of them.**

- [ ] **Appoint a Data Protection Officer** — release-gate blocker 1
      `audit.view` sits only with that role and nobody holds it. The trail is being written now and
      cannot be read by anyone.

- [ ] **Approve the retention schedule** — release-gate blocker 2
      Until then `mayPurge()` refuses everything, and indefinite accumulation is itself an exposure
      under RA 10173.

- [ ] **Restore a backup, once, into a clean environment** — release-gate blocker 3
      Nobody has ever done this. RPO and RTO are unset.

- [ ] **Place the six parked protection permissions** — currently on the MSWDO head because no
      protection-officer role exists. Reading a survivor's safety plan is not an administrative task.

- [ ] **Decide who may hold `document.share`** — held by nobody; the outward path is built and refused.

- [ ] **Enrol every staff account in MFA before cutover** — since TAB 02 an unenrolled account signs
      in to an enrolment-only session. Correct, and a support queue on the first morning if nobody
      prepared for it.

---

## 🚀 Deployment inputs — needed before anything ships

- [ ] **Real hostnames** for `admin.<domain>` and `api.<domain>` — placeholders sit in `netlify.toml`,
      `public/_headers` and both environment files
- [ ] **`CORS_ALLOWED_ORIGINS`** set to those exact origins — never a wildcard, never `*.netlify.app`
- [ ] **`TRUSTED_PROXIES`** set to the private CIDR — without it rate limiting collapses to one shared
      key and every audit entry is attributed to the load balancer
- [ ] **Object storage** with separate private and public credentials, neither able to read the other's
      bucket
- [ ] **HSTS only after certificates are confirmed** — it cannot be undone from the server

---

## Done

- [x] Push both repositories to `main` — 18 August 2026

---

## 🟣 Added by TAB 12 — cutover

- [ ] **Rehearse a rollback in staging and time it** — *the cheapest outstanding item*
      The plan is written ([`docs/integration/rollback.md`](docs/integration/rollback.md)); the
      five-minute figure is an estimate from the hosting model, not a measurement. Needs a staging
      site with two deploys and about fifteen minutes.

- [ ] **Stand up cutover telemetry before any flip** — error rate, API failure rate by status code,
      page-load timing, on a dashboard somebody is watching.
      → A cutover with no telemetry is a cutover whose failure is reported by a caseworker.

- [ ] **Do not deploy production until L-22 and L-23 are closed**
      The configuration is now correct — `dataSource: 'http'` — and the console is not ready:
      45 adapter reads bypass the mappers, and 24 of 43 guarded routes ask for permissions the API
      never sends, including the dashboard. Before TAB 12 this was hidden behind mock data.
