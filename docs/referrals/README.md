# Referrals, service providers and inter-office coordination

Routing a person to an office that can do what this one cannot.

## The one thing to understand first

**A referral summary leaves the building.**

Every other screen in this application is read inside the MSWDO. A summary is
handed to another organisation — a hospital, the police protection desk, a DSWD
field office — and once it is printed or transmitted, this office no longer
controls who reads it. Nothing can be taken back.

So the summary is **composed, not laid out** (`DL-82`). `composeReferralSummary`
decides what goes on it; a template cannot add a field. The minimum is the
client's name, the reference number and the reason. Everything beyond that is a
`SharedFieldChoice` with a required `because`.

There is no "share full profile" switch. A single switch gets ticked once and
forgotten; naming each field makes each one a decision somebody made and can be
asked about.

## Sending requires a lawful basis

A referral cannot be sent without a `DisclosureAuthority` (`DL-81`):

| Basis | When |
| --- | --- |
| `client-consent` | The ordinary case. They were told which office and what for, and agreed. |
| `statutory-mandate` | A statute or issuance requires the report or referral. Name it. |
| `vital-interest` | Consent could not be obtained and delay would risk serious harm. Say what the risk was. |

The note is required in all three cases.

The basis is a **parameter of `send`**, not a field set earlier. Recording
authority and transmitting are one act, so there is no window in which a
referral is sendable without one. The seed carries a draft with
`disclosure: null` so the refusal is exercised by a record that reached that
state honestly.

Three bases rather than one because consent alone would be its own failure:
insisting on written agreement from somebody unconscious in an emergency room
would mean either not referring, or lying about consent on the record.

## Three details that look small

- **A withheld field is omitted, not blanked.** "Address: withheld" tells the
  reader there is an address worth hiding — for a protection case that is itself
  the disclosure.
- **A chosen field the record does not hold is skipped**, because an empty line
  invites the receiving office to ask for it.
- **The composer reads `ResidentView`**, so a field the sender could not see is
  not there to share. Redaction is inherited from `DL-38`, not re-implemented,
  and the adapter additionally refuses extra fields when the sender's own view
  was redacted.

## The provider directory

`ServiceProvider` records what each office does, how to reach it, which channels
it accepts and how long it usually takes.

A free-text destination produces "PhilHealth Rizal", "Philhealth - Rizal" and
"PHIC Rizal" — three spellings of one office. An applicant then cannot be told
whether anybody has heard back, and a report counts one destination three ways
(`DL-80`).

`suspended` and `retired` entries are **listed, not hidden**: a worker who
cannot see that a shelter is full will keep sending families there, and a
retired entry has to stay readable or its past referrals stop making sense.

## The queue

Overdue is **derived**, never stored (`DL-83`): the office said it would chase by
a date, the date has passed, and nobody has heard back. A stored flag needs a
nightly job to stay true and is wrong every morning until it runs.

Default follow-up comes from urgency — 2, 7 or 14 days — offered rather than
imposed. The window is the office's own convention, recorded in `FOLLOW_UP_BASIS`
and unconfirmed against a written issuance in this offline run.

**Rescheduling takes a required reason and appends it as a note.** Moving a chase
date quietly is exactly how an overdue referral stops being overdue without
anybody acting on it: the queue goes green and the family is still waiting.

Urgency is advisory to the receiving office and operational to us. It orders our
queue and sets our chase date; it confers no priority this office can grant over
another's work, and the screens do not imply otherwise.

## Status

The existing catalog gained `waiting-requirements`, which is part of the
universal vocabulary rather than a referral-specific invention. It is also the
state an applicant most needs told apart from "in progress": one means wait, the
other means bring something.

`waiting-requirements → in-progress` is the one loop in the lifecycle, and it
exists because families routinely come back with the missing paper.

## A defect this TAB fixed

`MockReferralRepository` had **no permission checks at all** (`DL-84`). `list`
and `getById` returned seeded referrals to any caller, unauthenticated included,
with no barangay scoping.

It survived because `/referrals` was a placeholder route, so nothing reachable
called it. An adapter written ahead of its screens has no call sites for a
detector to inspect. `check:referrals` now asserts that every read is gated and
that scope is applied.

## Known gaps

- **No create form.** `createDraft` and `send` work through the port and are
  tested; the screen that composes a new referral and its disclosure plan is not
  built. Referrals in the seed exercise every state.
- **Attachments are modelled but not attachable.** `SharedAttachment` carries
  the shape and the required reason; wiring it to the TAB 14 document store is
  the natural next piece.
- **Printing is the browser's**, scoped by a `@media print` rule so only the
  sheet prints. A generated PDF is backend work.
