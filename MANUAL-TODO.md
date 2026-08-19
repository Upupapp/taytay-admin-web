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

---

## 🟤 Added by TAB 13 — hardening

- [ ] **Fetch the deployed headers and compare them to the table** — *the acceptance criterion*
      Everything TAB 13 did is about files. *"A policy in a file is not a policy in production."*
      Until somebody `curl -I`s the deployed console and API, the CSP is unverified.

- [ ] **Enable HSTS — but only after the certificate chain is confirmed**
      Deliberately absent, and `check:headers` fails the build if it appears. It cannot be undone
      from the server: a wrong `max-age` locks every browser out of the console for its duration.
      → Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` once custom domains
      and certificates are live, and remove the guard in the same change.

- [ ] **Set `CORS_ALLOWED_ORIGINS` and `TRUSTED_PROXIES`** on the API
      Exact origins, never a wildcard and never a `*.netlify.app` pattern — anybody can create a
      site on that domain. `TRUSTED_PROXIES` to the private CIDR, or rate limiting collapses to one
      shared key and every audit entry is attributed to the load balancer.

---

## ⚫ TAB 14 — RA 10173: three release blockers, none closeable by engineering

**These have the longest lead time in the whole programme. Start them now, not after the
integration commands.** Everything engineering owes here is done; none of it is usable until these
are.

- [ ] **Appoint a Data Protection Officer and assign the role** — *blocker 1*
      `audit.view` sits only with `data_protection_officer` and nobody holds it. **The trail is
      being written and cannot be read by anybody**, which also means the breach procedure has no
      decision-maker and no signatory.
      → Deliberately not the MSWDO head: that would be the auditee reading their own audit.

- [ ] **Approve the retention schedule** — *blocker 2*
      The DPO reviews the inventory, approves or corrects the periods and bases, and records who
      approved them and when. Until then `mayPurge()` refuses everything — the safe direction, but
      not a steady state, because indefinite accumulation is itself an exposure.
      → Two things unblock together: disposal, and the escape hatch in `AuditEntry` that lets an
      approved purge remove old trail entries.

- [ ] **Record the lawful basis for every processing purpose**, and confirm the consent surfaces
      residents actually see match what was recorded.

- [ ] **Decide `document.share`'s holder** — held by nobody; the outward path is built and refused.

- [ ] **Place the six parked protection permissions** — currently on the MSWDO head because no
      protection-officer role exists. Reading a survivor's safety plan is not an administrative
      convenience.

- [ ] **Rehearse the breach procedure on paper** — about an hour, with the MSWDO head, the DPO and
      whoever holds the deployment account.
      → Suggested scenario in [`breach-procedure.md`](../taytay-backend/docs/contracts/breach-procedure.md):
      a barangay-scoped account found to have read forty records outside its barangay over two
      weeks. It exercises detection from the trail, containment, assessment and the notifiability
      judgement — and it is the failure this system's scoping is most designed to prevent.

- [ ] **Find the NPC contact route and the current notification form** — needed before the
      rehearsal means anything.

- [ ] **Time a simulated data-subject access request** end to end. *"A right that takes three weeks
      of manual work is a right the office will not honour."*

---

## 🔶 TAB 15 — nothing is watching anything

- [ ] **Agree the SLOs with the MSWDO** — *"numbers the office agrees to, not numbers engineering
      finds comfortable."* Suggested starting points: list screens interactive within 2 s on the
      office's actual hardware and connection, a case workspace within 3 s, a write acknowledged
      within 1 s, API availability 99.5% during office hours. Then define the error budget and what
      happens when it is spent.

- [ ] **Poll the metrics endpoint, and alert** — queue depth, failed jobs, authentication
      anomalies, error rate by code, latency percentiles, certificate expiry, disk and database
      capacity. Each alert names an owner and a first action.
      → The endpoint exists and exposes all of it. Nothing polls it, which is the command's own
      line: *a metrics endpoint nobody polls is not monitoring, it is a file.*

- [ ] **Uptime checks from outside the network**, against the API health route and the console
      origin.

- [ ] **One dashboard the office can see** — are requests being processed, is money moving, are
      notifications arriving. Operational, not technical.

- [ ] **Load-test at municipal scale** — seed to Taytay's actual resident, household, case and
      document counts, not a demo dataset. *"A list endpoint that is fast over 200 records and
      quadratic over 40,000 is a launch-morning incident."*

- [ ] **Test degradation**: take Redis down, take the queue workers down, make object storage
      refuse, make the API slow. The console must say what is wrong and what the user can still do
      — never a spinner that never resolves.

---

## 🟩 TAB 16 — accessibility needs a person at a screen

Automated checks catch roughly a third of accessibility issues. Contrast is computed and passing;
these are the other two thirds.

- [ ] **Keyboard-only walkthrough of the six core journeys** — every control reachable, focus
      visible throughout, focus order matching reading order, Escape closing every overlay with
      focus restored.
- [ ] **Screen-reader walkthrough** with NVDA and one mobile reader — table semantics, form labels
      and error association, status chips announced by meaning rather than colour.
- [ ] **Zoom and real conditions** — 200% zoom at 320 CSS pixels wide, on an older monitor, in a
      bright office, on the office's actual browser.
- [ ] **The WCAG 2.2 additions** — focus not obscured, dragging alternatives, target size,
      consistent help, and no redundant re-entry across the four-section intake flow.
- [ ] **Review every user-facing string with the MSWDO** — status labels, errors, empty states,
      confirmations, refusals. The office has its own vocabulary and the software should use it.
- [ ] **Print the referral summary and the release manifest** — both leave the building on paper.
      Confirm the print view carries the same field discipline as the screen.

---

## 🟦 TAB 17 — the journeys need people and a staging API

- [ ] **User acceptance testing with the actual staff** — an intake officer, a social worker, the
      head, the disbursing officer, a barangay focal person and the auditor. Each on their own
      journey, on office hardware, **with the trainer silent**.
      → *"A workaround discovered during UAT becomes the procedure the office teaches forever."*
      Record what they get stuck on, and fix it rather than documenting it.

- [ ] **Run the six journeys against a seeded staging API, in CI, on every change**
      They currently run against a real database, router and permission set — not a mock, but not a
      deployed API either.

- [ ] **Journey 2's cross-client half** — a resident submits from the mobile app and it appears in
      the office queue. Needs both clients against one API.

- [ ] **Journey 3 is blocked on the case model** (ADR 0044). Building it now would fix a shape
      nobody has agreed.

- [ ] **Console failure paths** — API down mid-journey, token expiring mid-form, a slow network, an
      upload interrupted at 80%. Each must fail legibly and lose nothing the user typed.
