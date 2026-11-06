import {
  assignGenerations,
  FAMILY_ROLES,
  FamilyDraftInvalidError,
  fromPerspectiveOf,
  headOfFamily,
  RELATIONSHIP_EVENT_KINDS,
  RELATIONSHIP_KINDS,
  RelationshipInvalidError,
  TransferRefusedError,
  type Family,
  type FamilyDetail,
  type FamilyDraft,
  type FamilyDraftProblemCode,
  type FamilyId,
  type FamilyMember,
  type FamilyRole,
  type FamilySummary,
  type GraphEdge,
  type GraphNode,
  type HouseholdId,
  type Relationship,
  type RelationshipEvent,
  type RelationshipEventId,
  type RelationshipId,
  type RelationshipKind,
  type RelationshipProblemCode,
  type ResidentId,
  type ResidentTransfer,
  type ResidentView,
  type StaffUserId,
  type TransferProblemCode,
} from '@domain/index';

import { UNNAMED_ACTOR } from './household.mapper';
import { toResidentView, type BarangayIndex } from './resident.mapper';
import { date, dateTime, field, flag, id, int, oneOf, str } from './wire';

/**
 * Families and the relationships between people, on the wire (`OfficeFamilySummary`,
 * `OfficeFamilyDetail`, `OfficeRelationship`, `OfficeFamilyEvent`).
 *
 * | wire                                   | domain                              | if absent or unknown              |
 * | -------------------------------------- | ----------------------------------- | --------------------------------- |
 * | `family.id`, `reference_number`, `name` | `family.id`, `referenceNumber`, `name` | the record is not readable    |
 * | `family.household_id`                  | `family.householdId`                | `null`: between addresses (`DL-47`) |
 * | `family.formed_on`, `dissolved_on`     | the same                            | none recorded                     |
 * | `family.members[]` (periods)           | `family.members`                    | one unreadable: the record is not |
 * | `family.created_*`, `updated_*`        | `family.audit`                      | the record is not readable        |
 * | `head` (a summary)                     | `headName`                          | `null`: "No head recorded"        |
 * | `member_count`, `relationship_count`   | the same                            | the row is not readable           |
 * | `household_reference`, `barangay_id`   | the same                            | `null`: no household              |
 * | `members[]` (a record)                 | `graph.nodes`                       | one unreadable: the record is not |
 * | `relationships[]`                      | `graph.edges`, each node's edges    | one unreadable: the record is not |
 * | `others_in_household[]`                | `othersInHousehold`                 | one unreadable: the record is not |
 * | `history[]`                            | `history`, newest first             | one unreadable: the record is not |
 *
 * **The server has already redacted every member** (`DL-38`) — a protected member masked, and, in a
 * family with a protected member, everyone's own street withheld from a reader not cleared for it.
 * This mapper applies no rule of its own: each member is read by the resident mapper, and `withheld`
 * says what was held back.
 *
 * **The graph is assembled here exactly as the mock assembles it** — generations by
 * `assignGenerations` from the head, each node's edges by `fromPerspectiveOf` — so the two adapters
 * draw the same family from the same facts. A relationship's other person is named from the members
 * read beside it, already redacted; the API sends only relationships among the family's own members.
 *
 * **Not read**: the family has no trail of `AuditEntry` lines beyond its history, so `audit` is
 * empty, as the mock leaves it.
 *
 * @consumes GET office/families
 * @consumes GET office/residents/{id}/families
 */
