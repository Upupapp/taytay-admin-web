# Beneficiary registry

The longitudinal view: everything this office has done for one person, across
every programme and every year.

## The one thing to understand first

**A beneficiary is not a record. It is a standing a resident holds.**

There is no `Beneficiary` entity, no `BeneficiaryId`, and no beneficiary table.
The registry is a *projection over the resident registry*, keyed on
`ResidentId` throughout (`DL-71`). `npm run check:beneficiary` fails the build if
a beneficiary identifier appears.

That is what makes the acceptance criterion — *one person retains one canonical
resident identity across multiple programmes* — true by construction rather than
by discipline. There is physically no second record for a person to drift into.

The four roles the master command names are **derived, not stored**:

| Role | Derived from |
| --- | --- |
| Resident (`constituent`) | Being on the registry. Everybody has it. |
| Applicant | A request that is still live — the office owes an answer. |
| Recipient (`beneficiary`) | A payout that was *released* or *claimed*. |
| Programme member (`enrollee`) | A standing (non-exited) enrollment. |

They are **not exclusive**. A senior may be on the pension list, have received a
burial grant last year and have a medical request open this morning — all three
at once. A model that forced a choice would lose the other two.

`deriveStanding` returns the counts it used, and the detail screen shows them, so
a badge saying "Recipient" is a fact a caseworker can check rather than a claim.

## Files

| Where | What |
| --- | --- |
| `domain/beneficiaries/beneficiary-standing.ts` | The roles, derived from records |
| `domain/beneficiaries/assistance-timeline.ts` | Four record types merged into one sequence |
| `domain/beneficiaries/program-enrollment.ts` | Standing membership, and how it ends |
| `domain/beneficiaries/duplicate-review.ts` | Comparison signals and the recorded finding |
| `domain/beneficiaries/beneficiary.ts` | List and detail shapes, filtering |
| `data/mock/mock-duplicate-matcher.ts` | Compares values, emits none |
| `data/mock/mock-assistance-history.ts` | The one history assembly, shared with the resident registry |
| `features/beneficiaries/` | List, detail and duplicate-review screens |
| `shared/beneficiaries/` | The history timeline and the comparison panel |

## The timeline

`buildAssistanceTimeline` merges requests, payouts, referrals and enrollments
into one ordered sequence, newest first. Two rules hold it together:

- **Every entry names the record it came from.** `sourceKind`, `sourceId` and
  `reference` are required, so any row on screen can be opened and checked.
- **Nothing is invented.** No derived milestones, no "expected next step", no
  filled-in gaps. The timeline reports; it does not narrate.

Two things are deliberately left out:

- **An unfiled draft.** It has no `submittedAt`, and dating it to now would
  assert something that did not happen. It stays on the drafts section of the
  requests screen (`DL-63`).
- **A scheduled payout.** A plan is not a receipt. It appears once released.

Four status vocabularies meet here and **stay four**: each entry carries a
discriminated `TimelineEntryStatus` and is rendered with the catalog that
already defines its wording and tone. Adding a fifth source type is a compile
error in the timeline component rather than a silently unlabelled row.

## Duplicate review

Two rules, both from the acceptance criteria.

### 1. Compare without disclosing (`DL-73`)

A duplicate queue is structurally a machine for showing one person's details to
somebody who came to look at another person's record. So the comparison reports
**agreement, not values**: "both records carry the same birth date", never the
date.

`MatchSignal` carries an attribute, an outcome and the rule that was applied.
The matcher compares values and emits none of them. The panel that renders the
comparison *cannot* leak a birth date because it is never handed one.

`not-comparable` is distinct from `differs`, and the distinction is load-bearing:
one record simply not carrying a mobile number is not evidence that two people
are different, and treating absence as disagreement hides real duplicates behind
incomplete profiles.

The one disclosure the queue makes by default is a masked name on both sides
(`Mercado, A.`) — on the reasoning already settled for `formatProtectedName`: a
reviewer who can see nothing can review nothing.

### 2. Never merge (`DL-74`)

There is no destructive merge, and there must not be. Resolving a pair records a
**finding**:

- `same-person` names the record the office keeps using and supersedes the
  other. **Both records survive**, and so does every request, payout, case and
  enrollment attached to either. The superseded record stops appearing as its
  own entry in the list; it stays readable by id.
- `distinct-people` matters just as much. Without it the same pair resurfaces
  forever, and a reviewer who has already answered is asked again until they
  answer wrong.

Every finding carries a required reason and the reviewer's identity. The preview
describes what would be **carried across**, never what would be deleted, because
nothing is.

Three resemblance bands order the queue and **decide nothing** — the same
doctrine as vulnerability factors (`DL-42`), the intake advisory (`DL-60`) and
eligibility guidance (`DL-66`). There is no numeric score and no threshold above
which anything happens on its own.

## Permissions

| Permission | Held by |
| --- | --- |
| `beneficiary.view` | Intake, social workers, MSWDO head, auditor |
| `beneficiary.review-duplicates` | Social workers, MSWDO head, sysadmin |
| `beneficiary.export` | MSWDO head, sysadmin |

Two deliberate absences:

- **Intake reads but does not adjudicate.** The counter that created the second
  record is not the one that rules on whether it is a duplicate.
- **The auditor reads but does not adjudicate.** Oversight that could alter the
  identities it is checking is not oversight.

A caller without `beneficiary.review-duplicates` receives **no candidates at
all** — withheld in the data layer, not hidden by a template.

`barangay-link` holds none of these. A barangay encoder keeps the registry
current and files requests; the whole assistance history of their neighbours is
not theirs to read, and proximity is a reason to be stricter.

## Known gaps

- **Enrollment is read-only in the UI.** The seed carries the states — standing,
  suspended, exited, and a return that names the enrollment it resumes — and the
  domain validates them, but there is no screen yet for enrolling somebody or
  recording an exit. When it is built, the exit takes a reason and a note, like
  every other judgement here.
- **A finding cannot yet be corrected.** Answering the same pair with the
  opposite verdict is refused rather than silently applied, because a correction
  is a new act with its own reason and there is no screen for it. The refusal is
  deliberate; the missing screen is the gap.
- **`beneficiary.export` has no export yet.** The permission exists so the
  reporting TAB has something to hang the privacy warning on.
