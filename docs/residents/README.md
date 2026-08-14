# Constituent / Resident Master Registry (TAB 07)

The record every other workflow points at.

Decisions: `DL-38` (redaction in the data layer), `DL-39` (no editing what you
cannot see), `DL-40` (a saved view is named query parameters), `DL-41` (large
deterministic seed) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## The three acceptance guarantees, and how each is evidenced

### 1. A resident traces to family, household, cases and history — without searching again

`ResidentRepository.getProfile(id)` returns one `ResidentProfile` carrying the
resident, their household, the other members of it, and every assistance
request, payout and referral on file. The detail page renders all of it, and
every linked record is a link back to the list it came from.

The alternative — four repository calls stitched together in the component —
was rejected because the stitching would be re-implemented, slightly
differently, by every screen that later needs the same picture. The question
"has this family had help before?" has to have one answer.

_Evidence:_ `residents.spec.ts` asserts household reference, family membership,
and all three history sections on one screen; that every reference is an anchor
with an `href`; and that a family member links to their own record.
`mock-resident.repository.spec.ts` asserts the subject is excluded from their
own family list, that family members are disclosed under the same policy as the
subject, and that the released total counts money handed over rather than money
approved.

### 2. Sensitive attributes are permission-gated — and denied by default

Reads return a `ResidentView`, already redacted (`DL-38`). Two tiers:

| Tier                                 | Permission                | Withheld fields                                     |
| ------------------------------------ | ------------------------- | --------------------------------------------------- |
| Identity and means                   | `resident.view-sensitive` | `philsysLastFour`, `monthlyIncome`                  |
| Protected sector (RA 9262 / RA 9344) | `request.view-sensitive`  | sector flags, street address, contact details, name |

The protected tier bites only on a flagged record: an ordinary resident's phone
number is ordinary, and intake has to be able to ring people back.

The view also carries `withheld`, so a screen says **"3 details hidden by your
role"** instead of showing blanks that read as "not recorded" — and
`isProtected`, which is stated even when the sector itself is withheld, because
a worker who does not know a record needs care will not take any.

A record that arrives redacted **cannot be edited** (`DL-39`), in the adapter as
well as on the screen: a draft replaces the record, so saving one built from a
redacted copy would delete the withheld attributes.

_Evidence:_ `resident.spec.ts` covers the policy as a pure function, including
that it does not mutate its input and does not claim to have withheld a field
the record never held. `mock-resident.repository.spec.ts` proves the redaction
survives a bypassed UI, in the detail record and inside a paged list.
`residents.spec.ts` proves the screens report it rather than hiding it.

### 3. Large result sets stay usable

Three properties, none of them visible in a screenshot:

- **The adapter pages.** Only one page is sorted and disclosed, so the cost of
  the screen does not grow with the registry.
- **Typing is debounced and superseded.** A name typed across 250 records issues
  one query, not one per keystroke, and `switchMap` discards the answer to a
  question the user has moved past.
- **The URL is the query.** Paging and sorting are navigations, so the back
  button works and a filtered list is a link.

_Evidence:_ the seed carries 250 residents (`DL-41`). Tests assert that a page
is bounded, that two consecutive pages share no rows, and that combined filters
narrow rather than reset.

---

## Structure

| Piece                       | File                                       |
| --------------------------- | ------------------------------------------ |
| Model, filters, draft rules | `domain/residents/resident.ts`             |
| Disclosure policy           | `domain/residents/resident-disclosure.ts`  |
| Traceability aggregate      | `domain/residents/resident-profile.ts`     |
| Saved views                 | `domain/views/saved-view.ts`               |
| Registry adapter            | `data/mock/mock-resident.repository.ts`    |
| Mutable mock state          | `data/mock/mock-resident.store.ts`         |
| List / detail / form        | `features/residents/resident-*-page.*`     |
| URL ⇄ filter                | `features/residents/resident-query.ts`     |
| Copy (`DL-23`)              | `features/residents/residents.copy.ts`     |
| Summary card, person picker | `shared/residents/`                        |
| Saved-view bar              | `shared/ui/saved-views/saved-views-bar.ts` |

The summary card and the person picker live in `shared/` rather than in the
feature: the next workflow that asks "who is this for?" must reach for the same
control, not build a second search box with slightly different masking.

---

## The person picker

An ARIA **combobox**, not a text field with a list underneath. The input owns
`role="combobox"`, `aria-expanded` and `aria-controls`; the highlighted result
is pointed at by `aria-activedescendant` so focus never leaves the input; arrows
move, Enter chooses, Escape closes; and a polite live region announces the match
count, because a screen-reader user gets no visual cue that the list changed.

Options are `<button role="option" tabindex="-1">` — real activation for a
pointer, out of the tab order for a keyboard, and comfortably over the 24 px
target minimum.

---

## Known gaps

- **Household membership is not editable.** The form does not move a person
  between households: that is a two-sided decision belonging to a household
  screen no TAB has built yet. An existing membership is preserved on save.
- **The mock registry is tab-lifetime.** Created and edited records survive
  navigation but not a reload. Persistence is the API's.
- **`assigned-cases` scope still does not narrow lists** (carried from TAB 05),
  so a social worker sees the whole registry rather than their caseload.
- **No duplicate detection.** The picker helps a person notice an existing
  record, but nothing warns at creation that a similar name and birth date are
  already on file — the single most valuable next addition to this screen.
- **No export.** `resident.export` exists as a permission with no surface yet;
  it belongs with the reporting TAB.
- **`barangay-link` cannot read back a PhilSys reference it recorded.** A
  deliberate consequence of minimising by default, and worth re-examining after
  a first office pilot.
