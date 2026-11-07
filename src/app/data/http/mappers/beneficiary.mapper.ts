import {
  ASSISTANCE_STATUS_CATALOG,
  BENEFICIARY_ROLES,
  DUPLICATE_STRENGTH_LABELS,
  MATCH_ATTRIBUTE_LABELS,
  MATCH_OUTCOME_LABELS,
  PAYOUT_METHOD_LABELS,
  REFERRAL_DESTINATIONS,
  REFERRAL_STATUS_CATALOG,
  RELEASE_STATUS_CATALOG,
  centavos,
  type AssistanceHistoryReading,
  type AssistanceRequestId,
  type AssistanceRequestStatus,
  type BeneficiaryRole,
  type BeneficiaryStanding,
  type BeneficiarySummary,
  type DuplicateCandidate,
  type DuplicatePairId,
  type DuplicateStrength,
  type HouseholdId,
  type IdentityResolution,
  type IdentityResolutionDraft,
  type IdentityResolutionId,
  type MatchAttribute,
  type MatchOutcome,
  type MatchSignal,
  type MergePreview,
  type PayoutMethod,
  type ProgramId,
  type ProgramUtilization,
  type ProgramUtilizationReading,
  type ProgramUtilizationSummary,
  type ReferralId,
  type ReferralStatus,
  type ReleaseId,
  type ReleaseStatus,
  type ResidentAssistanceHistory,
  type ResidentCaseSummary,
  type ResidentId,
  type ResidentPayoutSummary,
  type ResidentReferralSummary,
  type ResidentView,
  type StaffUserId,
} from '@domain/index';

import { toResidentView, type BarangayIndex } from './resident.mapper';
import { bool, date, dateTime, field, id, int, oneOf, str } from './wire';

/**
 * The beneficiary registry, a resident's assistance history and programme utilization, from the
 * Node API (`DL-187`).
 *
 * | Wire                                          | Domain                                   | Absent or wrong means      |
 * | --------------------------------------------- | ---------------------------------------- | -------------------------- |
 * | `history{requests,releases,referrals,…}`      | `ResidentAssistanceHistory`              | the whole history refused  |
 * | `readable: false` + `because`                 | `{ kind: 'unavailable', because }`       | the reading refused        |
 * | `standing{roles,evidence}`                    | `BeneficiaryStanding`, the server's      | the row dropped            |
 * | `current_program_names` / `enrollments` null  | `null` — membership not recorded         | kept `null`, never `[]`    |
 * | `released_centavos`, `goods_received_count`  | `totalReleased` (`Money`), a goods count | the row dropped            |
 * | `signals[]{attribute,outcome,rule}`           | `MatchSignal[]` — never a value          | the candidate dropped      |
 *
 * **A history is whole or not at all.** A line left out reads as something the office never did
 * — a payout missing from a family's history is the `DL-112` failure in front of the family — so
 * one unreadable line refuses the history, and the screen says it could not be read.
 *
 * **The standing is the server's.** It is derived there, on read, from the same records (`DL-71`);
 * deriving it again here would be a second derivation that could disagree with the first.
 *
 * Money arrives as integer centavos and stays integer centavos; goods arrive as a count and are
 * never given a value (`DL-93`).
 */

const REQUEST_STATUSES: readonly AssistanceRequestStatus[] = Object.values(
  ASSISTANCE_STATUS_CATALOG,
).map((entry) => entry.value);
const RELEASE_STATUSES: readonly ReleaseStatus[] = Object.values(RELEASE_STATUS_CATALOG).map(
  (entry) => entry.value,
);
const REFERRAL_STATUSES: readonly ReferralStatus[] = Object.values(REFERRAL_STATUS_CATALOG).map(
  (entry) => entry.value,
);
const METHODS = Object.keys(PAYOUT_METHOD_LABELS) as readonly PayoutMethod[];
const ATTRIBUTES = Object.keys(MATCH_ATTRIBUTE_LABELS) as readonly MatchAttribute[];
const OUTCOMES = Object.keys(MATCH_OUTCOME_LABELS) as readonly MatchOutcome[];
const STRENGTHS = Object.keys(DUPLICATE_STRENGTH_LABELS) as readonly DuplicateStrength[];

/** Every element mapped, or `null` when any one could not be: a list that must be whole. */
function whole<T>(value: unknown, map: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(map);
  return items.every((item): item is T => item !== null) ? items : null;
}