export function toFamilySummary(wire: unknown, barangays: BarangayIndex): FamilySummary | null {
  const family = readFamily(field(wire, 'family'));
  const head = readHead(field(wire, 'head'), barangays);
  const memberCount = int(field(wire, 'member_count'));
  const relationshipCount = int(field(wire, 'relationship_count'));
  const rawReference = field(wire, 'household_reference');
  const householdReference = str(rawReference);
  const rawBarangay = field(wire, 'barangay_id');
  const barangayId = rawBarangay === null ? null : barangays.toConsole(str(rawBarangay));

  if (
    family === null ||
    head === undefined ||
    memberCount === null ||
    relationshipCount === null ||
    (rawReference !== null && householdReference === null) ||
    (rawBarangay !== null && barangayId === null)
  ) {
    return null;
  }

  return {
    family,
    headName: head === null ? NO_HEAD_NAME : head.listedName,
    memberCount,
    householdReference,
    barangayId,
    relationshipCount,
  };
}

/**
 * A family, everyone who has been in it, how they are related, and its history.
 *
 * @consumes GET office/families/{id}
 * @consumes POST office/families
 * @consumes POST office/families/transfers
 * @consumes POST office/families/{id}/members/{residentId}/role
 */
export function toFamilyDetail(wire: unknown, barangays: BarangayIndex): FamilyDetail | null {
  const family = readFamily(field(wire, 'family'));
  const members = readMembers(field(wire, 'members'), barangays);
  const relationships = readAll(field(wire, 'relationships'), toRelationship);
  const others = readAll(field(wire, 'others_in_household'), (entry) =>
    toFamilySummary(entry, barangays),
  );
  const history = readAll(field(wire, 'history'), toRelationshipEvent);

  if (
    family === null ||
    members === null ||
    relationships === null ||
    others === null ||
    history === null
  ) {
    return null;
  }

  return {
    family,
    graph: { nodes: graphNodes(family, members, relationships), edges: relationships },
    othersInHousehold: others,
    history,
    audit: [],
  };
}

/**
 * One relationship between two people, in its one canonical direction.
 *
 * @consumes POST office/residents/{id}/relationships
 * @consumes POST office/residents/{id}/relationships/{relationshipId}/end
 */
export function toRelationship(wire: unknown): Relationship | null {
  const relationshipId = id<RelationshipId>(field(wire, 'id'));
  const fromResidentId = id<ResidentId>(field(wire, 'from_resident_id'));
  const toResidentId = id<ResidentId>(field(wire, 'to_resident_id'));
  const kind = oneOf<RelationshipKind>(field(wire, 'kind'), RELATIONSHIP_KINDS);
  const since = optional(field(wire, 'since'), date);
  const until = optional(field(wire, 'until'), date);
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    relationshipId === null ||
    fromResidentId === null ||
    toResidentId === null ||
    kind === null ||
    since === undefined ||
    until === undefined ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    id: relationshipId,
    fromResidentId,
    toResidentId,
    kind,
    since,
    until,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };
}

/**
 * One act on the family registry, as the append-only history records it (`DL-48`). The reason is
 * the person's own words; an act whose author the server could name nobody for says so in words,
 * as the household trail does.
 *
 * @consumes GET office/residents/{id}/relationship-history
 */
export function toRelationshipEvent(wire: unknown): RelationshipEvent | null {
  const eventId = id<RelationshipEventId>(field(wire, 'id'));
  const kind = oneOf(field(wire, 'kind'), RELATIONSHIP_EVENT_KINDS);
  const reason = str(field(wire, 'reason'));
  const occurredAt = dateTime(field(wire, 'occurred_at'));
  const residentId = optional(field(wire, 'resident_id'), (value) => id<ResidentId>(value));
  const otherResidentId = optional(field(wire, 'other_resident_id'), (value) =>
    id<ResidentId>(value),
  );
  const familyId = optional(field(wire, 'family_id'), (value) => id<FamilyId>(value));
  const toFamilyId = optional(field(wire, 'to_family_id'), (value) => id<FamilyId>(value));
  const householdId = optional(field(wire, 'household_id'), (value) => id<HouseholdId>(value));
  const relationshipKind = optional(field(wire, 'relationship_kind'), (value) =>
    oneOf<RelationshipKind>(value, RELATIONSHIP_KINDS),
  );
  const role = optional(field(wire, 'role'), (value) => oneOf<FamilyRole>(value, FAMILY_ROLES));

  if (
    eventId === null ||
    kind === null ||
    reason === null ||
    occurredAt === null ||
    residentId === undefined ||
    otherResidentId === undefined ||
    familyId === undefined ||
    toFamilyId === undefined ||
    householdId === undefined ||
    relationshipKind === undefined ||
    role === undefined
  ) {
    return null;
  }

  return {
    id: eventId,
    kind,
    subject: { residentId, otherResidentId, familyId, toFamilyId, householdId, relationshipKind, role },
    reason,
    actorId: id<StaffUserId>(field(wire, 'actor_id')),
    actorName: str(field(wire, 'actor_name')) ?? UNNAMED_ACTOR,
    occurredAt,
  };
}

