import type { CivilStatus } from '../residents/resident';
import { asIsoDate, type AppAccountId, type IsoDate, type ResidentId } from '../shared/ids';

/**
 * Which registry record a verified app account is (`DL-228`, the API's ADR 0004 decision 1).
 *
 * The reviewer who verifies an account has the person's government ID in hand (`DL-197`), so that
 * is when the office says which registry record she is: link the account to a record, make a
 * record from the verified account, or leave it unlinked — each with a reason the server keeps.
 * Once linked, the resident's My requests and applications in the app follow that record.
 *
 * **The proposals are evidence, never a decision** (`DL-60`, `DL-74`). A match carries a label —
 * a surname and a given initial, the one disclosure a review queue makes — a band that only orders
 * the list, and signals that say *whether* an attribute agrees, never its value (`DL-73`).
 */
export const REGISTRY_MATCH_STRENGTHS = ['strong', 'moderate', 'weak'] as const;
export type RegistryMatchStrength = (typeof REGISTRY_MATCH_STRENGTHS)[number];

export const REGISTRY_MATCH_ATTRIBUTES = [
  'surname',
  'given-name',
  'barangay',
  'mobile',
  'birth-date',
  'sex',
] as const;
export type RegistryMatchAttribute = (typeof REGISTRY_MATCH_ATTRIBUTES)[number];

export const REGISTRY_MATCH_OUTCOMES = ['same', 'similar', 'differs', 'not-comparable'] as const;
export type RegistryMatchOutcome = (typeof REGISTRY_MATCH_OUTCOMES)[number];

/** Whether one attribute agrees, and by which rule. Never the attribute's value. */
export interface RegistryMatchSignal {
  readonly attribute: RegistryMatchAttribute;
  readonly outcome: RegistryMatchOutcome;
  /** The server's sentence for the rule it applied. */
  readonly rule: string;
}

export interface RegistryMatch {
  readonly residentId: ResidentId;
  /** Surname and a given initial ("Mercado, L."), as the server gives it. */
  readonly label: string;
  readonly strength: RegistryMatchStrength;
  readonly signals: readonly RegistryMatchSignal[];
  /** Another app account holds this record: the server would refuse a link to it. */
  readonly linkedToOtherAccount: boolean;
}

export interface RegistryMatches {
  readonly accountId: AppAccountId;
  /** The record the account is linked to now, or `null`. */
  readonly linkedResidentId: ResidentId | null;
  /** At most ten, ordered by the server. */
  readonly matches: readonly RegistryMatch[];
}

export const ACCOUNT_LINK_DECISIONS = ['link', 'create', 'leave-unlinked'] as const;
export type AccountLinkDecisionKind = (typeof ACCOUNT_LINK_DECISIONS)[number];

export type RegistrySex = 'female' | 'male';

/**
 * A registry record made from the verified account: the name as verified, split into the
 * registry's parts (the server checks the words against the verified name), and what the registry
 * needs that the account does not hold. The barangay, purok and mobile are the account's. `null`
 * sex or birth date means "the account's"; the server refuses when neither gives one.
 */
export interface AccountLinkRecord {
  readonly firstName: string;
  readonly middleName: string | null;
  readonly lastName: string;
  readonly suffix: string | null;
  readonly sex: RegistrySex | null;
  readonly birthDate: IsoDate | null;
  readonly civilStatus: CivilStatus;
  readonly streetAddress: string | null;
}

/**
 * What a link corrects on the record, read off the ID in hand (`DL-260`): the name as verified, split
 * into the registry's parts (the server refuses another name), the sex, the birth date. Each is the
 * reviewer's own choice; a field left out keeps the record's value. The record's earlier values are
 * kept in its history on the server, with the link's reason.
 */
export interface AccountLinkCorrections {
  readonly name?: {
    readonly firstName: string;
    readonly middleName: string | null;
    readonly lastName: string;
    readonly suffix: string | null;
  };
  readonly sex?: RegistrySex;
  readonly birthDate?: IsoDate;
}

