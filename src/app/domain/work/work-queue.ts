import type { IsoDate, StaffUserId } from '../shared/ids';
import { compareWork, workUrgency, type WorkItem, type WorkUrgency } from './work-item';

/**
 * A queue is a **view**, not a table.
 *
 * It holds no state of its own and nothing is ever written to it. What it shows
 * is assembled from case tasks and the live state of requests, visits,
 * referrals, releases and duplicate pairs, every time it is asked — which is
 * what makes "what do I owe today?" answerable without a nightly job that is
 * wrong every morning until it runs.
 */

export interface WorkQueue {
  /** Whose queue this is. `null` for a team queue covering several people. */
  readonly ownerId: StaffUserId | null;
  readonly ownerName: string | null;
  readonly items: readonly WorkItem[];
  /** The date the urgencies were computed against. Echoed so a screen cannot drift. */
  readonly asOf: IsoDate;
}

export interface WorkBuckets {
  readonly overdue: readonly WorkItem[];
  readonly dueToday: readonly WorkItem[];
  readonly dueSoon: readonly WorkItem[];
  readonly later: readonly WorkItem[];
  readonly undated: readonly WorkItem[];
}

const EMPTY_BUCKETS: WorkBuckets = {
  overdue: [],
  dueToday: [],
  dueSoon: [],
  later: [],
  undated: [],
};

const BUCKET_OF: Readonly<Record<WorkUrgency, keyof WorkBuckets>> = {
  overdue: 'overdue',
  'due-today': 'dueToday',
  'due-soon': 'dueSoon',
  later: 'later',
  undated: 'undated',
};

/**
 * Groups a queue by when it is owed.
 *
 * Buckets rather than a sortable table because the question is "what is late?",
 * and a late item three pages down a sorted list is a late item nobody saw.
 * Each bucket carries a heading in words, so lateness survives a screen reader,
 * a monochrome printout and a colour-blind reader — colour is never the only
 * carrier.
 */
export function bucketWork(items: readonly WorkItem[], today: IsoDate): WorkBuckets {
  const buckets: Record<keyof WorkBuckets, WorkItem[]> = {
    overdue: [],
    dueToday: [],
    dueSoon: [],
    later: [],
    undated: [],
  };
  for (const item of items) {
    buckets[BUCKET_OF[workUrgency(item, today)]].push(item);
  }
  for (const key of Object.keys(buckets) as (keyof WorkBuckets)[]) {
    buckets[key].sort((a, b) => compareWork(a, b, today));
  }
  return { ...EMPTY_BUCKETS, ...buckets };
}

/**
 * What the queue amounts to, in counts.
 *
 * Counts rather than a verdict, on the same doctrine as a payout session
 * (`DL-90`): "3 late, 2 due today" is a sentence somebody can act on, where
 * "behind schedule" names nothing and hides how much.
 */
export function describeQueue(buckets: WorkBuckets): string {
  const parts: string[] = [];
  if (buckets.overdue.length > 0) {
    parts.push(`${buckets.overdue.length} late`);
  }
  if (buckets.dueToday.length > 0) {
    parts.push(`${buckets.dueToday.length} due today`);
  }
  if (buckets.dueSoon.length > 0) {
    parts.push(`${buckets.dueSoon.length} due this week`);
  }
  const later = buckets.later.length + buckets.undated.length;
  if (later > 0) {
    parts.push(`${later} later`);
  }
  return parts.length === 0 ? 'Nothing owed.' : `${parts.join(', ')}.`;
}

export function totalWork(buckets: WorkBuckets): number {
  return (
    buckets.overdue.length +
    buckets.dueToday.length +
    buckets.dueSoon.length +
    buckets.later.length +
    buckets.undated.length
  );
}

/* ── The team queue ───────────────────────────────────────────────────────── */

/**
 * One person's share of the office's work.
 *
 * A supervisor's question is "who is carrying what, and where is it late?", so
 * a team queue is grouped **by person** rather than pooled. Pooling loses the
 * only thing the view exists to show.
 *
 * Unassigned work is a real column, not an omission: it is the office's most
 * common failure mode — a request nobody picked up, sitting behind an intake
 * date that keeps moving.
 */
export interface TeamMemberLoad {
  /** `null` is the unassigned column. */
  readonly staffId: StaffUserId | null;
  readonly name: string;
  readonly items: readonly WorkItem[];
  readonly overdueCount: number;
  readonly total: number;
}

export interface TeamQueue {
  readonly members: readonly TeamMemberLoad[];
  readonly asOf: IsoDate;
  readonly unassignedCount: number;
}

export function buildTeamQueue(
  items: readonly WorkItem[],
  names: ReadonlyMap<string, string>,
  today: IsoDate,
  unassignedLabel: string,
): TeamQueue {
  const groups = new Map<string, WorkItem[]>();
  for (const item of items) {
    const key = item.assignedTo ?? '';
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, [item]);
    } else {
      existing.push(item);
    }
  }

  const members: TeamMemberLoad[] = [...groups.entries()].map(([key, group]) => ({
    staffId: key === '' ? null : (key as StaffUserId),
    name: key === '' ? unassignedLabel : (names.get(key) ?? key),
    items: [...group].sort((a, b) => compareWork(a, b, today)),
    overdueCount: group.filter((item) => workUrgency(item, today) === 'overdue').length,
    total: group.length,
  }));

  // Whoever is most behind comes first; unassigned sorts last so it reads as a
  // gap rather than as somebody's caseload.
  members.sort((a, b) => {
    if (a.staffId === null) return 1;
    if (b.staffId === null) return -1;
    if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
    if (a.total !== b.total) return b.total - a.total;
    return a.name.localeCompare(b.name);
  });

  return {
    members,
    asOf: today,
    unassignedCount: groups.get('')?.length ?? 0,
  };
}
