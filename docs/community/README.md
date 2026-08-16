# Newsfeed and Events — scope, permissions and the resident boundary

The guardrail for the two late-phase modules. Built in TAB 24; the modules
themselves arrive in TABs 25 and 26.

Decision records: `DL-122`, `DL-123`.

---

## What this TAB is, and is not

It is **scope, permissions, audit seams and a contract**. It is not screens.

The late-phase command's continuation rules are explicit: do not scaffold a new
app, do not restart the architecture, inspect what exists before changing it,
and make **additive, backward-compatible** changes. So TAB 24 adds:

- 19 permission keys to the existing array,
- 10 audit actions to the existing vocabulary,
- 2 navigation entries in a new **Community** section,
- 2 placeholder routes, guarded,
- 1 typed resident contract,

and changes nothing that was already working. All 1292 tests from TABs 01–23
still pass, unchanged.

### Why the routes are placeholders again

`FeaturePlaceholderPage` was written in TAB 04 under a rule this routing file
has followed since: *a screen that a later TAB will build gets a placeholder,
never a dead link.* TAB 21 emptied the last one. TAB 24 adds two more for
exactly the reason the rule exists — the nav entries are real now, and the
screens land in TABs 25 and 26.

---

## One permission model

Nineteen keys join `PERMISSIONS`. Nothing else changes about how permission
works (`DL-122`).

| Newsfeed | Events |
| --- | --- |
| `newsfeed.view` | `events.view` |
| `newsfeed.create` | `events.create` |
| `newsfeed.edit` | `events.edit` |
| `newsfeed.publish` | `events.publish` |
| `newsfeed.schedule` | `events.cancel` |
| `newsfeed.archive` | `events.archive` |
| `newsfeed.pin` | `events.manage-registrations` |
| `newsfeed.moderate-comments` | `events.export-registrations` |
| `newsfeed.view-insights` | `events.mark-attendance` |
| | `events.view-insights` |

### Kebab-case, not snake_case

The command suggests `moderate_comments` and `view_insights`. They are written
here as `moderate-comments` and `view-insights`, because "extend the existing
model" governs the **shape** as well as the location — and one array holding
both `newsfeed.moderate_comments` and `request.view-sensitive` is a model nobody
can predict from memory.

### Roles were mapped, not invented

The command lists example roles and says to map them *only if compatible with
roles already built*. The seven existing roles express all of them:

| Command's example | Mapped to | Why |
| --- | --- | --- |
| Newsfeed Manager / Publisher | **MSWDO head** | A post goes out in the office's name, and that role already answers for what the office says |
| Newsfeed Moderator | **MSWDO head** | Hiding a resident's words is a disclosure decision, not a formatting one |
| Events Manager | **MSWDO head** | Same authority |
| Events Registration Staff | *not created* | No existing role fits, and inventing one to hold a permission nobody has yet is speculative. When the office names a person, the grant already exists to give them |
| Read-only Executive | **auditor** | Already read-only everywhere else |

**Caseworkers, intake and disbursement officers hold neither module.** Nothing
about casework implies speaking for the municipality.

A role may hold Newsfeed without Events, as the command allows — the keys are
independent and nothing in the model couples them.

### The read-only classification matters more than it looks

`events.export-registrations` and both `view-insights` keys are classified
**read-only**. Exporting discloses but does not change, exactly as
`report.export` is classified.

Getting this wrong would have quietly turned the **auditor into a mutating
role** — the same trap `document.download` set in TAB 14 and `audit.view-detail`
set in TAB 21. The property test catches it; the classification is explicit so
it never has to.

---

## One audit vocabulary

Ten actions join `AuditAction`, covering every seam the command names:

| Act | Action |
| --- | --- |
| Post published / scheduled / archived / pinned | `published`, `scheduled`, `archived`, `pinned`, `unpinned` |
| Comment hidden / restored / replied to | `comment-hidden`, `comment-restored`, `comment-replied` |
| Event cancelled | `cancelled` |
| Registration exported or status changed | `exported`, `registration-changed` |
| Attendance changed | `attendance-changed` |

They extend the existing union rather than starting a second one, so the audit
explorer, its filters and `DL-114`'s row/detail split apply to a published post
exactly as they do to a resident record. A second vocabulary would need a second
explorer.

---

## The resident boundary

`domain/community/resident-contract.ts` is **types only** (`DL-123`). There is
no resident component, no resident route and no resident template anywhere in
this repository, and `check:community` fails the build if one appears.

### The asymmetry

| A resident may | A resident may never |
| --- | --- |
| View a published post | Create or edit a post |
| React to a post | Publish, schedule, pin or archive anything |
| Comment on a post | Hide or moderate another person's comment |
| Share a post | Create, edit or cancel an event |
| View a published event | See a registration list |
| Register to attend | Mark anybody's attendance |

The municipality speaks in its own name; residents answer. A resident capability
that could publish would let somebody post under the MSWDO's masthead — a
different kind of harm from any this application otherwise guards against.

`RESIDENT_MUST_NEVER` names every refused admin key, even though the capability
list is already an allow-list. The redundancy is deliberate: an edit that adds
`newsfeed.publish` has to **delete a line that says why not**.

### What the resident shapes deliberately omit

- **`ResidentPostView` names the office, not the member of staff.** A resident
  sees "MSWDO Taytay", not that Grace Ocampo pressed publish at 4pm.
- **`ResidentEventView` has no registration count.** It reports
  `capacityRemaining`, which answers the question a resident actually has. A low
  count on a sensitive service is disclosive in a municipality this size.
- **`ResidentCommentView` has no hidden state.** A hidden comment is *absent*
  rather than present and flagged: telling a resident that somebody's comment
  was moderated discloses a decision about another person, and telling them
  whose would be worse.
- **`ResidentRegistrationRequest` has no "reason for attending".** An events
  module is not an intake form, and that field would collect means information
  the office never asked for and has no basis to hold.

---

## Files

| Path | What it holds |
| --- | --- |
| `domain/access/permission.ts` | The 19 new keys and their role mapping |
| `domain/access/permission-matrix.ts` | The read-only classification |
| `domain/shared/audit.ts` | The 10 new audit actions |
| `domain/governance/audit-view.ts` | Their labels |
| `domain/community/resident-contract.ts` | The resident boundary, types only |
| `core/navigation/navigation.ts` | The Community section |
| `app.routes.ts` | Two guarded placeholder routes |
| `docs/access/permission-matrix.md` | The office reference, kept in step |
| `tools/check-community.mjs` | The build gate for all of the above |

`npm run check:community` was validated against 17 planted regressions; every
one fails the build.