/** The reviewer's decision, sent with the approval in one act: a refused link approves nothing. */
export type AccountLinkDecision =
  | {
      readonly decision: 'link';
      readonly residentId: ResidentId;
      readonly reason: string;
      /** Absent when the record is linked as it stands. */
      readonly corrections?: AccountLinkCorrections;
    }
  | {
      readonly decision: 'create';
      readonly record: AccountLinkRecord;
      /** Optional: without one, the server says the record was made from the account. */
      readonly reason: string | null;
    }
  | { readonly decision: 'leave-unlinked'; readonly reason: string };

/** What the server recorded: the record linked or made, or `null` when left unlinked. */
export interface AccountLinkOutcome {
  readonly decision: AccountLinkDecisionKind;
  readonly residentId: ResidentId | null;
}

/** The record fields a correction can move. */
export const LINK_CORRECTED_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'suffix',
  'sex',
  'birthDate',
] as const;
export type LinkCorrectedField = (typeof LINK_CORRECTED_FIELDS)[number];

/** A link made after the account was verified (`DL-260`): the link, and what it corrected. */
export interface LaterLinkOutcome {
  readonly link: AccountLinkOutcome;
  readonly corrected: readonly LinkCorrectedField[];
}

export const ACCOUNT_LINK_LIMITS = {
  reason: 500,
  namePart: 100,
  suffix: 20,
  street: 200,
} as const;

/** What the reviewer has chosen so far, before it is a decision the server can read. */
export interface AccountLinkDraft {
  readonly decision: AccountLinkDecisionKind | null;
  readonly residentId: ResidentId | null;
  readonly reason: string;
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
  readonly suffix: string;
  readonly sex: RegistrySex | null;
  readonly birthDate: string;
  readonly civilStatus: CivilStatus | null;
  readonly streetAddress: string;
  /**
   * For a link: which of the record's fields to correct to the ID (`DL-260`). The name uses the
   * parts above; the sex and the birth date their own values, read off the ID.
   */
  readonly correctName: boolean;
  readonly correctSex: RegistrySex | null;
  readonly correctBirthDate: string;
}

export type AccountLinkProblem =
  | 'choose'
  | 'choose-record'
  | 'record-held'
  | 'reason'
  | 'reason-too-long'
  | 'first-name'
  | 'last-name'
  | 'name-too-long'
  | 'civil-status'
  | 'birth-date'
  | 'street-too-long';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Why the draft is not yet a decision, in the order a reviewer fixes them; empty when it is one.
 * The server holds every rule again — this only keeps a button from sending what it would refuse.
 */
export function accountLinkProblems(
  draft: AccountLinkDraft,
  matches: readonly RegistryMatch[],
): readonly AccountLinkProblem[] {
  const problems: AccountLinkProblem[] = [];
  const reason = draft.reason.trim();
  if (reason.length > ACCOUNT_LINK_LIMITS.reason) {
    problems.push('reason-too-long');
  }
  switch (draft.decision) {
    case null:
      return ['choose'];
    case 'link': {
      const match = matches.find((candidate) => candidate.residentId === draft.residentId);
      if (match === undefined) {
        problems.unshift('choose-record');
      } else if (match.linkedToOtherAccount) {
        problems.unshift('record-held');
      }
      if (reason === '') {
        problems.push('reason');
      }
      if (draft.correctName) {
        if (draft.firstName.trim() === '') problems.push('first-name');
        if (draft.lastName.trim() === '') problems.push('last-name');
        if (namePartsTooLong(draft)) problems.push('name-too-long');
      }
      if (draft.correctBirthDate.trim() !== '' && !ISO_DATE.test(draft.correctBirthDate.trim())) {
        problems.push('birth-date');
      }
      return problems;
    }
    case 'leave-unlinked':
      if (reason === '') {
        problems.push('reason');
      }
      return problems;
    case 'create': {
      if (draft.firstName.trim() === '') problems.push('first-name');
      if (draft.lastName.trim() === '') problems.push('last-name');
      if (namePartsTooLong(draft)) {
        problems.push('name-too-long');
      }
      if (draft.civilStatus === null) problems.push('civil-status');
      if (draft.birthDate.trim() !== '' && !ISO_DATE.test(draft.birthDate.trim())) {
        problems.push('birth-date');
      }
      if (draft.streetAddress.trim().length > ACCOUNT_LINK_LIMITS.street) {
        problems.push('street-too-long');
      }
      return problems;
    }
  }
}

