import type { ResidentView } from '../residents/resident-disclosure';
import type { BarangayId, FamilyId, ResidentId } from '../shared/ids';
import type { AuditEntry } from '../shared/audit';
import type { Family, FamilyRole } from './family';
import { fromPerspectiveOf, type InverseKind, type Relationship } from './relationship';
import type { RelationshipEvent } from './relationship-event';

/**
 * The relationship graph, expressed as data a list can render.
 *
 * There is no separate "visual model" and "accessible model" here, and that is
 * deliberate (`DL-50`). A diagram with a text alternative beside it is two
 * artifacts that drift, and the one that stops being maintained is always the
 * text. So the graph *is* the list: nodes carry their edges already stated from
 * their own point of view, and any drawing on the screen is decoration over the
 * same DOM.
 */
export interface GraphEdge {
  readonly relationshipId: Relationship['id'];
  /** How this reads from the node's own side: "parent of", "child of". */
  readonly kind: InverseKind;
  readonly otherResidentId: ResidentId;
  readonly otherName: string;
  readonly isCurrent: boolean;
  readonly since: Relationship['since'];
  readonly until: Relationship['until'];
}

export interface GraphNode {
  readonly view: ResidentView;
  readonly role: FamilyRole | null;
  readonly isCurrentMember: boolean;
  /**
   * Which generation row this person sits on, relative to the family head:
   * negative above, 0 alongside, positive below. Used to *arrange* the list;
   * the arrangement never carries meaning the text does not also carry.
   */
  readonly generation: number;
  readonly edges: readonly GraphEdge[];
}

export interface FamilyGraph {
  readonly nodes: readonly GraphNode[];
  /**
   * Every relationship once, as its own row. The node view answers "who is this
   * person to everyone else"; this answers "what links exist at all", which is
   * the question a person checking the record for errors is actually asking.
   */
  readonly edges: readonly Relationship[];
}

export interface FamilySummary {
  readonly family: Family;
  /** Already disclosed — a protected head is masked here as everywhere else. */
  readonly headName: string;
  readonly memberCount: number;
  /** `null` when the family is not currently linked to a household. */
  readonly householdReference: string | null;
  readonly barangayId: BarangayId | null;
  readonly relationshipCount: number;
}

export interface FamilyDetail {
  readonly family: Family;
  readonly graph: FamilyGraph;
  /** Other families sharing this family's household. Empty is common; so is not. */
  readonly othersInHousehold: readonly FamilySummary[];
  /** Append-only, newest first (`DL-48`). */
  readonly history: readonly RelationshipEvent[];
  readonly audit: readonly AuditEntry[];
}

/**
 * Places each person on a generation row relative to the family head.
 *
 * A breadth-first walk over parent and spouse links: a parent is one row above,
 * a child one below, a spouse or sibling alongside. Anyone the walk cannot
 * reach — which is normal, since a family may record a member before recording
 * how they are related — lands on row 0 rather than being dropped.
 */
export function assignGenerations(
  members: readonly ResidentId[],
  headResidentId: ResidentId | null,
  relationships: readonly Relationship[],
): ReadonlyMap<ResidentId, number> {
  const generations = new Map<ResidentId, number>();
  const start = headResidentId ?? members[0] ?? null;
  if (start === null) {
    return generations;
  }

  generations.set(start, 0);
  const queue: ResidentId[] = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    const level = generations.get(current) ?? 0;

    for (const relationship of relationships) {
      const perspective = fromPerspectiveOf(relationship, current);
      if (perspective === null) {
        continue;
      }
      const step = generationStep(perspective.kind);
      if (step === null || generations.has(perspective.otherResidentId)) {
        continue;
      }
      generations.set(perspective.otherResidentId, level + step);
      queue.push(perspective.otherResidentId);
    }
  }

  for (const member of members) {
    if (!generations.has(member)) {
      generations.set(member, 0);
    }
  }

  return generations;
}

function generationStep(kind: InverseKind): number | null {
  switch (kind) {
    case 'parent-of':
    case 'step-parent-of':
    case 'foster-parent-of':
    case 'guardian-of':
      return 1;
    case 'child-of':
    case 'step-child-of':
    case 'foster-child-of':
    case 'ward-of':
      return -1;
    case 'grandparent-of':
      return 2;
    case 'grandchild-of':
      return -2;
    case 'spouse-of':
    case 'sibling-of':
      return 0;
    case 'other-relative-of':
      // Unknown distance. Placing it alongside is a guess; leaving it out of
      // the walk means it does not drag anyone else onto a wrong row.
      return null;
  }
}

/** Rows in display order, topmost generation first. */
export function generationRows(graph: FamilyGraph): readonly (readonly GraphNode[])[] {
  const levels = [...new Set(graph.nodes.map((node) => node.generation))].sort((a, b) => a - b);
  return levels.map((level) => graph.nodes.filter((node) => node.generation === level));
}

export function nodeFor(graph: FamilyGraph, residentId: ResidentId): GraphNode | null {
  return graph.nodes.find((node) => node.view.resident.id === residentId) ?? null;
}

/** Families a resident currently belongs to. Plural on purpose. */
export function familiesOfResident(
  families: readonly Family[],
  residentId: ResidentId,
): readonly FamilyId[] {
  return families
    .filter((family) =>
      family.members.some((member) => member.residentId === residentId && member.leftOn === null),
    )
    .map((family) => family.id);
}
