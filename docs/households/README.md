# Household Registry & Vulnerability Snapshot (TAB 08)

The family as a unit of service delivery, and an indicator that can be argued
with.

Decisions: `DL-42` (advisory, never automated), `DL-43` (composition is
transactional), `DL-44` (the band is disclosed, not recomputed), `DL-45` (the
threshold is a placeholder) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## The three acceptance guarantees, and how each is evidenced

### 1. No automated indicator determines eligibility

This is enforced, not asserted (`DL-42`). Four things hold it up:

- **Nothing returns a decision.** `HouseholdRepository` has no method that
  answers eligibility, entitlement or an amount, and the snapshot types carry no
  `eligible`, `approved`, `grantAmount`, `score` or `points` field.
- **The two modules cannot see each other.** `domain/programs/` owns eligibility
  rules and never imports the vulnerability module; the vulnerability module
  never learns what a programme grants.
- **There is no score.** A coarse four-value band exists to order a list, from a
  rule a person can restate: two primary indicators is High, one is Elevated,
  two contributing alone is Worth watching. A number invites arithmetic, and
  arithmetic on a family's circumstances is how an advisory indicator becomes a
  decision nobody signed.
- **The indigency classification stays a human act.** It is recorded on the
  household by a person and is never derived from the snapshot.

_Evidence:_ `npm run check:vulnerability` fails the build on any of the above.
The checker was validated against five deliberately planted regressions — a
`score` field, an eligibility module importing the snapshot, a factor code
dropped from each of the two copy maps, and the advisory sentence removed from
the component — before it was trusted. `households.spec.ts` asserts the advisory
sentence is on the list page and on the snapshot itself.

### 2. Every factor is inspectable and correctable, with an audit trace

Each factor carries the rule it applied, the arithmetic it applied it to
(`FactorBasis`: what was observed, out of what, against which threshold, reading
which residents), and its state stated explicitly as **applies / does not apply
/ not known / not disclosed to your role**. Nothing is omitted when it does not
fire: a factor that silently disappears is one nobody notices is missing when
the rule breaks.

Anyone holding `household.correct-vulnerability` can override a factor. The
override:

- requires a reason of real length, refused in the adapter as well as the form;
- keeps `computedState`, so what the records said is readable beside what the
  worker said;
- writes an `AuditEntry` carrying action, summary, **reason**, actor and time;
- can be withdrawn, which is itself a recorded act with its own reason.

_Evidence:_ `household-vulnerability.spec.ts` covers totality, provenance,
unknown-versus-absent, the band rule and correction round-trips.
`vulnerability-snapshot.spec.ts` asserts the working is derived from the basis
rather than stored, and that a correction stays visible even when it says "does
not apply". `mock-household.repository.spec.ts` proves the permission split, the
reason requirement and the audit line.

### 3. Household → family → person stays consistent

Membership is edited as **intents** — add, remove, change role, set head — not
as a replacement member list. The whole next state is computed and validated
before anything is assigned, and committed with no suspension point in between,
so a batch is a unit and not a best effort (`DL-43`).

Invariants: exactly one head, the head is a member, the head pointer agrees with
the member marked head, nobody listed twice, never empty. Referential rules that
need the wider registry — does this person exist, are they already under another
roof — are checked in the adapter, which is the only place that can answer them.

Both sides of the link move together: a person added to a household is pointed
at it in the same act, and a person removed cannot keep a pointer to a household
that no longer lists them.

_Evidence:_ `household.spec.ts` covers the reducer and the invariants;
`mock-household.repository.spec.ts` asserts that an illegal change in a batch
rolls the whole batch back, that the resident's own `householdId` moves with the
membership, and that a person cannot be taken from another household.

---

## Structure

| Piece                        | File                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Household, roles, invariants | `domain/households/household.ts`                                                    |
| Indicators and provenance    | `domain/households/household-vulnerability.ts`                                      |
| Detail aggregate             | `domain/households/household-profile.ts`                                            |
| Adapter                      | `data/mock/mock-household.repository.ts`                                            |
| Transactional state          | `data/mock/mock-resident.store.ts`                                                  |
| List / detail                | `features/households/household-*-page.*`                                            |
| Relationship editor          | `features/households/household-member-editor.ts`                                    |
| Snapshot component           | `shared/households/vulnerability-snapshot.ts`                                       |
| Copy (`DL-23`)               | `shared/households/vulnerability.copy.ts`, `features/households/households.copy.ts` |
| Enforcement                  | `tools/check-vulnerability.mjs`                                                     |

The household model moved out of `domain/residents/resident.ts` in this TAB. A
resident points at a household by id, and that pointer is all a person record
knows; membership belongs to the household, which is what makes the two sides
keepable in step.

---

## Known gaps

- **The per-capita threshold is a placeholder** (`DL-45`). The PSA publishes an
  official poverty threshold per region and semester; this repository is offline
  and has not read one. The figure must be reconciled with the PSA release and
  the office's AICS practice before it is quoted to anyone. Nothing depends on
  it being right, which is the point.
- **Households cannot be created or dissolved.** A household exists because the
  seed says so; there is no "register a household" or "split this family"
  workflow. Splitting is the harder half and needs a decision about what happens
  to the case history on both sides.
- **Household income is not editable** from this screen, so `no-income-recorded`
  cannot be resolved by the person who noticed it.
- **The snapshot is computed per read.** At registry scale that is fine; it
  would not survive a municipality-wide report, which needs the API to compute
  and store it.
- **Corrections do not expire.** A correction made after a 2026 home visit will
  still be overriding the computation in 2028. Ageing them needs an office
  decision about how long a home visit stays authoritative.
- **`assigned-cases` scope still does not narrow lists** (carried from TAB 05).
