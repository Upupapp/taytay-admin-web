# The launch gate (TAB 19)

> *"Every line must be true, evidenced, and signed. A line that is nearly true is a NO-GO."*

This is the engineering assessment of each line against **measured evidence in the two
repositories**. It signs nothing: every line names a human signatory, and none of them is an
engineer's to give. Where a line is green here, that means the evidence exists for somebody to sign
against — not that it is signed.

**Overall: NO-GO**, and not marginally.

**Re-measured 2026-08-29.** The engineering half has moved a long way since the first assessment
and the verdict has not. Where a line's evidence changed, the change is stated rather than the line
quietly rewritten — a gate document that improves without saying what improved is one nobody can
audit.

---

## Summary

| Verdict | Lines |
| --- | --- |
| Evidence exists; awaiting signature | 4 |
| **NO-GO — engineering** | 3 |
| **NO-GO — needs people, appointments or infrastructure** | 8 |

---

## The lines

### 00 — Repositories remoted, `main` protected, visibility decided, restorable from a clean clone
**NO-GO.** Both repositories are remoted. Both are **public on GitHub**, and the recommendation to
make them private is an open owner decision — this is a system that processes indigent residents'
personal data, and every push publishes every commit. `main` is not protected; the owner
deliberately requires direct pushes with no review. Restorability from a clean clone is untested.

### 01 — Published error vocabulary correct; the gate that catches it watched failing
**Evidence exists.** The vocabulary was corrected in TAB 01 and `check:contract-drift` compares the
runtime list against the vendored union. It has been watched failing, against a planted regression.

### 02 — Authentication with MFA; no credential in web storage; sign-out revokes server-side
**Evidence exists** for the second and third. **MFA is unproven end to end** — there is no
deployment to prove it against.

### 03 — One permission vocabulary; server-issued; refusals proven by direct call for every module
**Evidence exists.** `check:permission-parity` compares both vocabularies; refusals are asserted by
direct API call. Six of those tests were found in TAB 17 to be passing for the wrong reason — they
granted a role that does not exist — and were fixed, with `grantRole` now refusing an unknown role.

### 04 — The case model decided, in an ADR, implemented identically on both sides
**NO-GO.** ADR 0044 is written and **not ratified**. It needs the MSWDO head, a social worker and an
intake officer in one room. Eleven `CaseRepository` methods have no endpoint, and TAB 17's journey 3
could not be built because building it would fix a shape nobody has agreed.

### 05/07 — Every screen serves real data; no port method is unresolved
**Still NO-GO, and no longer the largest finding in the programme.**

At the first assessment: **61** composed request paths that did not exist, including every money
write. Now **21**, of which **10 are the case surface blocked on ADR 0044** — so eleven remain that
anybody could fix.

Two further counters exist that did not before, because fixing the paths exposed what they were
hiding:

| Counter | Now | What it measures |
| --- | --- | --- |
| `check:routes` | 21 paths | a request that would not reach a real endpoint **at that verb** |
| `check:wire-adoption` | 13 writes | a body the endpoint could not read — `snake_case` against camelCase, and nested value objects the API wants flat |
| `check:port-adoption` | 13 methods | a port method **no screen calls** — a feature nobody can reach |

All three are ratchets: the number prints on every run and the build fails when it grows.

**The line is not "21 paths from green".** A path that resolves may still send a body the server
refuses, and a method that works may be reachable from no screen. The three numbers are three
different questions and a green answer to one says nothing about the others — which is why they are
counted apart.

### 08 — Money journey proven; idempotency and separation of duties server-side; concurrency on PostgreSQL
**Still NO-GO, on one count rather than two.**

Idempotency and separation of duties **are** enforced server-side and proven by test, and TAB 17's
journey 1 walks the money end to end through four people. At the first assessment the console could
reach none of it: every release write was among the 61.

Since then the money writes are wired, the payout session can be opened from a screen for the first
time, and `check:money` verifies independently that every money write carries a held idempotency
intent — a retry must carry the same key or the server treats it as a second, genuine session,
which on a payout is a second table expecting the same families.

**What still fails the line: concurrency is unproven on PostgreSQL.** There is none on this machine
and no container runtime. The row-locking test runs on SQLite, which is not evidence about
PostgreSQL — and the two staff at two tables pressing at the same instant is exactly the case
SQLite cannot reproduce.

### 09 — Documents append-only; no public object URL; every read audited
**Evidence exists; awaiting the DPO's signature.**

