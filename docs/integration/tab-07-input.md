# TAB 07 input — what the adapters could not map, and why

Handed over in writing, as TAB 05 requires: *"rows marked no counterpart become TAB 07's scope; do
not invent an endpoint here."*

Two things are handed over. The **36 no-counterpart rows** are in
[`port-mapping.md`](./port-mapping.md). This document is the second thing, and it was not
predicted by the sweep: **the endpoints that do exist frequently cannot fill the model the console
asks for.** A row marked *maps cleanly* in the mapping means the route matches; it does not mean
the payload does.

## The measurement

| Model | Published wire fields | Domain fields | Mappable today |
| --- | --- | --- | --- |
| `Resident` | 19 | 13 | 9 — L-12 |
| `Household` | 21 | 8 | 6 — L-14 |
| `AssistanceProgram` | 18 | 18 | **cannot be constructed** |
| `AssistanceRequest` | 21 (detail), 11 (list) | 16 | detail only — L-13 |
| `Referral` | 18 | 21 | not yet attempted |
| `FieldVisit` | 11 | 18 | not yet attempted |
| `Release` | 22 | 21 | not yet attempted — vocabulary diverges (TAB 04 step 4) |

**The counts are comparable, so this is not a size problem.** It is a *composition* problem: the
console's models carry structured sub-objects the wire either flattens or does not send at all —
`eligibility`, `responsibility`, `disclosure`, `assessment`, `checklist`, `sectors`.

## The single root cause

The console was built against a mock **it also authored**. Its domain models are therefore shaped
by what the screens wanted, and the API's projections by what the modules own. Nobody was wrong;
the two were never compared, and TAB 05 is the first time anything has tried to satisfy one from
the other.

That is why these gaps cluster in the same place every time: the fields the console composes for a
screen, and the fields a module can answer for on its own.

## What that costs, per case

### L-12 — `Resident`: four fields behind a wider permission

`householdId`, `sectors`, `philsysLastFour` and `monthlyIncome` are absent from the payload. They
sit behind `resident.view-sensitive` or on separate routes. Mapped to absent, not invented.

**TAB 07:** either a resident projection that includes them for a caller who holds the tier, or an
accepted rule that `getProfile` assembles four calls. The second is honest and slower; the first
is what `ResidentProfile` was designed for.

### L-13 — `AssistanceRequest`: no summary type in the domain

`AssistanceRequestRepository.list` returns `Page<AssistanceRequest>` — the full model — against an
11-field list projection. Eight fields would be blanked per row on the console's busiest screen.

**TAB 07 (or a domain change first):** `HouseholdRepository` already models this correctly with
`HouseholdSummary` / `HouseholdDetail`. The assistance port should do the same. This is the one
item on this list that is the **console's** to fix, not the backend's.

### L-14 — `Household`: the band cannot say "we did not ask"

`HouseholdSummary.band` is `'none' | 'watch' | 'elevated' | 'high'`. The list payload carries no
snapshot, so a mapper would have to write `'none'` — which reads on screen as *"no vulnerability
factors present"*, a positive claim about a household made on data nobody sent.

`toHouseholdSummary` **was not written**. Three ways out, all decisions: the band gains an
unassessed member, the list stops rendering a band, or the endpoint carries the snapshot.

### `AssistanceProgram` — the responsibility cannot be synthesised

This is the sharpest one and the reason programmes are listed as *cannot be constructed*.

`ProgramResponsibility` requires `administeredBy`, `fundsHeldBy`, `lguRole`, a `statement`
(*"what the office may honestly tell an applicant, in one sentence"*) and `sources` (citations).
The wire carries `owner_office`, `decided_by`, `authority` and `funding_source_label` — no
statement, and no sources.

Synthesising one would produce a record the domain's own validator rejects: `claim-without-source`
is a defined problem code, and so is **`national-programme-claimed-as-owned`**. CLAUDE.md is
explicit that AICS is a DSWD programme with DSWD-disbursed funds and that recording it otherwise
*"was a defect, not a wording preference"*.

So a guessed mapping here does not produce a slightly-wrong field. It produces the console telling
an applicant the municipality runs a programme it does not run.

**TAB 07:** the responsibility is catalog data (`DL-65`, `DL-66`). Either the programme payload
carries it, or the console keeps its own catalog and takes only status and dates from the API.
That is a genuine architectural choice and belongs in front of the office.

## What this does not change

The adapters that need none of this — search, saved views, audit rows, notifications, the session
— map cleanly and are unaffected. So do the write paths, which send rather than receive.

## Recommended order for TAB 07

1. **Decide the programme catalog question.** It blocks the intake screens and it is the only one
   with a legal-accuracy consequence.
2. **Add the assistance summary type** (console-side, small, unblocks the busiest screen).
3. **Resolve the household band** — cheapest of the three, and it currently blocks a list.
4. **Then the resident projection**, which is a convenience question rather than a correctness one.
5. Everything in `port-mapping.md` marked *no counterpart*, unchanged.

## The honest status of TAB 05

Steps 1, 3, 5, 8 and 9 are complete. Steps 2, 4, 6 and 7 are **partially complete and correctly
blocked**: two resources are mapped, four are analysed, and the rest wait on the decisions above
rather than on typing. Step 10 — adapter tests against responses recorded from staging — cannot
begin at all on this machine.

Writing the remaining mappers before these decisions would mean inventing the missing fields, and
every instance above is a case where the invented value is a claim about a household, a family or
a programme that nobody made.
