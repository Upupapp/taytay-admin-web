import type { StatusCatalog, StatusTransitions } from '../shared/status';
import type {
  AppAccountId,
  BarangayId,
  IsoDate,
  IsoDateTime,
  MediaId,
  ResidentId,
  SectorApplicationId,
} from '../shared/ids';

/**
 * A resident's application, from the residents' app, to be recorded in a sector (`DL-215`), read
 * from `office/sector-applications` (`resident.update`, because approving records a sector).
 *
 * **The office decides; the app only asks.** Approving records the sector on the registry record
 * through the registry's own act, with a reason kept in its history; returning writes nothing to the
 * registry and tells the resident why. A decided application is not decided again.
 *
 * **An account is not a registry record** (`DL-164`). If the office has not linked the applicant's
 * account to a record before, approving makes that link — an identity finding, made once, with its
 * own reason. The candidates the API suggests are suggestions, never a link.
 */
export interface SectorApplication {
  readonly id: SectorApplicationId;
  readonly sector: ApplicationSector;
  readonly status: SectorApplicationStatus;
  readonly submittedAt: IsoDateTime;
  readonly decidedAt: IsoDateTime | null;
  readonly decidedBy: string | null;
  /** The reason the resident reads, once returned. */
  readonly returnReason: string | null;
  /** The registry record the account is linked to, once linked. */
  readonly residentId: ResidentId | null;
  readonly proofCount: number;
  readonly applicant: SectorApplicant;
}

export interface SectorApplicant {
  readonly account: AppAccountId;
  /** As the account names itself; `null` when it names nobody. */
  readonly name: string | null;
  readonly barangayName: string | null;
}

export interface SectorApplicationDetail extends SectorApplication {
  /** Each read as bytes through the data layer, after `proofWarning` is shown. */
  readonly proofs: readonly MediaId[];
  /** The API's own warning, shown before any proof is opened. */
  readonly proofWarning: string;
  readonly linkedResident: ApplicantRecord | null;
  /** Records the API suggests: a suggestion, never a link. Empty once linked. */
  readonly candidates: readonly ApplicantRecord[];
  /** Whether this reader may record the card's details (`resident.view-sensitive`). */
  readonly detailsWritable: boolean;
}

/**
 * A registry record as the API lists it for this reader. Its birth date is not read: every
 * candidate shares the account's, which is how it was suggested (`DL-73`).
 */
export interface ApplicantRecord {
  readonly residentId: ResidentId;
  readonly name: string;
  readonly barangayId: BarangayId | null;
}

/** The three sectors a resident may apply for in the app; never a protected one. */
export const APPLICATION_SECTORS = ['senior-citizen', 'pwd', 'solo-parent'] as const;
export type ApplicationSector = (typeof APPLICATION_SECTORS)[number];

export const SECTOR_APPLICATION_STATUSES = ['pending', 'approved', 'returned'] as const;
export type SectorApplicationStatus = (typeof SECTOR_APPLICATION_STATUSES)[number];

export const SECTOR_APPLICATION_STATUS_CATALOG: StatusCatalog<SectorApplicationStatus> = {
  pending: {
    value: 'pending',
    label: 'Waiting',
    tone: 'warning',
    description: 'Sent from the app and not yet decided.',
  },
  approved: {
    value: 'approved',
    label: 'Approved',
    tone: 'success',
    description: 'The sector is recorded on the registry record.',
  },
  returned: {
    value: 'returned',
    label: 'Returned',
    tone: 'neutral',
    description: 'Sent back to the resident with a reason; nothing recorded.',
  },
};

/** The API's moves: a pending application is approved or returned, once. */
export const SECTOR_APPLICATION_STATUS_TRANSITIONS: StatusTransitions<SectorApplicationStatus> = {
  pending: ['approved', 'returned'],
  approved: [],
  returned: [],
};

/**
 * What approving sends. `link` is required when the account is not yet linked to a record; the
 * card's details are optional and need `detailsWritable`. **Only the last four characters of a card
 * number are taken** (`DL-183`): the API keeps no more, so this console asks for no more.
 */
export interface SectorApproval {
  readonly reason: string;
  readonly link?: { readonly residentId: ResidentId; readonly reason: string };
  readonly details?: SectorCardDetails;
}

export interface SectorCardDetails {
  readonly idLastFour?: string;
  readonly issuedOn?: IsoDate;
  readonly validUntil?: IsoDate;
  /** Senior citizens only. */
  readonly socialPension?: boolean;
  /** Persons with disability only. */
  readonly disabilityType?: string;
}

export const SECTOR_REASON_MAX_LENGTH = 500;
export const CARD_NUMBER_KEPT = 4;
export const DISABILITY_TYPE_MAX_LENGTH = 80;

/** A card's last four characters as the API accepts them: letters, digits, space, slash, hyphen. */
export function isCardLastFour(value: string): boolean {
  return /^[A-Za-z0-9 /-]{1,4}$/.test(value);
}

/** What each decision does, read from the API's handlers and said before the button that does it. */
export const SECTOR_APPLICATION_EFFECTS = {
  approve: [
    'The sector is recorded on the registry record, with your reason kept in its history.',
    'The resident is told in the app that the application was approved. Nothing is pushed to their phone.',
    'The decision is recorded in the audit trail under your name. It cannot be decided again.',
  ],
  link: [
    'This account is linked to the record you choose, for good: the link is never moved, and a record already linked to another account is refused.',
  ],
  return: [
    'Nothing is recorded in the registry.',
    'The resident reads your reason in the app, which tells them the application was returned.',
    'The decision is recorded in the audit trail under your name. It cannot be decided again.',
  ],
} as const;
