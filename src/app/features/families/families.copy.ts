import type { RelationshipProblemCode, TransferProblemCode } from '@domain/index';

/** Every user-facing string for the family registry (`DL-23`). */
export const FAMILIES_COPY = {
  list: {
    title: 'Families',
    subtitle: 'Who belongs to whom — which is not the same question as who lives where.',
    caption: 'Family units recorded by the MSWDO',
    /**
     * Said above the table, because the assumption it corrects is the one every
     * reader arrives with (`DL-47`).
     */
    notTheSameBanner:
      'A household is an address; a family is a unit of care. One address often holds several families, and a family can be between addresses with no household at all.',
    search: 'Search',
    searchPlaceholder: 'Family name, reference or head',
    barangay: 'Barangay',
    allBarangays: 'All barangays',
    unhousedOnly: 'Not linked to a household',
    includeDissolved: 'Include dissolved families',
    clear: 'Clear filters',
    columnReference: 'Family',
    columnName: 'Name',
    columnHead: 'Head',
    columnHousehold: 'Household',
    columnSize: 'Members',
    noHousehold: 'None recorded',
    dissolved: 'Dissolved',
    emptyHeading: 'No families yet',
    emptyMessage: 'Families appear here once relationships have been recorded.',
    noResultsHeading: 'No families match those filters',
    noResultsMessage: 'Try a different spelling, or clear the filters.',
  },

  detail: {
    subtitle: 'Family record',
    notFoundHeading: 'That family is not available',
    notFoundMessage:
      'The family does not exist, or it is outside the part of the municipality you cover.',
    back: 'Back to families',

    factsHeading: 'Family',
    reference: 'Family number',
    name: 'Name',
    household: 'Lives in household',
    noHousehold: 'Not linked to a household',
    noHouseholdNote:
      'Between addresses, or split across two. This is a recordable state, not missing data.',
    formed: 'Recorded from',
    dissolvedOn: 'Dissolved on',
    size: 'Current members',
    updated: 'Last updated',
    none: '—',

    sharingHeading: 'Other families at this address',
    sharingNote:
      'These families share a household with this one. They are separate units of care and are assessed separately.',
    noSharing: 'No other family is recorded at this address.',

    dissolvedNotice:
      'This family has been dissolved. The record and its history are kept, because they still explain where its members came from.',

    transfer: 'Move someone',
  },

  transfer: {
    heading: 'Move a person between families',
    description:
      'Moves one person out of this family and into another, in a single recorded act. The move is written to the history with your name and reason.',
    person: 'Who is moving?',
    destination: 'Which family are they joining?',
    noDestination: 'No family — out of this one only',
    role: 'Their role in the new family',
    moveHousehold: 'Move their household address too',
    moveHouseholdHint:
      'Often the address does not follow: a child boarding away belongs to the same family at a different address.',
    reason: 'Why?',
    reasonPlaceholder: 'e.g. Home visit 12 August: married and moved to the Cruz household',
    reasonHint: 'Required. Recorded permanently against your name.',
    confirm: 'Record the move',
    cancel: 'Cancel',
    saved: 'The move has been recorded.',
    problemsHeading: 'This move cannot be recorded',
  },

  relationship: {
    heading: 'Record a relationship',
    description:
      'Relationships are between people, not between a person and an address. They stay true when either of them moves.',
    subject: 'This person',
    kind: 'is the',
    object: 'of',
    reason: 'Why is this being recorded?',
    reasonPlaceholder: 'e.g. Birth certificate presented at intake on 12 August',
    confirm: 'Record relationship',
    cancel: 'Cancel',
    saved: 'Relationship recorded.',
    endHeading: 'End a relationship',
    endDescription:
      'The relationship is kept and marked as ended. It is never deleted: a case study written while it was current still has to make sense.',
    endConfirm: 'Mark as ended',
    ended: 'Relationship marked as ended.',
    problemsHeading: 'This relationship cannot be recorded',
  },

  transferProblem: {
    'resident-not-found': 'That person is not on the registry.',
    'family-not-found': 'That family is not on the registry.',
    'already-in-family': 'That person is already in the destination family.',
    'not-in-source-family': 'That person is not currently in this family.',
    'family-dissolved': 'The destination family has been dissolved.',
    'outside-your-barangay': 'That family is outside the area you cover.',
    'no-reason': 'A move needs a reason someone else can read.',
    'would-orphan-head':
      'This person heads the family. Give the family another head before moving them out.',
  } satisfies Record<TransferProblemCode, string>,

  relationshipProblem: {
    'same-person': 'A person cannot be related to themselves.',
    'already-recorded': 'That relationship is already recorded.',
    'contradicts-existing': 'That contradicts a relationship already on file.',
    'resident-not-found': 'That person is not on the registry.',
  } satisfies Record<RelationshipProblemCode, string>,
} as const;
