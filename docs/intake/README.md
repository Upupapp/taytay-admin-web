# Assistance Intake & Assessment (TAB 11)

Getting a request onto the record quickly, and getting it right.

Decisions: `DL-60` (the duplicate check is evidence, never a decision), `DL-61`
(the online channel is modelled and withheld), `DL-62` (four steps, one route),
`DL-63` (a draft is not a request), `DL-64` (case closure remains terminal, with
its sources) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## The three acceptance guarantees, and how each is evidenced

### 1. A common intake without excessive page changes

The flow is **one route with four sections** (`DL-62`): person → request →
checks → review. Moving between them is a query-parameter change, not a
navigation, so nothing is refetched and nothing typed is lost. The step is still
in the URL, so a refresh, a browser Back and a link to a colleague all land in
the same place.

The stepper marks any step that still has something outstanding, because with no
page change to interrupt them an encoder can otherwise reach the end without
noticing a gap.

_Evidence:_ `requests.spec.ts` asserts four steps on one page, that the current
step is marked with `aria-current="step"` rather than only shaded, that an
unknown step degrades to the first, and that the review step lists what is
outstanding per step.

### 2. Previous context visible without retyping

The applicant's context panel sits **outside** the step switch. It is fetched
once when the person is chosen — through `ResidentRepository.getProfile`, the
aggregate TAB 07 already built for exactly this question — and stays on screen
for every later step: the person, the address, everyone else at that address,
what the office has already handed over, and how many requests are open.

Nothing on the screen copies a household field into the request. The request
stores the applicant, the programme, the reason and the amount; everything else
is read from the registry when it is needed.

_Evidence:_ `requests.spec.ts` asserts the context panel is present on the
checks step as well as the first. `mock-intake.spec.ts` asserts the advisory
reads the household's history, not just the applicant's.

### 3. Nobody is approved or denied by a frontend score

This is the load-bearing one, and it is a property of the code's shape rather
than a promise about it (`DL-60`).

`IntakeAdvisory` has **no score, no total, no rating, no `eligible`, no
`recommendation`**. Each signal states the **rule** it applied, its **finding**,
and the **records it read** — all three rendered, because evidence held in a
model and never shown is indistinguishable from a verdict.

There are two tones and neither blocks:

| Tone      | What it does                                                              |
| --------- | ------------------------------------------------------------------------- |
| `note`    | Says something worth knowing. Changes nothing else.                       |
| `caution` | Asks the encoder to write a sentence before filing. The sentence is kept. |

A third tone that stopped a submission would be an automatic denial wearing a
different word. The same rule governs the assessment workspace: the readiness
list says what the office would normally have and gates nothing, because a home
visit is impossible for a household that has moved and a document can legitimately
be waived.

`tools/check-intake.mjs`, run in `npm run verify`, fails the build on a
decision-shaped field, a blocking tone, an exported scoring or auto-approving
function, an auto-decision method on the port, a signal that stops stating its
rule or records, a signal code missing from the copy, a panel that stops
rendering the evidence, or any request template binding `[disabled]` to the
advisory or the readiness list. Validated against **seven planted regressions**;
it caught all seven.

_Evidence:_ `intake.spec.ts` asserts every signal carries a rule, a finding and
its records, that only two tones exist, and that acknowledging a caution lets the
request file rather than blocking it. `mock-intake.spec.ts` asserts the
serialised advisory contains no decision-shaped key, and that a request with a
caution files once a reason is given.

---

## What the check looks for

| Signal                            | Tone    | Rule                                                                  |
| --------------------------------- | ------- | --------------------------------------------------------------------- |
| `open-request-same-programme`     | caution | An unfinished request already exists under this programme             |
| `open-request-other-programme`    | note    | Unfinished requests exist elsewhere in the office                     |
| `granted-same-programme-recently` | caution | Already granted under this programme inside the review window         |
| `assistance-within-lookback`      | note    | Assistance handed over to this person recently, with the total        |
| `household-assisted-recently`     | caution | Somebody else at this address was assisted recently                   |
| `open-case`                       | note    | The office already has an open case; the request may belong inside it |

The household signal is the one an office actually gets caught by: two members
of one household applying separately for the same event.

**The two review windows** — `ASSISTANCE_LOOKBACK_MONTHS` (12) and
`SAME_PROGRAMME_WINDOW_DAYS` (90) — decide how much history is _shown_ and
nothing else. They are office review conventions, not sourced statistics, and
they are deliberately not given the poverty threshold's citation treatment
because no outcome depends on them. **Confirm both against the office's own AICS
guidelines before the first pilot** (`DL-60`).

---

## Drafts

A saved intake is a `draft` request with **no control number** (`DL-63`). It is
listed apart from the request table, because nothing has been filed, nobody is
waiting on an answer, and counting drafts as requests would inflate every figure
the office reports. The control number is issued at filing — the moment the
office takes responsibility.

`saveDraft(draft, id)` is idempotent on the id the caller holds; `submitIntake`
is idempotent on the request. Two taps on a slow connection produce one record.

---

## Channels

`walk-in`, `barangay-referral`, `encoded` are offered. `online` is **modelled and
withheld** (`DL-61`): a channel staff can pick by hand is an encoded request
mislabelled. The screen says the option is unavailable and why. When the resident
app posts its first request, one value moves between two arrays and nothing else
changes.

---

## Structure

| Piece                                   | File                                                                 |
| --------------------------------------- | -------------------------------------------------------------------- |
| The advisory, and what it refuses to be | `domain/intake/intake-advisory.ts`                                   |
| Draft, steps, and what is missing       | `domain/intake/intake-draft.ts`                                      |
| Case study and readiness                | `domain/intake/assessment.ts`                                        |
| Adapter                                 | `data/mock/mock-assistance-request.repository.ts`                    |
| Intake flow                             | `features/requests/intake-page.*`                                    |
| Assessment workspace                    | `features/requests/assessment-page.*`                                |
| List and drafts                         | `features/requests/request-list-page.*`                              |
| Advisory panel                          | `shared/intake/advisory-panel.ts`                                    |
| Copy (`DL-23`)                          | `shared/intake/intake.copy.ts`, `features/requests/requests.copy.ts` |
| Structural check                        | `tools/check-intake.mjs`                                             |

The assessment workspace moves a request with `StatusTransition`, the shared
control TAB 10 built generic. Reason capture, permission intersection and the
refusal to move without words are inherited rather than re-implemented — which
is the return on having built it that way.

No new permission was added. Intake runs on `request.create`, document review on
`request.intake`, the case study on `request.assess`, and the advisory on
`request.create` — a sharper disclosure than the request list, so it is held
behind the narrower grant.

---

## Known gaps

- **A filed request does not yet appear on its case's timeline.** `MockCaseRepository`
  reads the frozen seed rather than the live request store; linking a request to
  a case belongs to the case/assistance seam and was not opened here.
- **`AssistanceRequestRepository.changeStatus` still allows a `null` reason.** The
  assessment workspace always supplies one through `StatusTransition`, but the
  port permits otherwise and certified tests rely on it. Tightening it to match
  `CaseRepository` is a small, separate change.
- **The intake channel and `referredBy` are captured but not stored** on the
  request: `AssistanceRequest` has no field for either yet. Adding them is
  additive and belongs with the reporting TAB that needs the split.
- **Drafts are tab-lifetime**, like the rest of the mock.
- **No autosave.** Saving is explicit, because an autosave against a mock is
  theatre and against a real API is a decision about write volume.
