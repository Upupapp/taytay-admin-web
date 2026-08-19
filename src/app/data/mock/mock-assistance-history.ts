import {
  byMostRecent,
  isTerminalAssistanceStatus,
  sumMoney,
  ZERO_PESOS,
  type Money,
  type ProgramId,
  type ResidentAssistanceHistory,
  type ResidentCaseSummary,
  type ResidentId,
  type ResidentPayoutSummary,
  type ResidentReferralSummary,
} from '@domain/index';

import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/releases.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MOCK_REFERRALS } from './seed/referrals.seed';

/**
 * Everything the office has done for one person, gathered in one pass.
 *
 * Extracted from the resident adapter in TAB 13, when the beneficiary registry
 * needed the same picture. It is deliberately **one implementation** rather than
 * two: a resident page and a beneficiary page that assemble the same history
 * separately will eventually disagree about what a family received, and the
 * disagreement will surface in front of the family.
 *
 * Note what is *not* gated here: the history is a fact about the subject, and
 * the caller has already been cleared to read the subject. Gating it again on
 * `request.view` would give a disbursing officer a page that silently omits the
 * cases their own payouts belong to.
 */
export function historySummaryFor(residentId: ResidentId): ResidentAssistanceHistory {
  const requests = MOCK_ASSISTANCE_REQUESTS.filter((request) => request.residentId === residentId);
  const requestIds = new Set(requests.map((request) => request.id));

  const cases: readonly ResidentCaseSummary[] = requests
    .map((request) => ({
      id: request.id,
      referenceNumber: request.referenceNumber,
      programId: request.programId,
      programName: programName(request.programId),
      status: request.status,
      requestedAmount: request.requestedAmount,
      approvedAmount: request.approvedAmount,
      submittedAt: request.submittedAt,
      updatedAt: request.audit.updatedAt,
    }))
    .sort((a, b) => byMostRecent(a.updatedAt, b.updatedAt));

  const payouts: readonly ResidentPayoutSummary[] = MOCK_DISBURSEMENTS.filter(
    (release) =>
      release.residentId === residentId || requestIds.has(release.requestId),
  )
    .map((release) => ({
      id: release.id,
      requestId: release.requestId,
      referenceNumber: release.referenceNumber,
      status: release.status,
      method: release.method,
      amount: release.amount,
      scheduledFor: release.scheduledFor,
      releasedAt: release.releasedAt,
    }))
    .sort((a, b) => byMostRecent(a.releasedAt, b.releasedAt));

  const referrals: readonly ResidentReferralSummary[] = MOCK_REFERRALS.filter(
    (referral) => referral.residentId === residentId,
  )
    .map((referral) => ({
      id: referral.id,
      referenceNumber: referral.referenceNumber,
      destination: referral.destination,
      destinationName: referral.destinationName,
      status: referral.status,
      referredAt: referral.referredAt,
      respondedAt: referral.respondedAt,
    }))
    .sort((a, b) => byMostRecent(a.referredAt, b.referredAt));

  // Released or claimed, *and* carrying an amount. What was scheduled, went
  // unclaimed or was voided never reached the family. An in-kind release reached
  // the family but contributes no peso figure — inventing one would put a
  // number nobody counted into every total downstream (`DL-93`).
  const handedOver = payouts.filter(
    (payout) =>
      (payout.status === 'released' ||
        payout.status === 'claimed' ||
        payout.status === 'completed') &&
      payout.amount !== null,
  );

  return {
    cases,
    payouts,
    referrals,
    totalReleased:
      handedOver.length > 0
        ? sumMoney(handedOver.map((payout) => payout.amount as Money))
        : ZERO_PESOS,
    openCaseCount: cases.filter((entry) => !isTerminalAssistanceStatus(entry.status)).length,
    lastActivityAt: cases[0]?.updatedAt ?? null,
  };
}

function programName(programId: ProgramId): string {
  return MOCK_PROGRAMS.find((program) => program.id === programId)?.name ?? 'Unknown programme';
}
