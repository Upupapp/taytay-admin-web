# TAB 08 step 2 — the two release state machines, mapped

*"Map the state machines: console statuses against `ReleaseStatus` (ready, released, completed,
failed, deferred, cancelled). Every transition, every terminal state, every required reason. A
released record cannot be rewound; confirm the console offers no control that implies otherwise."*

## They split on different axes, and that is the finding

The API splits on **whether an attempt was made**. The console splits on **whose failing it was**.

| | API | console |
| --- | --- | --- |
| postponed before any attempt | `deferred` — *"Postponed. Still intended."* | `deferred` — *"Attended but not released — the reason is recorded against the office."* |
| attempted, did not happen | `failed` — *"the beneficiary did not come, the transfer bounced"* | `unclaimed` — *"Not collected within the payout window."* |

Neither is wrong. They answer different questions, which is why a naive mapping of
`unclaimed → deferred` would be a real harm: `DL-94` exists because recording a family's
non-attendance as a deferral **writes the office's failing onto the household's record**, and every
`DeferralReason` the console defines is the office's own — funds not arrived, missing signature,
voucher error.

**The API's `failed` requires a reason.** That is what carries the distinction the console encodes
in a state name, and it is why no seventh state was added to a published enum that four clients
read. Vocabulary is not meaning: the reason field already holds it.

## The mapping

| console | API | notes |
| --- | --- | --- |
| `for-release` | `ready` | |
| `scheduled` | `ready` | The API models the payout date as a **column**, not a state. `scheduled_for` carries it. |
| `released` | `released` | Money has moved on both sides. |
| `claimed` | `completed` | Acknowledged by the beneficiary. |
| `unclaimed` | `failed`, **reached from `ready`** | Never from `released` — see below. The reason must name non-attendance, never an office failing. |
| `deferred` | `deferred` | Reason required on both sides. |
| `needs-correction` | `deferred` | Nothing was attempted, and it is still intended once the voucher is fixed. |
| `completed` | `completed` | The API cannot distinguish *acknowledged* from *closed out*; the console can. Lossy, and harmless. |
| `voided` | `cancelled` | *"Cancelled before release. Nothing was handed over."* |

Two console states map onto `ready` and two onto `completed`. The console is finer-grained, which
costs nothing: a finer client state always collapses into a coarser server one, and never the
reverse.

## The defect this exercise found

The command asks for a confirmation. The confirmation failed.

```
released → unclaimed → scheduled
```

`released` is defined by the console's own catalogue as *"Funds or goods issued by the disbursing
officer"*. `unclaimed` is *"Not collected"*. A record could therefore be issued, then marked
not-collected, then returned to a payout list — **the shape in which a family is paid twice**, and
it was reachable from the release detail screen.

Fixed: `released` now leads only to `claimed`. Nothing legitimate was lost, because `unclaimed` was
already reachable from `scheduled`, which is where a payout nobody collected actually sits. Three
tests hold it (`DL-133`), including one asserting that no state where money has moved can reach any
state before it moved.

The API had the same shape available — `Released → Failed → Ready` — and there it is **correct**,
because the API's `failed` covers a transfer that bounced: sent, not landed, retry. The console has
no such state, so the same edge meant something different and something wrong.

## Terminal states

| | API | console |
| --- | --- | --- |
| terminal | `completed`, `cancelled` | `completed`, `voided` |

They agree exactly, once `voided ↔ cancelled` is applied.

## Reasons required

| | API | console |
| --- | --- | --- |
| requires a reason | `failed`, `deferred`, `cancelled` | `deferred`, `needs-correction`, `voided` |

The API requires one on `failed`; the console requires one on `needs-correction`, which maps to
`deferred`. So every console state that demands a reason maps to an API state that also demands
one, and the API additionally demands one where the console records `unclaimed` — which the console
must supply rather than leaving blank. That is a constraint on the adapter, recorded here because
it is invisible from either side alone.
