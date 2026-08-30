import type { AssistanceRequestStatus } from '../assistance/assistance-request';
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

/**
 * What a programme has actually delivered.
 *
 * ## Every figure can be withheld, and none of them can be zero instead
 *
 * `DL-105`: a count of people or households below `SMALL_CELL_THRESHOLD` is **withheld** — never
 * dropped (a missing row reads as "none"), never rounded (that puts an untrue figure in a report),
 * never a zero (an absence of service is the finding). The office record implements exactly that:
 * a suppressed row keeps its programme, nulls its numbers, and says `suppressed: true`.
 *
 * So the figures are nullable and `isWithheld` sits beside them. A non-null `number` could not hold
 * a suppressed cell at all, which is the same defect a non-null `body` had on a withheld note
 * (`DL-158`) — a type that cannot represent the protective case forces a screen to invent one.
 *
 * ## Seven fields were removed, and the screens with them
 *
 * `filedCount`, `openCount`, `completedCount`, `rejectedCount`, `approvedTotal`, `lastFiledAt` and
 * `lastReleasedAt` had **no counterpart anywhere in the office record** (`DL-159`). The mock
 * computed all seven, so the programme screens rendered a full picture that existed only here; the
 * same screens against the API would have shown blanks.
 *
 * `approvedTotal` could not have survived in any case: `L-17` records that the schema holds one
 * amount column anywhere — money actually handed over — so there is no approved total to report.
 *
 * They are filed as an ask rather than kept as fields nothing fills. A programme's open and
 * completed counts are worth having; inventing them in a mock is not the way to get them.
 */
export interface ProgramUtilization {
  readonly programId: ProgramId;
  /** Releases made under this programme. `null` when the cell was too small to report. */
  readonly releaseCount: number | null;
  /** What actually reached somebody. The number a report should quote. */
  readonly releasedTotal: Money | null;
  /** True when the office record withheld the figures rather than reporting them. */
  readonly isWithheld: boolean;
}

/**
 * Derives the summary. Pure and total: a programme nobody has used yet returns zeros rather than
 * being absent, so a supervisor can see that it is unused rather than wonder whether it is missing.
 *
 * `isWithheld` is always `false` here. Suppression is the **office record's** decision — it holds
 * the population and knows when a cell is too small to report — and a client computing it from
 * rows it was already given would be suppressing figures it has in its hands (`DL-105`).
 */
export function summariseUtilization(input: UtilizationInput): ProgramUtilization {
  const releases = input.releases.filter((release) => release.programId === input.programId);

  return {
    programId: input.programId,
    releaseCount: releases.length,
    releasedTotal: releases.reduce(
      (running, release) => addMoney(running, release.amount),
      ZERO_PESOS,
    ),
    isWithheld: false,
  };
}

/**
 * A programme with no activity at all — worth a supervisor's attention.
 *
 * `false` for a withheld cell, and that is the point: a suppressed figure is not a zero. "We are
 * not telling you how many" and "nobody has used this" are different statements about a programme,
 * and the second is the one that gets it closed (`DL-105`).
 */
export function isUnused(utilization: ProgramUtilization): boolean {
  return utilization.releaseCount === 0;
}