/* ── the family itself ─────────────────────────────────────────────────────── */

function readFamily(value: unknown): Family | null {
  const familyId = id<FamilyId>(field(value, 'id'));
  const referenceNumber = str(field(value, 'reference_number'));
  const name = str(field(value, 'name'));
  const householdId = optional(field(value, 'household_id'), (entry) => id<HouseholdId>(entry));
  const formedOn = optional(field(value, 'formed_on'), date);
  const dissolvedOn = optional(field(value, 'dissolved_on'), date);
  const members = readAll(field(value, 'members'), readPeriod);
  const createdAt = dateTime(field(value, 'created_at'));
  const updatedAt = dateTime(field(value, 'updated_at'));

  if (
    familyId === null ||
    referenceNumber === null ||
    name === null ||
    householdId === undefined ||
    formedOn === undefined ||
    dissolvedOn === undefined ||
    members === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    id: familyId,
    referenceNumber,
    name,
    householdId,
    members,
    formedOn,
    dissolvedOn,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(value, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(value, 'updated_by')),
    },
  };
}

/** One membership period. Leaving closes it; nothing deletes it (`DL-48`). */
function readPeriod(value: unknown): FamilyMember | null {
  const residentId = id<ResidentId>(field(value, 'resident_id'));
  const role = oneOf<FamilyRole>(field(value, 'role'), FAMILY_ROLES);
  const joinedOn = date(field(value, 'joined_on'));
  const leftOn = optional(field(value, 'left_on'), date);
  if (residentId === null || role === null || joinedOn === null || leftOn === undefined) {
    return null;
  }
  return { residentId, role, joinedOn, leftOn };
}

/** Said in the list when the API sends no head — never an empty cell that reads as a name withheld. */
const NO_HEAD_NAME = 'No head recorded';

/** The head as the server disclosed them; `null` for none on file, `undefined` when unreadable. */
function readHead(value: unknown, barangays: BarangayIndex): ResidentView | null | undefined {
  if (value === null) {
    return null;
  }
  return toResidentView(value, barangays) ?? undefined;
}

interface ReadMember {
  readonly view: ResidentView;
  readonly role: FamilyRole | null;
  readonly isCurrentMember: boolean;
}

function readMembers(value: unknown, barangays: BarangayIndex): ReadMember[] | null {
  return readAll(value, (entry): ReadMember | null => {
    const view = toResidentView(field(entry, 'resident'), barangays);
    const role = optional(field(entry, 'role'), (raw) => oneOf<FamilyRole>(raw, FAMILY_ROLES));
    const isCurrentMember = flag(field(entry, 'is_current_member'));
    return view === null || role === undefined || isCurrentMember === null
      ? null
      : { view, role, isCurrentMember };
  });
}

/* ── the graph, assembled as the mock assembles it ─────────────────────────── */

/** Unknown only if the server sent a relationship naming somebody it did not list. */
const UNKNOWN_RESIDENT = 'Unknown resident';

