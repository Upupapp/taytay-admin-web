# Reference Repository Audit (TAB 02)

Deliberate source audit performed **before** feature implementation, so that
later TABs never have to guess where a module came from or why it looks the way
it does.

The governing split, which every document here observes:

| Source                              | Supplies                                                                                          | Never supplies                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Esperanza Web Platform** (`main`) | _Functional / domain_ material — module inventory, screen decomposition, workflow vocabulary      | Visual styling, design language, technology choices |
| **Get Hired FE** (`master`)         | _Design / interaction_ material — state taxonomy, motion and accessibility rules, layout patterns | Features, domain concepts, technology choices       |

Neither reference supplies architecture. This repository's architecture is fixed
by [`CLAUDE.md`](../../CLAUDE.md) and was settled in TAB 01.

---

## Documents

| Document                                                           | Answers                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| [`feature-source-matrix.md`](./feature-source-matrix.md)           | For each planned module: what is the source, and is it in scope? |
| [`experience-pattern-library.md`](./experience-pattern-library.md) | What interaction patterns do we adopt, and what is the evidence? |
| [`decision-log.md`](./decision-log.md)                             | Every intentional divergence from a reference, with rationale.   |

## How later TABs cite this

Cite the document and row id, e.g. `see FSM-04` or `see EPL-07` / `see DL-03`.
Ids are stable: append new rows, never renumber existing ones.

If a later TAB contradicts a decision recorded here, that TAB must add a new
`DL-*` entry superseding the old one rather than silently changing behaviour.

---

## Provenance and evidence

Both references were inspected **read-only via the GitHub REST API**
(`gh api`). Nothing was cloned into this repository, and neither reference was
modified, branched or written to in any way.

| Reference | Repository                                 | Branch   | Commit audited                             | Commit date          | Visibility | Primary language |
| --------- | ------------------------------------------ | -------- | ------------------------------------------ | -------------------- | ---------- | ---------------- |
| Esperanza | `Upupapp/Esperanza-Web-Platform-frontend-` | `main`   | `f983ea4d7f8e00a19b0a50073478f240e301787b` | 2026-08-10T12:35:59Z | Private    | Blade            |
| Get Hired | `Upupapp/get-hired-FE`                     | `master` | `1982731c00784f0d188453bf503c7d7888455492` | 2026-07-05T08:57:59Z | Public     | TypeScript       |

Audit date: **2026-08-14**. Access via `gh` CLI authenticated as
`PaulEspinas2020` (scopes `gist, read:org, repo, workflow`). Both references
resolved successfully; **no access gap was encountered**, so no facts in these
documents are reconstructed or assumed. Every claim cites a file path in one of
the two commits above.

Scale of what was inspected: Esperanza 185 files (96 under `resources/`);
Get Hired 1,667 files (1,279 under `src/`).

### Two findings that change how the references must be read

1. **Esperanza is a frontend-only prototype, not a working system.** Every route
   in `routes/web.php` is a bare `Route::view(...)`. `app/` contains only
   `Controller.php`, `User.php` and `AppServiceProvider.php`; `database/migrations/`
   contains only stock Laravel tables (`users`, `cache`, `jobs`). Its own
   `CLAUDE.md` states the hard rule: "Never generate: Controllers …, Models,
   Migrations, … business logic, DB queries, auth logic, authorization logic".
   **Consequence:** Esperanza is authoritative for _what modules exist and what
   they are called_. It is **not** a source of schema, business rules,
   authorization or lifecycle enforcement — it has none.

2. **Get Hired is Angular 13 with NgRx, Angular Material and Bootstrap 5.**
   (`package.json`: `@angular/core ~13.2.5`, `@ngrx/store ^13.1.0`,
   `@angular/material ^13.2.5`, `bootstrap ^5.2.0`, `@nguniversal/express-engine`.)
   This repository is Angular 22, standalone, zoneless, signals-first, with no
   CSS framework and no UI kit. **Consequence:** Get Hired is authoritative for
   _design intent and interaction rules_. Its implementation technique is
   explicitly out of bounds — see `DL-01`.

---

## Method

1. Retrieved the full file tree of each reference at the pinned commit
   (`git/trees/<branch>?recursive=1`).
2. For Esperanza, read `routes/web.php` (the authoritative module list), its
   `CLAUDE.md` (stated workflows and status vocabulary), and the admin views
   closest to this repository's domain.
3. For Get Hired, read the shared component inventory, the design token and
   motion stylesheets, and the brand experience-system documentation.
4. Classified every finding as _feature_, _design_, or _rejected_, and recorded
   the rationale for anything adopted, adapted or refused.

Where a decision depended on something outside both references, the rationale is
recorded in `decision-log.md`. Network access **was** available during this
audit, so what was and was not verified is stated precisely:

- **Verified against the primary source.** WCAG 2.2 — fetched from
  `https://www.w3.org/TR/WCAG22/` on 2026-08-14 (HTTP 200), confirming it is a
  W3C Recommendation of 12 December 2024 and yielding the criteria new in 2.2
  with their conformance levels. See `DL-20`.
- **Not re-verified.** Philippine statutes and DSWD issuances (RA 10173, RA 11055,
  RA 9262, RA 9344 and the sectoral laws) were **not** fetched from a primary
  source in this run. Decisions resting on them — `DL-04`, `DL-06`, `DL-08`,
  `DL-19` — continue to carry the caveat in `CLAUDE.md` §6: they are written from
  established statute knowledge, and any TAB depending on the precise text of an
  issuance must verify it first.
