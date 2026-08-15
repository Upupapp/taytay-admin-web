import type { AuditStamp } from '../shared/audit';
import { asIsoDate } from '../shared/ids';
import type { CaseId, CaseTaskId, IsoDate, IsoDateTime, StaffUserId } from '../shared/ids';
import type { StatusCatalog } from '../shared/status';

/**
 * A task is the answer to "what happens next on this case?".
 *
 * It exists so that the next action is a **record**, not an inference. A screen
 * that works out the next step from the status can only ever say what the
 * process expects; a task says what this office actually undertook to do, by
 * when, and who owes it (`DL-55`).
 */
export type CaseTaskKind =
  'home-visit' | 'document' | 'assessment' | 'follow-up' | 'referral' | 'review';

export const CASE_TASK_KINDS: readonly CaseTaskKind[] = [
  'home-visit',
  'document',
  'assessment',
  'follow-up',
  'referral',
  'review',
];

export type CaseTaskStatus = 'open' | 'done' | 'cancelled';

export const CASE_TASK_STATUS_CATALOG: StatusCatalog<CaseTaskStatus> = {
  open: {
    value: 'open',
    label: 'Open',
    tone: 'progress',
    description: 'Still owed. Counts towards the case being on time.',
  },
  done: {
    value: 'done',
    label: 'Done',
    tone: 'success',
    description: 'Completed, with the outcome recorded against a name.',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    tone: 'neutral',
    description: 'No longer required. The reason is kept.',
  },
};

export interface CaseTask {
  readonly id: CaseTaskId;
  readonly caseId: CaseId;
  readonly title: string;
  readonly kind: CaseTaskKind;
  readonly status: CaseTaskStatus;
  readonly dueOn: IsoDate;
  readonly assignedTo: StaffUserId | null;
  readonly completedAt: IsoDateTime | null;
  readonly completedBy: StaffUserId | null;
  /** What happened, in the words of whoever closed it. Null while open. */
  readonly outcome: string | null;
  readonly audit: AuditStamp;
}

export interface CaseTaskDraft {
  readonly title: string;
  readonly kind: CaseTaskKind;
  readonly dueOn: IsoDate;
  readonly assignedTo: StaffUserId | null;
}

export function isTaskOpen(task: CaseTask): boolean {
  return task.status === 'open';
}

/** Whole days from `today` to `dueOn`. Negative when the date has passed. */
export function daysUntil(dueOn: IsoDate, today: IsoDate): number {
  const due = Date.parse(`${dueOn}T00:00:00.000Z`);
  const now = Date.parse(`${today}T00:00:00.000Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) {
    return 0;
  }
  return Math.round((due - now) / 86_400_000);
}

export function isOverdue(task: CaseTask, today: IsoDate): boolean {
  return isTaskOpen(task) && daysUntil(task.dueOn, today) < 0;
}

/**
 * The next action: the open task that falls due soonest.
 *
 * Ties break on the identifier so two workers looking at the same case in the
 * same second are told to do the same thing.
 */
export function nextAction(tasks: readonly CaseTask[]): CaseTask | null {
  const open = tasks.filter(isTaskOpen);
  if (open.length === 0) {
    return null;
  }
  return (
    [...open].sort((a, b) =>
      a.dueOn === b.dueOn ? a.id.localeCompare(b.id) : a.dueOn < b.dueOn ? -1 : 1,
    )[0] ?? null
  );
}

export function openTaskCount(tasks: readonly CaseTask[]): number {
  return tasks.filter(isTaskOpen).length;
}

/** Today, as the domain sees it. Isolated so tests can pass a fixed date. */
export function todayAsIsoDate(now: Date = new Date()): IsoDate {
  return asIsoDate(now.toISOString().slice(0, 10));
}