/** An amount that may be absent: `null` stays `null`; anything else must be whole centavos. */
function optionalAmount(value: unknown): {
  readonly ok: boolean;
  readonly amount: ReturnType<typeof centavos> | null;
} {
  if (value === null) {
    return { ok: true, amount: null };
  }
  const amount = int(value);
  return amount === null || amount < 0
    ? { ok: false, amount: null }
    : { ok: true, amount: centavos(amount) };
}

function toCaseLine(wire: unknown): ResidentCaseSummary | null {
  const requestId = id<AssistanceRequestId>(field(wire, 'id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const programId = id<ProgramId>(field(wire, 'program_id'));
  const programName = str(field(wire, 'program_name'));
  const status = oneOf(field(wire, 'status'), REQUEST_STATUSES);
  const requested = optionalAmount(field(wire, 'requested_amount_centavos'));
  const approved = optionalAmount(field(wire, 'approved_amount_centavos'));
  const submittedAt = dateTime(field(wire, 'submitted_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  if (
    requestId === null ||
    referenceNumber === null ||
    programId === null ||
    programName === null ||
    status === null ||
    !requested.ok ||
    !approved.ok ||
    submittedAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  return {
    id: requestId,
    referenceNumber,
    programId,
    programName,
    status,
    requestedAmount: requested.amount,
    approvedAmount: approved.amount,
    submittedAt,
    updatedAt,
  };
}

function toPayoutLine(wire: unknown): ResidentPayoutSummary | null {
  const releaseId = id<ReleaseId>(field(wire, 'id'));
  const requestId = id<AssistanceRequestId>(field(wire, 'request_id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const status = oneOf(field(wire, 'status'), RELEASE_STATUSES);
  const method = oneOf(field(wire, 'method'), METHODS);
  const kind = oneOf(field(wire, 'kind'), ['money', 'in-kind'] as const);
  const amount = optionalAmount(field(wire, 'amount_centavos'));
  const scheduledRaw = field(wire, 'scheduled_for');
  const releasedRaw = field(wire, 'released_at');
  const scheduledFor = scheduledRaw === null ? null : date(scheduledRaw);
  const releasedAt = releasedRaw === null ? null : dateTime(releasedRaw);
  if (
    releaseId === null ||
    requestId === null ||
    referenceNumber === null ||
    status === null ||
    method === null ||
    kind === null ||
    !amount.ok ||
    // Goods carry no amount and money always does: anything else would value a sack of rice (DL-93).
    (kind === 'money') !== (amount.amount !== null) ||
    (scheduledRaw !== null && scheduledFor === null) ||
    (releasedRaw !== null && releasedAt === null)
  ) {
    return null;
  }
  return {
    id: releaseId,
    requestId,
    referenceNumber,
    status,
    method,
    amount: amount.amount,
    scheduledFor,
    releasedAt,
  };
}

function toReferralLine(wire: unknown): ResidentReferralSummary | null {
  const referralId = id<ReferralId>(field(wire, 'id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const destination = oneOf(field(wire, 'destination'), REFERRAL_DESTINATIONS);
  const destinationName = str(field(wire, 'destination_name'));
  const status = oneOf(field(wire, 'status'), REFERRAL_STATUSES);
  const referredAt = dateTime(field(wire, 'referred_at'));
  const respondedRaw = field(wire, 'responded_at');
  const respondedAt = respondedRaw === null ? null : dateTime(respondedRaw);
  if (
    referralId === null ||
    referenceNumber === null ||
    destination === null ||
    destinationName === null ||
    status === null ||
    referredAt === null ||
    (respondedRaw !== null && respondedAt === null)
  ) {
    return null;
  }
  return {
    id: referralId,
    referenceNumber,
    destination,
    destinationName,
    status,
    referredAt,
    respondedAt,
  };
}

/** The one assembly, as the server sent it. `null` when any part of it could not be read. */
export function toAssistanceHistory(wire: unknown): ResidentAssistanceHistory | null {
  const cases = whole(field(wire, 'requests'), toCaseLine);
  const payouts = whole(field(wire, 'releases'), toPayoutLine);
  const referrals = whole(field(wire, 'referrals'), toReferralLine);
  const released = int(field(wire, 'released_centavos'));
  const goods = int(field(wire, 'goods_received_count'));
  const open = int(field(wire, 'open_request_count'));
  const lastRaw = field(wire, 'last_activity_at');
  const lastActivityAt = lastRaw === null ? null : dateTime(lastRaw);
  if (
    cases === null ||
    payouts === null ||
    referrals === null ||
    released === null ||
    released < 0 ||
    goods === null ||
    open === null ||
    (lastRaw !== null && lastActivityAt === null)
  ) {
    return null;
  }
  return {
    cases,
    payouts,
    referrals,
    totalReleased: centavos(released),
    goodsReceivedCount: goods,
    openCaseCount: open,
    lastActivityAt,
  };
}

/**
 * A resident's history, or the server's sentence saying why this reader is not shown it. Never an
 * empty history in place of either.
 *
 * @consumes GET office/residents/{id}/assistance-history
 */
export function toAssistanceHistoryReading(wire: unknown): AssistanceHistoryReading | null {
  const readable = field(wire, 'readable');
  if (readable === false) {
    const because = str(field(wire, 'because'));
    return because === null ? null : { kind: 'unavailable', because };
  }
  if (readable !== true) {
    return null;
  }
  const history = toAssistanceHistory(wire);
  return history === null ? null : { kind: 'read', history };
}

function toStanding(wire: unknown): BeneficiaryStanding | null {
  const roles = whole(field(wire, 'roles'), (role) => oneOf(role, BENEFICIARY_ROLES));
  const evidence = field(wire, 'evidence');
  const open = int(field(evidence, 'open_request_count'));
  const settled = int(field(evidence, 'settled_request_count'));
  const received = int(field(evidence, 'received_release_count'));
  const currentRaw = field(evidence, 'current_enrollment_count');
  const pastRaw = field(evidence, 'past_enrollment_count');
  const current = currentRaw === null ? null : int(currentRaw);
  const past = pastRaw === null ? null : int(pastRaw);
  if (
    roles === null ||
    !roles.includes('constituent') ||
    open === null ||
    settled === null ||
    received === null ||
    (currentRaw !== null && current === null) ||
    (pastRaw !== null && past === null)
  ) {
    return null;
  }
  // In the domain's order, whatever order they travelled in.
  const held: readonly BeneficiaryRole[] = BENEFICIARY_ROLES.filter((role) => roles.includes(role));
  return {
    roles: held,
    evidence: {
      openRequestCount: open,
      settledRequestCount: settled,
      receivedReleaseCount: received,
      currentEnrollmentCount: current,
      pastEnrollmentCount: past,
    },
  };
}

/** `null` stays `null` — programme membership not recorded — and is never turned into `[]`. */
function programNames(value: unknown): {
  readonly ok: boolean;
  readonly names: readonly string[] | null;
} {
  if (value === null) {
    return { ok: true, names: null };
  }
  const names = whole(value, str);
  return names === null ? { ok: false, names: null } : { ok: true, names };
}

/**
 * One row of the registry.
 *
 * @consumes GET office/beneficiaries
 */
export function toBeneficiarySummary(
  wire: unknown,
  barangays: BarangayIndex,
): BeneficiarySummary | null {
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const resident = toResidentView(field(wire, 'resident'), barangays);
  const householdRaw = field(wire, 'household_id');
  const householdId = householdRaw === null ? null : id<HouseholdId>(householdRaw);
  const barangayId = barangays.toConsole(str(field(wire, 'barangay_id')));
  const standing = toStanding(field(wire, 'standing'));
  const programmes = programNames(field(wire, 'current_program_names'));
  const events = int(field(wire, 'assistance_event_count'));
  const lastRaw = field(wire, 'last_assistance_at');
  const lastAssistanceAt = lastRaw === null ? null : dateTime(lastRaw);
  const released = int(field(wire, 'released_centavos'));
  const goods = int(field(wire, 'goods_received_count'));
  const open = int(field(wire, 'open_request_count'));
  if (
    residentId === null ||
    resident === null ||
    (householdRaw !== null && householdId === null) ||
    barangayId === null ||
    standing === null ||
    !programmes.ok ||
    events === null ||
    (lastRaw !== null && lastAssistanceAt === null) ||
    released === null ||
    released < 0 ||
    goods === null ||
    open === null
  ) {
    return null;
  }
  return {
    residentId,
    resident,
    householdId,
    barangayId,
    standing,
    currentProgramNames: programmes.names,
    assistanceEventCount: events,
    lastAssistanceAt,
    totalReleased: centavos(released),
    goodsReceivedCount: goods,
    openCaseCount: open,
    hasOpenDuplicateReview: bool(field(wire, 'has_open_duplicate_review')),
  };
}

/** What the server says about one person; the adapter joins the household and families to it. */
export interface BeneficiaryRecordParts {
  readonly residentId: ResidentId;
  readonly resident: ResidentView;
  readonly householdId: HouseholdId | null;
  readonly standing: BeneficiaryStanding;
  readonly history: ResidentAssistanceHistory;
  readonly duplicateCandidates: readonly DuplicateCandidate[];
}

/**
 * One person's record, less what other routes already answer — the household and the families,
 * which the adapter reads from their own registers so their redaction stays theirs.
 *
 * `enrollments` arrives `null`: programme membership is not recorded by the API, and the adapter
 * keeps it `null` (`DL-187`). A candidate that cannot be read refuses the record: a reviewer shown
 * one of two candidates would clear the queue believing it held one.
 *
 * @consumes GET office/beneficiaries/{residentId}
 */
export function toBeneficiaryRecordParts(
  wire: unknown,
  barangays: BarangayIndex,
): BeneficiaryRecordParts | null {
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const resident = toResidentView(field(wire, 'resident'), barangays);
  const householdRaw = field(wire, 'household_id');
  const householdId = householdRaw === null ? null : id<HouseholdId>(householdRaw);
  const standing = toStanding(field(wire, 'standing'));
  const history = toAssistanceHistory(field(wire, 'history'));
  const candidates = whole(field(wire, 'duplicate_candidates'), toDuplicateCandidate);
  if (
    residentId === null ||
    resident === null ||
    (householdRaw !== null && householdId === null) ||
    standing === null ||
    history === null ||
    candidates === null
  ) {
    return null;
  }
  return { residentId, resident, householdId, standing, history, duplicateCandidates: candidates };
}

function toSignal(wire: unknown): MatchSignal | null {
  const attribute = oneOf(field(wire, 'attribute'), ATTRIBUTES);
  const outcome = oneOf(field(wire, 'outcome'), OUTCOMES);
  const rule = str(field(wire, 'rule'));
  // An attribute, an outcome and a rule, and nothing else is read: a value is never carried (DL-73).
  return attribute === null || outcome === null || rule === null
    ? null
    : { attribute, outcome, rule };
}

/**
 * A pair the office is holding, turned towards `resident_id`.
 *
 * @consumes GET office/duplicate-pairs
 * @consumes GET office/beneficiaries/{residentId}/duplicates
 */
export function toDuplicateCandidate(wire: unknown): DuplicateCandidate | null {
  const pairId = id<DuplicatePairId>(field(wire, 'pair_id'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const otherResidentId = id<ResidentId>(field(wire, 'other_resident_id'));
  const residentLabel = str(field(wire, 'resident_label'));
  const otherLabel = str(field(wire, 'other_label'));
  const strength = oneOf(field(wire, 'strength'), STRENGTHS);
  const signals = whole(field(wire, 'signals'), toSignal);
  if (
    pairId === null ||
    residentId === null ||
    otherResidentId === null ||
    residentLabel === null ||
    otherLabel === null ||
    strength === null ||
    signals === null
  ) {
    return null;
  }
  return {
    pairId,
    residentId,
    otherResidentId,
    residentLabel,
    otherLabel,
    strength,
    signals,
    holdsSensitiveRecord: bool(field(wire, 'holds_sensitive_record')),
  };
}

/**
 * A finding. `pair` is the two records in the order the API holds them, lower first.
 *
 * @consumes GET office/beneficiaries/{residentId}/findings
 * @consumes POST office/duplicate-pairs/{id}/decide
 */
export function toIdentityResolution(wire: unknown): IdentityResolution | null {
  const findingId = id<IdentityResolutionId>(field(wire, 'id'));
  const verdict = oneOf(field(wire, 'verdict'), ['same-person', 'distinct-people'] as const);
  const canonicalRaw = field(wire, 'canonical_resident_id');
  const supersededRaw = field(wire, 'superseded_resident_id');
  const canonical = canonicalRaw === null ? null : id<ResidentId>(canonicalRaw);
  const superseded = supersededRaw === null ? null : id<ResidentId>(supersededRaw);
  const pair = whole(field(wire, 'pair'), (entry) => id<ResidentId>(entry));
  const reason = str(field(wire, 'reason'));
  const decidedBy = id<StaffUserId>(field(wire, 'decided_by'));
  const decidedAt = dateTime(field(wire, 'decided_at'));
  const [first, second] = pair ?? [];
  if (
    findingId === null ||
    verdict === null ||
    (canonicalRaw !== null && canonical === null) ||
    (supersededRaw !== null && superseded === null) ||
    first === undefined ||
    second === undefined ||
    reason === null ||
    decidedBy === null ||
    decidedAt === null
  ) {
    return null;
  }
  return {
    id: findingId,
    verdict,
    canonicalResidentId: canonical,
    supersededResidentId: superseded,
    pair: [first, second],
    reason,
    decidedBy,
    decidedAt,
  };
}

/**
 * What a `same-person` finding would leave attached to the record it supersedes, to be read under
 * the record kept. `moving_enrollment_count` is `null`: membership is not recorded.
 *
 * @consumes GET office/duplicate-pairs/{id}/preview
 */
export function toMergePreview(wire: unknown): MergePreview | null {
  const canonicalResidentId = id<ResidentId>(field(wire, 'canonical_resident_id'));
  const supersededResidentId = id<ResidentId>(field(wire, 'superseded_resident_id'));
  const requests = int(field(wire, 'moving_request_count'));
  const releases = int(field(wire, 'moving_release_count'));
  const cases = int(field(wire, 'moving_case_count'));
  const enrollmentsRaw = field(wire, 'moving_enrollment_count');
  const enrollments = enrollmentsRaw === null ? null : int(enrollmentsRaw);
  const overlapping = whole(field(wire, 'overlapping_program_names'), str);
  if (
    canonicalResidentId === null ||
    supersededResidentId === null ||
    requests === null ||
    releases === null ||
    cases === null ||
    (enrollmentsRaw !== null && enrollments === null) ||
    overlapping === null
  ) {
    return null;
  }
  return {
    canonicalResidentId,
    supersededResidentId,
    movingRequestCount: requests,
    movingReleaseCount: releases,
    movingCaseCount: cases,
    movingEnrollmentCount: enrollments,
    overlappingProgramNames: overlapping,
  };
}

/** What `POST office/duplicate-pairs/{id}/decide` reads, and nothing else: the body is strict. */
export interface IdentityDecisionWire {
  readonly verdict: 'same-person' | 'distinct-people';
  readonly canonical_resident_id: string | null;
  readonly reason: string;
}

/**
 * The finding as the API reads it. The domain's `distinct-people` travels as it is: this API was
 * written to the console's word (`DL-74`), so the translation `DL-148` carried for the retired one
 * is gone. Who decided and when are the server's to record.
 */
export function toWireIdentityDecision(draft: IdentityResolutionDraft): IdentityDecisionWire {
  return {
    verdict: draft.verdict,
    canonical_resident_id: draft.verdict === 'same-person' ? draft.canonicalResidentId : null,
    reason: draft.reason.trim(),
  };
}

/**
 * How many pairs are open after a detection run.
 *
 * @consumes POST office/duplicate-pairs/detect
 */
export function toOpenPairCount(wire: unknown): number | null {
  const open = int(field(wire, 'open_pairs'));
  return open === null || open < 0 ? null : open;
}

function toUtilization(wire: unknown): ProgramUtilization | null {
  const programId = id<ProgramId>(field(wire, 'program_id'));
  const withheld = field(wire, 'withheld');
  const releaseCount = int(field(wire, 'release_count'));
  const released = int(field(wire, 'released_centavos'));
  const goodsCount = int(field(wire, 'goods_count'));
  if (programId === null || typeof withheld !== 'boolean') {
    return null;
  }
  if (withheld) {
    // A withheld cell keeps its programme and nulls its numbers: never a zero (DL-105).
    return {
      programId,
      releaseCount: null,
      releasedTotal: null,
      goodsCount: null,
      isWithheld: true,
    };
  }
  if (releaseCount === null || released === null || released < 0 || goodsCount === null) {
    return null;
  }
  return {
    programId,
    releaseCount,
    releasedTotal: centavos(released),
    goodsCount,
    isWithheld: false,
  };
}

/**
 * Every programme's utilization, or the server's sentence. Whole or not at all: a programme missing
 * from the summary would read as one nobody used.
 *
 * @consumes GET office/program-utilization
 */
export function toProgramUtilizationSummary(wire: unknown): ProgramUtilizationSummary | null {
  const readable = field(wire, 'readable');
  if (readable === false) {
    const because = str(field(wire, 'because'));
    return because === null ? null : { kind: 'unavailable', because };
  }
  const rows = readable === true ? whole(field(wire, 'rows'), toUtilization) : null;
  return rows === null ? null : { kind: 'read', rows };
}

/**
 * One programme's utilization, or the server's sentence.
 *
 * @consumes GET office/program-utilization/{programId}
 */
export function toProgramUtilizationReading(wire: unknown): ProgramUtilizationReading | null {
  const readable = field(wire, 'readable');
  if (readable === false) {
    const because = str(field(wire, 'because'));
    return because === null ? null : { kind: 'unavailable', because };
  }
  const utilization = readable === true ? toUtilization(field(wire, 'utilization')) : null;
  return utilization === null ? null : { kind: 'read', utilization };
}
