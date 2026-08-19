# Global search and saved views

Finding a record in a few keystrokes without turning the search box into a
disclosure channel.

Built in TAB 20. Decision records: `DL-109` … `DL-112`.

---

## Search reads only what it may show

The obvious rule is that a result must not display a case note. The rule that
matters as much is that it must not **match** on one either.

> Suppose search matched note bodies but rendered no snippet. Typing a
> condition, a shelter's name, or a surname and getting back exactly one
> resident tells you that word appears in that person's file.

The office would have disclosed the contents of a protected note without ever
rendering it, and the audit trail would record a search rather than a
disclosure.

So the searchable and displayable fields are the **same closed set** (`DL-109`):

| Read and shown | Refused on both sides |
| --- | --- |
| Disclosed name | Case note bodies |
| Reference / control number | Assessment findings |
| Barangay | Remarks, outcomes, service needs |
| Status label | Declined reasons, observations |
| Programme code | PhilSys digits, income, sectors, birth dates |

`NEVER_SEARCHED` holds the refused list, and `check:search` fails the build if
the adapter reads any of them.

`SearchHit` has no `snippet`, `context`, `matchedText` or `excerpt`. There is
nowhere for a sentence somebody wrote about a family to live.

`SearchRepository.search` takes a term and nothing else — no `fields`, no
`includeNotes`, no `deep`. A caller cannot ask search to read what a result may
not show.

### It also cannot show what the registry would not

A resident's name goes through `discloseResident` **before** it is matched, so a
protection case's name is withheld in search exactly as it is on their profile
(`DL-38`). A name this account may not read is a name it may not search on.

---

## Who may search what

Six record types, each gated by its own permission:

| Type | Permission |
| --- | --- |
| Residents | `resident.view` |
| Assistance requests | `request.view` |
| Cases | `case.view` |
| Households | `household.view` |
| Families | `family.view` |
| Programmes | `program.view` |

A release officer finds the resident and the request behind a payout and
**no case file**, because they hold no case access (`DL-08`).

Barangay scope is applied per producer. A family has no barangay of its own, so
its visibility comes from whether any of its members are visible.

### And what was skipped is named

`SearchResults.withheldTypes` reports the types that were not searched, and the
screen says so:

> Your account does not cover cases and families, so those were not searched.

Silently omitting them produces a result that reads as complete: an officer
searches a family's name, sees no case, and concludes the office has never
opened one. That is a wrong answer delivered with confidence (`DL-112`).

Naming the types rather than saying "some results are hidden" is deliberate — a
user who cannot tell **which** type they are missing cannot ask the right person
for access. For the same reason the `/search` route is guarded only by being
signed in: a narrower guard would hide the screen that explains the gap.

---

## Recent searches are not written down

The master command permits local-only recent searches. The safe reading is the
narrow one (`DL-110`).

A caseworker searching a resident by name leaves that name in the box.
Persisting it puts a resident's name on the device, outside every disclosure
rule the application otherwise applies — and on a shared office machine it is
readable by whoever sits down next.

**There is no way to tell a safe query from an unsafe one.** "Dela Cruz" is a
surname and also a street. A filter that tried to decide would be wrong in both
directions, and wrong quietly.

So nothing is persisted at all. The list lives in a signal for the lifetime of
the tab, and the screen says so — on a shared machine there is no other way for
an officer to know. `check:search` fails the build on `localStorage`,
`sessionStorage`, `indexedDB` or `document.cookie` anywhere in this module.

---

## The term lives in the URL

Like every other filter in this application (`DL-36`). A search is a link
somebody can send a colleague, the back button behaves, and the term is the only
thing in the query string.

Terms shorter than `MIN_SEARCH_LENGTH` are refused rather than run: two
characters against a municipal registry returns most of it, which is not a
search but a directory dump with a filter box on top.

Matching is case- and accent-insensitive, because the registry holds `Peña` and
an officer types `Pena`.

---

## Saved views

A saved view is a **name attached to query parameters** — nothing more — because
filter state already lives in the URL. Applying one is a navigation; sharing one
is a link. A list that grows a new filter gains it in saved views for free.

Six resources: residents, beneficiaries, assistance requests, releases,
cases and households.

**A personal view is a preference. A shared view is office configuration**
(`DL-111`). It appears for everyone who opens that screen, it outlives whoever
wrote it, and its *name* describes a population — "VAWC survivors, Santa Ana"
discloses who the office is looking at while holding no records at all.

So creating or removing a shared view costs `view.share`, held by the
administrator **and the MSWDO head**: a supervisor standardising the team's
queues is exactly who this is for.

Before TAB 20, `isShared` existed and nothing checked it — any account that
could read a list could publish a named view of it to the whole office. The
earlier rule that *nobody* could remove a shared view is superseded; it was a
stand-in for a permission that did not exist, and it left the office unable to
correct its own mistakes.

---

## Files

| Path | What it holds |
| --- | --- |
| `domain/search/search-result.ts` | Entity types, hits, groups, per-type permissions, count sentences |
| `domain/search/search-safety.ts` | The refused field list, recent-search rules, matching |
| `domain/views/saved-view.ts` | Saved views and `SHARE_VIEW_PERMISSION` |
| `data/mock/mock-search.repository.ts` | Six producers, gated and scoped |
| `data/mock/mock-saved-view.repository.ts` | Personal and shared views |
| `features/search/search-page.*` | The search screen |
| `shared/ui/saved-views/` | The saved-views bar (earlier TAB) |
| `tools/check-search.mjs` | The build gate for all of the above |

`npm run check:search` was validated against 21 planted regressions; every one
fails the build.
