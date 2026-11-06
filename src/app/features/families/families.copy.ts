import type {
  FamilyDraftProblemCode,
  RelationshipProblemCode,
  TransferProblemCode,
} from '@domain/index';

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
    searchPlaceholder: 'Family number, name or head’s surname',
    searchHint:
      'Type at least two characters. Every word must match the family number, its name or the surname of its head.',
    order: 'In order of family number.',
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
    emptyMessage: 'Families appear here once one is recorded with its members.',
    noResultsHeading: 'No families match those filters',
    noResultsMessage: 'Try a different spelling, or clear the filters.',
    create: 'Record a family',
    shown: (count: number) => `${count} shown.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every family matching these filters.',
    showMore: 'Show more',
    tryAgain: 'Try again',
    loadingMore: 'Loading more…',
    moreFailed:
      'The next families could not be loaded. The ones above are still correct; try again.',
  },

  create: {
    title: 'Record a family',
    subtitle: 'Who belongs to whom — the people, each with their role, and where they live if anywhere.',
    back: 'Back to families',
    familyHeading: 'The family',
    name: 'Name',
    nameHint: 'How the office refers to them — usually the surname, then “family”.',
    formedOn: 'Together since',
    formedOnHint: 'Optional. Leave it empty if nobody knows.',
    membersHeading: 'Members',
    addMember: 'Add a member',
    addMemberHint:
      'Search the registry. A person not yet registered is registered first, as a resident.',
    alreadyListed: 'That person is already listed in this family.',
    role: 'Role',
    roleOf: (name: string) => `Role of ${name}`,
    remove: 'Remove',
    removeNamed: (name: string) => `Remove ${name} from this family`,
    noMembersYet: 'Nobody added yet. A family is recorded with at least one member.',
    tooManyMembers: 'A family is recorded with at most 30 members; add the rest from its record.',
    householdHeading: 'Where they live',
    noHousehold: 'No household — between addresses, or split across two',
    /**
     * Said beside the choice rather than after it, because the reader arrives assuming a family
     * must have an address (`DL-47`).
     */
    noHouseholdNote:
      'A family between addresses, or split across two, is an ordinary thing to record. It is not missing information.',
    findHousehold: 'Find the household',
    findHouseholdHint:
      'Type at least two characters of the household number, the head’s surname or the street.',
    householdSearching: 'Searching the household register…',
    householdNoneFound: 'No household matches. Check the spelling, or record the family with none.',
    householdMore: 'More households match; type more to narrow them.',
    householdChosen: 'Lives in:',
    chooseHousehold: 'Live here',
    changeHousehold: 'Choose another household',
    householdFailed: 'The household register could not be searched. Try again, or record no household.',
    reason: 'Why is this family being recorded?',
    reasonHint: 'Required. Kept with the family and with each member’s joining, against your name.',
    reasonPlaceholder: 'e.g. Intake interview 12 August: mother and two children',
    submit: 'Record family',
    submitting: 'Recording…',
    missingName: 'Give the family a name.',
    missingMembers: 'Add at least one member.',
    missingReason: 'Say why the family is being recorded.',
    saved: 'Family recorded.',
    failed: 'The family could not be recorded.',
  },

  detail: {
    membersHeading: 'Members',
    makeHead: 'Make head',
    isHead: 'Head of this family',
    headChanged: 'The head of this family was changed.',
    headNotChanged: 'The head was NOT changed. Nothing was saved.',
    headHeading: 'Change who heads this family',
    headDescription:
      'Say why this person now heads the family. The reason is kept with the change in the ' +
      'family’s history, and nothing removes it.',
    headReason: 'Reason',
    headReasonPlaceholder: 'e.g. Her husband now works in Qatar and she runs the household.',
    headConfirm: 'Make head',
    headCancel: 'Cancel',
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
    endReason: 'Why has it ended?',
    endReasonPlaceholder: 'e.g. Annulment decree presented on 3 November',
    endFailed: 'That relationship was NOT marked as ended. Nothing was changed.',
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

  draftProblem: {
    'no-name': 'Give the family a name of up to 120 characters.',
    'no-members': 'Add at least one member.',
    'too-many-members': 'A family is recorded with at most 30 members.',
    'duplicate-member': 'The same person is listed twice.',
    'resident-not-found': 'A person listed is not on the registry, or is outside the area you cover.',
    'household-not-found':
      'That household is not on the register, or is outside the area you cover.',
    'no-reason': 'Say why the family is being recorded.',
  } satisfies Record<FamilyDraftProblemCode, string>,

  relationshipProblem: {
    'same-person': 'A person cannot be related to themselves.',
    'already-recorded': 'That relationship is already recorded.',
    'contradicts-existing': 'That contradicts a relationship already on file.',
    'resident-not-found': 'That person is not on the registry.',
  } satisfies Record<RelationshipProblemCode, string>,
} as const;
