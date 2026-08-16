# TAB 20 — Global Search, Saved Filters & Record Discovery

**Status:** COMPLETE — locally certified
**Commit:** `44de9f6`
**Verify gate:** PASS — lint, typecheck, **15 checkers**, **1204 tests** (62 files), production build

---

## What was built

| Layer    | Artefact                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| Domain   | `search/search-result.ts` — 6 entity types, hits, groups, per-type permissions, count sentences, `describeWithheld` |
| Domain   | `search/search-safety.ts` — `NEVER_SEARCHED`, recent-search rules, accent-insensitive matching |
| Domain   | `views/saved-view.ts` — gained `cases`, `households`, `SHARE_VIEW_PERMISSION` |
| Domain   | `access/permission.ts` — new `view.share` permission                          |
| Ports    | `SearchRepository` — one method, one parameter                                |
| Data     | `mock-search.repository.ts` — 6 producers, per-type gated, per-producer scoped, disclosing |
| Data     | `mock-saved-view.repository.ts` — shared create/remove behind `view.share`    |
| Data     | `HttpSearchRepository`; `api.contract.ts` gained a `search` endpoint          |
| Features | `search-page` + copy; the shell trigger now navigates                        |
| Features | `search.spec.ts` — 22 tests                                                   |
| Build    | `tools/check-search.mjs`, wired into `npm run verify`                         |
| Docs     | `docs/search/README.md`; `DL-109` … `DL-112`; CLAUDE.md §5; permission matrix |

---

## Acceptance criteria

| Criterion (master command)                    | Where it is met                                              | State |
| --------------------------------------------- | ------------------------------------------------------------ | ----- |
| Search results reveal only role-appropriate data | Per-type permission, per-producer scope, `discloseResident` before matching | PASS |
| Common records found in a few keystrokes       | Surname, control number or reference; accent-insensitive      | PASS  |
| Filters remain understandable and removable    | Saved views bar (existing) + recent chips + clear             | PARTIAL — see below |
| Global search overlay/page                     | `/search`, reached from the topbar trigger and Ctrl-K hint    | PASS  |
| Grouped result components                      | One group per entity type, with counts and see-all            | PASS  |
| Saved-view/filter preset system                | Extended to 6 resources; shared views behind `view.share`     | PASS  |
| Safe snippets only                             | Closed field set on both sides (`DL-109`)                     | PASS  |
| Recent searches local-only, nothing sensitive  | Nothing persisted at all (`DL-110`)                           | PASS  |
| Personal views first, shared behind permission | `view.share`, held by head and administrator                  | PASS  |

---

## Decisions recorded

- **DL-109** — search reads only what it may show.
- **DL-110** — a recent search is not written down.
- **DL-111** — saving a view for the office is a separate grant.
- **DL-112** — a record type that was not searched is named, not hidden.

---

## The reasoning worth keeping

**Matching is a disclosure even without a snippet.** The obvious rule — do not
display a case note — would have left a real leak in place. A search that
matched note bodies and rendered nothing still answers the question "does this
word appear in that person's file?", and it does so while the audit trail
records only a search.

Making the searchable set *identical* to the displayable set is what closes it,
and it is checkable: `NEVER_SEARCHED` is a list, and the checker greps the
adapter for every entry.

**Naming what was not searched.** The instinct is to hide types an account
cannot see. But an officer who searches a family's name, sees no case, and is
told nothing concludes the office never opened one — a wrong answer delivered
with confidence. Hence `withheldTypes`, the named list, and a `/search` route
guarded only by authentication so the explanation itself is reachable.

---

## Defect found and fixed

**Shared saved views were completely ungated.** `SavedView.isShared` existed on
the model and in the seed, and `create()` checked only the permission to read
the underlying list. Any account that could see residents could publish a named
view of them to every colleague in the office.

That matters more than it first sounds because a view holds no records: its
**name** is the disclosure. "VAWC survivors, Santa Ana" tells the whole office
who is being looked at, and it persists after whoever wrote it has moved on.

Fixed with `view.share`, held by the MSWDO head as well as the administrator —
`settings.manage` would have been administrator-only and too narrow for the
supervisor this feature is actually for.

The earlier rule that **nobody** could remove a shared view is superseded. It
was a stand-in for a permission that did not exist yet, and it left the office
unable to correct its own mistakes.

---

## Checker validation

`tools/check-search.mjs` enforces six doctrines, validated against **21 planted
regressions**: 21/21 caught, 0 missed, 0 stale, baseline restored clean.

**The checker ran clean on its first try and the plants found nothing wrong with
it** — the first time in this project that both halves passed first time. The
scoping rule was applied per assertion while writing (per-producer scope bodies,
declaration-scoped blocks, prose normalisation carried over from TAB 19), rather
than as a general intention.

Separately, **`check:access` caught `view.share` missing from
`docs/access/permission-matrix.md`** during the first full `verify`. That is a
checker written in an early TAB catching a permission added twelve TABs later,
which is exactly what it was for.

---

## Carried forward

- **Filter chips and a filtered-record count are not built.** The master
  command's filter UX asks for chips, clear-all, a count and a responsive filter
  drawer. Saved views, URL sync and clear-all exist from earlier TABs; the chip
  row and per-list count are a shared primitive that belongs with the list
  screens rather than with search, and no list currently renders one. Flagged
  rather than half-built.
- **`administration` is the last placeholder route**, and TAB 21 is the one that
  fills it. Assume its adapters are ungated until read — **three for three** so
  far (`DL-84`, `DL-95`, `DL-100`), and TAB 20 just made it four for four with
  the saved-view sharing gap.
- `visit-detail-page.scss` is 79 bytes over budget (pre-existing, non-blocking).
