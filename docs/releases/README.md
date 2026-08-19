# Releases, distribution and payout sessions

What the office hands over, to whom, when, and what happened when it could not.

Built in TAB 17. Decision records: `DL-89` … `DL-95`.

---

## What this module is not

It is not the treasury system, and it does not pretend to be one.

The municipality's accounting and treasury systems own funds, postings and
reconciliation. This application was given none of their rules — no chart of
accounts, no fund codes, no bank integration, no posting dates — so it invents
none (`DL-89`).

What that means concretely:

| Field                  | What it is                                       | What it is not                     |
| ---------------------- | ------------------------------------------------ | ---------------------------------- |
| `fundingSourceLabel`   | A label the office was given, held as text        | An account, a fund code, a posting |
| `approvingReference`   | A document reference somebody can look up         | A link into an approval engine     |
| `instrumentReference`  | Cheque, e-wallet or acknowledgement receipt number | A payment instruction              |

`npm run check:releases` fails the build if a ledger, journal entry, account
code, bank account or posting date appears anywhere in this domain, its adapters
or its screens. The boundary is also stated on the release detail screen, where
a disbursing officer reads it — a rule an office never sees is one it discovers
by being wrong about it.

---

## The nine states, and the two that matter most

```
for-release → scheduled → released → claimed → completed
                  ↓
              deferred ──→ scheduled
              unclaimed ─→ scheduled
        needs-correction ─→ for-release | scheduled
```

`completed` and `voided` are terminal. Everything else is still the office's to
act on.

**Deferred and unclaimed are not the same thing, and must never be recorded as
one** (`DL-94`):

- **Deferred** — they came, and the office could not pay. Every `DeferralReason`
  is the office's own: funds not yet with the office, a missing approving
  signature, an identification mismatch, a voucher error, a closed office. The
  domain refuses a deferral with no reason.
- **Unclaimed** — nobody came within the window. The office was ready. Why they
  did not come is not known, and the screen does not guess.

Collapsing them blames a family for the office's missing countersignature, and
the record then reads that way to every worker who opens it afterwards.

The queue is bucketed by **who has to act**. Deferrals and miskeyed vouchers sit
in the first bucket — "the office must act on these" — because those are the
ones where somebody is waiting on us. Unclaimed payouts do not.

---

## Money or goods, never both

`ReleaseKind` is `money` or `in-kind`, and the invariant runs both ways: a money
release carries an amount and no description; an in-kind release carries a
description and **no amount at all** (`DL-93`).

Putting a peso figure on a food pack invents a number nobody counted, and it
then appears in reports as though somebody did. So:

- `Release.amount` is `Money | null`, and every consumer handles the null.
- `sumReleased` filters in-kind releases out rather than coercing them to zero.
- A manifest reports a **money total** and a **separate count of goods**. Two
  numbers that each mean something.

---

## Payout sessions have no status

A `ReleaseBatch` is a plan: a date, a venue, a releasing officer and a list of
releases. It has **no status field** (`DL-90`).

What a session amounts to is counted from its members through `batchProgress`,
and said in words by `describeBatch`:

> 1 of 3 released, 1 deferred, 1 still to release.

Not "partially complete" — that names nobody, and the person still waiting is
invisible in it. Scheduling into a batch sets each member to `scheduled`
individually; the batch never becomes the thing that has been released.

---

## The payout list

The manifest is printed, carried out of the office and handled at a venue that
may be a barangay hall with no lockable drawer. It is the second artefact here
that leaves the building, after the referral summary, and it gets the same
treatment (`DL-92`).

**Composed by the data layer**, never assembled by a screen:
`ReleaseRepository.manifestFor(batchId)` returns a `ReleaseManifest`. A
template with the full records in scope is one binding away from printing a
birth date onto a sheet that leaves the building.

Each line carries:

- the beneficiary's listed name, already disclosed for the composing user
  (`DL-38`);
- the voucher **masked to its last four characters**, like a document number
  (`DL-77`) — enough to match what is in somebody's hand, not enough to
  reconstruct the series;
- the amount, or what the goods are;
- **blank space** for a signature or thumbmark.

The acknowledgement column is empty on purpose. Pre-filling how somebody will
acknowledge is how a sheet comes back signed for a person who was never there.

Nothing else appears: no birth date, no address, no sector membership, no
PhilSys digits, no reason for the assistance. The `@media print` rule hides the
office's own session cards and controls, so only the list prints.

---

## Approving and releasing

`DL-08` keeps the two permissions in different roles, and
`domain/access/permission.spec.ts` asserts no non-administrator role holds both.

Separated permissions are not separated **people**. An administrator holds
everything by definition, and a misconfigured account can hold both grants. So
`isSelfRelease` compares the release against **who actually approved the request
behind it** — read through `approverFor`, never inferred from the current user's
role — and the screen warns before the money moves (`DL-91`).

It warns and does not block. A small office on a bad day may genuinely have one
person available, and refusing the payout punishes the family for the office's
staffing. Naming it puts the fact where an auditor will see it.

A representative collecting on somebody's behalf must have their **authority
recorded**. The domain refuses the acknowledgement otherwise.

---

## Access

Every method on `MockReleaseRepository` checks its permission and applies
barangay scope through the beneficiary. That was not true before TAB 17: the
adapter was completely ungated, the second one found in that state after
`MockReferralRepository` (`DL-84`, `DL-95`). Both sat behind placeholder routes,
so nothing exercised them.

| Act                        | Permission               |
| -------------------------- | ------------------------ |
| Read a release or session   | `release.view`      |
| Create a payout session     | `release.schedule`  |
| Record a release, receipt or deferral | `release.release` |
| Void a release              | `release.void`      |

A release is reachable only if the person it is for is. Not-found and not-yours
read identically (`DL-31`).

---

## Files

| Path                                              | What it holds                              |
| ------------------------------------------------- | ------------------------------------------ |
| `domain/releases/release.ts`            | Statuses, transitions, kinds, invariants   |
| `domain/releases/release-batch.ts`           | Sessions and their derived progress        |
| `domain/releases/release-manifest.ts`        | Manifest composition, masking, self-release |
| `data/mock/mock-release.repository.ts`       | The gated adapter                          |
| `data/mock/seed/releases.seed.ts`            | Nine releases exercising every state       |
| `features/releases/release-list-page.*`           | The queue, bucketed by who must act        |
| `features/releases/release-detail-page.*`         | One release and the acts against it        |
| `features/releases/payout-session-page.*`         | Sessions and the printed payout list       |
| `tools/check-releases.mjs`                        | The build gate for all of the above        |

`npm run check:releases` was validated against 24 planted regressions; every one
fails the build.
