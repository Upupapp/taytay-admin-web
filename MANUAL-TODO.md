# MASTER TODO — manual tasks only

**Everything on this list needs a person. Nothing here can be coded.**

Anything that *can* be automated is not on this list — it has been done, or it is in the backlog
as engineering work. Detail and reasoning for each item live in
[`docs/integration/manual-actions.md`](docs/integration/manual-actions.md); this page is the list.

Last updated: 18 August 2026, after TAB 05.

---

## 🔴 Blocking right now

- [ ] **Add `workflow` scope to the GitHub token**
      Two CI files are written and tested and cannot be pushed without it. Classic token → tick
      `workflow`. Fine-grained → *Workflows: Read and write*.
      → Unblocks: the console's first CI pipeline, and the standing secret-scan gate in both repos.

- [ ] **Install Docker Desktop or OrbStack**
      Everything proven so far ran on SQLite. Nothing about concurrency, row locking or
      `lockForUpdate` is proven, and `migrate` has never run against real PostgreSQL.
      → Unblocks: TAB 05 step 10 properly, all of TAB 06, TABs 08–11, release-gate blocker 4.

---

## 🟠 Decisions — an hour each, and code is waiting on them

- [ ] **Self-release: block or warn?** (L-19) — *the sharpest one*
      The API refuses at the person level; the console warns and proceeds on purpose. Both are
      defensible, they cannot both be executed, and today the console's warning is a lie.
      → Take to the same session as the case model.

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

- [ ] **`barangay_id` is an auto-increment key** (L-15) — `conventions.md` §6 forbids it outright
- [ ] **No field for why a household applied** (L-16) — `reasonForRequest` has no source at all
- [ ] **No amount on an assistance request** (L-17) — money lives only on releases
- [ ] **`available_transitions` advertises `released`, which the endpoint refuses** (L-20)

---

## 🔵 Repository administration

- [ ] **Decide repository visibility** — both are public today; recommendation is private for both
- [ ] **Protect `main`** on both repos — no force-push, no deletion, required checks, one reviewer
      → Do after the `workflow` scope, so the checks exist to require.

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
