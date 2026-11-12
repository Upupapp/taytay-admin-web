/**
 * What a biometric (selfie) consent text has to cover, shown as a checklist beside the editor
 * (`DL-216`). It is a list of **topics**, never wording: the text is the office's legal text, and
 * nothing here is put into it, suggested for it or compared with it. Nothing here gates publishing
 * either — whether a text covers a topic is a person's reading, not the software's.
 *
 * Each topic names where it comes from, the way the poverty threshold carries its source
 * (`DL-46`). The statute's sections were read on 12 November 2026 in its text on lawphil.net; the
 * circular and the 2025 order from published summaries, not their primary text — so anything relied
 * on as the precise words of an issuance is to be checked against it first (`CLAUDE.md` §6).
 *
 * Where the topic is something the server does — what withdrawing erases — the sentence says what
 * it does, read from `44cae1b`, so the office's text can say it truly.
 */
export interface ConsentRequirement {
  readonly topic: string;
  readonly detail: string;
  readonly basis: string;
}

export interface ConsentSource {
  readonly name: string;
  readonly url: string;
}

export const BIOMETRIC_CONSENT_REQUIREMENTS: readonly ConsentRequirement[] = [
  {
    topic: 'Purpose',
    detail:
      'What the selfie is taken for, said specifically, and that it is used for nothing else.',
    basis: 'RA 10173 s. 13(a): consent specific to the purpose, given before the processing.',
  },
  {
    topic: 'What is collected',
    detail: 'The selfie photo, and what is kept with it.',
    basis: 'RA 10173 s. 16(b): what personal data enters the system, and how it is processed.',
  },
  {
    topic: 'Who sees it',
    detail: 'Who in the office looks at the selfie, and whether anyone outside the office does.',
    basis: 'RA 10173 s. 16(b): the recipients to whom it is or may be disclosed.',
  },
  {
    topic: 'How long it is kept',
    detail:
      'The office’s own retention period. No retention schedule is recorded in this console, so ' +
      'the text has to state one.',
    basis: 'RA 10173 s. 16(b): the period for which the information will be stored.',
  },
  {
    topic: 'Freely given',
    detail:
      'That agreeing is the resident’s choice, and that nothing is offered in exchange for a selfie.',
    basis:
      'RA 10173 s. 3(b); the NPC’s 2025 order against Tools for Humanity found biometric consent ' +
      'given for an incentive was not freely given.',
  },
  {
    topic: 'Asked on its own',
    detail: 'That this consent is separate from the Terms of Use and the privacy notice.',
    basis: 'NPC Circular 2023-04: no bundled consent; consent is granular, one purpose at a time.',
  },
  {
    topic: 'Withdrawing',
    detail: 'That the resident can withdraw it at any time, as easily as they gave it.',
    basis: 'NPC Circular 2023-04: withdrawal at any time, as easy as giving consent.',
  },
  {
    topic: 'What withdrawing does',
    detail:
      'The server erases the resident’s selfies at once. A pending ID review cannot be approved ' +
      'until a new selfie is sent. The ID images and the office’s decisions are kept, and what was ' +
      'done before the withdrawal stays lawful.',
    basis: 'NPC Circular 2023-04: the consequences of withdrawing are explained.',
  },
  {
    topic: 'Who answers for it',
    detail:
      'The office responsible for the selfies, and how a resident reaches it with a question.',
    basis: 'RA 10173 s. 16(b): the identity and contact details of the controller.',
  },
  {
    topic: 'Declining',
    detail:
      'What a resident who does not agree can do instead. Whether they can verify another way, in ' +
      'person for instance, is the office’s decision: this console knows of none.',
    basis: 'RA 10173 s. 3(b): consent is freely given only where not agreeing is a real choice.',
  },
];

export const BIOMETRIC_CONSENT_SOURCES: readonly ConsentSource[] = [
  {
    name: 'RA 10173, the Data Privacy Act of 2012',
    url: 'https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html',
  },
  {
    name: 'NPC Circular 2023-04, Guidelines on Consent (summary)',
    url: 'https://accralaw.com/?p=16522',
  },
];
