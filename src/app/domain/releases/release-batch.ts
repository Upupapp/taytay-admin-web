import type { AuditStamp } from '../shared/audit';
import type {
  ReleaseId,
  IsoDate,
  IsoDateTime,
  ReleaseBatchId,
  StaffUserId,
} from '../shared/ids';
import type { Money } from '../shared/money';
import type { Release, ReleaseStatus } from './release';
import { isReleased, sumReleased } from './release';

/**
 * A payout session: a date, a place, and the releases planned for it.
 *
 * **A batch is a plan, not a unit.** It groups releases so an office can staff a
 * table at the municipal hall on a Tuesday; it does not become the thing that
 * has a status. Each beneficiary keeps their own — the master command is
 * explicit that batch tools must never hide individual status, and the failure
 * it prevents is concrete: a batch marked "released" while three people in it
 * went home empty-handed, with nobody able to say which three (`DL-90`).
 *
 * So there is no `status` field here. What a screen shows about a batch is
 * **derived by counting its releases**, and the counts are what a supervisor
 * reads. A batch cannot claim anything its members do not.
 */

export interface ReleaseBatch {
  readonly id: ReleaseBatchId;
  readonly referenceNumber: string;
  readonly title: string;
  readonly scheduledFor: IsoDate;
  /** Where the payout table will be. Not a coordinate — a place people go. */
  readonly venue: string;
  /** Who is running the table. The releasing officer for the session. */
  readonly officerId: StaffUserId;
  readonly releaseIds: readonly ReleaseId[];
  readonly notes: string | null;
  /** Set when the office closes the session, whatever happened in it. */
  readonly closedAt: IsoDateTime | null;
  readonly audit: AuditStamp;
}

/**
 * What a batch actually amounts to, counted from its members.
 *
 * Deliberately counts rather than a state: "38 of 41 released, 2 deferred, 1
 * needing correction" is a sentence a supervisor can act on. "Partially
 * complete" is not.
 */
export interface BatchProgress {
  readonly total: number;
  readonly released: number;
  readonly acknowledged: number;
  readonly outstanding: number;
  readonly deferred: number;
  readonly needsCorrection: number;
  /** Handed over, not planned. Never the sum of what was scheduled. */
  readonly totalReleased: Money;
}

const DEFERRED: readonly ReleaseStatus[] = ['deferred', 'unclaimed'];

export function batchProgress(releases: readonly Release[]): BatchProgress {
  return {
    total: releases.length,
    released: releases.filter((entry) => isReleased(entry.status)).length,
    acknowledged: releases.filter((entry) => entry.acknowledgedAt !== null).length,
    outstanding: releases.filter(
      (entry) => entry.status === 'for-release' || entry.status === 'scheduled',
    ).length,
    deferred: releases.filter((entry) => DEFERRED.includes(entry.status)).length,
    needsCorrection: releases.filter((entry) => entry.status === 'needs-correction').length,
    totalReleased: sumReleased(releases),
  };
}

/**
 * The sentence a screen puts beside the counts.
 *
 * From the domain rather than a template, so a batch cannot be summarised as
 * "Complete" while somebody in it is still waiting.
 */
export function describeBatch(progress: BatchProgress): string {
  if (progress.total === 0) {
    return 'Nothing scheduled in this batch yet.';
  }
  const parts = [`${progress.released} of ${progress.total} released`];
  if (progress.deferred > 0) {
    parts.push(`${progress.deferred} deferred`);
  }
  if (progress.needsCorrection > 0) {
    parts.push(`${progress.needsCorrection} needing correction`);
  }
  if (progress.outstanding > 0) {
    parts.push(`${progress.outstanding} still to release`);
  }
  return `${parts.join(', ')}.`;
}

/* ── Scheduling into a batch ──────────────────────────────────────────────── */

export interface ReleaseBatchDraft {
  readonly title: string;
  readonly scheduledFor: IsoDate;
  readonly venue: string;
  readonly officerId: StaffUserId;
  readonly releaseIds: readonly ReleaseId[];
  readonly notes: string | null;
}

export type BatchProblem =
  | 'title-required'
  | 'venue-required'
  | 'officer-required'
  | 'scheduled-in-the-past'
  | 'nothing-to-release';

export function batchProblems(
  draft: ReleaseBatchDraft,
  today: IsoDate,
): readonly BatchProblem[] {
  const problems: BatchProblem[] = [];

  if (draft.title.trim().length === 0) {
    problems.push('title-required');
  }
  // A payout with no stated place is one a beneficiary cannot be told to attend.
  if (draft.venue.trim().length === 0) {
    problems.push('venue-required');
  }
  if (draft.officerId.trim().length === 0) {
    problems.push('officer-required');
  }
  if (draft.scheduledFor < today) {
    problems.push('scheduled-in-the-past');
  }
  if (draft.releaseIds.length === 0) {
    problems.push('nothing-to-release');
  }

  return problems;
}
