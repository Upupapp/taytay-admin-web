# Family Registry & Relationship Graph (TAB 09)

Who belongs to whom — which is not the same question as who lives where.

Decisions: `DL-47` (a household is not a family), `DL-48` (history is appended
to, never rewritten), `DL-49` (the validator refuses almost nothing), `DL-50`
(the graph is the list), `DL-51` (already done is a success) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## The three acceptance guarantees, and how each is evidenced

### 1. Nothing assumes a household equals a family

Three cardinalities are supported and all three are in the seed, so the
assumption is visibly false on the first screen a user opens:

| Case                                     | Seeded as                            | Why it is there                                               |
| ---------------------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| One household, **two families**          | `fam-0001` + `fam-0002` at `hh-0001` | A widow and her grandson are two units of care under one roof |
| A family with **no household**           | `fam-0004`                           | Between addresses. A recordable state, not missing data       |
| A relationship **crossing two families** | `rel-0004`                           | Grandmother in one family, grandson in another                |

A dissolved family (`fam-0005`) is retained rather than deleted, and hidden from
the default list rather than from the registry.

The existing `ResidentProfile.family` field — which listed housemates — was
renamed to `householdMembers` in this TAB. A field called `family` holding a
list of people at the same address is the assumption stated in the type system,
and everything built on top of it would have copied it.

_Evidence:_ `mock-family.repository.spec.ts` asserts two separate families at
one address, that each is shown the other as a separate unit, that an unhoused
family is readable and filterable, and that one person's family is not inferred
from their address. `families.spec.ts` asserts the list says so in words above
the table, and that a family with no household reads "Not linked to a household"
with an explanation rather than a blank.

### 2. Relationship changes are retained as immutable events

Ending a relationship sets `until`; leaving a family sets `leftOn`. **Neither
deletes a row**, and the port has no update or delete counterpart (`DL-48`).
A former member stays in the graph marked "Former member"; an ended relationship
stays in the edge list marked "Ended" with its date.

Every event carries what happened, to whom, by whom, when, and **why** — the
reason is required by the repository, not just by a form. Events hold ids and
enum values rather than rendered sentences, so an event recorded today still
reads correctly after the copy is rewritten.

Every mutation is also idempotent (`DL-51`): a retried record or transfer
returns the existing state and appends no second event. Idempotency is checked
before validation, because "that person is not in this family" is a true and
useless answer to a retried move.

_Evidence:_ `mock-family.repository.spec.ts` asserts that an ended relationship
survives in the graph, that the reason and actor reach the history, that a
former member is not dropped, and that repeating a completed transfer adds no
event. `relationship.spec.ts` covers the direction and duplicate rules.

### 3. The graph is understandable without lines or colour

**The graph is the list** (`DL-50`). No canvas, no SVG, no text alternative
beside a picture — the primary artifact is a structured list of people, each
stating in words who they are to everyone else, arranged into generation rows by
CSS alone.

- Generations are **named in words**; vertical position is reinforcement.
- **No connector lines are drawn.** Every relationship a line would represent is
  already a sentence inside the box.
- Current versus ended is **stated with its date**, not by colour or dash.
- A second view lists every link exactly once as a real table — the question
  somebody proof-reading the record is actually asking.

Deleting the stylesheet leaves the graph fully readable. That is the test.

_Evidence:_ `relationship-graph.spec.ts` asserts every relationship appears as a
sentence, that the same link reads correctly from both sides, that generations
are named, that no `<canvas>` or `<svg>` exists, that headings/lists/links are
real, and that the edge table has scoped headers.

---

## Structure

| Piece                       | File                                                                         |
| --------------------------- | ---------------------------------------------------------------------------- |
| Family, roles, transfers    | `domain/families/family.ts`                                                  |
| Relationships and inverses  | `domain/families/relationship.ts`                                            |
| Immutable event history     | `domain/families/relationship-event.ts`                                      |
| Graph model and generations | `domain/families/family-graph.ts`                                            |
| Adapter                     | `data/mock/mock-family.repository.ts`                                        |
| Transactional state         | `data/mock/mock-family.store.ts`                                             |
| List / detail               | `features/families/family-*-page.*`                                          |
| Graph component             | `shared/families/relationship-graph.ts`                                      |
| Copy (`DL-23`)              | `shared/families/relationship.copy.ts`, `features/families/families.copy.ts` |

The resident registry stays the canonical source of people: a family transfer
that moves an address calls `MockResidentStore.setHousehold`, so the resident
record still has exactly one owner.

---

## Known gaps

- **Families cannot be created or dissolved from the UI.** The registry reads
  and edits what the seed holds; forming a new family and dissolving an old one
  are the natural next screens.
- **The transfer destination is limited to families in the same household.**
  Moving somebody to a family at another address is expressible in the port but
  not yet offered in the dialogue — it needs a family picker, the sibling of
  `PersonPicker`.
- **Deep cycle detection is one hop.** A person cannot be recorded as their own
  parent, but a longer ancestral cycle would not be caught. It needs the whole
  graph, which belongs to the API.
- **Generations are computed per read** and re-walked on every detail load.
- **Relationship history is tab-lifetime**, like the rest of the mock.
- **`assigned-cases` scope still does not narrow lists** (carried from TAB 05).
