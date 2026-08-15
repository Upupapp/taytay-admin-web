import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import { isTerminalAssistanceStatus } from '../assistance/assistance-request';
import type { AssistanceRequestId, IsoDateTime, ProgramId } from '../shared/ids';
import { addMoney, ZERO_PESOS, type Money } from '../shared/money';

/**
 * How much a programme has actually been used.
 *
 * Deliberately a **description of the past**, not a budget position and not a
 * ceiling. It counts what was filed and what was handed over; it does not say
 * whether a programme has money left, because this front end does not hold the
 * appropriation and inventing a "remaining balance" from grants alone would be
 * a number the office would be asked to honour (`DL-69`).
 *
 * Nothing here feeds a decision. It answers "is this programme being used, and
 * by whom" for a supervisor deciding where to put attention.
 */
export interface UtilizationInput {
  readonly programId: ProgramId;
  readonly requests: readonly UtilizationRequest[];
  readonly releases: readonly UtilizationRelease[];
  readonly now: IsoDateTime;
}

export interface UtilizationRequest {
  readonly id: AssistanceRequestId;
  readonly programId: ProgramId;
  readonly status: AssistanceRequestStatus;
  readonly requestedAmount: Money | null;
  readonly approvedAmount: Money | null;
  readonly submittedAt: IsoDateTime | null;
}

export interface UtilizationRelease {
  readonly requestId: AssistanceRequestId;
  readonly programId: ProgramId;
  readonly amount: Money;
  readonly releasedAt: IsoDateTime;
}

export interface ProgramUtilization {
  readonly programId: ProgramId;
  /** Filed requests, drafts excluded: a draft is not a request (`DL-63`). */
  readonly filedCount: number;
  readonly openCount: number;
  readonly completedCount: number;
  readonly rejectedCount: number;
  /** What was approved, whether or not it has been released. */
  readonly approvedTotal: Money;
  /** What actually reached somebody. The number a report should quote. */
  readonly releasedTotal: Money;
  readonly releaseCount: number;
  readonly lastFiledAt: IsoDateTime | null;
  readonly lastReleasedAt: IsoDateTime | null;
}

/**
 * Derives the summary. Pure and total: a programme nobody has used yet returns
 * zeros rather than being absent, so a supervisor can see that it is unused
 * rather than wonder whether it is missing.
 */
export function summariseUtilization(input: UtilizationInput): ProgramUtilization {
  const mine = input.requests.filter(
    (request) => request.programId === input.programId && request.status !== 'draft',
  );
  const releases = input.releases.filter((release) => release.programId === input.programId);

  const approvedTotal = mine.reduce(
    (running, request) =>
      request.approvedAmount === null ? running : addMoney(running, request.approvedAmount),
    ZERO_PESOS,
  );

  return {
    programId: input.programId,
    filedCount: mine.length,
    openCount: mine.filter((request) => !isTerminalAssistanceStatus(request.status)).length,
    completedCount: mine.filter((request) => request.status === 'completed').length,
    rejectedCount: mine.filter((request) => request.status === 'rejected').length,
    approvedTotal,
    releasedTotal: releases.reduce(
      (running, release) => addMoney(running, release.amount),
      ZERO_PESOS,
    ),
    releaseCount: releases.length,
    lastFiledAt: latest(mine.map((request) => request.submittedAt)),
    lastReleasedAt: latest(releases.map((release) => release.releasedAt)),
  };
}

/** A programme with no activity at all — worth a supervisor's attention. */
export function isUnused(utilization: ProgramUtilization): boolean {
  return utilization.filedCount === 0;
}

function latest(moments: readonly (IsoDateTime | null)[]): IsoDateTime | null {
  return moments.reduce<IsoDateTime | null>(
    (newest, moment) =>
      moment === null ? newest : newest === null || moment > newest ? moment : newest,
    null,
  );
}
