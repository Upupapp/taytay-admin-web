# Launch runbook and abort criteria (TAB 19)

**This runbook cannot be executed yet.** The gate is NO-GO on eleven of fifteen lines. It is
written now because *"agreed in advance is worth more than any judgement made at 9 a.m. with a
queue forming"*, and because the abort criteria are worthless if they are written by somebody
watching it go wrong.

Timings are **blank on purpose**. They come from the rollback rehearsal (TAB 18), which has not
happened. A runbook with invented timings is one the office plans a morning around.

---

## Abort criteria — agreed before the day, not on it

Roll back if **any** of these is true. No discussion on the day; the list is the discussion.

| # | Condition | Why it is absolute |
| --- | --- | --- |
| 1 | Any release or acknowledgement fails, or records the wrong amount | A family is paid twice or not at all. Nothing else on this list outranks money. |
| 2 | A caseworker sees a record they should not — any sensitive sector, any other barangay | An unlawful disclosure cannot be rolled back. The rollback limits it; it does not undo it. |
| 3 | Any resident data is lost or unaccounted for after a write | An office that cannot trust the record stops using it, permanently. |
| 4 | Sign-in fails for any role for more than 15 minutes | Not a degradation — the office cannot work at all. |
| 5 | The audit trail stops recording | Every act from that moment is unattributable, and cannot be reconstructed later. |
| 6 | Staff adopt a workaround to complete a journey | *"A workaround discovered during UAT becomes the procedure the office teaches forever."* The same is true on day one. |

**Who may call the abort:** the MSWDO head, or the engineer on duty, **acting alone**. Either, not
both — requiring agreement means the abort waits for whoever is in a meeting.

Nobody needs permission to call it, and nobody is asked to justify calling it afterwards. An abort
that costs somebody an argument is one that gets delayed past the point it was cheap.

---

## Not on a Friday. Not on a payout day. Not during a disaster response.

A Friday launch means a weekend of an office working around something with nobody to call. A payout
day puts the newest part of the system in front of the most consequential act, with families
waiting. A disaster response is when the office is least able to absorb anything unfamiliar and
most needed by residents.

---

## The pilot

**One boundary, running alongside the existing process — not replacing it.** The recommendation is
**one barangay**, because it bounds the residents affected rather than the staff involved, and every
role gets exercised. Bounding by programme would exercise one journey; bounding by week would mean
every resident that week is in the pilot with no way back.

*"A pilot that cannot be abandoned is not a pilot."* The paper process runs in parallel for the
whole pilot. That is duplicated effort and it is the price of being able to stop.

**Watch for a full cycle including at least one payout.** A pilot that ends before money moves has
not tested the part that matters.

**Widening is a decision somebody takes**, with a hold point between each boundary. Never let the
pilot become production by inertia — put a date on the widening decision before the pilot starts,
so that not deciding is visible as not deciding.

**Retire the paper process only after a full cycle with no workaround**, confirmed by the staff
rather than by engineering.

---

## Hypercare

Two weeks. Daily check-ins with the office. An engineer reachable. A visible list of what is being
fixed, that the office can see without asking.

*"Do not stand down hypercare because the first week was quiet."* Week one is when people are
careful and still doing things the old way in parallel. Week two is when they start trusting it.

---

## Handover

A system nobody owns is a system that decays quietly. Each of these needs a **named person**, not a
team: the runbooks, the alert ownership, the escalation path, the backup verification schedule, and
the deferred backlog below.

---

## What was deferred, with owners — in the backlog, not in a document

| Item | From | Blocked on |
| --- | --- | --- |
| The 61 unwired composed paths | 05 | Nothing. This is the P0 |
| The case surface — 11 port methods | 04 | ADR 0044 ratification |
| Concurrency proven on PostgreSQL | 08 | A PostgreSQL instance |
| The capacity race under real contention | 10 | A first event with real registrants |
| The second API node | 18 | An owner decision, or a documented single-node trade-off |
| Image derivation off the request path | 09 | Observed load |
| Migration rollback on real PostgreSQL | 18 | A PostgreSQL instance |
| The restore exercise | 18 | A backup, and an environment to restore into |
| Six journeys in CI | 17 | Actions credit, and a staging API |
| Console failure paths | 17 | A browser harness |

*"With dates, in the backlog, not in a document."* The dates are the owner's to set; this records
what must have one.