function graphNodes(
  family: Family,
  members: readonly ReadMember[],
  relationships: readonly Relationship[],
): readonly GraphNode[] {
  const everyone = members.map((member) => member.view.resident.id);
  const generations = assignGenerations(everyone, headOfFamily(family), relationships);
  const names = new Map(members.map((member) => [member.view.resident.id, member.view.listedName]));

  return members
    .map((member): GraphNode => {
      const residentId = member.view.resident.id;
      return {
        view: member.view,
        role: member.role,
        isCurrentMember: member.isCurrentMember,
        generation: generations.get(residentId) ?? 0,
        edges: relationships
          .map((relationship): GraphEdge | null => {
            const perspective = fromPerspectiveOf(relationship, residentId);
            return perspective === null
              ? null
              : {
                  relationshipId: relationship.id,
                  kind: perspective.kind,
                  otherResidentId: perspective.otherResidentId,
                  otherName: names.get(perspective.otherResidentId) ?? UNKNOWN_RESIDENT,
                  isCurrent: perspective.isCurrent,
                  since: relationship.since,
                  until: relationship.until,
                };
          })
          .filter((edge): edge is GraphEdge => edge !== null),
      };
    })
    .sort((a, b) => a.generation - b.generation);
}

/* ── reading helpers ───────────────────────────────────────────────────────── */

/** Every entry read, in the server's order — or `null` when one cannot be read. */
function readAll<T>(value: unknown, read: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const entries = value.map(read);
  return entries.every((entry): entry is T => entry !== null) ? entries : null;
}

/**
 * A field the API sends as a value or `null`: `null` when it said none, `undefined` when it said
 * something this console cannot read — which makes the record unreadable, never "none".
 */
function optional<T>(value: unknown, read: (value: unknown) => T | null): T | null | undefined {
  if (value === null) {
    return null;
  }
  return read(value) ?? undefined;
}

/* ── refusals ──────────────────────────────────────────────────────────────── */

const TRANSFER_CODES = {
  'resident-not-found': true,
  'family-not-found': true,
  'already-in-family': true,
  'not-in-source-family': true,
  'family-dissolved': true,
  'outside-your-barangay': true,
  'no-reason': true,
  'would-orphan-head': true,
} satisfies Record<TransferProblemCode, true>;

const RELATIONSHIP_CODES = {
  'same-person': true,
  'already-recorded': true,
  'contradicts-existing': true,
  'resident-not-found': true,
} satisfies Record<RelationshipProblemCode, true>;

const DRAFT_CODES = {
  'no-name': true,
  'no-members': true,
  'too-many-members': true,
  'duplicate-member': true,
  'resident-not-found': true,
  'household-not-found': true,
  'no-reason': true,
} satisfies Record<FamilyDraftProblemCode, true>;

/** What the refused request was, which decides the vocabulary its problems are read in. */
export type FamilyRefusalKind = 'transfer' | 'relationship' | 'family';

/**
 * A refused change, in the domain's terms — or `null` when the failure is not a refusal.
 *
 * The API answers a refused family, transfer, role change or relationship with a 409 whose
 * `details` name each problem by the console's own codes, with the residents it is about. A
 * transfer or a role change reads as a `TransferRefusedError`, a relationship as a
 * `RelationshipInvalidError` and a new family as a `FamilyDraftInvalidError` — the errors the
 * screens and the mock already use.
 *
 * A conflict naming a code outside that vocabulary is the server's own sentence instead, never
 * re-worded into a rule it did not state. That is how a transfer refused because the person heads
 * their **household** reads (`head-cannot-be-removed`, asked to move the household with them): a
 * household rule, refused in the household's words, which the transfer screen shows as given.
 */
