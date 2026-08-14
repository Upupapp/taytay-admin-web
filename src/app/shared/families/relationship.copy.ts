import type { FamilyRole, InverseKind, RelationshipEventKind } from '@domain/index';

/**
 * Wording for relationships and their history (`DL-23`).
 *
 * Keyed by the domain unions, so a new relationship kind or event kind cannot
 * ship as a bare identifier on a screen. That matters more here than elsewhere:
 * the relationship graph carries its whole meaning in these words, because it
 * is not allowed to carry any in lines or colour (`DL-50`).
 */
export const RELATIONSHIP_COPY = {
  graphHeading: 'Relationships',
  graphSummary:
    'Each person is listed with who they are to everyone else, in words. The layout groups generations; it adds nothing the text does not already say.',

  listView: 'People',
  edgeView: 'Every recorded link',
  viewLabel: 'Show',

  generationAbove: 'Older generation',
  generationSame: 'Same generation',
  generationBelow: 'Younger generation',
  generationFurtherAbove: 'Two generations older',
  generationFurtherBelow: 'Two generations younger',

  noRelationships: 'No relationships have been recorded for this family yet.',
  noEdges: 'Nothing links these people yet. Record a relationship to start the graph.',
  formerMember: 'Former member',
  formerRelationship: 'Ended',
  currentRelationship: 'Current',
  since: 'since',
  until: 'until',
  relationshipCount: 'relationships',

  /** Read from the subject's own side: "Ana is the **parent of** Ben". */
  kindLabel: {
    'parent-of': 'parent of',
    'child-of': 'child of',
    'spouse-of': 'spouse of',
    'sibling-of': 'sibling of',
    'grandparent-of': 'grandparent of',
    'grandchild-of': 'grandchild of',
    'guardian-of': 'guardian of',
    'ward-of': 'in the care of',
    'step-parent-of': 'step-parent of',
    'step-child-of': 'step-child of',
    'foster-parent-of': 'foster parent of',
    'foster-child-of': 'foster child of',
    'other-relative-of': 'related to',
  } satisfies Record<InverseKind, string>,

  roleLabel: {
    head: 'Family head',
    partner: 'Partner',
    child: 'Child',
    dependant: 'Dependant',
    elder: 'Elder',
    'other-member': 'Other member',
  } satisfies Record<FamilyRole, string>,

  eventLabel: {
    'family-formed': 'Family recorded',
    'family-dissolved': 'Family dissolved',
    'member-joined': 'Joined the family',
    'member-left': 'Left the family',
    'member-role-changed': 'Role in the family changed',
    'resident-transferred': 'Moved between families',
    'relationship-recorded': 'Relationship recorded',
    'relationship-ended': 'Relationship ended',
    'family-household-changed': 'Family moved household',
  } satisfies Record<RelationshipEventKind, string>,

  historyHeading: 'How this family came to look this way',
  historyEmpty: 'Nothing has been changed on this family yet.',
  historyReason: 'Reason',
  historyImmutable:
    'This history is added to, never edited. A relationship that ends is kept, because a case study written while it was current still has to make sense.',
} as const;