function namePartsTooLong(draft: AccountLinkDraft): boolean {
  const parts = [draft.firstName, draft.middleName, draft.lastName];
  return (
    parts.some((part) => part.trim().length > ACCOUNT_LINK_LIMITS.namePart) ||
    draft.suffix.trim().length > ACCOUNT_LINK_LIMITS.suffix
  );
}

/** What the draft corrects on a linked record, or `undefined` when it corrects nothing. */
function correctionsOf(draft: AccountLinkDraft): AccountLinkCorrections | undefined {
  const optional = (value: string): string | null => (value.trim() === '' ? null : value.trim());
  const birth = draft.correctBirthDate.trim();
  const corrections: AccountLinkCorrections = {
    ...(draft.correctName
      ? {
          name: {
            firstName: draft.firstName.trim(),
            middleName: optional(draft.middleName),
            lastName: draft.lastName.trim(),
            suffix: optional(draft.suffix),
          },
        }
      : {}),
    ...(draft.correctSex === null ? {} : { sex: draft.correctSex }),
    ...(birth === '' ? {} : { birthDate: asIsoDate(birth) }),
  };
  return Object.keys(corrections).length === 0 ? undefined : corrections;
}

/** The draft as a decision, or `null` while `accountLinkProblems` names anything. */
export function toAccountLinkDecision(
  draft: AccountLinkDraft,
  matches: readonly RegistryMatch[],
): AccountLinkDecision | null {
  if (accountLinkProblems(draft, matches).length > 0) {
    return null;
  }
  const reason = draft.reason.trim();
  const optional = (value: string): string | null => (value.trim() === '' ? null : value.trim());
  switch (draft.decision) {
    case 'link': {
      if (draft.residentId === null) {
        return null;
      }
      const corrections = correctionsOf(draft);
      return corrections === undefined
        ? { decision: 'link', residentId: draft.residentId, reason }
        : { decision: 'link', residentId: draft.residentId, reason, corrections };
    }
    case 'leave-unlinked':
      return { decision: 'leave-unlinked', reason };
    case 'create':
      return draft.civilStatus === null
        ? null
        : {
            decision: 'create',
            record: {
              firstName: draft.firstName.trim(),
              middleName: optional(draft.middleName),
              lastName: draft.lastName.trim(),
              suffix: optional(draft.suffix),
              sex: draft.sex,
              birthDate: draft.birthDate.trim() === '' ? null : asIsoDate(draft.birthDate.trim()),
              civilStatus: draft.civilStatus,
              streetAddress: optional(draft.streetAddress),
            },
            reason: reason === '' ? null : reason,
          };
    case null:
      return null;
  }
}

/** An empty draft, its name parts started from the verified name (the last word as the surname). */
export function startAccountLinkDraft(verifiedName: string): AccountLinkDraft {
  const words = verifiedName
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  const lastName = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  const firstName = words.length > 1 ? words.slice(0, -1).join(' ') : (words[0] ?? '');
  return {
    decision: null,
    residentId: null,
    reason: '',
    firstName,
    middleName: '',
    lastName,
    suffix: '',
    sex: null,
    birthDate: '',
    civilStatus: null,
    streetAddress: '',
    correctName: false,
    correctSex: null,
    correctBirthDate: '',
  };
}
