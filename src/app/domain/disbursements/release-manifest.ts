import type { ResidentView } from '../residents/resident-disclosure';
import type { IsoDate, IsoDateTime, StaffUserId } from '../shared/ids';
import type { Money } from '../shared/money';
import type { Disbursement, ReleaseKind } from './disbursement';
import { RELEASE_KIND_LABELS } from './disbursement';

/**
 * The payout list carried to the table.
 *
 * A manifest is printed, taken out of the office and handled by whoever is at
 * the venue — sometimes a barangay hall with no lockable drawer. So it carries
 * the minimum a releasing officer needs to hand the right thing to the right
 * person, and nothing else (`DL-92`).
 *
 * What it deliberately omits: birth dates, addresses, sector membership,
 * PhilSys digits, the reason for the assistance. None of those help anybody at
 * a payout table, and a sheet listing which of your neighbours is a VAWC
 * survivor is a disclosure the office cannot recall once it is on a clipboard.
 *
 * The reference number is masked to its tail for the same reason a document
 * number is (`DL-77`): enough to match the voucher in hand, not enough to
 * reconstruct the series.
 */

export interface ManifestLine {
  /** Row number on the printed sheet, so a table can call people in order. */
  readonly position: number;
  /** `Surname, Given` — already disclosed for the composing user (`DL-38`). */
  readonly beneficiaryName: string;
  readonly maskedReference: string;
  readonly kind: ReleaseKind;
  /** The peso figure for a money release; `null` for goods. */
  readonly amount: Money | null;
  /** What the goods are, for an in-kind release. */
  readonly goods: string | null;
  readonly method: string;
  /** Space for the signature or thumbmark. Never pre-filled. */
  readonly acknowledgementKind: string | null;
}

export interface ReleaseManifest {
  readonly batchReference: string;
  readonly title: string;
  readonly scheduledFor: IsoDate;
  readonly venue: string;
  readonly officerName: string;
  readonly lines: readonly ManifestLine[];
  readonly moneyLineCount: number;
  readonly inKindLineCount: number;
  /** Total of the money lines only. Goods are counted, never valued. */
  readonly moneyTotal: Money;
  readonly preparedAt: IsoDateTime;
  readonly handlingNotice: string;
}

export const MANIFEST_NOTICE =
  'This list contains personal information protected under RA 10173. Keep it with the releasing ' +
  'officer, do not photograph or copy it, and return it to the MSWDO when the payout closes.';

/**
 * Masks a voucher reference to its last four characters.
 *
 * Same rule as a document number: enough to match what is in somebody's hand,
 * not enough to reconstruct the series and guess at other people's vouchers.
 */
export function maskReference(reference: string): string {
  const trimmed = reference.trim();
  return trimmed.length <= 4 ? '•'.repeat(trimmed.length) : `••••${trimmed.slice(-4)}`;
}

export interface ManifestInput {
  readonly batchReference: string;
  readonly title: string;
  readonly scheduledFor: IsoDate;
  readonly venue: string;
  readonly officerName: string;
  readonly preparedAt: IsoDateTime;
  /** Each release with the beneficiary as the composing user may see them. */
  readonly entries: readonly { release: Disbursement; beneficiary: ResidentView }[];
}

/**
 * Builds the manifest.
 *
 * Composed rather than laid out, for the reason the referral summary is
 * (`DL-82`): a template with the full records in scope is one binding away from
 * printing a birth date onto a sheet that leaves the building.
 */
export function composeManifest(input: ManifestInput): ReleaseManifest {
  const lines: ManifestLine[] = input.entries.map((entry, index) => ({
    position: index + 1,
    beneficiaryName: entry.beneficiary.listedName,
    maskedReference: maskReference(entry.release.referenceNumber),
    kind: entry.release.kind,
    amount: entry.release.amount,
    goods: entry.release.inKindDescription,
    method: entry.release.method,
    // Left blank on purpose. Pre-filling how somebody will acknowledge is how a
    // sheet comes back signed for a person who was never there.
    acknowledgementKind: null,
  }));

  const moneyLines = lines.filter((line) => line.kind === 'money');

  return {
    batchReference: input.batchReference,
    title: input.title,
    scheduledFor: input.scheduledFor,
    venue: input.venue,
    officerName: input.officerName,
    lines,
    moneyLineCount: moneyLines.length,
    inKindLineCount: lines.length - moneyLines.length,
    // Goods are counted, never valued: a peso total that silently included an
    // invented figure for rice would be wrong in a way nobody could see.
    moneyTotal: moneyLines.reduce<Money>(
      (total, line) => ({
        centavos: total.centavos + (line.amount?.centavos ?? 0),
        currency: 'PHP',
      }),
      { centavos: 0, currency: 'PHP' },
    ),
    preparedAt: input.preparedAt,
    handlingNotice: MANIFEST_NOTICE,
  };
}

export function describeKind(kind: ReleaseKind): string {
  return RELEASE_KIND_LABELS[kind];
}

/* ── Segregation of duties ────────────────────────────────────────────────── */

/**
 * Whether the person about to release also approved the request behind it.
 *
 * `DL-08` keeps approval and release in different roles, and
 * `permission.spec.ts` asserts no role holds both. This is the second half:
 * even where the *permissions* are separated, a system administrator or a
 * misconfigured account could still be the same human on both sides, and the
 * screen should say so before the money moves.
 *
 * It returns a warning rather than a refusal. A small office on a bad day may
 * genuinely have one person available, and blocking the payout punishes the
 * family for the office's staffing. Naming it puts the fact in the record.
 */
export function isSelfRelease(
  approvedBy: StaffUserId | null,
  releasingOfficer: StaffUserId,
): boolean {
  return approvedBy !== null && approvedBy === releasingOfficer;
}

export const SELF_RELEASE_WARNING =
  'You approved this request. Releasing it yourself means one person did both, which the office ' +
  'normally separates. Ask another officer to release it if one is available.';
