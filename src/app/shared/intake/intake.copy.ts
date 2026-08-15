import type {
  AssessmentReadinessCode,
  IntakeChannel,
  IntakeProblemCode,
  IntakeSignalCode,
  IntakeSignalTone,
  IntakeStep,
} from '@domain/index';

/** Every user-facing string more than one intake screen says (`DL-23`). */
export const INTAKE_COPY = {
  channelLabel: {
    'walk-in': 'Walk-in',
    'barangay-referral': 'Barangay referral',
    encoded: 'Encoded from paper',
    online: 'Online submission',
  } satisfies Record<IntakeChannel, string>,

  channelHint: {
    'walk-in': 'The applicant was seen at the counter.',
    'barangay-referral': 'Endorsed by a barangay official, usually with a covering letter.',
    encoded: 'Typed up afterwards from a paper form.',
    online: 'Filed by the applicant themselves. Not available from this screen.',
  } satisfies Record<IntakeChannel, string>,

  stepLabel: {
    person: 'Who is this for?',
    request: 'What is being asked for?',
    checks: 'Checks',
    review: 'Review and file',
  } satisfies Record<IntakeStep, string>,

  stepShort: {
    person: 'Person',
    request: 'Request',
    checks: 'Checks',
    review: 'Review',
  } satisfies Record<IntakeStep, string>,

  toneLabel: {
    note: 'For information',
    caution: 'Worth a second look',
  } satisfies Record<IntakeSignalTone, string>,

  signalLabel: {
    'open-request-same-programme': 'Unfinished request, same programme',
    'open-request-other-programme': 'Unfinished request elsewhere',
    'granted-same-programme-recently': 'Recently granted under this programme',
    'assistance-within-lookback': 'Assistance received recently',
    'household-assisted-recently': 'Household assisted recently',
    'open-case': 'Open case',
  } satisfies Record<IntakeSignalCode, string>,

  problem: {
    'no-resident': 'Choose the person this request is for.',
    'no-programme': 'Choose the programme being applied to.',
    'no-reason': 'Say what the assistance is needed for.',
    'reason-too-short': 'Give enough detail that an assessor could act on it.',
    'missing-mandatory-requirement':
      'A required document is neither presented nor waived. Waiving one is a valid answer — it just has to be recorded.',
    'waiver-without-reason': 'A waived requirement needs a reason.',
    'unacknowledged-caution':
      'The duplicate check raised something. Read it and say why this is going ahead.',
  } satisfies Record<IntakeProblemCode, string>,

  readiness: {
    'no-assessment': 'No case study has been recorded yet.',
    'findings-too-short': 'The findings are too short to stand as a case study.',
    'outstanding-requirements': 'A required document is still outstanding.',
    'no-home-visit': 'No home visit is recorded.',
  } satisfies Record<AssessmentReadinessCode, string>,

  advisory: {
    heading: 'Duplicate and previous-assistance check',
    /**
     * The sentence a caseworker repeats when challenged. It has to stay true
     * and it has to stay on the screen (`DL-60`).
     */
    advisory:
      'This check reports what the records say. It does not approve, refuse, score or rank anybody — a person decides, and records why.',
    notCheckedYet: 'Choose a person to run the check.',
    nothingFound: 'Nothing found in the records that were read.',
    found: (signals: number, cautionCount: number) =>
      cautionCount === 0
        ? `${signals} thing${signals === 1 ? '' : 's'} to be aware of.`
        : `${signals} thing${signals === 1 ? '' : 's'} to be aware of, ${cautionCount} worth a second look.`,
    recordsRead: (count: number) => `${count} record${count === 1 ? '' : 's'} read.`,
    ruleLabel: 'Rule applied:',
    recordsLabel: 'Records read:',
  },

  acknowledgement: {
    heading: 'Before filing',
    description:
      'The check above raised something worth a second look. Filing is not blocked — say why this request should go ahead, and your words are kept with it.',
    reason: 'Why is this going ahead?',
    reasonPlaceholder:
      'e.g. Second admission for the same condition; the earlier grant covered the first hospital bill only',
    reasonHint: 'Required, and recorded permanently against your name.',
    tooShort: 'Say a little more — this is the note an auditor reads.',
  },
} as const;
