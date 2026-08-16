# User management, audit trail and data governance

The administrative controls a sensitive government case-management system needs,
and honest labels on the parts that are not built.

Built in TAB 21 — the TAB that filled the last placeholder route. Decision
records: `DL-113` … `DL-117`.

---

## The audit trail says what changed, never what it changed to

The master command asks for an event stream with a before/after summary and, in
the same breath, that generic list rows must not dump full sensitive record
values. Those pull against each other unless the split is **structural**.

A rendering rule — "do not show values in the list" — lasts until the first
person who wants to see what changed without clicking through. So the values are
not on the row at all (`DL-114`):

| | Carries |
| --- | --- |
| **`AuditRow`** | actor, action, entity, summary in words, timestamp, source, **which fields moved and how sensitive each is** |
| **`AuditEntryDetail`** | the before and after — a separate read, by id, behind `audit.view-detail` |

`toAuditRow` has no parameter that could carry a value. `auditRows` has no
`include`, no `expand` and no `withValues`. The split is in the shape, not in
what a caller remembers to ask for.

### Why this screen specifically

An audit list is the one surface designed to be **scrolled, filtered and
exported by somebody reviewing other people's work**. A row reading

> `monthlyIncome: ₱3,200 → ₱18,000` — Rosalinda Peña

discloses her income to every reviewer who filters by date, and does so in the
name of accountability — which is what makes it hard to argue with afterwards.

### Who may open the values

**The auditor, and not the MSWDO head.**

Reading the trail is oversight: did somebody record a reason, assign an owner,
act in time? Reading the recorded values is access to the record itself.
Checking whether a figure was altered improperly is the audit remit
specifically, which is why that role holds it and is read-only everywhere else.

`audit.view-detail` is explicitly classified `READ_ONLY` — the same catch as
`document.download` in TAB 14, where a name-shape heuristic would have called it
a mutation and quietly made the auditor a mutating role.

Opening the values restates the rationale where it is read: *this view is itself
auditable, and opening it is recorded against your name.*

---

## Deactivation ends a live session

`signIn` refused a deactivated account. `currentUser()` did not — it resolved
the same account into a fully permissioned identity.

So an account switched off at 10am kept **every grant** until the person
happened to sign out. That is worse than either half alone: the office saw the
account marked inactive, believed access had been withdrawn, and it had not
been. The one moment deactivation matters most — somebody being walked out — is
the moment it did nothing (`DL-116`).

`canHoldSession` now lives in the domain and **both paths ask it**, so sign-in
and session cannot drift apart again.

An administrator cannot deactivate the account they are signed in as: it would
take effect immediately and they could not undo it from here.

Changing an account's status takes a **required reason**, like every other
mutation in this application (`DL-54`).

---

## An account is not a directory entry

`StaffUser` is the **authorisation** model. Every guard, every adapter and
twenty-eight test fixtures depend on its shape, and it answers one question: who
may do what.

`StaffProfile` holds the directory — employee ID, unit, contact details. Those
are **personal information about an employee**, with the same protection under
RA 10173 that a resident's has (`DL-115`).

Keeping them apart means a directory change does not ripple through
twenty-eight permission tests, and a role can be shown without showing a phone
number. One identity, two facets, both keyed on `StaffUserId`. `StaffAccount`
composes them in the data layer, so the disclosure decision lives in one place.

Same instinct as `Resident` versus `ResidentView` (`DL-38`).

---

## There is no invite or reset flow

Accounts are provisioned by an administrator outside this console (`DL-32`), and
the staff screen **says so in a sentence** rather than showing a disabled
button.

A disabled button implies "later". A sentence says "not here". And a half-built
invite form is worse than none, because whoever fills it in reasonably believes
an account now exists.

`GovernanceRepository` has no `create`, no `invite` and no `resetAccess`, and
`check:governance` fails the build if one appears — or if a `<form>` shows up on
an administration screen.

---

## Retention is empty on purpose

No records disposition schedule was supplied. RA 9470 requires a government
agency to have one approved by the National Archives, and the MSWDO will — but
this application was not given it, and periods differ by record series in ways
nobody can guess (`DL-113`).

So every rule carries:

- `periodInYears: null`
- `provenance: 'awaiting-office-policy'`
- a screen that prints **"No schedule recorded"** — never a zero, never
  "indefinite", never a default

The list covers **every** classified record type rather than a subset: showing
three of ten with schedules would imply the other seven need none. The screen
counts how many are still waiting, so the gap stays visible — the same device as
`awaitsConfirmation` for the review windows (`DL-68`).

This is the same refusal as `DL-89` (accounting), `DL-101` (service standards)
and `DL-105` (a disclosure threshold). It is the most consequential of the four:
an office that believes it may delete after five years, and does, **cannot undo
it**.

---

## Data classification

RA 10173 distinguishes **personal information** from **sensitive personal
information**, and the second carries stricter conditions — which is why this
application has held `vawc-survivor` and `cicl` behind their own permission
since TAB 07.

Ten record types are labelled, each with what it actually holds and the section
the label comes from. Four sit in the top tier: protection sectors, case notes,
supporting documents and referrals.

Labelling is not decoration. An office that cannot say which of its screens hold
sensitive personal information cannot answer a data protection officer, cannot
scope a breach, and cannot train anybody on what to be careful with.

Citations were written from established statute knowledge and **not re-verified
against an online primary source in an offline run**, as `CLAUDE.md` §6 requires
such citations to be marked.

---

## Correction requests

Somebody says a record is wrong; the office decides; and **whichever way it
goes, the request and its answer stay on file** (`DL-117`).

| State | Meaning |
| --- | --- |
| `raised` | Said to be wrong. Nobody has looked. |
| `under-review` | The office is checking against what was presented. |
| `applied` | Corrected. The previous value stays in the trail. |
| `refused` | Not agreed, and the reason is recorded and disclosable. |
| `withdrawn` | No longer pursued. |

`applied` and `refused` each require an **outcome in words**, and all three end
states are **terminal**. Somebody who disagrees raises a new request naming the
old one — the same shape as a case that recurs (`DL-53`), because reopening
rewrites what the office decided and when.

- A correction applied with no trace leaves a record that silently disagrees
  with the decision made on the old one.
- A request refused with no trace leaves a resident with nothing to appeal
  against.

**The capture screen is not built**, and the governance page says so.

---

## Access

| Act | Permission |
| --- | --- |
| See the directory and the matrix | `staff.view` |
| Activate or deactivate an account | `staff.manage` |
| Read the audit trail | `audit.view` |
| Open recorded values | `audit.view-detail` |
| Classifications, retention, corrections | `settings.manage` |

Every governance read and the single write are gated at the adapter, not only in
the UI.

---

## The permission matrix screen

Built from `PERMISSIONS` and `ROLE_DEFINITIONS` rather than from a table
somebody maintains, so the screen and the system cannot disagree — the screen
*is* the system's own answer. `check:access` separately holds
`docs/access/permission-matrix.md` to the same source, which is how a permission
added twelve TABs later still reaches the office reference.

Every cell says **"Holds"** or **"Does not hold"** to a screen reader. A tick
with no text is unreadable to assistive technology, and this is the reference an
office consults when somebody asks why they cannot do something.

---

## Files

| Path | What it holds |
| --- | --- |
| `domain/governance/audit-view.ts` | Rows, the value split, filtering, count sentences |
| `domain/governance/data-classification.ts` | Ten record types, four tiers, statutory basis |
| `domain/governance/retention.ts` | Rules awaiting an office schedule |
| `domain/governance/correction-request.ts` | States, transitions, the reason rule |
| `domain/governance/staff-profile.ts` | The directory, `canHoldSession`, the not-built notices |
| `data/mock/mock-governance.repository.ts` | The gated adapter |
| `data/mock/seed/governance.seed.ts` | Profiles, the trail, values held apart, corrections |
| `features/administration/staff-page.*` | The directory and activation |
| `features/administration/roles-page.*` | The permission matrix |
| `features/administration/audit-page.*` | The trail explorer |
| `features/administration/governance-page.*` | Classification, retention, corrections |
| `tools/check-governance.mjs` | The build gate for all of the above |

`npm run check:governance` was validated against 27 planted regressions; every
one fails the build.