export function toFamilyRefusal(failure: unknown, kind: FamilyRefusalKind): Error | null {
  if (field(failure, 'code') !== 'CONFLICT') {
    return null;
  }
  const message =
    str(field(failure, 'message')) ?? 'The server refused that change to the family registry.';
  switch (kind) {
    case 'transfer': {
      const problems = readProblems(field(failure, 'details'), TRANSFER_CODES);
      return problems === null ? new Error(message) : new TransferRefusedError(problems);
    }
    case 'relationship': {
      const problems = readProblems(field(failure, 'details'), RELATIONSHIP_CODES);
      return problems === null ? new Error(message) : new RelationshipInvalidError(problems);
    }
    case 'family': {
      const problems = readProblems(field(failure, 'details'), DRAFT_CODES);
      return problems === null ? new Error(message) : new FamilyDraftInvalidError(problems);
    }
  }
}

/** Every problem the details name, or `null` when one is unfamiliar, malformed or none are named. */
function readProblems<C extends string>(
  details: unknown,
  codes: Readonly<Record<C, true>>,
): { code: C; residentId: ResidentId | null }[] | null {
  if (details === null || typeof details !== 'object' || Array.isArray(details)) {
    return null;
  }
  const isCode = (key: string): key is C => Object.hasOwn(codes, key);
  const problems: { code: C; residentId: ResidentId | null }[] = [];
  for (const [key, residents] of Object.entries(details)) {
    if (!isCode(key) || !Array.isArray(residents)) {
      return null;
    }
    const named = residents.map((entry) => id<ResidentId>(entry));
    if (!named.every((entry): entry is ResidentId => entry !== null)) {
      return null;
    }
    if (named.length === 0) {
      problems.push({ code: key, residentId: null });
    }
    for (const residentId of named) {
      problems.push({ code: key, residentId });
    }
  }
  return problems.length === 0 ? null : problems;
}

/* ── writes ────────────────────────────────────────────────────────────────── */

/** What `POST office/families` reads (`OfficeFamilyCreate`), and nothing else: the body is strict. */
export interface FamilyDraftWire {
  readonly name: string;
  /** Required, and `null` for a family between addresses. */
  readonly household_id: string | null;
  readonly formed_on: string | null;
  readonly members: readonly { readonly resident_id: string; readonly role: FamilyRole }[];
  readonly reason: string;
}

export function toWireFamilyDraft(draft: FamilyDraft, reason: string): FamilyDraftWire {
  return {
    name: draft.name.trim(),
    household_id: draft.householdId,
    formed_on: draft.formedOn,
    members: draft.members.map((member) => ({ resident_id: member.residentId, role: member.role })),
    reason: reason.trim(),
  };
}

/** What `POST office/families/transfers` reads (`OfficeFamilyTransfer`): one intent, both halves. */
export interface TransferWire {
  readonly resident_id: string;
  readonly from_family_id: string | null;
  readonly to_family_id: string | null;
  readonly role: FamilyRole;
  readonly move_household: boolean;
  readonly reason: string;
}

export function toWireTransfer(transfer: ResidentTransfer): TransferWire {
  return {
    resident_id: transfer.residentId,
    from_family_id: transfer.fromFamilyId,
    to_family_id: transfer.toFamilyId,
    role: transfer.role,
    move_household: transfer.moveHousehold,
    reason: transfer.reason.trim(),
  };
}

/**
 * What `POST office/residents/{id}/relationships` reads (`OfficeRelationshipCreate`). No `since`:
 * the port records a relationship as of now, and the server's default for none is `null`.
 */
export interface RelationshipWire {
  readonly to_resident_id: string;
  readonly kind: RelationshipKind;
  readonly reason: string;
}

export function toWireRelationship(
  toResidentId: ResidentId,
  kind: RelationshipKind,
  reason: string,
): RelationshipWire {
  return { to_resident_id: toResidentId, kind, reason: reason.trim() };
}

/** What `POST office/families/{id}/members/{residentId}/role` reads (`OfficeFamilyRoleChange`). */
export interface RoleChangeWire {
  readonly role: FamilyRole;
  readonly reason: string;
}

export function toWireRoleChange(role: FamilyRole, reason: string): RoleChangeWire {
  return { role, reason: reason.trim() };
}