Append-only is structural, the private disk carries no public URL, and exactly one class may write
the public bucket.

**A document can now be uploaded, which was not true at the first assessment and was not visible
either.** `DocumentVersionDraft.file` held file *metadata* with no bytes, the endpoint reads a
multipart upload, `FileTransport` was injected by nothing but its own spec, and there was no
`<input type="file">` anywhere in the console. Every check passed throughout — including
`check:documents-transport`, correctly, because every rule it enforces is a prohibition and a
prohibition holds trivially where the feature is absent.

**A green check over an absent feature** is what `check:port-adoption` was built to make visible.

Requires the DPO's signature, and there is no DPO.

### 13 — CSP and companion headers verified on the deployed origins by inspection
**NO-GO.** The policy is correct and checked mechanically, including the `style-src` omission that
would have rendered the console unstyled. **"On the deployed origins by inspection" cannot be done
— nothing is deployed.**

### 14 — DPO appointed and reading the trail; retention approved and applied; access request answerable
**NO-GO. Release-gate blocker 1.** No DPO is appointed. No retention schedule exists — every period
is `null` and the screen says "No schedule recorded" rather than inventing one. This has the longest
lead time in the programme and the least engineering content, which is exactly why it is most likely
to be discovered late.

### 15 — SLOs agreed and met at realistic volume; alerts fire to a named owner
**NO-GO.** No production, no realistic volume, no alerting, no named owner.

### 16 — WCAG 2.2 AA on every screen against real data; strings signed off
**NO-GO.** Contrast is computed rather than eyeballed and status is carried in words. But *"against
real data"* is exactly what cannot be done — the console has never rendered a real resident — and
the strings need the MSWDO head, not an engineer.

### 17 — Six journeys green in CI; adversarial tests refused; six role sign-offs
**NO-GO, unchanged.** Two of six journeys automated, against a real database and router but not a deployed
API. Adversarial refusals are server-side. **No CI** — there is no Actions credit — and **no role
sign-offs**, which need six members of staff on office hardware with the trainer silent.

### 18 — Pipelines in place; backup restored with observed figures; rollback rehearsed and timed
**NO-GO. Release-gate blocker 3.** No pipeline, no backup, no restore, no rollback rehearsal.
*"A backup that has never been restored is a hypothesis."*

---

## What this assessment is worth

**Five lines now have evidence, up from four.** Ten do not, and **eight of those cannot be closed by
engineering at all** — they need an appointment, a decision, a room with three people in it, or a
server.

The three that *are* engineering are 05/07, 08 and 17, and they still share one cause: **the console
has never run against the API.** Everything green on this side is green against a mock, and every
number below was found by comparing two repositories rather than by anything actually talking.

### What moved, and what that says about the checks

| | First assessment | Now |
| --- | --- | --- |
| Composed paths that 404 | 61 | 21 (10 blocked on ADR 0044) |
| Write bodies the server could not read | uncounted | 13 |
| Port methods no screen calls | uncounted | 13 |
| Console tests | 91 files | 93 files, 1,614 tests |
| Backend tests | 1,067 | 1,111, 8,023 assertions |

The two "uncounted" rows are the finding, not a footnote. **Fixing the paths exposed two further
classes of defect that every gate in the repository had been silent about** — a request that
reaches a real endpoint with a body it cannot read, and a feature implemented on both adapters that
no screen can reach. Neither was a new regression; both had been true throughout, under checks that
passed.

That is the pattern worth carrying into whatever is assessed next: **a green check over an absent or
unreachable feature reports a guarantee nobody holds**, and the only defence is a counter that says
what it does *not* cover.

## The order this unblocks in

1. **ADR 0044 ratification** (line 04) — a meeting. Ten of the twenty-one remaining paths are the
   case surface, and TAB 05's remainder cannot be finished without it.
2. **A staging deployment** — which is what turns lines 02, 13, 16 and 17 from unprovable into
   testable, and is the only thing that would make "green against a mock" stop being the caveat on
   every engineering line.
3. **The DPO appointment** (line 14) — start it now; it gates the launch and nothing engineering
   does shortens it.
4. **A PostgreSQL instance** — the smallest item on this list and the one blocking two separate
   proofs: migration rollback (line 18) and money concurrency (line 08).
5. **The remaining eleven paths** (line 05/07) — against `port-mapping.md`, which already records
   the right route for most, and which is itself due a refresh: it is stale in both directions.
